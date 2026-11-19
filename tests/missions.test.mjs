// Neon Harbor — missions.test.mjs
// Regression tests for the mission state machine: M2 fails at 5 stars,
// M4 only completes at the hideout with wanted level 0, M3 times out,
// M1 needs a stolen car.

import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../game/src/config.js';
import { Missions, MISSION_STATUS } from '../game/src/missions.js';

function active(index) {
  const m = new Missions();
  m.index = index;
  m.start();
  m.begin();
  return m;
}

test('M1: steal step completes only after a car is stolen', () => {
  const m = active(0);
  let ev = m.update({ x: 0, z: 0, stoleCar: false, wantedStars: 0, dt: 0.1 });
  assert.equal(ev.length, 0);
  assert.equal(m.stepIndex, 0);
  ev = m.update({ x: 0, z: 0, stoleCar: true, wantedStars: 1, dt: 0.1 });
  assert.equal(ev[0].kind, 'step');
  assert.equal(m.stepIndex, 1);
});

test('M1: driving to the garage passes the mission for $250', () => {
  const m = active(0);
  m.update({ x: 0, z: 0, stoleCar: true, wantedStars: 1, dt: 0.1 });
  const ev = m.update({ x: CONFIG.garage.x, z: CONFIG.garage.z, stoleCar: false, wantedStars: 1, dt: 0.1 });
  assert.equal(ev[0].kind, 'passed');
  assert.equal(ev[0].reward, 250);
  assert.equal(m.status, MISSION_STATUS.PASSED);
});

test('M2: fails the moment wanted level reaches 5 stars', () => {
  const m = active(1);
  m.update({ x: CONFIG.portsidePickup.x, z: CONFIG.portsidePickup.z, stoleCar: false, wantedStars: 2, dt: 0.1 });
  assert.equal(m.stepIndex, 1);
  const ev = m.update({ x: 0, z: 0, stoleCar: false, wantedStars: 5, dt: 0.1 });
  assert.equal(ev[0].kind, 'failed');
  assert.equal(m.status, MISSION_STATUS.FAILED);
});

test('M2: clean delivery passes for $400', () => {
  const m = active(1);
  m.update({ x: CONFIG.portsidePickup.x, z: CONFIG.portsidePickup.z, stoleCar: false, wantedStars: 1, dt: 0.1 });
  const ev = m.update({ x: CONFIG.downtownDrop.x, z: CONFIG.downtownDrop.z, stoleCar: false, wantedStars: 1, dt: 0.1 });
  assert.equal(ev[0].kind, 'passed');
  assert.equal(ev[0].reward, 400);
});

test('M3: delivery after the 90s timer fails the mission', () => {
  const m = active(2);
  m.update({ x: CONFIG.passengerPickup.x, z: CONFIG.passengerPickup.z, stoleCar: false, wantedStars: 0, dt: 0.1 });
  assert.equal(m.stepIndex, 1);
  const ev = m.update({ x: CONFIG.beachfrontDrop.x, z: CONFIG.beachfrontDrop.z, stoleCar: false, wantedStars: 0, dt: 91 });
  assert.equal(ev[0].kind, 'failed');
  assert.match(ev[0].reason, /time/i);
});

test('M3: delivery inside the timer passes for $500', () => {
  const m = active(2);
  m.update({ x: CONFIG.passengerPickup.x, z: CONFIG.passengerPickup.z, stoleCar: false, wantedStars: 0, dt: 0.1 });
  const ev = m.update({ x: CONFIG.beachfrontDrop.x, z: CONFIG.beachfrontDrop.z, stoleCar: false, wantedStars: 0, dt: 30 });
  assert.equal(ev[0].kind, 'passed');
  assert.equal(ev[0].reward, 500);
});

test('M4: hideout with wanted stars does NOT complete the mission', () => {
  const m = active(3);
  m.update({ x: CONFIG.rallyPoint.x, z: CONFIG.rallyPoint.z, stoleCar: false, wantedStars: 2, dt: 0.1 });
  assert.equal(m.stepIndex, 1);
  const ev = m.update({ x: CONFIG.hideout.x, z: CONFIG.hideout.z, stoleCar: false, wantedStars: 1, dt: 0.1 });
  assert.equal(ev.length, 0);
  assert.equal(m.status, MISSION_STATUS.ACTIVE);
});

test('M4: hideout with wanted level 0 passes for $800', () => {
  const m = active(3);
  m.update({ x: CONFIG.rallyPoint.x, z: CONFIG.rallyPoint.z, stoleCar: false, wantedStars: 2, dt: 0.1 });
  const ev = m.update({ x: CONFIG.hideout.x, z: CONFIG.hideout.z, stoleCar: false, wantedStars: 0, dt: 0.1 });
  assert.equal(ev[0].kind, 'passed');
  assert.equal(ev[0].reward, 800);
});
