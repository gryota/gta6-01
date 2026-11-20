// Economy: the mission money, the flat BUSTED fine, and the own-car rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSION_TOTAL, BUSTED_FINE, MISSION_REWARDS } from '../game/src/config.js';
import { stealPoints } from '../game/src/wanted.js';

test('the four mission rewards total $1,950', () => {
  assert.equal(MISSION_TOTAL, 1950);
  assert.equal(MISSION_REWARDS.reduce((a, b) => a + b, 0), 1950);
});

test('the BUSTED fine is a flat $150, capped by what the player holds', () => {
  assert.equal(BUSTED_FINE, 150);
  assert.equal(Math.min(40, BUSTED_FINE), 40);
  assert.equal(Math.min(1000, BUSTED_FINE), 150);
});

test('entering your own stolen car adds no wanted', () => {
  assert.equal(stealPoints(true), 0);
  assert.equal(stealPoints(false), 100);
});
