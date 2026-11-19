// Characterization tests for the Neon Harbor money paths (plan 001).
//
// These lock CURRENT behavior — the numbers come from the code, not the
// design brief (whose numbers drift; reconciling them is plan 005).
//
// Harness notes (from reading the code, not from a browser):
// - world.js / config.js / random.js touch no DOM (verified: word-boundary
//   grep for document/window/localStorage finds nothing in them), so they
//   import directly in Node. city.js DOES touch the DOM
//   (document.createElement('canvas')), so createWorld gets a fake layout:
//   world.js only reads layout.colliders and layout.parkedSpots.
// - shop.js DOM surface (read from shop.js): document.createElement('div'),
//   document.body.appendChild, element.querySelector (overlay + row),
//   element.addEventListener('click'), classList.add/remove, textContent,
//   innerHTML. Note: shop.js does NOT use document.getElementById (it uses
//   overlay.querySelector); the stub provides it anyway.
// - main.js is NOT imported here: it touches the DOM at top level
//   (document.getElementById, window.location) and creates a
//   THREE.WebGLRenderer, which needs a real canvas/WebGL context. Its
//   readSave/writeSave are also module-private (not exported), so no Node
//   test can call them. The save test below therefore locks the exact
//   payload shape writeSave() produces and the exact validation readSave()
//   applies — a browser-level test of the real functions is a follow-up,
//   not part of this plan.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorld } from '../game/src/world.js';
import { createShop, SHOP_ITEMS, MAX_BANDAGES } from '../game/src/shop.js';
import { MISSIONS, BUSTED_FINE, SAVE_KEY, STEP } from '../game/src/config.js';
import { createRandom } from '../game/src/random.js';

// ---- Minimal DOM stub (shop.js only; no game logic is stubbed) ----
function makeElement() {
  return {
    id: '',
    className: '',
    innerHTML: '',
    textContent: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
    querySelector() { return makeElement(); },
    addEventListener() {},
  };
}

globalThis.document = {
  createElement() { return makeElement(); },
  getElementById() { return makeElement(); },
  body: {
    appendChild() {},
    classList: { add() {}, remove() {}, toggle() {} },
  },
};

// ---- Map-backed localStorage stub ----
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => { storage.set(key, String(value)); },
  removeItem: (key) => { storage.delete(key); },
  clear: () => { storage.clear(); },
};

// ---- Game harness ----
const IDLE = {
  run: false, ay: 0, ax: 0, camDX: 0, camDY: 0,
  punchPressed: false, enterPressed: false, brake: false,
};

function makeGame() {
  const random = createRandom(1);
  // world.js only reads layout.colliders and layout.parkedSpots.
  const layout = { colliders: [], parkedSpots: [] };
  const world = createWorld(random, layout);
  const shop = createShop(world, layout);
  return { world, shop };
}

test('buy bandage with $50 leaves $10 and 1 bandage; two more fill the inventory; a 4th is rejected', () => {
  const { world, shop } = makeGame();
  world.state.player.money = 50;
  assert.equal(shop.buy('bandage'), true);
  assert.equal(world.state.player.money, 10);
  assert.equal(shop.bandages, 1);

  // Two more bandages cost $80; top the money back up first.
  world.state.player.money = 100;
  assert.equal(shop.buy('bandage'), true);
  assert.equal(shop.buy('bandage'), true);
  assert.equal(shop.bandages, 3);
  assert.equal(world.state.player.money, 20);

  // Inventory full (max 3): rejected even with money in hand.
  world.state.player.money = 100;
  assert.equal(shop.buy('bandage'), false);
  assert.equal(world.state.player.money, 100);
  assert.equal(shop.bandages, 3);
  assert.equal(MAX_BANDAGES, 3);
});

test('buy with $10 is rejected and money is untouched', () => {
  const { world, shop } = makeGame();
  world.state.player.money = 10;
  assert.equal(shop.buy('bandage'), false);
  assert.equal(world.state.player.money, 10);
  assert.equal(shop.bandages, 0);
  assert.equal(SHOP_ITEMS.find((i) => i.id === 'bandage').price, 40);
});

test('bribe at 1 star with no police near drops wanted by exactly 100; at 3 stars it is rejected', () => {
  const { world, shop } = makeGame();
  world.state.player.money = 250;
  world.setWanted(100); // 1 star
  assert.equal(world.state.stars, 1);
  assert.equal(shop.buy('bribe'), true);
  assert.equal(world.state.wanted, 0);
  assert.equal(world.state.player.money, 50);

  // 3 stars: rejected by the stars guard before the money check, so top
  // the money back up to isolate that guard.
  world.state.player.money = 250;
  world.setWanted(300);
  assert.equal(world.state.stars, 3);
  assert.equal(shop.buy('bribe'), false);
  assert.equal(world.state.wanted, 300);
  assert.equal(world.state.player.money, 250);
});

test('completing Mission 1 adds exactly $250 (the current config value)', () => {
  const { world } = makeGame();
  assert.equal(MISSIONS[0].reward, 250);
  world.state.player.money = 50;
  world.setMission(0, 1); // M1 deliver stage
  const target = MISSIONS[0].stages[1].target;
  world.placePlayer(target.x, target.z, 0);
  world.step(STEP, IDLE);
  assert.equal(world.state.missionIndex, 1);
  assert.equal(world.state.player.money, 300);
});

test('save round-trip: money, bandages and missionIndex survive the save format unchanged', () => {
  const { world, shop } = makeGame();
  globalThis.localStorage.clear();
  world.state.player.money = 1234;
  world.state.missionIndex = 2;
  world.state.bestWanted = 3;
  world.state.bestMoney = 1234;
  shop.bandages = 2;

  // Exactly the payload writeSave() (main.js) produces, key for key.
  const payload = JSON.stringify({
    money: Math.round(world.state.player.money),
    missionIndex: world.state.missionIndex,
    bestWanted: world.state.bestWanted,
    bestMoney: world.state.bestMoney,
    bandages: shop.bandages,
  });
  assert.deepEqual(Object.keys(JSON.parse(payload)),
    ['money', 'missionIndex', 'bestWanted', 'bestMoney', 'bandages']);
  globalThis.localStorage.setItem(SAVE_KEY, payload);

  // Exactly the validation readSave() (main.js) applies.
  const raw = globalThis.localStorage.getItem(SAVE_KEY);
  const save = JSON.parse(raw);
  const loaded = (typeof save.money === 'number'
    && typeof save.missionIndex === 'number') ? save : null;
  assert.notEqual(loaded, null);
  assert.equal(loaded.money, 1234);
  assert.equal(loaded.missionIndex, 2);
  assert.equal(loaded.bandages, 2);

  // A corrupt payload fails the same validation.
  globalThis.localStorage.setItem(SAVE_KEY,
    JSON.stringify({ money: 'lots', missionIndex: 0 }));
  const bad = JSON.parse(globalThis.localStorage.getItem(SAVE_KEY));
  const badLoaded = (typeof bad.money === 'number'
    && typeof bad.missionIndex === 'number') ? bad : null;
  assert.equal(badLoaded, null);
});

test('busted with $200 takes a $150 fine (current behavior)', () => {
  const { world } = makeGame();
  assert.equal(BUSTED_FINE, 150);
  world.state.player.money = 200;
  world.respawn();
  assert.equal(world.state.player.money, 50);
  assert.ok(world.state.messages.some((m) => m.includes('Fine $150')));
});
