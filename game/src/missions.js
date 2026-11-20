// Neon Harbor — missions.js
// The four story missions as a small state machine, pure logic (no three.js).
// Phases: IDLE -> BRIEFING -> ACTIVE -> PASSED / FAILED -> IDLE (next mission).
// A mission is a list of steps; the world checks each step's condition and
// calls advance() when the player reaches it. Failing conditions live here
// so the tests can prove them: M2 fails at 5 stars, M4 only finishes at the
// hideout with wanted 0, M3 has a 90-second clock.

import {
  GARAGE,
  HIDEOUT,
  DOCKS_PICKUP,
  BEACH_PICKUP,
  DOWNTOWN_DROP,
  MISSION_REWARDS,
  MISSION_3_TIME_LIMIT,
  MISSION_FAIL_WANTED_STARS,
} from './config.js';

export const MISSION_NAMES = ['First Gear', 'Harbor Run', 'Night Shift', 'The Vane Job'];

export const MISSION_BRIEFINGS = [
  'Ms. Vane: "Rook, you owe me. Steal a car and bring it to the garage. Any car. Don\'t get caught."',
  'Ms. Vane: "A package is waiting at the Portside docks. Pick it up, bring it to the garage. The harbor is hot — stay under 5 stars or the job is blown."',
  'Ms. Vane: "A fare needs a ride from the Beachfront to Downtown. Ninety seconds, Rook. The meter is running."',
  'Ms. Vane: "Last job. Lose the heat, then get to the hideout. Come back clean and the debt is gone."',
];

// Each step: what the player must do, where, and how close is close enough.
export function missionSteps(index) {
  switch (index) {
    case 0:
      return [
        { kind: 'steal', text: 'Steal a car (walk up to one and press E)', radius: 0 },
        { kind: 'goto', pos: GARAGE, text: 'Deliver the car to the garage', radius: 8 },
      ];
    case 1:
      return [
        { kind: 'goto', pos: DOCKS_PICKUP, text: 'Pick up the package at the Portside docks', radius: 7 },
        { kind: 'goto', pos: GARAGE, text: 'Deliver the package to the garage', radius: 8 },
      ];
    case 2:
      return [
        { kind: 'goto', pos: BEACH_PICKUP, text: 'Pick up the passenger at the Beachfront', radius: 7 },
        { kind: 'goto', pos: DOWNTOWN_DROP, text: 'Drop the passenger in Downtown', radius: 8 },
      ];
    case 3:
      return [
        { kind: 'goto', pos: HIDEOUT, text: 'Reach the hideout with wanted 0', radius: 8, needWantedZero: true },
      ];
    default:
      return [];
  }
}

export function createMissions() {
  return {
    index: 0, // 0-3, or 4 when the story is done
    phase: 'IDLE', // IDLE | BRIEFING | ACTIVE | PASSED | FAILED
    step: 0,
    timer: 0, // seconds left on the active mission's clock (0 = no clock)
    timeLimit: 0,
    failedReason: '',
  };
}

export function missionReward(index) {
  return MISSION_REWARDS[index] ?? 0;
}

export function missionName(index) {
  return MISSION_NAMES[index] ?? 'Done';
}

export function currentStep(missions) {
  const steps = missionSteps(missions.index);
  return steps[missions.step] ?? null;
}

export function startMission(missions, index) {
  missions.index = index;
  missions.phase = 'BRIEFING';
  missions.step = 0;
  missions.timer = 0;
  missions.timeLimit = index === 2 ? MISSION_3_TIME_LIMIT : 0;
  missions.failedReason = '';
  return missions;
}

export function beginActive(missions) {
  if (missions.phase !== 'BRIEFING') return missions;
  missions.phase = 'ACTIVE';
  missions.timer = missions.timeLimit;
  return missions;
}

// The player reached the current step's spot. Returns 'PASSED' when the
// last step is done, 'NEXT' when there is another step, 'BLOCKED' when the
// step refuses (M4 at the hideout while still wanted).
export function advanceStep(missions, wantedStars) {
  const step = currentStep(missions);
  if (!step || missions.phase !== 'ACTIVE') return 'BLOCKED';
  if (step.needWantedZero && wantedStars > 0) return 'BLOCKED';
  missions.step += 1;
  if (missions.step >= missionSteps(missions.index).length) {
    missions.phase = 'PASSED';
    return 'PASSED';
  }
  return 'NEXT';
}

// Tick the mission clock and the fail rules. Returns 'FAILED' with a reason
// set, or null while the mission is still alive.
export function tickMission(missions, dt, wantedStars) {
  if (missions.phase !== 'ACTIVE') return null;
  if (missions.index === 1 && wantedStars >= MISSION_FAIL_WANTED_STARS) {
    missions.phase = 'FAILED';
    missions.failedReason = 'The heat hit 5 stars — the Harbor Run is blown.';
    return 'FAILED';
  }
  if (missions.timeLimit > 0) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      missions.timer = 0;
      missions.phase = 'FAILED';
      missions.failedReason = 'Out of time — the fare walked away.';
      return 'FAILED';
    }
  }
  return null;
}

// After PASSED, open the next mission (or finish the story at index 4).
// After FAILED, the same mission restarts from its briefing.
export function nextMission(missions) {
  if (missions.phase === 'PASSED') {
    missions.index = Math.min(4, missions.index + 1);
  }
  missions.phase = 'IDLE';
  missions.step = 0;
  missions.timer = 0;
  missions.timeLimit = 0;
  missions.failedReason = '';
  return missions;
}
