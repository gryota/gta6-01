// Neon Harbor — wanted.js
// The wanted system as a pure state machine: points 0-500, 100 points = 1
// star. Adding points never exceeds the cap; points decay only while no
// police officer is near. No line-of-sight check by design.

import { CONFIG } from './config.js';

export class Wanted {
  constructor() {
    this.points = 0;
  }

  // Stars use a ceiling so that a star lasts until its points fully decay
  // (~16.7 s per star at 6 pts/s). With a floor, a steal (+100, exactly one
  // star) would drop to 0 stars after 0.17 s of decay and the police fleet
  // would never spawn — the core steal → chase loop would not run.
  get stars() {
    return Math.min(5, Math.ceil(this.points / CONFIG.wantedPointsPerStar));
  }

  add(points) {
    this.points = Math.max(0, Math.min(CONFIG.wantedMaxPoints, this.points + points));
    return this.stars;
  }

  setPoints(points) {
    this.points = Math.max(0, Math.min(CONFIG.wantedMaxPoints, points));
    return this.stars;
  }

  clear() {
    this.points = 0;
  }

  /** Decay 6 points/sec, but only while no police is within 45 m. */
  update(dt, nearestPoliceDist) {
    if (this.points > 0 && (nearestPoliceDist === null || nearestPoliceDist > CONFIG.wantedDecayMinPoliceDist)) {
      this.points = Math.max(0, this.points - CONFIG.wantedDecayPerSec * dt);
    }
  }

  /** How many police cars chase the player at the current star level. */
  policeCarCount() {
    if (this.stars === 0) return 0;
    return Math.min(1 + this.stars, 5);
  }

  /** Whether foot police are on the street at the current star level. */
  footPoliceActive() {
    return this.stars >= CONFIG.footPoliceMinStars;
  }
}
