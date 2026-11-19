// Neon Harbor — money.test.mjs
// Regression tests for the economy: mission rewards total $1,950 and the
// busted fine is a flat $150.

import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../game/src/config.js';

test('mission rewards total $1,950', () => {
  assert.deepEqual(CONFIG.missionRewards, [250, 400, 500, 800]);
  const total = CONFIG.missionRewards.reduce((a, b) => a + b, 0);
  assert.equal(total, 1950);
});

test('busted fine is a flat $150', () => {
  assert.equal(CONFIG.bustedFine, 150);
  const fine = (money) => Math.min(money, CONFIG.bustedFine);
  assert.equal(fine(1000), 150);
  assert.equal(fine(80), 80);
  assert.equal(fine(0), 0);
});

test('wanted point values match the final loop numbers', () => {
  assert.equal(CONFIG.wantedStealCar, 100);
  assert.equal(CONFIG.wantedHitPedestrian, 80);
  assert.equal(CONFIG.wantedHitCar, 30);
  assert.equal(CONFIG.wantedHitPoliceCar, 60);
  assert.equal(CONFIG.wantedPunchPolice, 150);
  assert.equal(CONFIG.wantedDecayPerSec, 6);
});
