// Neon Harbor — mission state machine.
// IDLE -> BRIEFING -> ACTIVE -> PASSED / FAILED -> IDLE (next mission).
import { MISSIONS, MISSION_TIMER_SEC } from './config.js';

export const PHASE = {
  IDLE: 'idle',
  BRIEFING: 'briefing',
  ACTIVE: 'active',
  PASSED: 'passed',
  FAILED: 'failed',
};

export function createMissions() {
  return {
    unlocked: 1, // mission ids 1..4; unlocked = next playable
    current: null, // mission object or null
    phase: PHASE.IDLE,
    stage: 0, // 0 = go to pickup, 1 = go to drop
    timer: 0,
    failReason: '',
  };
}

export function startBriefing(m, id) {
  const def = MISSIONS.find((x) => x.id === id);
  if (!def || id > m.unlocked) return null;
  m.current = def;
  m.phase = PHASE.BRIEFING;
  m.stage = 0;
  m.timer = 0;
  m.failReason = '';
  return def;
}

export function acceptMission(m) {
  if (m.phase !== PHASE.BRIEFING) return false;
  m.phase = PHASE.ACTIVE;
  m.timer = MISSION_TIMER_SEC;
  return true;
}

export function passMission(m) {
  if (m.phase !== PHASE.ACTIVE) return 0;
  const reward = m.current.reward;
  m.phase = PHASE.PASSED;
  m.unlocked = Math.max(m.unlocked, m.current.id + 1);
  return reward;
}

export function failMission(m, reason) {
  if (m.phase !== PHASE.ACTIVE && m.phase !== PHASE.BRIEFING) return;
  m.phase = PHASE.FAILED;
  m.failReason = reason;
}

export function resetToIdle(m) {
  m.current = null;
  m.phase = PHASE.IDLE;
  m.stage = 0;
  m.timer = 0;
  m.failReason = '';
}

// Mission 2 fails the moment wanted hits 5 stars.
export function checkM2Fail(m, stars) {
  if (m.phase === PHASE.ACTIVE && m.current && m.current.id === 2 && stars >= 5) {
    failMission(m, 'Wanted hit 5 stars — the package is burned.');
    return true;
  }
  return false;
}

// Mission 3 timer: runs out -> fail.
export function tickTimer(m, dt) {
  if (m.phase !== PHASE.ACTIVE) return false;
  if (m.current && m.current.id === 3) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.timer = 0;
      failMission(m, 'Out of time — the passenger walked away.');
      return true;
    }
  }
  return false;
}

// Mission 4 finishes only at the hideout with wanted 0.
export function canFinishM4(m, stars, atHideout) {
  return m.phase === PHASE.ACTIVE && m.current && m.current.id === 4 && atHideout && stars === 0;
}

export function totalRewards() {
  return MISSIONS.reduce((sum, x) => sum + x.reward, 0);
}
