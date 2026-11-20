// Neon Harbor — mission state machine tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissions, startBriefing, acceptMission, passMission, failMission, resetToIdle, checkM2Fail, tickTimer, canFinishM4, totalRewards, PHASE } from '../game/src/missions.js';

test('mission 2 fails at 5 stars', () => {
  const m = createMissions();
  m.unlocked = 2;
  startBriefing(m, 2);
  acceptMission(m);
  assert.equal(checkM2Fail(m, 4), false);
  assert.equal(checkM2Fail(m, 5), true);
  assert.equal(m.phase, PHASE.FAILED);
});

test('mission 4 finishes only at the hideout with wanted 0', () => {
  const m = createMissions();
  m.unlocked = 4;
  startBriefing(m, 4);
  acceptMission(m);
  assert.equal(canFinishM4(m, 0, false), false); // not at hideout
  assert.equal(canFinishM4(m, 1, true), false); // wanted > 0
  assert.equal(canFinishM4(m, 0, true), true);
});

test('mission 3 has a 90 second timer', () => {
  const m = createMissions();
  m.unlocked = 3;
  startBriefing(m, 3);
  acceptMission(m);
  assert.equal(m.timer, 90);
  assert.equal(tickTimer(m, 89), false);
  assert.equal(tickTimer(m, 2), true); // ran out
  assert.equal(m.phase, PHASE.FAILED);
});

test('passing a mission pays its reward and unlocks the next', () => {
  const m = createMissions();
  startBriefing(m, 1);
  acceptMission(m);
  assert.equal(passMission(m), 250);
  assert.equal(m.unlocked, 2);
  assert.equal(m.phase, PHASE.PASSED);
});

test('total rewards are $1950', () => {
  assert.equal(totalRewards(), 1950);
});

test('cannot start a locked mission', () => {
  const m = createMissions();
  assert.equal(startBriefing(m, 3), null);
  assert.equal(m.phase, PHASE.IDLE);
});

test('fail then reset returns to idle', () => {
  const m = createMissions();
  startBriefing(m, 1);
  acceptMission(m);
  failMission(m, 'test');
  assert.equal(m.phase, PHASE.FAILED);
  resetToIdle(m);
  assert.equal(m.phase, PHASE.IDLE);
  assert.equal(m.current, null);
});
