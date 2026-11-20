// Neon Harbor — police.js
// The heat's teeth: police cars that chase and ram, and foot police who
// close in on foot. Pure motion logic — the meshes live in render.js.
// Numbers come from config.js (the brief's final loop numbers).

import {
  POLICE_CAR_SPEED_NEAR,
  POLICE_CAR_SPEED_FAR,
  POLICE_CAR_NEAR_DIST,
  FOOT_POLICE_MIN_STARS,
  FOOT_POLICE_MAX,
  FOOT_POLICE_SPAWN_SEC,
  FOOT_POLICE_SPEED,
  SURROUNDED_COUNT,
  SURROUNDED_RADIUS,
  SURROUNDED_SEC,
  DAMAGE_POLICE_RAM,
  DAMAGE_POLICE_PUNCH,
} from './config.js';
import { createRandom, range } from './random.js';
import { randomStreetPoint } from './city.js';

export function createPolice(seed) {
  return {
    cars: [],
    foot: [],
    spawnTimer: 0,
    surroundedTimer: 0,
    rng: createRandom(seed + 303),
  };
}

function dist(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

function angleTo(ax, az, bx, bz) {
  // Heading convention: 0 faces -Z (north), positive turns clockwise.
  return Math.atan2(bx - ax, -(bz - az));
}

function turnToward(current, target, maxStep) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.max(-maxStep, Math.min(maxStep, diff));
  return current + step;
}

// How many police cars the stars call for: 1 + stars, capped at 5.
export function wantedCarCount(stars) {
  return Math.min(1 + stars, 5);
}

// Step the police. Returns events: { type: 'ram' | 'punch' | 'busted', damage? }.
export function stepPolice(police, dt, player, stars, inCar) {
  const events = [];
  const rng = police.rng;

  // --- police cars -------------------------------------------------------
  const want = stars > 0 ? wantedCarCount(stars) : 0;
  while (police.cars.length < want) {
    const p = randomStreetPoint(rng);
    const a = rng() * Math.PI * 2;
    police.cars.push({
      id: `police-${police.cars.length}-${Date.now() % 100000}`,
      kind: 'police',
      x: player.x + Math.cos(a) * range(rng, 55, 85),
      z: player.z + Math.sin(a) * range(rng, 55, 85),
      heading: 0,
      speed: 0,
      color: 0x1c2f4a,
      owned: false,
    });
  }
  while (police.cars.length > want) police.cars.pop();

  for (const car of police.cars) {
    const d = dist(car.x, car.z, player.x, player.z);
    const speed = d < POLICE_CAR_NEAR_DIST ? POLICE_CAR_SPEED_NEAR : POLICE_CAR_SPEED_FAR;
    const wantHeading = angleTo(car.x, car.z, player.x, player.z);
    car.heading = turnToward(car.heading, wantHeading, 2.4 * dt);
    car.speed = speed;
    car.x += -Math.sin(car.heading) * speed * dt;
    car.z += -Math.cos(car.heading) * speed * dt;
    // Ram: touching the player's car hurts.
    if (inCar && d < 3.4) {
      events.push({ type: 'ram', damage: DAMAGE_POLICE_RAM });
      // Bounce off so the ram does not repeat every frame.
      car.x += Math.sin(car.heading) * 2.2;
      car.z += Math.cos(car.heading) * 2.2;
    }
  }

  // --- foot police ---------------------------------------------------------
  if (stars >= FOOT_POLICE_MIN_STARS) {
    police.spawnTimer -= dt;
    if (police.spawnTimer <= 0 && police.foot.length < FOOT_POLICE_MAX) {
      police.spawnTimer = FOOT_POLICE_SPAWN_SEC;
      const a = rng() * Math.PI * 2;
      police.foot.push({
        id: `foot-${police.foot.length}-${Date.now() % 100000}`,
        x: player.x + Math.cos(a) * 26,
        z: player.z + Math.sin(a) * 26,
        heading: 0,
        punchCooldown: 0,
      });
    }
  } else {
    police.foot.length = 0;
    police.spawnTimer = 0;
  }

  let closeCount = 0;
  for (const cop of police.foot) {
    const d = dist(cop.x, cop.z, player.x, player.z);
    cop.heading = angleTo(cop.x, cop.z, player.x, player.z);
    if (d > 1.6) {
      cop.x += -Math.sin(cop.heading) * FOOT_POLICE_SPEED * dt;
      cop.z += -Math.cos(cop.heading) * FOOT_POLICE_SPEED * dt;
    } else if (!inCar) {
      cop.punchCooldown -= dt;
      if (cop.punchCooldown <= 0) {
        cop.punchCooldown = 1.0;
        events.push({ type: 'punch', damage: DAMAGE_POLICE_PUNCH });
      }
    }
    if (d < SURROUNDED_RADIUS) closeCount += 1;
  }

  // Surrounded: 2+ foot police within 3 m for 2.5 s -> BUSTED.
  if (!inCar && closeCount >= SURROUNDED_COUNT) {
    police.surroundedTimer += dt;
    if (police.surroundedTimer >= SURROUNDED_SEC) {
      police.surroundedTimer = 0;
      events.push({ type: 'busted' });
    }
  } else {
    police.surroundedTimer = 0;
  }

  return events;
}

// Is any police unit within `radius` of the player (for wanted decay and bribes)?
export function policeNear(police, player, radius) {
  for (const car of police.cars) {
    if (dist(car.x, car.z, player.x, player.z) < radius) return true;
  }
  for (const cop of police.foot) {
    if (dist(cop.x, cop.z, player.x, player.z) < radius) return true;
  }
  return false;
}

export function clearPolice(police) {
  police.cars.length = 0;
  police.foot.length = 0;
  police.spawnTimer = 0;
  police.surroundedTimer = 0;
}
