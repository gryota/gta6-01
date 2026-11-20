// Neon Harbor — config.js
// Every tunable number of the game lives here, so the loop rules the brief
// fixes (wanted points, police counts, mission money, timers) are in one place.

export const STEP = 1 / 60;

// World layout (metres; x east, z south; forward is -Z, heading 0 faces north).
export const MAP_HALF = 210;
export const STREET_PITCH = 52;
export const STREET_WIDTH = 12;
export const STREET_LINES = [-156, -104, -52, 0, 52, 104, 156];

// Districts (for the city builder and the minimap).
export const DISTRICTS = {
  portside: { x0: -210, z0: -210, x1: -104, z1: 210, name: 'Portside' },
  downtown: { x0: -104, z0: -104, x1: 104, z1: 104, name: 'Downtown' },
  oldtown: { x0: 104, z0: -210, x1: 210, z1: -52, name: 'Old Town' },
  beachfront: { x0: -104, z0: 104, x1: 210, z1: 210, name: 'Beachfront' },
  industrial: { x0: 104, z0: -52, x1: 210, z1: 104, name: 'Industrial' },
};

// Landmarks the missions and the shop point at.
export const GARAGE = { x: 52, z: 104, name: 'Garage' };
export const HIDEOUT = { x: -170, z: 160, name: 'Hideout' };
export const DOCKS_PICKUP = { x: -180, z: 0, name: 'Portside docks' };
export const BEACH_PICKUP = { x: 0, z: 170, name: 'Beachfront' };
export const DOWNTOWN_DROP = { x: 0, z: -60, name: 'Downtown' };
export const SHOP_POS = { x: 150, z: -130, name: 'Gry Market' };
export const PLAYER_SPAWN = { x: 0, z: 30, heading: 0 };

// Wanted: points 0-500, 100 points = 1 star.
export const WANTED_MAX = 500;
export const WANTED_PER_STAR = 100;
export const WANTED_DECAY_PER_SEC = 6;
export const WANTED_DECAY_CLEAR_RADIUS = 45;
export const POINTS_STEAL = 100;
export const POINTS_HIT_PEDESTRIAN = 80;
export const POINTS_HIT_CAR = 30;
export const POINTS_HIT_POLICE_CAR = 60;
export const POINTS_PUNCH_POLICE = 150;

// Police.
export const POLICE_CAR_SPEED_NEAR = 21;
export const POLICE_CAR_SPEED_FAR = 17;
export const POLICE_CAR_NEAR_DIST = 60;
export const FOOT_POLICE_MIN_STARS = 2;
export const FOOT_POLICE_MAX = 3;
export const FOOT_POLICE_SPAWN_SEC = 4;
export const FOOT_POLICE_SPEED = 4.2;
export const SURROUNDED_COUNT = 2;
export const SURROUNDED_RADIUS = 3;
export const SURROUNDED_SEC = 2.5;

// Player.
export const HEALTH_MAX = 100;
export const DAMAGE_CRASH = 4;
export const DAMAGE_POLICE_RAM = 6;
export const DAMAGE_POLICE_PUNCH = 8;
export const REGEN_PER_SEC = 3;
export const WALK_SPEED = 5;
export const RUN_SPEED = 8.5;
export const CAR_TOP_SPEED = 26;
export const CAR_ACCEL = 14;
export const CAR_BRAKE = 26;
export const CAR_STEER = 1.9;
export const BUSTED_FINE = 150;

// Missions.
export const MISSION_REWARDS = [250, 400, 500, 800];
export const MISSION_TOTAL = 1950;
export const MISSION_3_TIME_LIMIT = 90;
export const MISSION_FAIL_WANTED_STARS = 5;

// Shop — Gry Market (Old Town night market).
export const SHOP_BANDAGE_PRICE = 40;
export const SHOP_DRINK_PRICE = 25;
export const SHOP_BRIBE_PRICE = 200;
export const SHOP_BANDAGE_MAX = 3;
export const SHOP_BANDAGE_HEAL = 50;
export const SHOP_DRINK_HEAL = 25;
export const SHOP_BRIBE_MIN_STARS = 1;
export const SHOP_BRIBE_MAX_STARS = 2;
export const SHOP_BRIBE_CLEAR_RADIUS = 30;
export const SHOP_INTERACT_RADIUS = 4;

// Traffic.
export const TRAFFIC_CARS = 10;
export const PEDESTRIANS = 24;
export const TRAFFIC_SPEED = 9;

// Save.
export const SAVE_KEY = 'neon-harbor-save-v1';
export const MONEY_MAX = 999999;
