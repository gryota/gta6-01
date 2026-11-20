// Neon Harbor — shared constants. Pure data, no browser APIs.
export const STEP = 1 / 60;
export const MAP_HALF = 210;
export const STREET_SPACING = 60;
export const STREET_LINES = [-180, -120, -60, 0, 60, 120, 180];
export const ROAD_WIDTH = 12;

// Landmarks (x, z) on or beside streets.
export const LANDMARKS = {
  GARAGE: { x: -90, z: 90, name: 'Garasi Rook' },
  HIDEOUT: { x: 150, z: 150, name: 'Hideout' },
  DOCKS_PICKUP: { x: -180, z: -90, name: 'Dermaga Portside' },
  BEACH_PICKUP: { x: -30, z: 180, name: 'Pantai Beachfront' },
  DOWNTOWN_DROP: { x: 30, z: 0, name: 'Drop Downtown' },
  SHOP_POS: { x: 126, z: -120, name: 'Gry Market' },
};

export const PLAYER = {
  HEALTH_MAX: 100,
  WALK_SPEED: 5,
  RUN_SPEED: 9,
  PUNCH_RANGE: 2.2,
  PUNCH_DAMAGE: 34,
  PUNCH_COOLDOWN: 0.45,
};

export const CAR = {
  ACCEL: 14,
  BRAKE: 22,
  MAX_SPEED: 34,
  MAX_REVERSE: 10,
  STEER: 0.55,
  TURN_RATE: 2.4,
  HANDBRAKE_DECEL: 30,
};

export const TRAFFIC = { CARS: 10, PEDS: 24, CAR_SPEED: 9, PED_SPEED: 1.6 };

export const POLICE = {
  CAR_SPEED_NEAR: 21,
  CAR_SPEED_FAR: 17,
  FOOT_MIN_STARS: 2,
  FOOT_MAX: 3,
  FOOT_SPAWN_EVERY: 4,
  FOOT_SPEED: 4.2,
  FOOT_PUNCH_RANGE: 1.6,
  FOOT_PUNCH_DAMAGE: 8,
  FOOT_PUNCH_COOLDOWN: 1.1,
  SURROUND_RADIUS: 3,
  SURROUND_COUNT: 2,
  SURROUND_TIME: 2.5,
  SPAWN_DIST: 60,
};

export const DAMAGE = { COLLISION: 4, POLICE_RAM: 6, POLICE_PUNCH: 8 };
export const REGEN_PER_SEC = 3;
export const BUSTED_FINE = 150;

export const SHOP = {
  BANDAGE_PRICE: 40,
  BANDAGE_MAX: 3,
  BANDAGE_HEAL: 50,
  DRINK_PRICE: 25,
  DRINK_HEAL: 25,
  BRIBE_PRICE: 200,
  BRIBE_MIN_DIST: 30,
};
