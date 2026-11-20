// Neon Harbor — wanted system. Pure logic, no rendering.
// Points 0..500; stars = ceil(points / 100), capped at 5.
import { WANTED } from './config.js';

export function starsFromPoints(points) {
  if (points <= 0) return 0;
  return Math.min(5, Math.ceil(points / WANTED.POINTS_PER_STAR));
}

export function createWanted() {
  return { points: 0, stars: 0, surroundedTimer: 0 };
}

export function addPoints(w, points) {
  w.points = Math.max(0, Math.min(WANTED.MAX_POINTS, w.points + points));
  w.stars = starsFromPoints(w.points);
  return w.stars;
}

export function setPoints(w, points) {
  w.points = Math.max(0, Math.min(WANTED.MAX_POINTS, points));
  w.stars = starsFromPoints(w.points);
  return w.stars;
}

// Decay: 6 points/sec only when no police is within DECAY_RADIUS.
export function decay(w, dt, nearestPoliceDist) {
  if (w.points > 0 && (nearestPoliceDist === null || nearestPoliceDist > WANTED.DECAY_RADIUS)) {
    w.points = Math.max(0, w.points - WANTED.DECAY_PER_SEC * dt);
    w.stars = starsFromPoints(w.points);
  }
  return w.stars;
}

// Points for stealing a car. Stealing your OWN already-stolen car adds nothing.
export function stealPoints(owned) {
  return owned ? 0 : WANTED.STEAL_CAR;
}

// Bribe: exactly -1 star (100 points), only when stars are 1..2.
export function bribePoints(w) {
  if (w.stars < 1 || w.stars > 2) return null;
  w.points = Math.max(0, w.points - WANTED.POINTS_PER_STAR);
  w.stars = starsFromPoints(w.points);
  return w.stars;
}

// Surrounded: 2+ foot police within 3 m for 2.5 s -> BUSTED.
export function updateSurrounded(w, dt, footPoliceNear) {
  if (footPoliceNear >= 2) {
    w.surroundedTimer += dt;
    if (w.surroundedTimer >= 2.5) {
      w.surroundedTimer = 0;
      return true; // busted
    }
  } else {
    w.surroundedTimer = 0;
  }
  return false;
}

// How many police cars for the current stars.
export function policeCarCount(stars) {
  return Math.min(1 + stars, 5);
}

// BUSTED fine: flat, capped at the money on hand.
export function bustedFine(money) {
  return Math.min(Math.max(0, money), 150);
}
