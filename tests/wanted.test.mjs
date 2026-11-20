// Wanted system: stars are ceil(points/100), so a steal holds its star.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWanted, addWanted, decayWanted, bribeWanted, starsFor, stealPoints } from '../game/src/wanted.js';

test('stars are ceil of points/100', () => {
  assert.equal(starsFor(0), 0);
  assert.equal(starsFor(1), 1);
  assert.equal(starsFor(100), 1);
  assert.equal(starsFor(101), 2);
  assert.equal(starsFor(300), 3);
  assert.equal(starsFor(500), 5);
  assert.equal(starsFor(501), 5);
});

test('stealing a car (+100) holds 1 star through the whole decay', () => {
  const w = createWanted();
  addWanted(w, 100);
  assert.equal(w.stars, 1);
  // 6 points/s decay: after 16 s, 4 points left — still 1 star.
  for (let i = 0; i < 16; i += 1) decayWanted(w, 1, false);
  assert.equal(w.points, 4);
  assert.equal(w.stars, 1);
  // One more second clears it.
  decayWanted(w, 1, false);
  assert.equal(w.points, 0);
  assert.equal(w.stars, 0);
});

test('decay pauses while police are near', () => {
  const w = createWanted();
  addWanted(w, 200);
  decayWanted(w, 10, true);
  assert.equal(w.points, 200);
  decayWanted(w, 10, false);
  assert.equal(w.points, 140);
});

test('a bribe drops exactly one star', () => {
  const w = createWanted();
  addWanted(w, 200);
  assert.equal(bribeWanted(w), true);
  assert.equal(w.points, 100);
  assert.equal(w.stars, 1);
  assert.equal(bribeWanted(w), true);
  assert.equal(w.points, 0);
  assert.equal(w.stars, 0);
});

test('a bribe is refused at 0 or 3+ stars', () => {
  const w = createWanted();
  assert.equal(bribeWanted(w), false);
  addWanted(w, 300);
  assert.equal(bribeWanted(w), false);
  assert.equal(w.points, 300);
});

test('points cap at 500', () => {
  const w = createWanted();
  addWanted(w, 900);
  assert.equal(w.points, 500);
  assert.equal(w.stars, 5);
});

test('stealing your own car adds no heat', () => {
  assert.equal(stealPoints(false), 100);
  assert.equal(stealPoints(true), 0);
});
