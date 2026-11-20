// Neon Harbor — traffic.js
// The city's moving life: AI cars that follow the street grid and pedestrians
// on the sidewalks. Pure motion logic — the meshes live in render.js, and the
// world reads these positions each frame.

import { STREET_LINES, MAP_HALF, TRAFFIC_CARS, PEDESTRIANS, TRAFFIC_SPEED } from './config.js';
import { createRandom, range, pick } from './random.js';
import { randomStreetPoint } from './city.js';

const CAR_COLORS = [0xc23b3b, 0x3b6fc2, 0xd8c26a, 0x7a7f8a, 0x3d8a4a, 0x8a5fbf, 0xd8d8d8, 0x2c2f36];

export function createTraffic(seed) {
  const rng = createRandom(seed + 101);
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i += 1) {
    const p = randomStreetPoint(rng);
    cars.push({
      id: `traffic-${i}`,
      kind: 'traffic',
      x: p.x, z: p.z,
      axis: p.axis, line: p.line,
      dir: rng() < 0.5 ? 1 : -1,
      speed: range(rng, TRAFFIC_SPEED * 0.7, TRAFFIC_SPEED * 1.1),
      color: pick(rng, CAR_COLORS),
      heading: p.axis === 'z' ? (p.dir || 1) > 0 ? 0 : Math.PI : (p.dir || 1) > 0 ? Math.PI / 2 : -Math.PI / 2,
      stopped: false,
      owned: false,
    });
  }
  const pedestrians = [];
  for (let i = 0; i < PEDESTRIANS; i += 1) {
    const p = randomStreetPoint(rng);
    pedestrians.push({
      id: `ped-${i}`,
      x: p.x + pick(rng, [-8, 8]),
      z: p.z + pick(rng, [-8, 8]),
      axis: p.axis,
      dir: rng() < 0.5 ? 1 : -1,
      speed: range(rng, 1.1, 1.9),
      color: pick(rng, [0xe8b04a, 0x4a90d8, 0xd84a7a, 0x7ad84a, 0xd8d8d8, 0x8a6fd8]),
      heading: 0,
      down: false,
      downTimer: 0,
    });
  }
  return { cars, pedestrians, rng };
}

// One traffic car: drive along its street; at an intersection, sometimes
// turn onto the crossing street. Stop when another car is right ahead.
export function stepTrafficCar(car, dt, cars) {
  const ahead = cars.find((other) => {
    if (other === car || other.axis !== car.axis || other.line !== car.line || other.dir !== car.dir) return false;
    const along = car.axis === 'z' ? other.z - car.z : other.x - car.x;
    return along > 0 && along < 9;
  });
  car.stopped = Boolean(ahead);
  if (car.stopped) return;
  const v = car.speed * car.dir * dt;
  if (car.axis === 'z') car.z += v;
  else car.x += v;
  // Wrap around the map edge.
  if (car.axis === 'z' && (car.z > MAP_HALF || car.z < -MAP_HALF)) {
    car.z = car.dir > 0 ? -MAP_HALF : MAP_HALF;
  }
  if (car.axis === 'x' && (car.x > MAP_HALF || car.x < -MAP_HALF)) {
    car.x = car.dir > 0 ? -MAP_HALF : MAP_HALF;
  }
  // Intersection: chance to turn onto the crossing street.
  const along = car.axis === 'z' ? car.z : car.x;
  const crossing = STREET_LINES.find((cl) => Math.abs(along - cl) < 1.2);
  if (crossing !== undefined && Math.random() < 0.012) {
    car.axis = car.axis === 'z' ? 'x' : 'z';
    car.line = crossing;
    car.dir = Math.random() < 0.5 ? 1 : -1;
    if (car.axis === 'z') car.z = crossing;
    else car.x = crossing;
  }
  car.heading = car.axis === 'z'
    ? (car.dir > 0 ? Math.PI : 0)
    : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
}

export function stepPedestrian(ped, dt) {
  if (ped.down) {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) ped.down = false;
    return;
  }
  const v = ped.speed * ped.dir * dt;
  if (ped.axis === 'z') ped.z += v;
  else ped.x += v;
  const along = ped.axis === 'z' ? ped.z : ped.x;
  if (along > MAP_HALF - 4 || along < -MAP_HALF + 4) ped.dir *= -1;
  ped.heading = ped.axis === 'z'
    ? (ped.dir > 0 ? Math.PI : 0)
    : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
}

export function stepTraffic(traffic, dt) {
  for (const car of traffic.cars) stepTrafficCar(car, dt, traffic.cars);
  for (const ped of traffic.pedestrians) stepPedestrian(ped, dt);
}

// A pedestrian the player knocked down: lies flat for a few seconds.
export function knockPedestrian(ped) {
  ped.down = true;
  ped.downTimer = 4;
}
