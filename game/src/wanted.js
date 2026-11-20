// Wanted system — pure logic, no browser APIs.
// Points 0-500, 100 points = 1 star. Stars use ceil so a fresh 100-point
// offence shows 1 star at once and one star takes ~16.7s to decay (6/s).
export const WANTED = {
  STEAL: 100,
  HIT_PED: 80,
  HIT_CAR: 30,
  HIT_POLICE_CAR: 60,
  PUNCH_POLICE: 150,
  DECAY_PER_SEC: 6,
  MAX_POINTS: 500,
  MAX_STARS: 5,
};

export function starsFromPoints(points) {
  const p = Math.max(0, Math.min(WANTED.MAX_POINTS, points));
  return Math.min(WANTED.MAX_STARS, Math.ceil(p / 100));
}

export function policeCarCount(stars) {
  return Math.min(1 + stars, 5);
}

// Points for stealing a car: your own stolen car (owned) adds nothing.
export function stealPoints(owned) {
  return owned ? 0 : WANTED.STEAL;
}

// Decay only while no police is near; otherwise wanted holds.
export function decayPoints(points, dt, policeNear) {
  if (policeNear || points <= 0) return Math.max(0, points);
  return Math.max(0, points - WANTED.DECAY_PER_SEC * dt);
}

// A bribe removes exactly one star (100 points).
export function bribePoints(points) {
  return Math.max(0, points - 100);
}

export class WantedState {
  constructor(points = 0) {
    this.points = Math.max(0, Math.min(WANTED.MAX_POINTS, points));
  }
  get stars() {
    return starsFromPoints(this.points);
  }
  add(n) {
    this.points = Math.max(0, Math.min(WANTED.MAX_POINTS, this.points + n));
    return this.stars;
  }
  decay(dt, policeNear) {
    this.points = decayPoints(this.points, dt, policeNear);
    return this.stars;
  }
  bribe() {
    this.points = bribePoints(this.points);
    return this.stars;
  }
}
