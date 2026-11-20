import test from 'node:test';
import assert from 'node:assert/strict';
import { canBuyBandage, canBuyDrink, canBuyBribe, buyBandage, buyDrink, buyBribe, useBandage } from '../game/src/shop.js';

test('bandage: needs $40 and a free slot (max 3)', () => {
  assert.equal(canBuyBandage(40, 0), true);
  assert.equal(canBuyBandage(39, 0), false);
  assert.equal(canBuyBandage(500, 3), false);
  assert.deepEqual(buyBandage(100, 1), { money: 60, bandages: 2 });
  assert.equal(buyBandage(10, 0), null);
  assert.equal(buyBandage(100, 3), null);
});

test('drink: needs $25, heals +25 immediately', () => {
  assert.equal(canBuyDrink(25), true);
  assert.equal(canBuyDrink(24), false);
  assert.deepEqual(buyDrink(100, 80), { money: 75, health: 100 });
  assert.deepEqual(buyDrink(100, 50), { money: 75, health: 75 });
  assert.equal(buyDrink(10, 50), null);
});

test('bribe: only at wanted 1-2, $200, no police within 30 m', () => {
  assert.equal(canBuyBribe(200, 1, 40), true);
  assert.equal(canBuyBribe(200, 2, null), true);
  assert.equal(canBuyBribe(200, 0, 40), false);
  assert.equal(canBuyBribe(200, 3, 40), false);
  assert.equal(canBuyBribe(200, 1, 30), false);
  assert.equal(canBuyBribe(200, 1, 29), false);
  assert.equal(canBuyBribe(199, 1, 40), false);
  assert.deepEqual(buyBribe(250, 2, 100), { money: 50 });
  assert.equal(buyBribe(250, 3, 100), null);
});

test('use bandage: +50 HP capped at 100, null when none left', () => {
  assert.deepEqual(useBandage(2, 60), { bandages: 1, health: 100 });
  assert.deepEqual(useBandage(1, 20), { bandages: 0, health: 70 });
  assert.equal(useBandage(0, 20), null);
});
