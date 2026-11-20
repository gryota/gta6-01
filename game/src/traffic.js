// Neon Harbor — traffic: AI cars on street lines + pedestrians on sidewalks.
import { STREET_LINES, TRAFFIC, MAP_HALF } from './config.js';
import { mulberry32, range, pick } from './random.js';
import { clampToMap } from './city.js';

const CAR_COLORS = [0xc23b2e, 0x2e6ac2, 0xd8b13a, 0x3a9e5f, 0x8a8a92, 0x5a3a8a, 0xc2702e, 0x2e8a8a];

export function createTraffic() {
  const rand = mulberry32(99);
  const cars = [];
  for (let i = 0; i < TRAFFIC.CARS; i++) {
    const vertical = rand() < 0.5;
    const line = pick(rand, STREET_LINES);
    const lane = (rand() < 0.5 ? -1 : 1) * 2.6;
    cars.push({
      id: i,
      vertical,
      line,
      lane,
      pos: range(rand, -MAP_HALF + 20, MAP_HALF - 20),
      dir: rand() < 0.5 ? 1 : -1,
      speed: TRAFFIC.CAR_SPEED * range(rand, 0.8, 1.2),
      color: CAR_COLORS[i % CAR_COLORS.length],
      owned: false, // becomes the player's stolen car
      parked: false,
      mesh: null,
    });
  }
  // A few parked cars near the start for the first steal.
  const parkedSpots = [
    { x: -12, z: -30, angle: 0 },
    { x: 12, z: 18, angle: Math.PI / 2 },
    { x: -84, z: 40, angle: 0 },
    { x: 84, z: -40, angle: -Math.PI / 2 },
  ];
  for (const s of parkedSpots) {
    cars.push({
      id: cars.length,
      vertical: false, line: 0, lane: 0,
      pos: 0, dir: 1, speed: 0,
      color: CAR_COLORS[cars.length % CAR_COLORS.length],
      owned: false, parked: true,
      px: s.x, pz: s.z, angle: s.angle,
      mesh: null,
    });
  }
  const peds = [];
  for (let i = 0; i < TRAFFIC.PEDESTRIANS; i++) {
    const vertical = rand() < 0.5;
    const line = pick(rand, STREET_LINES);
    const side = (rand() < 0.5 ? -1 : 1) * 9;
    peds.push({
      id: i,
      vertical,
      line,
      side,
      pos: range(rand, -MAP_HALF + 20, MAP_HALF - 20),
      dir: rand() < 0.5 ? 1 : -1,
      speed: TRAFFIC.PED_SPEED * range(rand, 0.8, 1.3),
      mesh: null,
    });
  }
  return { cars, peds };
}

export function carPosition(car) {
  if (car.parked) return { x: car.px, z: car.pz, angle: car.angle };
  if (car.vertical) return { x: car.line + car.lane, z: car.pos, angle: car.dir > 0 ? 0 : Math.PI };
  return { x: car.pos, z: car.line + car.lane, angle: car.dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
}

export function stepTraffic(t, dt) {
  for (const car of t.cars) {
    if (car.parked) continue;
    car.pos += car.dir * car.speed * dt;
    if (car.pos > MAP_HALF - 12) { car.pos = MAP_HALF - 12; car.dir = -1; }
    if (car.pos < -MAP_HALF + 12) { car.pos = -MAP_HALF + 12; car.dir = 1; }
  }
  for (const p of t.peds) {
    p.pos += p.dir * p.speed * dt;
    if (p.pos > MAP_HALF - 12) { p.pos = MAP_HALF - 12; p.dir = -1; }
    if (p.pos < -MAP_HALF + 12) { p.pos = -MAP_HALF + 12; p.dir = 1; }
  }
}

export function pedPosition(p) {
  if (p.vertical) return { x: p.line + p.side, z: p.pos };
  return { x: p.pos, z: p.line + p.side };
}

// Nearest stealable car within range of (x, z). Parked cars first.
export function nearestStealable(t, x, z, rangeM = 5) {
  let best = null;
  let bestD = rangeM;
  for (const car of t.cars) {
    if (car.owned) continue;
    const p = carPosition(car);
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function clampCarToMap(car) {
  const p = carPosition(car);
  const c = clampToMap(p.x, p.z);
  if (car.vertical) car.pos = c.z;
  else if (!car.parked) car.pos = c.x;
}
