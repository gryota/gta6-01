import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, totalReward, failsAtWanted, canComplete, bustedFine, createMissionState, currentMission } from '../game/src/missions.js';

test('four missions in order with the final rewards', () => {
  assert.equal(MISSIONS.length, 4);
  assert.deepEqual(MISSIONS.map((m) => m.reward), [250, 400, 500, 800]);
  assert.equal(MISSIONS[0].name, 'First Gear');
  assert.equal(MISSIONS[1].name, 'Harbor Run');
  assert.equal(MISSIONS[2].name, 'Night Shift');
  assert.equal(MISSIONS[3].name, 'The Vane Job');
});

test('total reward is $1,950', () => {
  assert.equal(totalReward(), 1950);
});

test('M2 fails at wanted 5, other missions do not', () => {
  assert.equal(failsAtWanted(2, 5), true);
  assert.equal(failsAtWanted(2, 4), false);
  assert.equal(failsAtWanted(1, 5), false);
  assert.equal(failsAtWanted(3, 5), false);
  assert.equal(failsAtWanted(4, 5), false);
});

test('M4 completes only at the hideout with wanted 0', () => {
  assert.equal(canComplete(4, true, 0), true);
  assert.equal(canComplete(4, true, 1), false);
  assert.equal(canComplete(4, false, 0), false);
  assert.equal(canComplete(1, true, 3), true);
});

test('M3 has a 90 second timer', () => {
  assert.equal(MISSIONS[2].timeLimit, 90);
});

test('busted fine is flat min(money, $150)', () => {
  assert.equal(bustedFine(0), 0);
  assert.equal(bustedFine(100), 100);
  assert.equal(bustedFine(150), 150);
  assert.equal(bustedFine(900), 150);
  assert.equal(bustedFine(-50), 0);
});

test('mission state starts at mission 1, IDLE', () => {
  const s = createMissionState();
  assert.equal(s.phase, 'IDLE');
  assert.equal(currentMission(s).id, 1);
});
