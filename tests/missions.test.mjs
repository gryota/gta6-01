// Missions: the fail rules and the finish rules, as the brief fixes them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMissions, startMission, beginActive, advanceStep, tickMission,
  nextMission, missionReward, missionSteps,
} from '../game/src/missions.js';

test('M2 Harbor Run fails the moment wanted hits 5 stars', () => {
  const m = createMissions();
  startMission(m, 1);
  beginActive(m);
  assert.equal(tickMission(m, 1, 4), null);
  assert.equal(tickMission(m, 1, 5), 'FAILED');
  assert.equal(m.phase, 'FAILED');
  assert.match(m.failedReason, /5 stars/);
});

test('M2 does not fail at 4 stars', () => {
  const m = createMissions();
  startMission(m, 1);
  beginActive(m);
  assert.equal(tickMission(m, 1, 4), null);
  assert.equal(m.phase, 'ACTIVE');
});

test('M4 only finishes at the hideout with wanted 0', () => {
  const m = createMissions();
  startMission(m, 3);
  beginActive(m);
  // Still wanted: the step refuses.
  assert.equal(advanceStep(m, 2), 'BLOCKED');
  assert.equal(m.phase, 'ACTIVE');
  // Wanted 0: the last step passes.
  assert.equal(advanceStep(m, 0), 'PASSED');
  assert.equal(m.phase, 'PASSED');
});

test('M3 Night Shift has a 90-second clock', () => {
  const m = createMissions();
  startMission(m, 2);
  beginActive(m);
  assert.equal(m.timeLimit, 90);
  assert.equal(tickMission(m, 89, 0), null);
  assert.equal(tickMission(m, 2, 0), 'FAILED');
  assert.match(m.failedReason, /time/i);
});

test('a failed mission restarts from its own briefing', () => {
  const m = createMissions();
  startMission(m, 1);
  beginActive(m);
  tickMission(m, 1, 5);
  nextMission(m);
  startMission(m, m.index);
  assert.equal(m.index, 1);
  assert.equal(m.phase, 'BRIEFING');
  assert.equal(m.step, 0);
});

test('a passed mission opens the next one', () => {
  const m = createMissions();
  startMission(m, 0);
  beginActive(m);
  advanceStep(m, 0); // steal step
  assert.equal(advanceStep(m, 0), 'PASSED');
  nextMission(m);
  assert.equal(m.index, 1);
  assert.equal(m.phase, 'IDLE');
});

test('mission rewards add up to $1,950', () => {
  assert.equal([0, 1, 2, 3].reduce((sum, i) => sum + missionReward(i), 0), 1950);
  assert.deepEqual([0, 1, 2, 3].map(missionReward), [250, 400, 500, 800]);
});

test('every mission has steps', () => {
  for (let i = 0; i < 4; i += 1) {
    assert.ok(missionSteps(i).length >= 1, `mission ${i + 1} has no steps`);
  }
});
