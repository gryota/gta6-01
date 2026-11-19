// Neon Harbor — world.js
// The simulation: player on foot and behind the wheel, stealing cars,
// collisions and their wanted consequences, melee, the shop, missions,
// busted/respawn, health, the clock and the chase camera. It owns no DOM
// except through the hud module.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Wanted } from './wanted.js';
import { Missions, MISSION_STATUS } from './missions.js';
import { buyItem, useBandage } from './shop.js';
import { storeSave } from './save.js';
import { makePlayerMesh, makeVehicleMesh } from './render.js';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

export function createWorld(deps) {
  const { scene, camera, city, traffic, police, missions, audio, input, hud, storage } = deps;
  const wanted = new Wanted();

  const player = {
    x: 0,
    z: 60,
    heading: 0,
    health: CONFIG.playerHealth,
    money: CONFIG.startingMoney,
    bandages: 0,
    inCar: false,
    car: null,
    speed: 0,
  };
  const playerMesh = makePlayerMesh();
  scene.add(playerMesh);

  let camYaw = 0;
  let camPitch = 0.32;
  let camDist = 10;
  let time = 0;
  let clockHour = CONFIG.clockStartHour;
  let stoleCarEvent = false;
  let crashCooldown = 0;
  let hitCooldown = 0;
  let saveTimer = 0;
  let shopOpen = false;
  let gameOver = false;
  let bestWanted = deps.bestWanted || 0;

  const onBusted = (reason) => {
    if (gameOver) return;
    gameOver = true;
    const fine = Math.min(player.money, CONFIG.bustedFine);
    player.money -= fine;
    player.health = CONFIG.playerHealth;
    wanted.clear();
    police.clearAll();
    if (player.inCar) exitCar();
    player.x = CONFIG.garage.x;
    player.z = CONFIG.garage.z;
    player.heading = Math.PI;
    let missionFailed = false;
    if (missions.status === MISSION_STATUS.ACTIVE) {
      missions.status = MISSION_STATUS.FAILED;
      missionFailed = true;
    }
    audio.busted();
    persistSave();
    deps.onBusted({ fine, reason, missionFailed });
  };

  function persistSave() {
    bestWanted = Math.max(bestWanted, wanted.stars);
    storeSave(storage, {
      money: player.money,
      missionIndex: missions.index,
      bandages: player.bandages,
      bestWanted,
    });
  }

  function pushOutOfBuildings(o, radius) {
    for (const c of city.colliders) {
      const nx = clamp(o.x, c.minX, c.maxX);
      const nz = clamp(o.z, c.minZ, c.maxZ);
      const dx = o.x - nx;
      const dz = o.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 < 0.0001) {
          o.x = c.maxX + radius;
          continue;
        }
        const d = Math.sqrt(d2);
        o.x = nx + (dx / d) * radius;
        o.z = nz + (dz / d) * radius;
        return true;
      }
    }
    return false;
  }

  function damagePlayer(amount, cause) {
    if (gameOver) return;
    player.health -= amount;
    hud.toast(`${cause} -${amount} HP`);
    if (player.health <= 0) {
      player.health = 0;
      onBusted('Health depleted — Rook went down.');
    }
  }

  function enterCar(car) {
    player.inCar = true;
    player.car = car;
    car.speed = 0;
    audio.pickup();
  }

  function exitCar() {
    if (!player.car) return;
    const car = player.car;
    car.speed = 0;
    car.kind = 'parked';
    player.x = car.x + Math.cos(car.heading) * 2.5;
    player.z = car.z - Math.sin(car.heading) * 2.5;
    player.heading = car.heading;
    player.inCar = false;
    player.car = null;
  }

  function tryInteract() {
    if (shopOpen) return;
    // Gry Market first when standing at the stall.
    const shopD = Math.hypot(player.x - CONFIG.shop.x, player.z - CONFIG.shop.z);
    if (!player.inCar && shopD < 6) {
      openShop();
      return;
    }
    if (player.inCar) {
      exitCar();
      return;
    }
    const car = traffic.nearestCar(player.x, player.z, 3.6);
    if (!car) return;
    if (!car.owned) {
      wanted.add(CONFIG.wantedStealCar);
      car.owned = true;
      stoleCarEvent = true;
      hud.toast('Car stolen! Wanted +1 star');
      audio.pickup();
      if (car.kind === 'traffic') traffic.spawnFleeingPed(car.x + 2, car.z + 2);
    }
    car.kind = 'stolen';
    enterCar(car);
  }

  function openShop() {
    shopOpen = true;
    audio.resume();
    hud.openShop(
      { money: player.money, bandages: player.bandages, health: player.health, wantedStars: wanted.stars, nearestPoliceDist: police.nearestDist(player.x, player.z) },
      (itemId) => {
        const state = { money: player.money, bandages: player.bandages, health: player.health, wantedStars: wanted.stars, nearestPoliceDist: police.nearestDist(player.x, player.z) };
        const res = buyItem(itemId, state);
        if (res.ok) {
          player.money = state.money;
          player.bandages = state.bandages;
          player.health = state.health;
          if (res.bribe) wanted.add(-CONFIG.wantedPointsPerStar);
          audio.coin();
          persistSave();
        }
        return res;
      },
      () => {
        shopOpen = false;
      }
    );
  }

  function tryPunch() {
    if (player.inCar || shopOpen) return;
    const hit = police.damageFoot(player.x, player.z, 2.6, 15);
    if (hit) {
      audio.punch();
      if (hit.down) {
        hud.toast('Cop down!');
      } else {
        wanted.add(CONFIG.wantedPunchPolice);
        hud.toast('You hit a cop! Wanted up');
      }
    } else {
      audio.punch();
    }
  }

  function tryBandage() {
    const state = { money: player.money, bandages: player.bandages, health: player.health };
    if (useBandage(state)) {
      player.bandages = state.bandages;
      player.health = state.health;
      hud.toast(`Bandage used. Health ${Math.ceil(player.health)}.`);
      audio.pickup();
      persistSave();
    } else {
      hud.toast(player.bandages <= 0 ? 'No bandages — buy some at Gry Market.' : 'Health already full.');
    }
  }

  function updateFoot(dt, ax) {
    const fwdX = -Math.sin(camYaw);
    const fwdZ = -Math.cos(camYaw);
    const rightX = Math.cos(camYaw);
    const rightZ = -Math.sin(camYaw);
    let mx = fwdX * ax.forward + rightX * ax.strafe;
    let mz = fwdZ * ax.forward + rightZ * ax.strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const speed = ax.run ? CONFIG.runSpeed : CONFIG.walkSpeed;
      player.x += mx * speed * dt;
      player.z += mz * speed * dt;
      player.heading = Math.atan2(-mx, -mz);
      player.speed = speed;
    } else {
      player.speed = 0;
    }
    pushOutOfBuildings(player, CONFIG.playerRadius);
    player.x = clamp(player.x, -CONFIG.worldHalf + 2, CONFIG.worldHalf - 2);
    player.z = clamp(player.z, -CONFIG.worldHalf + 2, CONFIG.worldHalf - 2);
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.heading;
    // A traffic car can run the player down.
    if (hitCooldown <= 0) {
      for (const car of traffic.cars) {
        if (car.kind !== 'traffic') continue;
        if (Math.hypot(car.x - player.x, car.z - player.z) < 2.2 && car.speed > 3) {
          hitCooldown = 1;
          damagePlayer(CONFIG.crashDamage, 'Hit by traffic');
          player.x += (player.x - car.x) * 0.4;
          player.z += (player.z - car.z) * 0.4;
          break;
        }
      }
    }
  }

  function updateCar(dt, ax) {
    const car = player.car;
    if (!car) return;
    const throttle = ax.forward;
    if (throttle > 0) car.speed += CONFIG.carAccel * dt * throttle;
    else if (throttle < 0) {
      car.speed += car.speed > 0.5 ? -CONFIG.carBrake * dt : CONFIG.carAccel * 0.6 * dt * throttle;
    } else {
      car.speed -= car.speed * 0.6 * dt;
    }
    if (ax.handbrake) car.speed -= car.speed * CONFIG.handbrakeFriction * dt;
    car.speed = clamp(car.speed, -CONFIG.carReverseMax, CONFIG.carMaxSpeed);
    if (Math.abs(car.speed) > 0.2) {
      car.heading += ax.strafe * CONFIG.carSteer * (car.speed / CONFIG.carMaxSpeed) * dt * Math.sign(car.speed) * 2.2;
    }
    const nx = car.x + -Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + -Math.cos(car.heading) * car.speed * dt;
    const before = { x: car.x, z: car.z };
    car.x = nx;
    car.z = nz;
    const hitWall = pushOutOfBuildings(car, CONFIG.carRadius);
    if (hitWall) {
      if (Math.abs(car.speed) > 12 && crashCooldown <= 0) {
        crashCooldown = 1;
        damagePlayer(CONFIG.crashDamage, 'Crash');
        audio.crash();
      }
      car.speed *= 0.4;
    }
    car.x = clamp(car.x, -CONFIG.worldHalf + 2, CONFIG.worldHalf - 2);
    car.z = clamp(car.z, -CONFIG.worldHalf + 2, CONFIG.worldHalf - 2);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    player.speed = Math.abs(car.speed);

    // Run over a pedestrian.
    if (Math.abs(car.speed) > 5) {
      const ped = traffic.knockPedAt(car.x, car.z, 2.2);
      if (ped) {
        wanted.add(CONFIG.wantedHitPedestrian);
        hud.toast('Pedestrian down! Wanted up');
        audio.crash();
      }
    }
    // Bump other cars.
    if (crashCooldown <= 0) {
      for (const other of [...traffic.cars, ...police.cars]) {
        if (other === car) continue;
        const d = Math.hypot(other.x - car.x, other.z - car.z);
        if (d < 3.4 && Math.abs(car.speed) > 6) {
          crashCooldown = 1;
          const isPolice = police.cars.includes(other);
          wanted.add(isPolice ? CONFIG.wantedHitPoliceCar : CONFIG.wantedHitCar);
          damagePlayer(CONFIG.crashDamage, isPolice ? 'Hit a police car' : 'Traffic collision');
          audio.crash();
          car.speed *= 0.5;
          if (other.kind === 'traffic') other.s += 6;
          break;
        }
      }
    }
  }

  function updateCamera(dt) {
    const look = input.consumeLook();
    camYaw -= look.dx * 0.005;
    camPitch = clamp(camPitch + look.dy * 0.003, 0.08, 1.1);
    if (look.wheel !== 0) camDist = clamp(camDist + look.wheel * 0.01, 6, 18);
    if (player.inCar && player.car) {
      camYaw = angleLerp(camYaw, player.car.heading, 1 - Math.pow(0.02, dt));
    }
    const targetX = player.x;
    const targetZ = player.z;
    const dist = player.inCar ? camDist + 3 : camDist;
    const height = 2 + Math.sin(camPitch) * dist * 0.55;
    const cx = targetX + Math.sin(camYaw) * Math.cos(camPitch) * dist;
    const cz = targetZ + Math.cos(camYaw) * Math.cos(camPitch) * dist;
    camera.position.set(cx, height, cz);
    camera.lookAt(targetX, 1.6, targetZ);
  }

  function update(dt) {
    if (gameOver) {
      updateCamera(dt);
      return;
    }
    if (shopOpen) {
      // E or Esc closes the shop menu.
      if (input.consumeAction('pause') || input.consumeAction('interact')) hud.closeShop();
      updateCamera(dt);
      return;
    }
    time += dt;
    clockHour = (clockHour + dt * CONFIG.clockHoursPerRealSec) % 24;
    crashCooldown -= dt;
    hitCooldown -= dt;

    const ax = input.axis();
    if (input.consumeAction('interact')) tryInteract();
    if (input.consumeAction('punch')) tryPunch();
    if (input.consumeAction('bandage')) tryBandage();
    if (input.consumeAction('mute')) {
      audio.setMuted(!audio.isMuted());
      hud.toast(audio.isMuted() ? 'Sound off' : 'Sound on');
    }

    if (player.inCar) updateCar(dt, ax);
    else updateFoot(dt, ax);

    // Police + wanted.
    const nearestPolice = police.nearestDist(player.x, player.z);
    police.update({
      x: player.x,
      z: player.z,
      inCar: player.inCar,
      wantedStars: wanted.stars,
      dt,
      onRam: (dmg) => {
        damagePlayer(dmg, 'Ram by police');
        audio.crash();
      },
      onPunch: (dmg) => damagePlayer(dmg, 'Cop punch'),
      onBusted: () => onBusted('Surrounded by police — BUSTED.'),
    });
    wanted.update(dt, police.nearestDist(player.x, player.z));

    // Health regen only while clean.
    if (wanted.stars === 0 && player.health < 100) {
      player.health = Math.min(100, player.health + CONFIG.healthRegenPerSec * dt);
    }

    // Missions.
    if (missions.status === MISSION_STATUS.ACTIVE) {
      const events = missions.update({ x: player.x, z: player.z, stoleCar: stoleCarEvent, wantedStars: wanted.stars, dt });
      for (const ev of events) {
        if (ev.kind === 'step') {
          hud.toast(ev.text);
          audio.pickup();
        } else if (ev.kind === 'passed') {
          player.money += ev.reward;
          audio.missionPass();
          persistSave();
          deps.onMissionPassed({ title: missions.def.title, reward: ev.reward });
        } else if (ev.kind === 'failed') {
          audio.busted();
          deps.onMissionFailed({ reason: ev.reason });
        }
      }
    }
    stoleCarEvent = false;

    // Beacon follows the current objective.
    const marker = missions.markerPos();
    if (marker) {
      city.beacon.visible = true;
      city.beacon.position.set(marker.x, 0, marker.z);
      city.beacon.children[1].position.y = 9 + Math.sin(time * 2.5) * 0.6;
    } else {
      city.beacon.visible = false;
    }

    // Audio follows the chase.
    audio.setEngine(player.inCar ? Math.abs(player.speed) / CONFIG.carMaxSpeed : 0, player.inCar);
    audio.setSiren(wanted.stars > 0);

    // Autosave now and then.
    saveTimer += dt;
    if (saveTimer > 10) {
      saveTimer = 0;
      persistSave();
    }

    updateCamera(dt);
  }

  function hudState() {
    return {
      playerX: player.x,
      playerZ: player.z,
      heading: player.heading,
      health: player.health,
      money: player.money,
      stars: wanted.stars,
      speed: player.inCar ? Math.abs(player.speed) * 3.6 : 0,
      driving: player.inCar,
      bandages: player.bandages,
      clockHour,
      marker: missions.markerPos(),
      cars: [...traffic.cars.filter((c) => c.kind === 'traffic' || c.kind === 'parked'), ...police.cars.map((c) => ({ ...c, kind: 'police' }))],
      footPolice: police.foot,
    };
  }

  function applySave(save) {
    player.money = save.money;
    player.bandages = save.bandages;
    missions.index = save.missionIndex;
    bestWanted = save.bestWanted;
  }

  function resetRun() {
    gameOver = false;
    player.x = 0;
    player.z = 60;
    player.heading = 0;
    player.health = CONFIG.playerHealth;
    player.inCar = false;
    player.car = null;
    player.speed = 0;
    wanted.clear();
    police.clearAll();
    camYaw = 0;
    camPitch = 0.32;
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.heading;
  }

  function setShotPose(pose) {
    resetRun();
    player.x = pose.x;
    player.z = pose.z;
    player.heading = pose.heading;
    camYaw = pose.camYaw;
    camPitch = pose.camPitch;
    camDist = pose.camDist;
    if (pose.wanted) wanted.setPoints(pose.wanted);
    if (pose.missionIndex !== undefined) {
      missions.index = pose.missionIndex;
      missions.start();
      missions.begin();
    }
    if (pose.inCar && pose.carIndex !== undefined) {
      const car = traffic.cars[pose.carIndex];
      if (car) {
        car.kind = 'stolen';
        car.owned = true;
        car.x = pose.x;
        car.z = pose.z;
        car.heading = pose.heading;
        // Bright hero car so the shot reads at a glance.
        scene.remove(car.mesh);
        car.mesh = makeVehicleMesh(0xd8a03a);
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = pose.heading;
        scene.add(car.mesh);
        enterCar(car);
      }
    }
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.heading;
    updateCamera(0.016);
  }

  return {
    player,
    wanted,
    missions,
    update,
    hudState,
    applySave,
    resetRun,
    setShotPose,
    persistSave,
    get shopOpen() {
      return shopOpen;
    },
    get time() {
      return time;
    },
    setGameOver(v) {
      gameOver = v;
    },
    resumeFromBusted() {
      gameOver = false;
    },
  };
}
