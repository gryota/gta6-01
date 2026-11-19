// Neon Harbor — shop.test.mjs
// Regression tests for Gry Market: bandage cap, energy heal, bribe rules,
// insufficient money never takes anything.

import test from 'node:test';
import assert from 'node:assert/strict';
import { buyItem, useBandage, shopError } from '../game/src/shop.js';

function richState(over = {}) {
  return { money: 1000, bandages: 0, health: 100, wantedStars: 0, nearestPoliceDist: null, ...over };
}

test('bandage: bought, carried up to 3, then refused', () => {
  const s = richState();
  for (let i = 1; i <= 3; i++) {
    const res = buyItem('bandage', s);
    assert.equal(res.ok, true);
    assert.equal(s.bandages, i);
  }
  assert.equal(s.money, 1000 - 3 * 40);
  const res = buyItem('bandage', s);
  assert.equal(res.ok, false);
  assert.equal(s.money, 1000 - 3 * 40);
});

test('bandage: not enough money changes nothing', () => {
  const s = richState({ money: 30 });
  const res = buyItem('bandage', s);
  assert.equal(res.ok, false);
  assert.equal(res.message, 'Uang tidak cukup');
  assert.equal(s.money, 30);
  assert.equal(s.bandages, 0);
});

test('energy drink: heals +25 now, capped at 100', () => {
  const s = richState({ health: 60 });
  const res = buyItem('energy', s);
  assert.equal(res.ok, true);
  assert.equal(s.health, 85);
  assert.equal(s.money, 1000 - 25);
  const s2 = richState({ health: 90 });
  buyItem('energy', s2);
  assert.equal(s2.health, 100);
});

test('bribe: only at 1-2 stars with no police within 30 m', () => {
  assert.ok(shopError('bribe', richState({ wantedStars: 0 })));
  assert.ok(shopError('bribe', richState({ wantedStars: 3 })));
  assert.ok(shopError('bribe', richState({ wantedStars: 2, nearestPoliceDist: 10 })));
  assert.equal(shopError('bribe', richState({ wantedStars: 2, nearestPoliceDist: 40 })), null);
  assert.equal(shopError('bribe', richState({ wantedStars: 1, nearestPoliceDist: null })), null);
  const s = richState({ wantedStars: 2, nearestPoliceDist: 40 });
  const res = buyItem('bribe', s);
  assert.equal(res.ok, true);
  assert.equal(res.bribe, true);
  assert.equal(s.money, 800);
});

test('useBandage: +50 health, consumes one, never over 100', () => {
  const s = { money: 0, bandages: 2, health: 40 };
  assert.equal(useBandage(s), true);
  assert.equal(s.health, 90);
  assert.equal(s.bandages, 1);
  assert.equal(useBandage({ money: 0, bandages: 0, health: 40 }), false);
  assert.equal(useBandage({ money: 0, bandages: 1, health: 100 }), false);
});
