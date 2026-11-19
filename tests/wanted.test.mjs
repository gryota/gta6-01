// Neon Harbor — wanted.test.mjs
// Regression tests for the wanted system: star math, decay only while no
// police is near, police fleet size per star level.

import test from 'node:test';
import assert from 'node:assert/strict';
import { Wanted } from '../game/src/wanted.js';

test('stars: 100 points per star, capped at 5 (ceiling)', () => {
  const w = new Wanted();
  assert.equal(w.stars, 0);
  // A ceiling: any heat at all shows a star, and the star lasts until its
  // points fully decay (~16.7 s). A floor would drop a fresh steal (+100,
  // exactly one star) to 0 stars after 0.17 s of decay.
  w.add(1);
  assert.equal(w.stars, 1);
  w.add(99);
  assert.equal(w.stars, 1);
  w.add(1);
  assert.equal(w.stars, 2);
  w.add(450);
  assert.equal(w.points, 500);
  assert.equal(w.stars, 5);
});

test('a steal keeps its star while the points decay', () => {
  const w = new Wanted();
  w.add(100); // a steal
  assert.equal(w.stars, 1);
  w.update(10, null); // 10 s of decay, no police near: 100 -> 40
  assert.equal(w.points, 40);
  assert.equal(w.stars, 1);
  w.update(10, null); // points reach 0
  assert.equal(w.points, 0);
  assert.equal(w.stars, 0);
});

test('a bribe (-100 points) removes exactly one star', () => {
  const w = new Wanted();
  w.setPoints(250);
  assert.equal(w.stars, 3);
  w.add(-100);
  assert.equal(w.points, 150);
  assert.equal(w.stars, 2);
  w.add(-100);
  assert.equal(w.points, 50);
  assert.equal(w.stars, 1);
});

test('decay: 6 points/sec only when no police within 45 m', () => {
  const w = new Wanted();
  w.setPoints(200);
  w.update(10, 100);
  assert.equal(w.points, 140);
  w.update(10, 10);
  assert.equal(w.points, 140);
  w.update(10, null);
  assert.equal(w.points, 80);
});

test('decay never goes below zero', () => {
  const w = new Wanted();
  w.setPoints(10);
  w.update(10, null);
  assert.equal(w.points, 0);
});

test('police cars: min(1 + stars, 5), none at 0 stars', () => {
  const w = new Wanted();
  assert.equal(w.policeCarCount(), 0);
  w.setPoints(100);
  assert.equal(w.policeCarCount(), 2);
  w.setPoints(300);
  assert.equal(w.policeCarCount(), 4);
  w.setPoints(500);
  assert.equal(w.policeCarCount(), 5);
});

test('foot police activate at 2 stars', () => {
  const w = new Wanted();
  assert.equal(w.footPoliceActive(), false);
  w.setPoints(100);
  assert.equal(w.footPoliceActive(), false);
  w.setPoints(101);
  assert.equal(w.footPoliceActive(), true);
});
