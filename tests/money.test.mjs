import test from 'node:test';
import assert from 'node:assert/strict';
import { totalReward, bustedFine } from '../game/src/missions.js';
import { stealPoints, starsFromPoints } from '../game/src/wanted.js';

// Economy regression: the numbers the brief fixes in place.
test('economy: missions pay $1,950 in total, busted fine is flat $150', () => {
  assert.equal(totalReward(), 1950);
  assert.equal(bustedFine(1950), 150);
  assert.equal(bustedFine(80), 80);
});

test('economy: stealing your first car costs 1 star, re-entering it costs nothing', () => {
  assert.equal(starsFromPoints(stealPoints(false)), 1);
  assert.equal(starsFromPoints(stealPoints(true)), 0);
});
