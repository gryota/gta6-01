// Neon Harbor — wanted.js
// The wanted system, pure logic (no three.js) so Node can test it.
// Points run 0-500; a star is a full 100 points of heat. Stars use ceil:
// stealing a car (+100) must hold 1 star for the whole decay (~16.7 s),
// because with floor it would drop to 0 stars 0.17 s later and the chase
// would never happen. A bribe of -100 points is then exactly -1 star.

import {
  WANTED_MAX,
  WANTED_PER_STAR,
  WANTED_DECAY_PER_SEC,
} from './config.js';

export function starsFor(points) {
  if (points <= 0) return 0;
  return Math.min(5, Math.ceil(points / WANTED_PER_STAR));
}

export function createWanted() {
  return { points: 0, stars: 0 };
}

export function addWanted(wanted, points) {
  wanted.points = Math.min(WANTED_MAX, Math.max(0, wanted.points + points));
  wanted.stars = starsFor(wanted.points);
  return wanted.stars;
}

// Stealing a car is +100 heat — unless it is already yours. Getting back
// into a car you stole earlier adds nothing.
export function stealPoints(owned) {
  return owned ? 0 : 100;
}

export function setWanted(wanted, points) {
  wanted.points = Math.min(WANTED_MAX, Math.max(0, points));
  wanted.stars = starsFor(wanted.points);
  return wanted.stars;
}

// Heat falls 6 points a second, but only when no police is within the
// clear radius — being watched keeps the heat on.
export function decayWanted(wanted, dt, policeNear) {
  if (policeNear || wanted.points <= 0) return wanted.stars;
  wanted.points = Math.max(0, wanted.points - WANTED_DECAY_PER_SEC * dt);
  wanted.stars = starsFor(wanted.points);
  return wanted.stars;
}

// A bribe drops exactly one star: -100 points, only at 1-2 stars.
export function bribeWanted(wanted) {
  if (wanted.stars < 1 || wanted.stars > 2) return false;
  wanted.points = Math.max(0, wanted.points - WANTED_PER_STAR);
  wanted.stars = starsFor(wanted.points);
  return true;
}
