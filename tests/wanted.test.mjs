import test from 'node:test';
import assert from 'node:assert/strict';
import { WANTED, starsFromPoints, stealPoints, decayPoints, bribePoints, policeCarCount, WantedState } from '../game/src/wanted.js';

test('stars: 0 points is 0 stars, 1 point is already 1 star (ceil)', () => {
  assert.equal(starsFromPoints(0), 0);
  assert.equal(starsFromPoints(1), 1);
  assert.equal(starsFromPoints(100), 1);
  assert.equal(starsFromPoints(101), 2);
  assert.equal(starsFromPoints(500), 5);
  assert.equal(starsFromPoints(999), 5);
});

test('steal: fresh car +100, your own stolen car +0', () => {
  assert.equal(stealPoints(false), 100);
  assert.equal(stealPoints(true), 0);
});

test('decay: 6 points/sec, one star lasts ~16.7s, never below 0', () => {
  assert.equal(decayPoints(100, 16.7, false), 0);
  assert.equal(decayPoints(100, 1, false), 100 - WANTED.DECAY_PER_SEC);
  assert.equal(decayPoints(3, 10, false), 0);
  // No decay while police are near.
  assert.equal(decayPoints(100, 10, true), 100);
});

test('bribe removes exactly one star', () => {
  assert.equal(bribePoints(200), 100);
  assert.equal(starsFromPoints(bribePoints(200)), 1);
  assert.equal(bribePoints(50), 0);
});

test('police cars: min(1+stars, 5)', () => {
  assert.equal(policeCarCount(0), 1);
  assert.equal(policeCarCount(2), 3);
  assert.equal(policeCarCount(5), 5);
});

test('WantedState keeps points in range and tracks stars', () => {
  const w = new WantedState();
  w.add(100);
  assert.equal(w.stars, 1);
  w.add(450);
  assert.equal(w.points, 500);
  assert.equal(w.stars, 5);
  w.decay(100, false);
  assert.equal(w.points, 0);
  w.add(200);
  w.bribe();
  assert.equal(w.stars, 1);
});
