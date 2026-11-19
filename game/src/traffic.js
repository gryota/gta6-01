// Neon Harbor — traffic.js
// Ambient life: AI cars driving rectangular loops on the road grid, parked
// cars waiting to be stolen, and pedestrians strolling the sidewalks. The
// world asks it for the nearest stealable car and for pedestrians a speeding
// car just hit.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng, range, pick } from './random.js';
import { makeVehicleMesh, makePersonMesh } from './render.js';

const CAR_COLORS = [0x8a2a2a, 0x2a4a8a, 0x3a6a3a, 0x8a7a2a, 0x5a5a5a, 0x7a3a6a, 0x2a7a7a, 0x9a9a9a];
const SHIRT_COLORS = [0xc25a3a, 0x3a7ac2, 0x5ac23a, 0xc2a83a, 0x8a5ac2, 0xdddddd, 0x2a2a2a, 0xc27a9a];

function headingFromDir(dx, dz) {
  return Math.atan2(-dx, -dz);
}

export function createTraffic(scene, seed = 1) {
  const rng = makeRng(seed + 7);
  const lines = CONFIG.roadLines;
  const cars = [];
  const peds = [];
  let nextId = 1;

  // --- Traffic loops: rectangles on the road grid, driven clockwise.
  const loops = [
    { x0: -180, x1: -60, z0: -120, z1: 120 },
    { x0: 0, x1: 180, z0: -180, z1: 0 },
    { x0: -120, x1: 120, z0: 60, z1: 180 },
    { x0: -180, x1: 0, z0: -60, z1: 60 },
    { x0: 60, x1: 180, z0: -120, z1: 120 },
  ];

  function loopPoint(loop, s) {
    const w = loop.x1 - loop.x0;
    const h = loop.z1 - loop.z0;
    const p = ((s % (2 * (w + h))) + 2 * (w + h)) % (2 * (w + h));
    let x;
    let z;
    let dx;
    let dz;
    if (p < w) {
      x = loop.x0 + p;
      z = loop.z0;
      dx = 1;
      dz = 0;
    } else if (p < w + h) {
      x = loop.x1;
      z = loop.z0 + (p - w);
      dx = 0;
      dz = 1;
    } else if (p < 2 * w + h) {
      x = loop.x1 - (p - w - h);
      z = loop.z1;
      dx = -1;
      dz = 0;
    } else {
      x = loop.x0;
      z = loop.z1 - (p - 2 * w - h);
      dx = 0;
      dz = -1;
    }
    // Right-hand side of the road.
    const ox = dz * 2.2;
    const oz = -dx * 2.2;
    return { x: x + ox, z: z + oz, dx, dz };
  }

  for (let i = 0; i < CONFIG.trafficCarCount; i++) {
    const loop = loops[i % loops.length];
    const mesh = makeVehicleMesh(pick(rng, CAR_COLORS));
    scene.add(mesh);
    cars.push({
      id: nextId++,
      kind: 'traffic',
      loop,
      s: range(rng, 0, 400),
      speed: range(rng, 7, 11),
      baseSpeed: 9,
      x: 0,
      z: 0,
      heading: 0,
      mesh,
      owned: false,
    });
  }

  // --- Parked cars along the roads, free for the taking.
  for (let i = 0; i < 8; i++) {
    const vertical = rng() < 0.5;
    const line = pick(rng, lines);
    const along = range(rng, -200, 200);
    const x = vertical ? line + 3.4 : along;
    const z = vertical ? along : line + 3.4;
    const heading = vertical ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const mesh = makeVehicleMesh(pick(rng, CAR_COLORS));
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    cars.push({ id: nextId++, kind: 'parked', x, z, heading, speed: 0, mesh, owned: false, loop: null, s: 0 });
  }

  // --- Pedestrians on the sidewalks.
  function randomSidewalkPoint() {
    const vertical = rng() < 0.5;
    const line = pick(rng, lines);
    const along = range(rng, -210, 210);
    const side = rng() < 0.5 ? -6.5 : 6.5;
    return vertical ? { x: line + side, z: along } : { x: along, z: line + side };
  }
  for (let i = 0; i < CONFIG.pedestrianCount; i++) {
    const p = randomSidewalkPoint();
    const mesh = makePersonMesh(pick(rng, SHIRT_COLORS));
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    const target = randomSidewalkPoint();
    peds.push({
      x: p.x,
      z: p.z,
      tx: target.x,
      tz: target.z,
      speed: range(rng, 1.2, 2.1),
      mesh,
      down: 0,
      heading: 0,
      flee: 0,
    });
  }

  function spawnFleeingPed(x, z) {
    const mesh = makePersonMesh(pick(rng, SHIRT_COLORS));
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const target = randomSidewalkPoint();
    const ped = { x, z, tx: target.x, tz: target.z, speed: 4.5, mesh, down: 0, heading: 0, flee: 4 };
    peds.push(ped);
    return ped;
  }

  function update(dt, time) {
    // Traffic cars follow their loops; a car slows for the one ahead.
    for (const car of cars) {
      if (car.kind !== 'traffic') continue;
      let speed = car.baseSpeed;
      for (const other of cars) {
        if (other === car || other.kind !== 'traffic' || other.loop !== car.loop) continue;
        const gap = (other.s - car.s + 2000) % 2000;
        if (gap > 0 && gap < 12) speed = Math.min(speed, other.baseSpeed * 0.6);
      }
      car.s += speed * dt;
      car.speed = speed;
      const pt = loopPoint(car.loop, car.s);
      car.x = pt.x;
      car.z = pt.z;
      car.heading = headingFromDir(pt.dx, pt.dz);
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
    // Pedestrians stroll; knocked-down ones lie still, then get back up.
    for (const ped of peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) {
          const p = randomSidewalkPoint();
          ped.x = p.x;
          ped.z = p.z;
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
          const t = randomSidewalkPoint();
          ped.tx = t.x;
          ped.tz = t.z;
        }
        continue;
      }
      const dx = ped.tx - ped.x;
      const dz = ped.tz - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 1) {
        const t = randomSidewalkPoint();
        ped.tx = t.x;
        ped.tz = t.z;
        continue;
      }
      const sp = ped.flee > 0 ? ped.speed : ped.speed;
      if (ped.flee > 0) ped.flee -= dt;
      ped.x += (dx / d) * sp * dt;
      ped.z += (dz / d) * sp * dt;
      ped.heading = headingFromDir(dx, dz);
      ped.mesh.position.set(ped.x, Math.abs(Math.sin(time * 6 + ped.x)) * 0.06, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }

  /** Nearest car (traffic or parked) within `radius` of a point. */
  function nearestCar(x, z, radius) {
    let best = null;
    let bestD = radius;
    for (const car of cars) {
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
  }

  /** A car hit a pedestrian: knock them down, return the ped (once). */
  function knockPedAt(x, z, radius) {
    for (const ped of peds) {
      if (ped.down > 0) continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) {
        ped.down = 6;
        ped.mesh.rotation.x = -Math.PI / 2;
        ped.mesh.position.y = 0.35;
        return ped;
      }
    }
    return null;
  }

  return { cars, peds, update, nearestCar, knockPedAt, spawnFleeingPed, headingFromDir };
}
