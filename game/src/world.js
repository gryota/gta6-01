// Neon Harbor's rules and state, with no drawing and no browser in it. step() advances
// one fixed step from a controls object and records what happened as messages and
// sounds, so the caller can react without the world knowing about screens or audio.
import {
  BUSTED_FINE, CAR, CITY_HALF, MISSIONS, PARKED_COUNT, PED_COUNT, PLAYER,
  ROADS, SAFEHOUSE, TRAFFIC_COUNT, WANTED,
} from './config.js';

export const EVENT_MISSION = 1;
export const EVENT_BUSTED = 2;

const CAR_COLORS = [0xc23b3b, 0x3b7ac2, 0x3bc25e, 0xc2a23b, 0x8b5ec2, 0xd0d0d0, 0x222226, 0xc26a3b];
const PED_SHIRTS = [0xe8e8e8, 0x3bc2a2, 0xc23b7a, 0x7a9ac2, 0xd8c23b, 0x5ec23b];

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist2(ax, az, bx, bz) { const dx = ax - bx; const dz = az - bz; return dx * dx + dz * dz; }
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + clamp(d, -t, t);
}

export function createWorld(random, layout) {
  const colliders = layout.colliders;
  let carId = 1;

  const player = {
    x: SAFEHOUSE.x, z: SAFEHOUSE.z, heading: 0, health: PLAYER.health,
    money: 50, onFoot: true, walkPhase: 0, punchTimer: 0, invuln: 0,
  };
  const state = {
    player,
    playerCar: null,
    cars: [],
    peds: [],
    wanted: 0,
    stars: 0,
    clockMin: 18 * 60 + 30,
    time: 0,
    camYaw: Math.PI,
    camPitch: 0.42,
    missionIndex: 0,
    missionStage: 0,
    missionTimer: 0,
    missionDone: false,
    passenger: false,
    busted: false,
    bustedTimer: 0,
    crimeCooldown: 0,
    policeTimer: 0,
    copTimer: 0,
    bestWanted: 0,
    bestMoney: 50,
    messages: [],
    sounds: [],
  };

  function msg(text) { state.messages.push(text); }
  function sound(name) { state.sounds.push(name); }

  function makeCar(x, z, heading, kind, color) {
    const car = {
      id: carId++, x, z, heading, speed: 0, kind, color,
      owned: false,
      driver: kind === 'traffic',
      node: null, prev: null, cruise: 9 + random() * 4,
      hitCooldown: 0, stuck: 0,
    };
    return car;
  }

  function nearestRoadCoord(v) {
    let best = ROADS[0];
    for (const r of ROADS) if (Math.abs(v - r) < Math.abs(v - best)) best = r;
    return best;
  }

  function randomRoadPoint() {
    const vertical = random() < 0.5;
    const road = ROADS[Math.floor(random() * ROADS.length)];
    const along = -200 + random() * 400;
    return vertical ? { x: road, z: along } : { x: along, z: road };
  }

  function spawnTrafficCar(near) {
    let point = randomRoadPoint();
    if (near) {
      for (let tries = 0; tries < 8; tries += 1) {
        const p = randomRoadPoint();
        if (dist2(p.x, p.z, player.x, player.z) < 130 * 130 && dist2(p.x, p.z, player.x, player.z) > 40 * 40) {
          point = p;
          break;
        }
      }
    }
    const car = makeCar(point.x, point.z, random() * Math.PI * 2, 'traffic',
      CAR_COLORS[Math.floor(random() * CAR_COLORS.length)]);
    pickNextNode(car);
    state.cars.push(car);
    return car;
  }

  function pickNextNode(car) {
    const nx = nearestRoadCoord(car.x);
    const nz = nearestRoadCoord(car.z);
    const node = { x: nx, z: nz };
    const neighbors = [];
    for (const r of ROADS) {
      if (r !== nx) neighbors.push({ x: r, z: nz });
      if (r !== nz) neighbors.push({ x: nx, z: r });
    }
    // Neighbours must share a road with the current node: same x or same z, adjacent only.
    const adjacent = neighbors.filter((n) => {
      if (n.x === nx && Math.abs(n.z - nz) === 80) return true;
      if (n.z === nz && Math.abs(n.x - nx) === 80) return true;
      return false;
    });
    const options = adjacent.filter((n) => !(car.prev && n.x === car.prev.x && n.z === car.prev.z));
    const next = (options.length ? options : adjacent)[Math.floor(random() * (options.length ? options.length : adjacent.length))];
    car.prev = node;
    car.node = next;
  }

  function spawnPed(near) {
    const vertical = random() < 0.5;
    const road = ROADS[Math.floor(random() * ROADS.length)];
    const side = random() < 0.5 ? -1 : 1;
    const along = -200 + random() * 400;
    const ped = {
      x: vertical ? road + side * 8.6 : along,
      z: vertical ? along : road + side * 8.6,
      heading: random() * Math.PI * 2,
      speed: 1.1 + random() * 0.9,
      kind: 'walker',
      color: PED_SHIRTS[Math.floor(random() * PED_SHIRTS.length)],
      tx: 0, tz: 0, hp: 50, down: 0, flee: 0, walkPhase: random() * 6,
    };
    pickPedTarget(ped);
    state.peds.push(ped);
    return ped;
  }

  function pickPedTarget(ped) {
    const vertical = random() < 0.5;
    const road = ROADS[Math.floor(random() * ROADS.length)];
    const side = random() < 0.5 ? -1 : 1;
    const along = -200 + random() * 400;
    ped.tx = vertical ? road + side * 8.6 : along;
    ped.tz = vertical ? along : road + side * 8.6;
  }

  /** Push a circle out of building colliders and the city bounds; returns true on a hit. */
  function collideCircle(obj, radius) {
    let hit = false;
    for (const c of colliders) {
      const cx = clamp(obj.x, c.minX, c.maxX);
      const cz = clamp(obj.z, c.minZ, c.maxZ);
      const dx = obj.x - cx;
      const dz = obj.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          obj.x = cx + (dx / d) * radius;
          obj.z = cz + (dz / d) * radius;
        } else {
          // Centre inside the box: push out along the smallest penetration axis.
          const pushL = obj.x - c.minX + radius;
          const pushR = c.maxX - obj.x + radius;
          const pushU = obj.z - c.minZ + radius;
          const pushD = c.maxZ - obj.z + radius;
          const min = Math.min(pushL, pushR, pushU, pushD);
          if (min === pushL) obj.x = c.minX - radius;
          else if (min === pushR) obj.x = c.maxX + radius;
          else if (min === pushU) obj.z = c.minZ - radius;
          else obj.z = c.maxZ + radius;
        }
      }
    }
    if (obj.x < -CITY_HALF) { obj.x = -CITY_HALF; hit = true; }
    if (obj.x > 232) { obj.x = 232; hit = true; }
    if (obj.z < -CITY_HALF) { obj.z = -CITY_HALF; hit = true; }
    if (obj.z > CITY_HALF) { obj.z = CITY_HALF; hit = true; }
    return hit;
  }

  function addWanted(points) {
    state.wanted = clamp(state.wanted + points, 0, WANTED.maxPoints);
    state.crimeCooldown = 5;
  }

  function currentMission() {
    return state.missionDone ? null : MISSIONS[state.missionIndex];
  }

  function currentStage() {
    const m = currentMission();
    return m ? m.stages[state.missionStage] : null;
  }

  function objectiveText() {
    const m = currentMission();
    if (!m) return 'Free roam — Neon Harbor is yours. Earn cash, dodge the law.';
    const stage = m.stages[state.missionStage];
    return `${m.name}: ${stage.text}`;
  }

  function missionTarget() {
    const stage = currentStage();
    return stage ? stage.target : null;
  }

  function completeStage() {
    const m = currentMission();
    if (!m) return;
    state.missionStage += 1;
    if (state.missionStage >= m.stages.length) {
      player.money += m.reward;
      state.bestMoney = Math.max(state.bestMoney, player.money);
      msg(`Mission Passed — ${m.name}  +$${m.reward}`);
      sound('mission');
      state.missionIndex += 1;
      state.missionStage = 0;
      state.missionTimer = 0;
      state.passenger = false;
      if (state.missionIndex >= MISSIONS.length) {
        state.missionDone = true;
        msg('The Vane Job is done. Rook is free — Neon Harbor is yours.');
      } else {
        msg(`New mission: ${MISSIONS[state.missionIndex].name} — ${MISSIONS[state.missionIndex].brief}`);
      }
    }
  }

  function failMission(reason) {
    msg(`${reason} — mission restarted.`);
    state.missionStage = 0;
    state.missionTimer = 0;
    state.passenger = false;
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      const d = dist2(car.x, car.z, player.x, player.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar(car) {
    if (car.kind === 'police') {
      msg('Locked — that is a police car.');
      return;
    }
    if (car.driver) {
      // The driver bails out and runs.
      const driver = spawnPed();
      driver.x = car.x + 2;
      driver.z = car.z + 2;
      driver.kind = 'driver';
      driver.flee = 1;
      car.driver = false;
      car.owned = true;
      addWanted(WANTED.steal);
      msg('Car stolen! The law is coming.');
      sound('pickup');
    } else if (car.kind === 'parked') {
      // A parked car is still someone else's car.
      car.owned = true;
      addWanted(WANTED.steal);
      msg('Car stolen! The law is coming.');
      sound('pickup');
    }
    state.playerCar = car;
    car.kind = 'player';
    player.onFoot = false;
    player.x = car.x;
    player.z = car.z;
  }

  function exitCar() {
    const car = state.playerCar;
    if (!car) return;
    player.onFoot = true;
    player.x = car.x - Math.cos(car.heading) * 2.6;
    player.z = car.z + Math.sin(car.heading) * 2.6;
    player.heading = car.heading;
    car.kind = 'parked';
    car.speed = 0;
    state.playerCar = null;
  }

  function spawnPoliceCar() {
    // Spawn on a road at the map edge, at least 60 m from the player.
    let point = null;
    for (let tries = 0; tries < 10; tries += 1) {
      const edge = Math.floor(random() * 4);
      const along = -200 + random() * 400;
      const p = edge === 0 ? { x: -160, z: along } : edge === 1 ? { x: 160, z: along }
        : edge === 2 ? { x: along, z: -160 } : { x: along, z: 160 };
      if (dist2(p.x, p.z, player.x, player.z) > 60 * 60) { point = p; break; }
    }
    if (!point) point = { x: -160, z: player.z };
    const car = makeCar(point.x, point.z, 0, 'police', 0x111114);
    car.cruise = 19;
    car.hitCooldown = 0;
    state.cars.push(car);
    return car;
  }

  function spawnFootCop() {
    const angle = random() * Math.PI * 2;
    const cop = {
      x: player.x + Math.cos(angle) * 26,
      z: player.z + Math.sin(angle) * 26,
      heading: 0, speed: 5.6, kind: 'cop', color: 0x1a2a6b,
      tx: 0, tz: 0, hp: 50, down: 0, flee: 0, walkPhase: 0, punchTimer: 0,
    };
    state.peds.push(cop);
    return cop;
  }

  function doBusted() {
    if (state.busted) return;
    state.busted = true;
    state.bustedTimer = 0;
    sound('busted');
  }

  function respawn() {
    const fine = Math.min(Math.max(0, player.money), BUSTED_FINE);
    player.money -= fine;
    player.health = PLAYER.health;
    player.x = SAFEHOUSE.x;
    player.z = SAFEHOUSE.z;
    player.heading = 0;
    player.onFoot = true;
    if (state.playerCar) {
      state.playerCar.kind = 'parked';
      state.playerCar.speed = 0;
      state.playerCar = null;
    }
    state.wanted = 0;
    state.stars = 0;
    state.busted = false;
    state.cars = state.cars.filter((c) => c.kind === 'traffic' || c.kind === 'parked');
    state.peds = state.peds.filter((p) => p.kind === 'walker');
    state.missionStage = 0;
    state.missionTimer = 0;
    state.passenger = false;
    msg(`Busted! Fine $${fine}. Rook walks free — this time.`);
  }

  function stepPlayerOnFoot(dt, c) {
    const speed = c.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const fx = Math.sin(state.camYaw);
    const fz = Math.cos(state.camYaw);
    const rx = -Math.cos(state.camYaw);
    const rz = Math.sin(state.camYaw);
    let mx = fx * c.ay + rx * c.ax;
    let mz = fz * c.ay + rz * c.ax;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      player.x += mx * speed * dt;
      player.z += mz * speed * dt;
      player.heading = Math.atan2(mx, mz);
      player.walkPhase += dt * speed * 1.6;
    }
    if (collideCircle(player, PLAYER.radius)) {
      // Bumped a wall: nothing more to do, position is already pushed out.
    }
    if (player.punchTimer > 0) player.punchTimer -= dt;
    if (player.invuln > 0) player.invuln -= dt;

    if (c.punchPressed && player.punchTimer <= 0) {
      player.punchTimer = PLAYER.punchCooldown;
      sound('punch');
      const px = Math.sin(player.heading);
      const pz = Math.cos(player.heading);
      for (const ped of state.peds) {
        if (ped.down > 0) continue;
        const dx = ped.x - player.x;
        const dz = ped.z - player.z;
        const d = Math.hypot(dx, dz);
        if (d < PLAYER.punchRange && (dx * px + dz * pz) / Math.max(d, 0.01) > 0.2) {
          ped.hp -= PLAYER.punchDamage;
          ped.x += px * 0.9;
          ped.z += pz * 0.9;
          if (ped.hp <= 0) {
            ped.down = 4;
            ped.hp = 50;
            if (ped.kind === 'cop') {
              addWanted(WANTED.hitCop);
              msg('Cop down! That will not be forgotten.');
            } else {
              addWanted(WANTED.hitPed);
              msg('You knocked a pedestrian down. Witnesses called it in.');
            }
          }
          break;
        }
      }
    }

    if (c.enterPressed) {
      const car = nearestCar(4.2);
      if (car) enterCar(car);
      else msg('No car close enough. Walk up to one and press E.');
    }
  }

  function stepPlayerCar(dt, c) {
    const car = state.playerCar;
    if (!car) return;
    const throttle = c.ay;
    const steer = -c.ax; // joystick right / D = steer right
    if (throttle > 0) car.speed += CAR.accel * throttle * dt;
    else if (throttle < 0) {
      if (car.speed > 0.5) car.speed -= CAR.brake * dt;
      else car.speed += CAR.reverseAccel * throttle * dt;
    } else {
      car.speed -= car.speed * 0.6 * dt;
    }
    if (c.brake) {
      car.speed -= car.speed * 2.2 * dt;
      car.heading += steer * dt * 3.4 * clamp(car.speed / 9, -1, 1);
    } else {
      car.heading += steer * dt * CAR.steerRate * clamp(car.speed / 9, -1, 1);
    }
    car.speed = clamp(car.speed, -CAR.reverseTop, CAR.topSpeed);
    if (Math.abs(car.speed) < 0.15 && throttle === 0) car.speed = 0;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    if (collideCircle(car, CAR.radius)) {
      if (Math.abs(car.speed) > 7) {
        sound('crash');
        player.health -= 4;
      }
      car.speed *= 0.45;
    }
    // Running over pedestrians.
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      if (Math.abs(car.speed) > 5 && dist2(car.x, car.z, ped.x, ped.z) < 2.2 * 2.2) {
        ped.down = 4;
        ped.hp = 50;
        addWanted(ped.kind === 'cop' ? WANTED.hitCop : WANTED.hitPed);
        msg(ped.kind === 'cop' ? 'You ran over a cop!' : 'You hit a pedestrian!');
        sound('crash');
        car.speed *= 0.7;
      }
    }
    if (c.enterPressed) exitCar();
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      if (!car.node) pickNextNode(car);
      const dx = car.node.x - car.x;
      const dz = car.node.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        pickNextNode(car);
        continue;
      }
      // Lane offset: right-hand side of the road.
      const nx = dx / dist;
      const nz = dz / dist;
      const tx = car.node.x + -nz * 2.8;
      const tz = car.node.z + nx * 2.8;
      const tdx = tx - car.x;
      const tdz = tz - car.z;
      const targetHeading = Math.atan2(tdx, tdz);
      car.heading = angleLerp(car.heading, targetHeading, dt * 3);
      // Slow down for the car ahead.
      let targetSpeed = car.cruise;
      for (const other of state.cars) {
        if (other === car) continue;
        const ox = other.x - car.x;
        const oz = other.z - car.z;
        const od = Math.hypot(ox, oz);
        if (od < 13 && od > 0.01 && (ox * nx + oz * nz) / od > 0.7) {
          targetSpeed = Math.min(targetSpeed, 3.5);
          break;
        }
      }
      car.speed += clamp(targetSpeed - car.speed, -12 * dt, 8 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      // Too far from the player: recycle near the action.
      if (dist2(car.x, car.z, player.x, player.z) > 280 * 280) {
        const p = randomRoadPoint();
        car.x = p.x;
        car.z = p.z;
        car.node = null;
        car.prev = null;
      }
    }
  }

  function stepPolice(dt) {
    const policeCars = state.cars.filter((c) => c.kind === 'police');
    const desired = state.wanted > 0 ? Math.min(1 + state.stars, 5) : 0;
    state.policeTimer -= dt;
    if (policeCars.length < desired && state.policeTimer <= 0) {
      spawnPoliceCar();
      state.policeTimer = 1.6;
    }
    for (const car of policeCars) {
      if (car.hitCooldown > 0) car.hitCooldown -= dt;
      if (state.wanted === 0) {
        // Heat is off: cruise away and leave.
        car.speed = Math.max(0, car.speed - 8 * dt);
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        if (dist2(car.x, car.z, player.x, player.z) > 260 * 260) {
          state.cars.splice(state.cars.indexOf(car), 1);
        }
        continue;
      }
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      car.heading = angleLerp(car.heading, targetHeading, dt * 2.6);
      const targetSpeed = dist > 30 ? 21 : 17;
      car.speed += clamp(targetSpeed - car.speed, -14 * dt, 10 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      if (collideCircle(car, CAR.radius)) car.speed *= 0.5;
      // Ram the player's car.
      if (state.playerCar && dist < 4.6 && car.hitCooldown <= 0) {
        car.hitCooldown = 0.9;
        player.health -= 6;
        state.playerCar.speed *= 0.6;
        sound('crash');
        msg('Police rammed your car!');
      }
      // On foot: a cop gets out and chases.
      if (player.onFoot && dist < 14 && car.speed < 4) {
        const cop = spawnFootCop();
        cop.x = car.x + 2;
        cop.z = car.z + 2;
        car.speed = 0;
        car.cruise = 0;
        // Park the empty cruiser where it stopped.
        car.kind = 'parked';
        state.cars.splice(state.cars.indexOf(car), 1);
        const parked = makeCar(car.x, car.z, car.heading, 'parked', 0x111114);
        state.cars.push(parked);
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of state.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        continue;
      }
      if (ped.kind === 'cop') {
        if (ped.punchTimer > 0) ped.punchTimer -= dt;
        const dx = player.x - ped.x;
        const dz = player.z - ped.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 70) {
          state.peds.splice(state.peds.indexOf(ped), 1);
          continue;
        }
        if (player.onFoot && dist > 0.5) {
          ped.heading = Math.atan2(dx, dz);
          ped.x += Math.sin(ped.heading) * ped.speed * dt;
          ped.z += Math.cos(ped.heading) * ped.speed * dt;
          ped.walkPhase += dt * 9;
          if (dist < 1.9 && ped.punchTimer <= 0) {
            ped.punchTimer = 1.0;
            player.health -= 8;
            sound('punch');
            msg('A cop is beating you down!');
          }
        }
        continue;
      }
      if (ped.flee > 0) {
        const dx = ped.x - player.x;
        const dz = ped.z - player.z;
        const dist = Math.hypot(dx, dz) || 1;
        ped.heading = Math.atan2(dx / dist, dz / dist);
        ped.x += (dx / dist) * 4.5 * dt;
        ped.z += (dz / dist) * 4.5 * dt;
        ped.walkPhase += dt * 10;
        if (dist > 60) state.peds.splice(state.peds.indexOf(ped), 1);
        continue;
      }
      const dx = ped.tx - ped.x;
      const dz = ped.tz - ped.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5) {
        pickPedTarget(ped);
      } else {
        ped.heading = Math.atan2(dx / dist, dz / dist);
        ped.x += (dx / dist) * ped.speed * dt;
        ped.z += (dz / dist) * ped.speed * dt;
        ped.walkPhase += dt * ped.speed * 2.4;
      }
    }
    // Keep the streets populated.
    const walkers = state.peds.filter((p) => p.kind === 'walker').length;
    if (walkers < PED_COUNT) spawnPed();
  }

  function stepCarCollisions(dt) {
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 4.2 && d > 0.01) {
          const push = (4.2 - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.x -= nx * push;
          a.z -= nz * push;
          b.x += nx * push;
          b.z += nz * push;
          if ((a.kind === 'player' || b.kind === 'player') && Math.abs(a.speed - b.speed) > 6) {
            const other = a.kind === 'player' ? b : a;
            addWanted(other.kind === 'police' ? 60 : WANTED.hitCar);
            if (a.kind === 'player') a.speed *= 0.6;
            if (b.kind === 'player') b.speed *= 0.6;
            sound('crash');
          }
        }
      }
    }
  }

  function stepMissions(dt) {
    const m = currentMission();
    if (!m) return;
    const stage = m.stages[state.missionStage];
    if (stage.timer && state.missionStage === 1 && m.id === 3 && state.passenger) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        failMission('Out of time — the fare walked off');
        return;
      }
    }
    if (stage.key === 'steal') {
      if (!player.onFoot) completeStage();
      return;
    }
    if (stage.key === 'pickup' && m.id === 3) {
      // The passenger boards when the player arrives in a car.
      if (state.playerCar && dist2(player.x, player.z, stage.target.x, stage.target.z) < 8 * 8) {
        state.passenger = true;
        state.missionTimer = 90;
        msg('Passenger aboard. 90 seconds — go!');
        sound('pickup');
        state.missionStage += 1;
      }
      return;
    }
    if (stage.key === 'pickup' || stage.key === 'deliver' || stage.key === 'vault') {
      const target = stage.target;
      if (m.id === 2 && stage.key === 'deliver' && state.stars >= 5) {
        failMission('The heat was too much — the package is lost');
        return;
      }
      if (dist2(player.x, player.z, target.x, target.z) < 8 * 8) {
        if (stage.key === 'pickup' && m.id === 2) {
          addWanted(WANTED.steal);
          msg('Package grabbed. Someone saw you take it!');
        }
        if (stage.key === 'vault') {
          state.wanted = Math.max(state.wanted, 300);
          msg('Vault hit! Every cop in the city is coming.');
        }
        sound('pickup');
        completeStage();
      }
      return;
    }
    if (stage.key === 'escape') {
      const target = stage.target;
      if (dist2(player.x, player.z, target.x, target.z) < 8 * 8) {
        if (state.wanted === 0) {
          sound('pickup');
          completeStage();
        } else if (!state.escapeHintShown) {
          state.escapeHintShown = true;
          msg('Lose the heat first — get wanted to zero, then reach the hideout.');
        }
      } else {
        state.escapeHintShown = false;
      }
    }
  }

  function step(dt, c) {
    if (state.busted) return;
    state.time += dt;
    state.clockMin += dt * 0.5;
    if (state.crimeCooldown > 0) state.crimeCooldown -= dt;
    state.camYaw -= c.camDX * 0.005;
    state.camPitch = clamp(state.camPitch + c.camDY * 0.003, 0.12, 1.1);

    if (player.onFoot) stepPlayerOnFoot(dt, c);
    else stepPlayerCar(dt, c);

    stepTraffic(dt);
    stepPolice(dt);
    stepPeds(dt);
    stepCarCollisions(dt);
    stepMissions(dt);

    // Wanted: stars from points, slow decay when the heat is off.
    const policeNear = state.cars.some((car) => car.kind === 'police'
      && dist2(car.x, car.z, player.x, player.z) < 45 * 45)
      || state.peds.some((p) => p.kind === 'cop' && dist2(p.x, p.z, player.x, player.z) < 45 * 45);
    if (state.crimeCooldown <= 0 && !policeNear && state.wanted > 0) {
      state.wanted = Math.max(0, state.wanted - WANTED.decayPerSec * dt);
    }
    state.stars = Math.min(5, Math.ceil(state.wanted / WANTED.pointsPerStar));
    state.bestWanted = Math.max(state.bestWanted, state.stars);

    // Foot cops join the chase at 2+ stars.
    state.copTimer -= dt;
    if (state.stars >= 2 && player.onFoot && state.copTimer <= 0) {
      const cops = state.peds.filter((p) => p.kind === 'cop').length;
      if (cops < 3) {
        spawnFootCop();
        state.copTimer = 4;
      }
    }

    // Health regen when calm.
    if (state.wanted === 0 && player.health < PLAYER.health) {
      player.health = Math.min(PLAYER.health, player.health + 3 * dt);
    }
    // Busted: health gone, or surrounded on foot.
    if (player.health <= 0) {
      player.health = 0;
      doBusted();
    } else if (player.onFoot) {
      const close = state.peds.filter((p) => p.kind === 'cop' && p.down <= 0
        && dist2(p.x, p.z, player.x, player.z) < 3 * 3).length;
      if (close >= 2) {
        state.bustedTimer += dt;
        if (state.bustedTimer > 2.5) doBusted();
      } else {
        state.bustedTimer = 0;
      }
    }
  }

  function reset(save) {
    state.cars.length = 0;
    state.peds.length = 0;
    player.x = SAFEHOUSE.x;
    player.z = SAFEHOUSE.z;
    player.heading = 0;
    player.health = PLAYER.health;
    player.money = save && Number.isFinite(save.money) ? Math.max(0, save.money) : 50;
    player.onFoot = true;
    player.walkPhase = 0;
    player.punchTimer = 0;
    player.invuln = 0;
    state.playerCar = null;
    state.wanted = 0;
    state.stars = 0;
    state.clockMin = 18 * 60 + 30;
    state.time = 0;
    state.camYaw = Math.PI;
    state.camPitch = 0.42;
    state.missionIndex = save && Number.isInteger(save.missionIndex) ? Math.min(4, Math.max(0, save.missionIndex)) : 0;
    state.missionStage = 0;
    state.missionTimer = 0;
    state.missionDone = state.missionIndex >= MISSIONS.length;
    state.passenger = false;
    state.busted = false;
    state.bustedTimer = 0;
    state.crimeCooldown = 0;
    state.policeTimer = 0;
    state.copTimer = 0;
    state.escapeHintShown = false;
    state.bestWanted = save && Number.isInteger(save.bestWanted) ? Math.min(5, Math.max(0, save.bestWanted)) : 0;
    state.bestMoney = Math.max(save ? save.bestMoney || 0 : 0, player.money);
    state.messages.length = 0;
    state.sounds.length = 0;
    for (const spot of layout.parkedSpots.slice(0, PARKED_COUNT)) {
      const car = makeCar(spot.x, spot.z, spot.heading, 'parked',
        CAR_COLORS[Math.floor(random() * CAR_COLORS.length)]);
      state.cars.push(car);
    }
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) spawnTrafficCar(false);
    for (let i = 0; i < PED_COUNT; i += 1) spawnPed();
    if (!state.missionDone) {
      const m = MISSIONS[state.missionIndex];
      msg(`${m.name} — ${m.brief}`);
    }
  }

  // Helpers for the screenshot scenes: place the player and stage a moment.
  function placePlayer(x, z, heading) {
    player.x = x;
    player.z = z;
    player.heading = heading;
    state.camYaw = heading;
  }
  function givePlayerCar(x, z, heading, speed) {
    const car = makeCar(x, z, heading, 'player', 0xc23b3b);
    car.speed = speed || 0;
    state.cars.push(car);
    state.playerCar = car;
    player.onFoot = false;
    player.x = x;
    player.z = z;
    player.heading = heading;
    return car;
  }
  function setWanted(points) {
    state.wanted = points;
    state.stars = Math.min(5, Math.ceil(points / WANTED.pointsPerStar));
  }
  function spawnPoliceAt(x, z) {
    const car = makeCar(x, z, 0, 'police', 0x111114);
    car.cruise = 19;
    state.cars.push(car);
    return car;
  }
  function setMission(index, stage) {
    state.missionIndex = index;
    state.missionStage = stage;
    state.missionDone = false;
    state.passenger = index === 2 && stage === 1;
    if (index === 2 && stage === 1) state.missionTimer = 90;
  }

  reset(null);
  return {
    state, reset, step, respawn,
    objectiveText, missionTarget, currentMission,
    placePlayer, givePlayerCar, setWanted, spawnPoliceAt, setMission,
  };
}
