// Neon Harbor — wanted system tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWanted, addPoints, starsFromPoints, decay, stealPoints, bribePoints, updateSurrounded, policeCarCount, bustedFine } from '../game/src/wanted.js';

test('stars are ceil(points/100), capped at 5', () => {
  assert.equal(starsFromPoints(0), 0);
  assert.equal(starsFromPoints(1), 1);
  assert.equal(starsFromPoints(100), 1);
  assert.equal(starsFromPoints(101), 2);
  assert.equal(starsFromPoints(500), 5);
  assert.equal(starsFromPoints(600), 5);
});

test('stealing adds 100 points (1 star)', () => {
  const w = createWanted();
  assert.equal(addPoints(w, stealPoints(false)), 1);
  assert.equal(w.points, 100);
});

test('entering your own stolen car adds no wanted', () => {
  const w = createWanted();
  assert.equal(stealPoints(true), 0);
  assert.equal(addPoints(w, stealPoints(true)), 0);
  assert.equal(w.points, 0);
});

test('wanted decays 6/sec only when no police within 45 m', () => {
  const w = createWanted();
  addPoints(w, 200);
  decay(w, 10, null);
  assert.equal(w.points, 140);
  decay(w, 10, 20); // police close: no decay
  assert.equal(w.points, 140);
  decay(w, 10, 46); // police far: decays
  assert.equal(w.points, 80);
});

test('a star lasts about 16.7 seconds of decay', () => {
  const w = createWanted();
  addPoints(w, 100);
  decay(w, 16.7, null);
  assert.ok(w.points < 1);
  assert.equal(w.stars, 0);
});

test('bribe is exactly -1 star', () => {
  const w = createWanted();
  addPoints(w, 200); // 2 stars
  assert.equal(bribePoints(w), 1);
  assert.equal(w.points, 100);
  assert.equal(bribePoints(w), 0);
  assert.equal(bribePoints(w), null); // 0 stars: no bribe
});

test('bribe refused above 2 stars', () => {
  const w = createWanted();
  addPoints(w, 300);
  assert.equal(bribePoints(w), null);
});

test('surrounded: 2+ foot police within 3 m for 2.5 s -> busted', () => {
  const w = createWanted();
  assert.equal(updateSurrounded(w, 1, 2), false);
  assert.equal(updateSurrounded(w, 1, 2), false);
  assert.equal(updateSurrounded(w, 1, 2), true);
  assert.equal(updateSurrounded(w, 1, 1), false); // timer resets
});

test('police car count is min(1+stars, 5)', () => {
  assert.equal(policeCarCount(0), 1);
  assert.equal(policeCarCount(1), 2);
  assert.equal(policeCarCount(4), 5);
  assert.equal(policeCarCount(5), 5);
});

test('busted fine is flat $150', () => {
  assert.equal(bustedFine(1000), 150);
  assert.equal(bustedFine(150), 150);
  assert.equal(bustedFine(80), 80);
  assert.equal(bustedFine(0), 0);
});
