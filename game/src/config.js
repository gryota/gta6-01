// Neon Harbor — config: all tuning constants in one place.
export const STEP = 1 / 60;
export const MAP_HALF = 210;
export const STREET_LINES = [-150, -75, 0, 75, 150];
export const STREET_HALF = 6;
export const SEA_WEST = -182;
export const SEA_SOUTH = 182;

// Landmarks (x, z). All on or beside streets so the player can reach them.
export const LANDMARKS = {
  GARAGE: { x: -60, z: -60, label: 'Garage' },
  HIDEOUT: { x: -120, z: 120, label: 'Hideout' },
  DOCKS_PICKUP: { x: -168, z: 0, label: 'Docks' },
  BEACH_PICKUP: { x: 120, z: 168, label: 'Beach' },
  DOWNTOWN_DROP: { x: 30, z: 60, label: 'Downtown Drop' },
  SHOP_POS: { x: 105, z: -105, label: 'Gry Market' },
  PASSENGER_PICKUP: { x: 75, z: -150, label: 'Passenger' },
  PASSENGER_DROP: { x: -75, z: 150, label: 'Rooftop Bar' },
  ESCAPE_POINT: { x: -168, z: 120, label: 'Escape' },
};

// Wanted: points 0..500, 100 points = 1 star.
export const WANTED = {
  MAX_POINTS: 500,
  POINTS_PER_STAR: 100,
  STEAL_CAR: 100,
  HIT_PEDESTRIAN: 80,
  HIT_CAR: 30,
  HIT_POLICE_CAR: 60,
  PUNCH_POLICE: 150,
  DECAY_PER_SEC: 6,
  DECAY_RADIUS: 45,
};

// Police.
export const POLICE = {
  CHASE_NEAR: 21,
  CHASE_FAR: 17,
  FOOT_MIN_STARS: 2,
  FOOT_MAX: 3,
  FOOT_SPAWN_SEC: 4,
  FOOT_SPEED: 5.2,
  SURROUND_COUNT: 2,
  SURROUND_RADIUS: 3,
  SURROUND_SEC: 2.5,
};

// Player.
export const PLAYER = {
  HEALTH: 100,
  WALK_SPEED: 6,
  RUN_SPEED: 10,
  CAR_SPEED_MAX: 34,
  CAR_ACCEL: 16,
  CAR_BRAKE: 26,
  CAR_TURN: 1.9,
  PUNCH_DAMAGE: 8,
  PUNCH_RANGE: 2.2,
  COLLISION_DAMAGE: 4,
  POLICE_RAM_DAMAGE: 6,
  POLICE_PUNCH_DAMAGE: 8,
  REGEN_PER_SEC: 3,
  BUSTED_FINE: 150,
};

// Missions: id, name, briefing, reward. Total $1950.
export const MISSIONS = [
  { id: 1, name: 'First Gear', reward: 250, briefing: 'Ms. Vane: steal a car and bring it to the Garage. No questions.' },
  { id: 2, name: 'Harbor Run', reward: 400, briefing: 'Ms. Vane: pick up the package at the Docks, deliver it Downtown. Keep it under 5 stars.' },
  { id: 3, name: 'Night Shift', reward: 500, briefing: 'Ms. Vane: a passenger waits uptown. 90 seconds on the clock. Drive.' },
  { id: 4, name: 'The Vane Job', reward: 800, briefing: 'Ms. Vane: one last run. Reach the Hideout — and arrive clean, wanted 0.' },
];
export const MISSION_TIMER_SEC = 90;

// Traffic.
export const TRAFFIC = {
  CARS: 10,
  PEDESTRIANS: 24,
  CAR_SPEED: 9,
  PED_SPEED: 1.6,
};

// Shop — Gry Market.
export const SHOP = {
  BANDAGE_PRICE: 40,
  BANDAGE_MAX: 3,
  BANDAGE_HEAL: 50,
  DRINK_PRICE: 25,
  DRINK_HEAL: 25,
  BRIBE_PRICE: 200,
  BRIBE_MIN_STARS: 1,
  BRIBE_MAX_STARS: 2,
  BRIBE_CLEAR_RADIUS: 30,
};

// World clock: starts 18:00, one game minute per real second.
export const CLOCK_START_HOUR = 18;
