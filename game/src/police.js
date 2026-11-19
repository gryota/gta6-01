// Neon Harbor — police.js
// The heat: police cars that chase at a fixed speed and ram, foot police
// who close in and punch, and the busted rule (two foot cops within 3 m
// for 2.5 s). Spawn counts follow the wanted stars exactly.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng, range, pick } from './random.js';
import { makeVehicleMesh, makePersonMesh } from './render.js';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function createPolice(scene, colliders, seed = 1) {
  const rng = makeRng(seed + 31);
  const cars = [];
  const foot = [];
  let spawnTimer = 0;
  let bustedHold = 0;
  let nextId = 1;

  function randomRoadPointNear(x, z, minD, maxD) {
    for (let tries = 0; tries < 20; tries++) {
      const line = pick(rng, CONFIG.roadLines);
      const along = range(rng, -210, 210);
      const px = rng() < 0.5 ? line : along;
      const pz = rng() < 0.5 ? along : line;
      const d = Math.hypot(px - x, pz - z);
      if (d >= minD && d <= maxD) return { x: px, z: pz };
    }
    return { x: x + 70, z };
  }

  function pushOutOfBuildings(o, radius) {
    for (const c of colliders) {
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
      }
    }
  }

  function spawnCar(px, pz) {
    const mesh = makeVehicleMesh(0x16181c, true);
    scene.add(mesh);
    const car = { id: nextId++, x: px, z: pz, heading: 0, speed: 0, mesh, ramCooldown: 0 };
    cars.push(car);
    return car;
  }

  function spawnFoot(px, pz) {
    const mesh = makePersonMesh(0x1a2a4a, 0xc89878, 0x1a2a4a);
    scene.add(mesh);
    const cop = { id: nextId++, x: px, z: pz, heading: 0, mesh, punchCooldown: 0, health: 30 };
    foot.push(cop);
    return cop;
  }

  /**
   * Melee hit on a foot cop: 15 damage. Returns the cop, with `down: true`
   * when the hit knocked them out (they are removed); otherwise null.
   */
  function damageFoot(x, z, radius, dmg) {
    for (const cop of [...foot]) {
      if (Math.hypot(cop.x - x, cop.z - z) < radius) {
        cop.health -= dmg;
        if (cop.health <= 0) {
          removeFoot(cop);
          return { ...cop, down: true };
        }
        return { ...cop, down: false };
      }
    }
    return null;
  }

  function removeCar(car) {
    scene.remove(car.mesh);
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
  }

  function removeFoot(cop) {
    scene.remove(cop.mesh);
    const i = foot.indexOf(cop);
    if (i >= 0) foot.splice(i, 1);
  }

  /**
   * ctx: { x, z, inCar, wantedStars, dt, onRam(damage), onPunch(damage), onBusted() }
   */
  function update(ctx) {
    const dt = ctx.dt;
    const want = ctx.wantedStars > 0 ? Math.min(1 + ctx.wantedStars, 5) : 0;

    // Police cars: grow or shrink the fleet to match the stars.
    while (cars.length < want) {
      const p = randomRoadPointNear(ctx.x, ctx.z, 60, 90);
      spawnCar(p.x, p.z);
    }
    while (cars.length > want) removeCar(cars[cars.length - 1]);

    for (const car of cars) {
      const dx = ctx.x - car.x;
      const dz = ctx.z - car.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(-dx, -dz);
      const turn = clamp(angleDiff(targetHeading, car.heading), -2.4 * dt, 2.4 * dt);
      car.heading += turn;
      car.speed = dist < CONFIG.policeCarNearDist ? CONFIG.policeCarNearSpeed : CONFIG.policeCarFarSpeed;
      car.x += -Math.sin(car.heading) * car.speed * dt;
      car.z += -Math.cos(car.heading) * car.speed * dt;
      pushOutOfBuildings(car, 1.8);
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      car.ramCooldown -= dt;
      if (dist < 3.2 && car.ramCooldown <= 0) {
        car.ramCooldown = CONFIG.policeCarRamCooldown;
        ctx.onRam(CONFIG.policeCarRamDamage);
      }
      if (dist > 160) {
        const p = randomRoadPointNear(ctx.x, ctx.z, 60, 90);
        car.x = p.x;
        car.z = p.z;
      }
    }

    // Foot police: from 2 stars, at most 3, one every 4 seconds.
    spawnTimer -= dt;
    if (ctx.wantedStars >= CONFIG.footPoliceMinStars && foot.length < CONFIG.footPoliceMax && spawnTimer <= 0) {
      spawnTimer = CONFIG.footPoliceSpawnEvery;
      const p = randomRoadPointNear(ctx.x, ctx.z, 22, 30);
      spawnFoot(p.x, p.z);
    }
    if (ctx.wantedStars < CONFIG.footPoliceMinStars) {
      while (foot.length > 0) removeFoot(foot[foot.length - 1]);
      bustedHold = 0;
    }

    let closeCount = 0;
    for (const cop of [...foot]) {
      const dx = ctx.x - cop.x;
      const dz = ctx.z - cop.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 90) {
        removeFoot(cop);
        continue;
      }
      const targetHeading = Math.atan2(-dx, -dz);
      cop.heading += clamp(angleDiff(targetHeading, cop.heading), -3 * dt, 3 * dt);
      cop.x += -Math.sin(cop.heading) * CONFIG.footPoliceSpeed * dt;
      cop.z += -Math.cos(cop.heading) * CONFIG.footPoliceSpeed * dt;
      pushOutOfBuildings(cop, 0.7);
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      cop.punchCooldown -= dt;
      if (dist < CONFIG.footPolicePunchRange && cop.punchCooldown <= 0) {
        cop.punchCooldown = CONFIG.footPolicePunchCooldown;
        ctx.onPunch(CONFIG.footPolicePunchDamage);
      }
      if (dist < CONFIG.bustedRadius) closeCount++;
    }

    // Busted: two or more foot cops within 3 m for 2.5 s straight.
    if (closeCount >= CONFIG.bustedMinCops) {
      bustedHold += dt;
      if (bustedHold >= CONFIG.bustedHoldSec) {
        bustedHold = 0;
        ctx.onBusted();
      }
    } else {
      bustedHold = 0;
    }
  }

  function nearestDist(x, z) {
    let best = null;
    for (const car of cars) {
      const d = Math.hypot(car.x - x, car.z - z);
      if (best === null || d < best) best = d;
    }
    for (const cop of foot) {
      const d = Math.hypot(cop.x - x, cop.z - z);
      if (best === null || d < best) best = d;
    }
    return best;
  }

  function clearAll() {
    while (cars.length > 0) removeCar(cars[cars.length - 1]);
    while (foot.length > 0) removeFoot(foot[foot.length - 1]);
    bustedHold = 0;
  }

  return { cars, foot, update, nearestDist, clearAll, damageFoot };
}
