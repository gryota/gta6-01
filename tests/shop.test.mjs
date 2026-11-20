// Gry Market: prices, the bandage pouch cap, the bribe rules, healing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buyItem, useBandage, canBuyBribe, SHOP_ITEMS } from '../game/src/shop.js';
import { createWanted, addWanted } from '../game/src/wanted.js';

function state(over = {}) {
  return {
    money: 500, health: 60, bandages: 0,
    wanted: createWanted(),
    ...over,
  };
}

test('a bandage costs $40 and the pouch holds at most 3', () => {
  const s = state({ bandages: 2 });
  assert.equal(buyItem(s, 'bandage', false).ok, true);
  assert.equal(s.money, 460);
  assert.equal(s.bandages, 3);
  const res = buyItem(s, 'bandage', false);
  assert.equal(res.ok, false);
  assert.equal(s.money, 460);
});

test('a purchase with too little money changes nothing', () => {
  const s = state({ money: 30 });
  const res = buyItem(s, 'bandage', false);
  assert.equal(res.ok, false);
  assert.match(res.reason, /tidak cukup/);
  assert.equal(s.money, 30);
  assert.equal(s.bandages, 0);
});

test('an energy drink heals +25 on the spot', () => {
  const s = state({ health: 60 });
  assert.equal(buyItem(s, 'drink', false).ok, true);
  assert.equal(s.health, 85);
  assert.equal(s.money, 475);
});

test('a drink never heals past 100', () => {
  const s = state({ health: 90 });
  buyItem(s, 'drink', false);
  assert.equal(s.health, 100);
});

test('a bribe needs 1-2 stars and no police nearby', () => {
  assert.equal(canBuyBribe(0, false), false);
  assert.equal(canBuyBribe(1, false), true);
  assert.equal(canBuyBribe(2, false), true);
  assert.equal(canBuyBribe(3, false), false);
  assert.equal(canBuyBribe(1, true), false);
});

test('a bribe costs $200 and drops exactly one star', () => {
  const s = state();
  addWanted(s.wanted, 200);
  assert.equal(buyItem(s, 'bribe', false).ok, true);
  assert.equal(s.money, 300);
  assert.equal(s.wanted.stars, 1);
});

test('a bribe refused by the rules costs nothing', () => {
  const s = state();
  addWanted(s.wanted, 300);
  assert.equal(buyItem(s, 'bribe', false).ok, false);
  assert.equal(s.money, 500);
});

test('H spends one bandage for +50 health, capped at 100', () => {
  const s = state({ health: 40, bandages: 1 });
  assert.equal(useBandage(s).ok, true);
  assert.equal(s.health, 90);
  assert.equal(s.bandages, 0);
  assert.equal(useBandage(s).ok, false);
  const full = state({ health: 100, bandages: 1 });
  assert.equal(useBandage(full).ok, false);
  assert.equal(full.bandages, 1);
});

test('the shop lists three items', () => {
  assert.deepEqual(SHOP_ITEMS.map((i) => i.id), ['bandage', 'drink', 'bribe']);
  assert.deepEqual(SHOP_ITEMS.map((i) => i.price), [40, 25, 200]);
});
