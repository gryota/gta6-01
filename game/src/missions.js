// Neon Harbor — missions.js
// The four-mission story as a pure state machine:
//   IDLE -> BRIEFING -> ACTIVE -> PASSED / FAILED -> IDLE
// The world feeds it a small context each tick (player position, wanted
// level, whether a car was just stolen); it answers with events. No DOM,
// no three.js, so the Node tests can drive it directly.

import { CONFIG, MISSION_DEFS } from './config.js';

export const MISSION_STATUS = {
  IDLE: 'IDLE',
  BRIEFING: 'BRIEFING',
  ACTIVE: 'ACTIVE',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
};

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export class Missions {
  constructor() {
    this.index = 0; // next mission to play
    this.status = MISSION_STATUS.IDLE;
    this.stepIndex = 0;
    this.timer = 0;
    this.completed = [false, false, false, false];
  }

  get def() {
    return MISSION_DEFS[this.index];
  }

  get reward() {
    return CONFIG.missionRewards[this.index];
  }

  get done() {
    return this.index >= MISSION_DEFS.length;
  }

  /** Extra wanted points applied when a mission begins (M4 starts hot). */
  beginWantedBonus() {
    return this.def.id === 'm4' ? 200 : 0;
  }

  start() {
    if (this.done) return false;
    this.status = MISSION_STATUS.BRIEFING;
    this.stepIndex = 0;
    this.timer = 0;
    return true;
  }

  begin() {
    if (this.status !== MISSION_STATUS.BRIEFING) return false;
    this.status = MISSION_STATUS.ACTIVE;
    this.stepIndex = 0;
    this.timer = this.currentStep().timed ? CONFIG.mission3TimeLimit : 0;
    return true;
  }

  currentStep() {
    return this.def.steps[this.stepIndex];
  }

  /** Text for the HUD objective line. */
  objectiveText() {
    if (this.status === MISSION_STATUS.BRIEFING) return `Briefing: ${this.def.title}`;
    if (this.status !== MISSION_STATUS.ACTIVE) return '';
    const step = this.currentStep();
    const timer = step.timed ? ` — ${Math.max(0, Math.ceil(this.timer))}s` : '';
    return `${this.def.title}: ${step.text}${timer}`;
  }

  /** World position of the current objective marker, or null. */
  markerPos() {
    if (this.status !== MISSION_STATUS.ACTIVE) return null;
    const step = this.currentStep();
    if (step.type === 'steal') return null;
    return step.pos;
  }

  /**
   * Advance the mission one tick. ctx: { x, z, stoleCar, wantedStars, dt }.
   * Returns an array of events: { kind: 'step' | 'passed' | 'failed', reason? }.
   */
  update(ctx) {
    const events = [];
    if (this.status !== MISSION_STATUS.ACTIVE) return events;
    const def = this.def;

    // Mission 2 fails the moment the wanted level reaches five stars.
    if (def.id === 'm2' && ctx.wantedStars >= 5) {
      this.status = MISSION_STATUS.FAILED;
      events.push({ kind: 'failed', reason: 'Wanted level hit 5 stars — the job is blown.' });
      return events;
    }

    const step = this.currentStep();

    // Timed step (M3 delivery): the clock runs out, the fare walks away.
    if (step.timed) {
      this.timer -= ctx.dt;
      if (this.timer <= 0) {
        this.status = MISSION_STATUS.FAILED;
        events.push({ kind: 'failed', reason: 'Out of time — the passenger left.' });
        return events;
      }
    }

    let done = false;
    if (step.type === 'steal') {
      done = ctx.stoleCar === true;
    } else if (step.type === 'goto') {
      done = dist2(ctx.x, ctx.z, step.pos.x, step.pos.z) < 7;
    } else if (step.type === 'escape') {
      // M4 only completes at the hideout with a clean slate: wanted level 0.
      done = dist2(ctx.x, ctx.z, step.pos.x, step.pos.z) < 7 && ctx.wantedStars === 0;
    }

    if (!done) return events;

    this.stepIndex++;
    if (this.stepIndex >= def.steps.length) {
      this.status = MISSION_STATUS.PASSED;
      this.completed[this.index] = true;
      events.push({ kind: 'passed', reward: this.reward });
      return events;
    }
    const next = this.currentStep();
    if (next.timed) this.timer = CONFIG.mission3TimeLimit;
    events.push({ kind: 'step', text: next.text });
    return events;
  }

  /** Move to the next mission after a pass; call after the reward is paid. */
  advance() {
    if (this.status === MISSION_STATUS.PASSED) this.index++;
    this.status = MISSION_STATUS.IDLE;
    this.stepIndex = 0;
    this.timer = 0;
  }

  /** Retry after a failure: same mission, back to briefing. */
  retry() {
    this.status = MISSION_STATUS.BRIEFING;
    this.stepIndex = 0;
    this.timer = 0;
  }
}
