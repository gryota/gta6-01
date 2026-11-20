// Neon Harbor — world.js
// The simulation: one step advances the player (on foot or driving), the
// traffic, the police, the wanted heat, the missions and the shop. It owns
// the three.js meshes for every moving thing and hands the HUD a snapshot.
// Events come back as a list each step: the main loop plays sounds and
// shows banners from them.

import * as THREE from 'three';
import {
  STEP, PLAYER_SPAWN, GARAGE, HIDEOUT, SHOP_POS,
  WALK_SPEED, RUN_SPEED, CAR_TOP_SPEED, CAR_ACCEL, CAR_BRAKE, CAR_STEER,
  HEALTH_MAX, DAMAGE_CRASH, BUSTED_FINE, REGEN_PER_SEC,
  POINTS_STEAL, POINTS_HIT_PEDESTRIAN, POINTS_HIT_CAR, POINTS_HIT_POLICE_CAR,
  POINTS_PUNCH_POLICE, SHOP_INTERACT_RADIUS, SAVE_KEY,
} from './config.js';
import { createRandom } from './random.js';
import { buildCity, resolveCollisions, randomStreetPoint } from './city.js';
import { createTraffic, stepTraffic, knockPedestrian } from './traffic.js';
import { createPolice, stepPolice, policeNear, clearPolice } from './police.js';
import { createWanted, addWanted, setWanted, decayWanted, stealPoints } from './wanted.js';
import { createMissions, missionSteps, currentStep, startMission, beginActive, advanceStep, tickMission, nextMission, missionReward, missionName } from './missions.js';
import { decodeSave, encodeSave } from './save.js';
import { buyItem, useBandage } from './shop.js';
import { buildCarMesh, buildPersonMesh } from './render.js';

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function createWorld(scene, seed, saveRaw) {
  const city = buildCity(scene, seed);
  const traffic = createTraffic(seed);
  const police = createPolice(seed);
  const wanted = createWanted();
  const missions = createMissions();
  const save = decodeSave(saveRaw);
  const rng = createRandom(seed + 707);

  const player = {
    x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z, heading: PLAYER_SPAWN.heading,
    speed: 0, health: HEALTH_MAX, money: save.money, bandages: save.bandages,
    inCar: false, car: null, camYaw: Math.PI, camPitch: 0.32,
  };
  missions.index = save.missionIndex;
  let bestWanted = save.bestWanted;

  // Parked cars: easy first steals near the spawn, the garage and the docks.
  const parkedSpots = [
    { x: 6, z: 52 }, { x: 58, z: 92 }, { x: -170, z: -14 },
  ];
  for (const spot of parkedSpots) {
    traffic.cars.push({
      id: `parked-${traffic.cars.length}`,
      kind: 'parked', x: spot.x, z: spot.z, axis: 'z', line: spot.x,
      dir: 1, speed: 0, color: 0xc23b3b, heading: 0, stopped: true, owned: false,
    });
  }

  // Meshes for every moving thing.
  const personMesh = buildPersonMesh(0x3b6fc2);
  scene.add(personMesh);
  for (const car of traffic.cars) {
    car.mesh = buildCarMesh(car.color, false);
    scene.add(car.mesh);
  }
  for (const ped of traffic.pedestrians) {
    ped.mesh = buildPersonMesh(ped.color);
    scene.add(ped.mesh);
  }

  let elapsed = 0;
  let hitCooldown = 0;
  let shopOpen = false;
  let screen = 'title';

  function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, encodeSave({
        money: player.money, missionIndex: missions.index,
        bandages: player.bandages, bestWanted,
      }));
    } catch { /* storage off: the session still plays */ }
  }

  function syncMeshes() {
    personMesh.visible = !player.inCar;
    if (!player.inCar) {
      personMesh.position.set(player.x, 0, player.z);
      personMesh.rotation.y = player.heading;
    }
    for (const car of traffic.cars) {
      if (!car.mesh) continue;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
    // The player's car left the traffic list when stolen — sync it too.
    if (player.inCar && player.car && player.car.mesh) {
      player.car.mesh.position.set(player.car.x, 0, player.car.z);
      player.car.mesh.rotation.y = player.car.heading;
    }
    for (const car of police.cars) {
      if (!car.mesh) continue;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
    for (const ped of traffic.pedestrians) {
      if (!ped.mesh) continue;
      ped.mesh.visible = !ped.down;
      ped.mesh.position.set(ped.x, ped.down ? 0.4 : 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      if (ped.down) ped.mesh.rotation.x = Math.PI / 2;
      else ped.mesh.rotation.x = 0;
    }
    for (const cop of police.foot) {
      if (!cop.mesh) continue;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
    }
    // Mission beacon over the current target.
    const step = currentStep(missions);
    if (missions.phase === 'ACTIVE' && step && step.pos) {
      city.beacon.visible = true;
      city.beacon.position.set(step.pos.x, 17, step.pos.z);
    } else {
      city.beacon.visible = false;
    }
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of traffic.cars) {
      const d = dist2(player.x, player.z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar(events) {
    const car = nearestCar(4.5);
    if (!car) return;
    // Stealing is +100 heat; getting back into your own stolen car is free.
    addWanted(wanted, stealPoints(car.owned));
    if (!car.owned) events.push({ type: 'steal' });
    // A stolen traffic car leaves the traffic flow and becomes the player's.
    const idx = traffic.cars.indexOf(car);
    if (idx >= 0) traffic.cars.splice(idx, 1);
    car.owned = true;
    car.speed = 0;
    player.car = car;
    player.inCar = true;
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
  }

  function exitCar() {
    if (!player.car) return;
    const car = player.car;
    player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 3;
    player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 3;
    player.heading = car.heading;
    player.inCar = false;
    player.car = null;
    car.speed = 0;
    // The car stays parked where it was left, still the player's.
    traffic.cars.push(car);
  }

  function bust(events, reason) {
    const fine = Math.min(player.money, BUSTED_FINE);
    player.money -= fine;
    player.health = HEALTH_MAX;
    setWanted(wanted, 0);
    clearPolice(police);
    if (player.car) {
      // The car is impounded: it goes back to traffic as a plain parked car.
      const car = player.car;
      car.owned = false;
      car.speed = 0;
      traffic.cars.push(car);
      player.car = null;
    }
    player.inCar = false;
    player.x = GARAGE.x;
    player.z = GARAGE.z;
    player.heading = 0;
    // The active mission fails and restarts from its briefing.
    if (missions.phase === 'ACTIVE' || missions.phase === 'BRIEFING') {
      missions.phase = 'FAILED';
      missions.failedReason = reason;
      nextMission(missions);
      startMission(missions, missions.index);
      events.push({ type: 'mission-failed', reason });
    }
    saveGame();
    events.push({ type: 'busted', fine });
  }

  function step(input, dt) {
    const events = [];
    elapsed += dt;
    if (hitCooldown > 0) hitCooldown -= dt;
    if (screen !== 'play') {
      syncMeshes();
      return events;
    }

    // --- camera yaw from the mouse drag ----------------------------------
    player.camYaw -= input.camDX * 0.005;
    player.camPitch = Math.max(0.08, Math.min(0.9, player.camPitch + input.camDY * 0.003));

    // --- shop --------------------------------------------------------------
    if (input.enterPressed && !player.inCar && !shopOpen) {
      const dShop = Math.hypot(player.x - SHOP_POS.x, player.z - SHOP_POS.z);
      if (dShop < SHOP_INTERACT_RADIUS) {
        shopOpen = true;
        events.push({ type: 'shop-open' });
      }
    }

    // --- player --------------------------------------------------------------
    if (player.inCar && player.car) {
      const car = player.car;
      if (input.ay > 0) car.speed = Math.min(CAR_TOP_SPEED, car.speed + CAR_ACCEL * dt);
      else if (input.ay < 0) car.speed = Math.max(-8, car.speed - CAR_BRAKE * dt);
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
      if (input.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 30 * dt);
      const steer = input.ax * CAR_STEER * Math.min(1, Math.abs(car.speed) / 8);
      car.heading += steer * Math.sign(car.speed || 1) * dt * (car.speed >= 0 ? 1 : -1);
      car.x += -Math.sin(car.heading) * car.speed * dt;
      car.z += -Math.cos(car.heading) * car.speed * dt;
      car.x = Math.max(-MAP_HALF_LIMIT(), Math.min(MAP_HALF_LIMIT(), car.x));
      car.z = Math.max(-MAP_HALF_LIMIT(), Math.min(MAP_HALF_LIMIT(), car.z));
      resolveCollisions(city.colliders, car, 2.2);
      player.x = car.x;
      player.z = car.z;
      player.heading = car.heading;
      player.speed = car.speed;
      // Chase camera follows behind the car.
      const targetYaw = car.heading + Math.PI;
      let diff = targetYaw - player.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      player.camYaw += diff * Math.min(1, 2.2 * dt);
    } else {
      const speed = input.run ? RUN_SPEED : WALK_SPEED;
      const sin = Math.sin(player.camYaw);
      const cos = Math.cos(player.camYaw);
      // Input ay forward is away from the camera; ax strafes right.
      const mx = -sin * input.ay + cos * input.ax;
      const mz = -cos * input.ay - sin * input.ax;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        player.x += (mx / len) * speed * dt;
        player.z += (mz / len) * speed * dt;
        player.heading = Math.atan2(mx, -mz);
      }
      player.x = Math.max(-MAP_HALF_LIMIT(), Math.min(MAP_HALF_LIMIT(), player.x));
      player.z = Math.max(-MAP_HALF_LIMIT(), Math.min(MAP_HALF_LIMIT(), player.z));
      resolveCollisions(city.colliders, player, 0.6);
      player.speed = len > 0.01 ? speed : 0;
    }

    // --- enter / exit car -----------------------------------------------------
    if (input.enterPressed && !shopOpen) {
      if (player.inCar) exitCar();
      else enterCar(events);
    }

    // --- punch ------------------------------------------------------------------
    if (input.punchPressed && !player.inCar) {
      let hit = false;
      for (const cop of police.foot) {
        if (dist2(player.x, player.z, cop.x, cop.z) < 2.2 * 2.2) {
          addWanted(wanted, POINTS_PUNCH_POLICE);
          cop.x += Math.sin(cop.heading) * -4;
          cop.z += Math.cos(cop.heading) * -4;
          hit = true;
          events.push({ type: 'punch' });
          break;
        }
      }
      if (!hit) events.push({ type: 'swing' });
    }

    // --- heal ---------------------------------------------------------------------
    if (input.healPressed) {
      const res = useBandage(player);
      if (res.ok) events.push({ type: 'heal' });
    }

    // --- traffic + collisions -------------------------------------------------------
    stepTraffic(traffic, dt);
    if (player.inCar && player.car && hitCooldown <= 0) {
      const car = player.car;
      for (const other of traffic.cars) {
        if (other === car) continue;
        if (dist2(car.x, car.z, other.x, other.z) < 3.4 * 3.4) {
          addWanted(wanted, other.kind === 'police' ? POINTS_HIT_POLICE_CAR : POINTS_HIT_CAR);
          player.health = Math.max(0, player.health - DAMAGE_CRASH);
          car.speed *= 0.4;
          hitCooldown = 1;
          events.push({ type: 'crash' });
          break;
        }
      }
      for (const ped of traffic.pedestrians) {
        if (!ped.down && dist2(car.x, car.z, ped.x, ped.z) < 2.6 * 2.6) {
          addWanted(wanted, POINTS_HIT_PEDESTRIAN);
          knockPedestrian(ped);
          events.push({ type: 'hit-ped' });
          break;
        }
      }
    }
    if (!player.inCar && hitCooldown <= 0) {
      for (const ped of traffic.pedestrians) {
        if (!ped.down && dist2(player.x, player.z, ped.x, ped.z) < 1.2 * 1.2) {
          addWanted(wanted, POINTS_HIT_PEDESTRIAN);
          knockPedestrian(ped);
          hitCooldown = 1;
          events.push({ type: 'hit-ped' });
          break;
        }
      }
    }

    // --- police ---------------------------------------------------------------------
    const carsBefore = [...police.cars];
    const policeEvents = stepPolice(police, dt, player, wanted.stars, player.inCar);
    // Meshes for newly spawned police cars / foot police.
    for (const car of police.cars) {
      if (!car.mesh) {
        car.mesh = buildCarMesh(car.color, true);
        scene.add(car.mesh);
      }
    }
    for (const cop of police.foot) {
      if (!cop.mesh) {
        cop.mesh = buildPersonMesh(0x1c2f4a);
        scene.add(cop.mesh);
      }
    }
    // Despawned police cars: drop their meshes from the scene.
    for (const car of carsBefore) {
      if (!police.cars.includes(car) && car.mesh) {
        scene.remove(car.mesh);
        car.mesh.geometry.dispose();
        car.mesh = null;
      }
    }
    for (const ev of policeEvents) {
      if (ev.type === 'ram') {
        player.health = Math.max(0, player.health - ev.damage);
        events.push({ type: 'crash' });
      } else if (ev.type === 'punch') {
        player.health = Math.max(0, player.health - ev.damage);
        events.push({ type: 'punch-hit' });
      } else if (ev.type === 'busted') {
        bust(events, 'Surrounded by the harbor police.');
      }
    }

    // --- wanted decay + regen ---------------------------------------------------------
    const near = policeNear(police, player, 45);
    decayWanted(wanted, dt, near);
    if (wanted.stars === 0 && player.health < HEALTH_MAX) {
      player.health = Math.min(HEALTH_MAX, player.health + REGEN_PER_SEC * dt);
    }
    if (wanted.stars > bestWanted) bestWanted = wanted.stars;

    // --- missions ---------------------------------------------------------------------
    const failed = tickMission(missions, dt, wanted.stars);
    if (failed === 'FAILED') {
      events.push({ type: 'mission-failed', reason: missions.failedReason });
      nextMission(missions);
      startMission(missions, missions.index);
      events.push({ type: 'briefing', index: missions.index });
    } else if (missions.phase === 'ACTIVE') {
      const step = currentStep(missions);
      if (step) {
        if (step.kind === 'steal' && player.inCar) {
          const res = advanceStep(missions, wanted.stars);
          if (res === 'PASSED') finishMission(events);
        } else if (step.kind === 'goto' && step.pos) {
          if (dist2(player.x, player.z, step.pos.x, step.pos.z) < step.radius * step.radius) {
            const res = advanceStep(missions, wanted.stars);
            if (res === 'PASSED') finishMission(events);
            else if (res === 'NEXT') events.push({ type: 'step' });
          }
        }
      }
    }

    // --- busted by health ---------------------------------------------------------------
    if (player.health <= 0) {
      bust(events, 'Beaten down by the harbor police.');
    }

    syncMeshes();
    return events;
  }

  function finishMission(events) {
    const reward = missionReward(missions.index);
    player.money += reward;
    events.push({ type: 'mission-passed', reward, next: missions.index + 1 < 4 ? missionName(missions.index + 1) : '' });
    nextMission(missions);
    saveGame();
    if (missions.index < 4) {
      startMission(missions, missions.index);
      events.push({ type: 'briefing', index: missions.index });
    }
  }

  function MAP_HALF_LIMIT() {
    return 208;
  }

  return {
    player,
    wanted,
    missions,
    police,
    traffic,
    city,
    screen,
    setScreen(value) { screen = value; },
    isShopOpen() { return shopOpen; },
    closeShop() { shopOpen = false; },
    openShop() { shopOpen = true; },
    buyShopItem(itemId) {
      const near = policeNear(police, player, 30);
      const res = buyItem(player, itemId, near);
      if (res.ok) saveGame();
      return res;
    },
    startNewGame() {
      player.money = 0;
      player.bandages = 0;
      player.health = HEALTH_MAX;
      setWanted(wanted, 0);
      clearPolice(police);
      missions.index = 0;
      startMission(missions, 0);
      player.x = PLAYER_SPAWN.x;
      player.z = PLAYER_SPAWN.z;
      player.heading = PLAYER_SPAWN.heading;
      player.inCar = false;
      player.car = null;
      saveGame();
    },
    continueGame() {
      player.health = HEALTH_MAX;
      setWanted(wanted, 0);
      clearPolice(police);
      player.x = PLAYER_SPAWN.x;
      player.z = PLAYER_SPAWN.z;
      player.heading = PLAYER_SPAWN.heading;
      player.inCar = false;
      player.car = null;
      startMission(missions, missions.index);
    },
    beginBriefing() { beginActive(missions); },
    step,
    snapshot() {
      const step = currentStep(missions);
      return {
        health: player.health,
        money: player.money,
        bandages: player.bandages,
        wantedStars: wanted.stars,
        clockHours: 18 + (elapsed % 720) / 30,
        speed: Math.abs(player.speed),
        inCar: player.inCar,
        objective: missions.phase === 'ACTIVE' && step ? step.text : missions.phase === 'BRIEFING' ? 'Read the briefing' : missions.index >= 4 ? 'Story complete — free roam' : '',
        missionTimer: missions.phase === 'ACTIVE' ? missions.timer : 0,
        missionTarget: missions.phase === 'ACTIVE' && step && step.pos ? step.pos : null,
        player: { x: player.x, z: player.z, heading: player.heading },
        trafficCars: traffic.cars.map((c) => ({ x: c.x, z: c.z })),
        policeCars: police.cars.map((c) => ({ x: c.x, z: c.z })),
        policeFoot: police.foot.map((c) => ({ x: c.x, z: c.z })),
      };
    },
    // Diagnostics for the screenshot poses: the beacon and mission state.
    debugState() {
      return {
        beaconVisible: city.beacon.visible,
        beaconPos: { x: city.beacon.position.x, y: city.beacon.position.y, z: city.beacon.position.z },
        missionPhase: missions.phase,
        missionIndex: missions.index,
        missionStep: missions.step,
        playerPos: { x: player.x, z: player.z },
        wantedStars: wanted.stars,
      };
    },
    // Place the world for a screenshot pose (shots.js calls this).
    setShotPose(pose) {
      player.x = pose.x;
      player.z = pose.z;
      player.heading = pose.heading;
      player.camYaw = pose.camYaw;
      player.camPitch = pose.camPitch;
      setWanted(wanted, pose.wanted || 0);
      if (pose.inCar) {
        const car = traffic.cars[pose.carIndex % traffic.cars.length] || traffic.cars[0];
        const idx = traffic.cars.indexOf(car);
        if (idx >= 0) traffic.cars.splice(idx, 1);
        car.owned = true;
        car.x = pose.x;
        car.z = pose.z;
        car.heading = pose.heading;
        car.speed = 0;
        player.car = car;
        player.inCar = true;
      }
      if (pose.missionIndex !== undefined && pose.missionIndex !== null) {
        missions.index = pose.missionIndex;
        startMission(missions, pose.missionIndex);
        beginActive(missions);
      }
      // Chase pose: three police cars closing in at fixed offsets.
      if ((pose.wanted || 0) >= 300) {
        clearPolice(police);
        const offsets = [[-8, -14], [10, -10], [-4, 12]];
        for (const [ox, oz] of offsets) {
          const car = {
            id: `shot-police-${ox}`, kind: 'police',
            x: pose.x + ox, z: pose.z + oz, heading: pose.heading,
            speed: 0, color: 0x1c2f4a, owned: false,
            mesh: buildCarMesh(0x1c2f4a, true),
          };
          scene.add(car.mesh);
          police.cars.push(car);
        }
      }
    },
  };
}
