// Neon Harbor — every tuning number, colour and mission in one place.
// The city is a road grid: roads run along x = -160,-80,0,80,160 and
// z = -160,-80,0,80,160. Blocks sit between them. All original names.

export const STEP = 1 / 60;

export const ROADS = [-160, -80, 0, 80, 160];
export const ROAD_W = 12;
export const CITY_HALF = 220;
export const SEA_X = 235;

export const BLOCK_CENTERS = [-200, -120, -40, 40, 120, 200];

/** District of the block whose centre is (bx, bz). */
export function districtAt(bx, bz) {
  if (bx <= -160) return 'portside';
  if (bx >= 160) return 'beachfront';
  if (bz <= -160) return 'oldtown';
  if (bz >= 160) return 'industrial';
  return 'downtown';
}

export const DISTRICT_STYLE = {
  downtown: { minH: 30, maxH: 85, hue: 0x2a3550, windows: 'downtown' },
  portside: { minH: 8, maxH: 14, hue: 0x4a4038, windows: 'low' },
  oldtown: { minH: 7, maxH: 15, hue: 0x5a4632, windows: 'low' },
  beachfront: { minH: 6, maxH: 13, hue: 0x3a4a55, windows: 'low' },
  industrial: { minH: 9, maxH: 20, hue: 0x45413c, windows: 'mid' },
};

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 7.5,
  radius: 0.7,
  health: 100,
  punchRange: 2.6,
  punchDamage: 34,
  punchCooldown: 0.45,
};

export const CAR = {
  accel: 15,
  brake: 26,
  reverseAccel: 10,
  topSpeed: 27,
  reverseTop: 9,
  steerRate: 2.1,
  radius: 2.1,
  length: 4.4,
};

export const TRAFFIC_COUNT = 10;
export const PED_COUNT = 24;
export const PARKED_COUNT = 8;

export const WANTED = {
  steal: 100,
  hitPed: 80,
  hitCar: 30,
  hitCop: 150,
  decayPerSec: 6,
  maxPoints: 500,
  pointsPerStar: 100,
};

export const MISSIONS = [
  {
    id: 1,
    name: 'First Gear',
    brief: 'Ms. Vane wants a car. Any car. Steal one and bring it to the garage in Industrial.',
    stages: [
      { key: 'steal', text: 'Steal a car (walk up to one and press E)', target: null },
      { key: 'deliver', text: 'Drive the car to Rook\'s Garage in Industrial', target: { x: 150, z: 160, label: 'Garage' } },
    ],
    reward: 250,
  },
  {
    id: 2,
    name: 'Harbor Run',
    brief: 'A package is waiting at Pier 9 in Portside. Grab it and drop it downtown. The harbour crew will not like it.',
    stages: [
      { key: 'pickup', text: 'Pick up the package at Pier 9, Portside', target: { x: -160, z: -40, label: 'Pier 9' } },
      { key: 'deliver', text: 'Deliver the package to the Volt Tower, Downtown', target: { x: 0, z: 40, label: 'Volt Tower' } },
    ],
    reward: 400,
  },
  {
    id: 3,
    name: 'Night Shift',
    brief: 'A fare is waiting at the corner of 80th and Marina. Get them to Palm Court on Beachfront before the meter runs out.',
    stages: [
      { key: 'pickup', text: 'Pick up the passenger at 80th & Marina', target: { x: 80, z: -80, label: 'Passenger' } },
      { key: 'deliver', text: 'Drop the passenger at Palm Court, Beachfront — 90 seconds!', target: { x: 160, z: 80, label: 'Palm Court' }, timer: 90 },
    ],
    reward: 500,
  },
  {
    id: 4,
    name: 'The Vane Job',
    brief: 'The last one. Hit the vault under Volt Tower, then lose the heat and reach the hideout in Old Town. After this, Rook is free.',
    stages: [
      { key: 'vault', text: 'Reach the vault under Volt Tower, Downtown', target: { x: 0, z: -80, label: 'Vault' } },
      { key: 'escape', text: 'Lose the cops, then reach the hideout in Old Town', target: { x: -120, z: -160, label: 'Hideout' } },
    ],
    reward: 800,
  },
];

export const BUSTED_FINE = 150;
export const SAFEHOUSE = { x: 40, z: 40 };

export const PALETTE = {
  sky: 0x2c1740,
  fog: 0x35204e,
  ground: 0x23232c,
  road: 0x2e2e38,
  sidewalk: 0x3d3d48,
  sand: 0xc2a878,
  sea: 0x0b2f4a,
  neonCyan: 0x29e6ff,
  neonPink: 0xff2e88,
  neonYellow: 0xffd23e,
  text: '#eef1f5',
  muted: '#9aa3b5',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'neon-harbor.save.v1';
