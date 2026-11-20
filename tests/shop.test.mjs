// Neon Harbor — Gry Market shop tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createShopState, buyBandage, buyDrink, buyBribe, useBandage } from '../game/src/shop.js';

test('bandage costs $40 and caps at 3', () => {
  const s = createShopState();
  let money = 200;
  for (let i = 0; i < 3; i++) {
    const r = buyBandage(s, money);
    assert.equal(r.bought, true);
    money = r.money;
  }
  assert.equal(s.bandages, 3);
  assert.equal(money, 80);
  const r = buyBandage(s, money);
  assert.equal(r.bought, false); // cap reached
  assert.equal(r.money, 80);
});

test('cannot buy with too little money', () => {
  const s = createShopState();
  const r = buyBandage(s, 30);
  assert.equal(r.bought, false);
  assert.equal(r.money, 30);
  assert.equal(s.bandages, 0);
  assert.equal(s.message, 'Uang tidak cukup');
});

test('energy drink heals +25 immediately', () => {
  const s = createShopState();
  const r = buyDrink(s, 100, 60);
  assert.equal(r.bought, true);
  assert.equal(r.money, 75);
  assert.equal(r.health, 85);
  const capped = buyDrink(s, 100, 90);
  assert.equal(capped.health, 100);
});

test('bribe is exactly -1 star, only at 1-2 stars, police far', () => {
  const s = createShopState();
  assert.equal(buyBribe(s, 500, 0, null).ok, false); // 0 stars
  assert.equal(buyBribe(s, 500, 3, null).ok, false); // 3 stars
  assert.equal(buyBribe(s, 500, 2, 10).ok, false); // police too close
  assert.equal(buyBribe(s, 500, 2, 45).ok, true);
  assert.equal(buyBribe(s, 100, 1, null).ok, false); // not enough money
  const ok = buyBribe(s, 500, 1, null);
  assert.equal(ok.ok, true);
  assert.equal(ok.money, 300);
});

test('using a bandage heals +50 and consumes one', () => {
  const s = createShopState();
  s.bandages = 2;
  const r = useBandage(s, 40);
  assert.equal(r.used, true);
  assert.equal(r.health, 90);
  assert.equal(s.bandages, 1);
  const capped = useBandage(s, 80);
  assert.equal(capped.health, 100);
  const empty = useBandage(createShopState(), 50);
  assert.equal(empty.used, false);
});
