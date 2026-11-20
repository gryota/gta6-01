// Traffic — AI cars on street loops, pedestrians on sidewalks, parked cars.
// Pure movement logic + meshes (factories live in render.js).
import { STREET_LINES, TRAFFIC, LANDMARKS } from './config.js';
import { range, pick } from './random.js';
import { makeCarMesh, makePedMesh } from './render.js';

const CAR_COLORS = [0xc0c8d0, 0x8a2f2f, 0x2f5a8a, 0x3a6b3f, 0xd8b13a, 0x5a5a66, 0x7a4a8a];
const PED_COLORS = [0xd86a4a, 0x4a7ad8, 0x7ad84a, 0xd8c84a, 0x9a5ad8, 0x4ad8c8];

// Traffic-light phase: 8s north-south green, then 8s east-west green.
export function lightPhase(time) {
  return Math.floor(time / 8) % 2 === 0 ? 'NS' : 'EW';
}

function rectLoop(rng) {
  const xs = pick(rng, STREET_LINES.slice(0, -1));
  const xe = xs + 60;
  const zs = pick(rng, STREET_LINES.slice(0, -1));
  const ze = zs + 60;
  // Clockwise rectangle on street centrelines.
  return [
    { x: xs, z: zs },
    { x: xe, z: zs },
    { x: xe, z: ze },
    { x: xs, z: ze },
  ];
}

function sidewalkLoop(rng) {
  const bx = pick(rng, STREET_LINES.slice(0, -1)) + 8;
  const bz = pick(rng, STREET_LINES.slice(0, -1)) + 8;
  const w = 60 - 16;
  return [
    { x: bx, z: bz },
    { x: bx + w, z: bz },
    { x: bx + w, z: bz + w },
    { x: bx, z: bz + w },
  ];
}

export class Traffic {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.time = 0;
    this.cars = [];
    this.peds = [];
    this.parked = [];
    for (let i = 0; i < TRAFFIC.CARS; i++) {
      const loop = rectLoop(rng);
      const start = loop[Math.floor(rng() * 4)];
      const car = this._makeCar(loop, start, pick(rng, CAR_COLORS), false);
      this.cars.push(car);
    }
    // Parked cars the player can steal.
    const parkedSpots = [
      { x: -84, z: 30, h: 0 },
      { x: 36, z: -84, h: Math.PI / 2 },
      { x: 96, z: 66, h: 0 },
      { x: -36, z: 156, h: Math.PI / 2 },
    ];
    for (const s of parkedSpots) {
      const car = this._makeCar(null, { x: s.x, z: s.z }, pick(rng, CAR_COLORS), true);
      car.heading = s.h;
      car.mesh.rotation.y = s.h;
      this.parked.push(car);
    }
    for (let i = 0; i < TRAFFIC.PEDS; i++) {
      const loop = sidewalkLoop(rng);
      const start = loop[Math.floor(rng() * 4)];
      const ped = {
        pos: { x: start.x, z: start.z },
        heading: rng() * Math.PI * 2,
        loop,
        wp: 0,
        speed: TRAFFIC.PED_SPEED * range(rng, 0.8, 1.2),
        state: 'walk',
        timer: 0,
        mesh: makePedMesh(pick(rng, PED_COLORS)),
      };
      ped.mesh.position.set(start.x, 0, start.z);
      scene.add(ped.mesh);
      this.peds.push(ped);
    }
  }

  _makeCar(loop, start, color, parked) {
    const mesh = makeCarMesh(color, false);
    mesh.position.set(start.x, 0, start.z);
    this.scene.add(mesh);
    return {
      pos: { x: start.x, z: start.z },
      heading: 0,
      speed: 0,
      loop,
      wp: 1,
      color,
      mesh,
      parked,
      owned: false,
      driver: !parked,
    };
  }

  allCars() {
    return [...this.cars, ...this.parked];
  }

  nearestCar(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.allCars()) {
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  nearestPed(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.pos.x - pos.x, ped.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  // A stolen car leaves traffic; world.js owns it from here on.
  takeCar(car) {
    this.cars = this.cars.filter((c) => c !== car);
    this.parked = this.parked.filter((c) => c !== car);
    return car;
  }

  // A pedestrian hit by a car goes down, then respawns elsewhere.
  knockDown(ped) {
    ped.state = 'down';
    ped.timer = 5;
    ped.mesh.rotation.z = Math.PI / 2;
  }

  flee(ped, from) {
    ped.state = 'flee';
    ped.timer = 3;
    const dx = ped.pos.x - from.x;
    const dz = ped.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    ped.fleeDir = { x: dx / d, z: dz / d };
  }

  update(dt) {
    this.time += dt;
    const phase = lightPhase(this.time);
    for (const car of this.cars) {
      const target = car.loop[car.wp];
      const dx = target.x - car.pos.x;
      const dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      // Stop at a red light when close to the corner.
      let wantSpeed = TRAFFIC.CAR_SPEED;
      if (dist < 12) {
        const movingNS = Math.abs(dz) > Math.abs(dx);
        if ((movingNS && phase === 'EW') || (!movingNS && phase === 'NS')) wantSpeed = 0;
      }
      car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 2);
      if (dist < 2.5) {
        car.wp = (car.wp + 1) % car.loop.length;
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.set(car.pos.x, 0, car.pos.z);
      car.mesh.rotation.y = car.heading;
    }
    for (const ped of this.peds) {
      if (ped.state === 'down') {
        ped.timer -= dt;
        if (ped.timer <= 0) {
          ped.state = 'walk';
          ped.mesh.rotation.z = 0;
          const loop = sidewalkLoop(this.rng);
          ped.loop = loop;
          ped.wp = 0;
          ped.pos = { x: loop[0].x, z: loop[0].z };
        }
        continue;
      }
      if (ped.state === 'flee') {
        ped.timer -= dt;
        ped.pos.x += ped.fleeDir.x * 5 * dt;
        ped.pos.z += ped.fleeDir.z * 5 * dt;
        if (ped.timer <= 0) ped.state = 'walk';
      } else {
        const target = ped.loop[ped.wp];
        const dx = target.x - ped.pos.x;
        const dz = target.z - ped.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.5) {
          ped.wp = (ped.wp + 1) % ped.loop.length;
          continue;
        }
        ped.heading = Math.atan2(dx, dz);
        ped.pos.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.pos.z += Math.cos(ped.heading) * ped.speed * dt;
      }
      ped.mesh.position.set(ped.pos.x, 0, ped.pos.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }
}
