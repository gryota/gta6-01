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
import { validateSave } from '../game/src/save.js';

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

// ---- Save validation (plan 002) ----

test('validateSave rejects corrupt saves', () => {
  const base = { money: 50, missionIndex: 0 };
  // missionIndex out of range / non-integer
  assert.equal(validateSave({ ...base, missionIndex: -1 }), null);
  assert.equal(validateSave({ ...base, missionIndex: 2.5 }), null);
  assert.equal(validateSave({ ...base, missionIndex: NaN }), null);
  assert.equal(validateSave({ ...base, missionIndex: 5 }), null);
  // money non-finite / negative
  assert.equal(validateSave({ ...base, money: NaN }), null);
  assert.equal(validateSave({ ...base, money: Infinity }), null);
  assert.equal(validateSave({ ...base, money: -50 }), null);
  assert.equal(validateSave({ ...base, money: 'lots' }), null);
  // bestWanted out of range / non-integer
  assert.equal(validateSave({ ...base, bestWanted: -1 }), null);
  assert.equal(validateSave({ ...base, bestWanted: 6 }), null);
  assert.equal(validateSave({ ...base, bestWanted: 2.5 }), null);
  // bestMoney non-finite / negative
  assert.equal(validateSave({ ...base, bestMoney: Infinity }), null);
  assert.equal(validateSave({ ...base, bestMoney: -1 }), null);
  // bandages non-integer / negative
  assert.equal(validateSave({ ...base, bandages: -1 }), null);
  assert.equal(validateSave({ ...base, bandages: 1.5 }), null);
  // not an object at all
  assert.equal(validateSave(null), null);
  assert.equal(validateSave(undefined), null);
  assert.equal(validateSave('save'), null);
  assert.equal(validateSave([50, 0]), null);
});

test('validateSave accepts legitimate saves unchanged', () => {
  const minimal = { money: 50, missionIndex: 0 };
  assert.deepEqual(validateSave(minimal), minimal);
  const full = { money: 0, missionIndex: 4, bestWanted: 5, bestMoney: 1950, bandages: 3 };
  assert.deepEqual(validateSave(full), full);
  // Optional fields may be absent.
  assert.deepEqual(validateSave({ money: 100, missionIndex: 2 }), { money: 100, missionIndex: 2 });
});

test('reset clamps a corrupt save instead of crashing', () => {
  const { world } = makeGame();
  // Negative money / missionIndex / bestWanted clamp to the valid range.
  world.reset({ money: -500, missionIndex: -1, bestWanted: -3 });
  assert.equal(world.state.player.money, 0);
  assert.equal(world.state.missionIndex, 0);
  assert.equal(world.state.bestWanted, 0);
  assert.equal(world.state.missionDone, false);

  // Non-finite money falls back to the default $50; non-integer
  // missionIndex falls back to 0; bestWanted above 5 clamps to 5.
  world.reset({ money: NaN, missionIndex: 2.5, bestWanted: 6 });
  assert.equal(world.state.player.money, 50);
  assert.equal(world.state.missionIndex, 0);
  assert.equal(world.state.bestWanted, 5);

  // A valid end-of-story save (missionIndex 4) still loads as done.
  world.reset({ money: 0, missionIndex: 4, bestWanted: 5, bestMoney: 1950 });
  assert.equal(world.state.missionIndex, 4);
  assert.equal(world.state.missionDone, true);
});

test('busted with negative money takes a $0 fine and never adds money', () => {
  const { world } = makeGame();
  world.state.player.money = -500;
  world.respawn();
  assert.equal(world.state.player.money, -500);
  assert.ok(world.state.messages.some((m) => m.includes('Fine $0')));
});

test('shop refuses purchases on a NaN or Infinity balance', () => {
  const { world, shop } = makeGame();
  world.state.player.money = NaN;
  assert.equal(shop.buy('bandage'), false);
  assert.ok(Number.isNaN(world.state.player.money));
  assert.equal(shop.bandages, 0);

  world.state.player.money = Infinity;
  assert.equal(shop.buy('bandage'), false);
  assert.equal(world.state.player.money, Infinity);
  assert.equal(shop.bandages, 0);

  world.state.player.money = -10;
  assert.equal(shop.buy('bandage'), false);
  assert.equal(world.state.player.money, -10);
  assert.equal(shop.bandages, 0);
});

// ---- Mission wanted rules (plan 003) ----

const M2_FAIL_MSG = 'The heat was too much — the package is lost';
const M4_HINT = 'Lose the heat first — get wanted to zero, then reach the hideout.';

test('Mission 2 fails when wanted reaches 5 stars before delivery', () => {
  const { world } = makeGame();
  world.setMission(1, 1); // M2 deliver stage (Volt Tower, 0, 40)
  world.placePlayer(0, 40, 0);
  world.setWanted(500); // 5 stars
  world.step(STEP, IDLE);
  assert.equal(world.state.missionIndex, 1);
  assert.equal(world.state.missionStage, 0); // restarted from briefing
  assert.equal(world.state.player.money, 50); // no reward
  assert.ok(world.state.messages.some((m) => m.includes(M2_FAIL_MSG)));
});

test('Mission 2 completes below 5 stars', () => {
  const { world } = makeGame();
  world.setMission(1, 1);
  world.placePlayer(0, 40, 0);
  world.setWanted(0);
  world.step(STEP, IDLE);
  assert.equal(world.state.missionIndex, 2);
  assert.equal(world.state.player.money, 450); // 50 + 400 reward
});

test('Mission 4 escape stays blocked while hot and the hint shows exactly once', () => {
  const { world } = makeGame();
  world.setMission(3, 1); // M4 escape stage (Hideout, -120, -160)
  world.givePlayerCar(-120, -160, 0, 0);
  world.setWanted(300); // 3 stars, as after the vault
  for (let i = 0; i < 5; i += 1) world.step(STEP, IDLE);
  assert.equal(world.state.missionIndex, 3);
  assert.equal(world.state.missionStage, 1);
  assert.ok(world.state.wanted > 0);
  assert.equal(world.state.escapeHintShown, true);
  assert.equal(world.state.messages.filter((m) => m === M4_HINT).length, 1);
});

test('Mission 4 escape completes at wanted 0 inside the hideout', () => {
  const { world } = makeGame();
  world.setMission(3, 1);
  world.givePlayerCar(-120, -160, 0, 0);
  world.setWanted(0);
  world.step(STEP, IDLE);
  assert.equal(world.state.missionIndex, 4);
  assert.equal(world.state.missionDone, true);
  assert.equal(world.state.player.money, 850); // 50 + 800 reward
});

// ---- Own-car re-entry (plan 004) ----
// The game has no parked cars with the empty test layout (they spawn from
// layout.parkedSpots), so the tests stage cars with exactly makeCar's shape.
function stageCar(world, fields) {
  const car = {
    id: fields.id, x: fields.x, z: fields.z, heading: 0, speed: 0,
    kind: fields.kind, color: 0xffffff, owned: false,
    driver: fields.kind === 'traffic', node: null, prev: null,
    cruise: 0, hitCooldown: 0, stuck: 0,
  };
  world.state.cars.push(car);
  return car;
}

function pressEnter(world) {
  world.step(STEP, { ...IDLE, enterPressed: true });
}

function newMessages(world, before) {
  return world.state.messages.slice(before);
}

test('stealing a parked car adds 100 wanted; re-entering it adds 0', () => {
  const { world } = makeGame();
  world.state.cars = [];
  const car = stageCar(world, { id: 9001, x: 40, z: 40, kind: 'parked' });
  world.placePlayer(40, 40, 0);

  let before = world.state.messages.length;
  pressEnter(world);
  assert.equal(world.state.wanted, 100);
  assert.equal(world.state.playerCar, car);
  assert.equal(car.owned, true);
  assert.ok(newMessages(world, before).some((m) => m.includes('Car stolen!')));

  // Exit, then re-enter the same car.
  pressEnter(world);
  assert.equal(world.state.player.onFoot, true);
  assert.equal(world.state.playerCar, null);
  assert.equal(car.kind, 'parked');
  assert.equal(world.state.wanted, 100);

  before = world.state.messages.length;
  pressEnter(world);
  assert.equal(world.state.wanted, 100);
  assert.equal(world.state.playerCar, car);
  assert.equal(newMessages(world, before).some((m) => m.includes('Car stolen!')), false);
});

test('stealing a traffic car adds 100 wanted; re-entering it adds 0', () => {
  const { world } = makeGame();
  world.state.cars = [];
  const car = stageCar(world, { id: 9002, x: -60, z: 80, kind: 'traffic' });
  world.placePlayer(-60, 80, 0);

  let before = world.state.messages.length;
  pressEnter(world);
  assert.equal(world.state.wanted, 100);
  assert.equal(world.state.playerCar, car);
  assert.equal(car.driver, false);
  assert.equal(car.owned, true);
  assert.ok(newMessages(world, before).some((m) => m.includes('Car stolen!')));

  pressEnter(world);
  assert.equal(world.state.player.onFoot, true);
  assert.equal(world.state.wanted, 100);

  before = world.state.messages.length;
  pressEnter(world);
  assert.equal(world.state.wanted, 100);
  assert.equal(world.state.playerCar, car);
  assert.equal(newMessages(world, before).some((m) => m.includes('Car stolen!')), false);
});

test('stealing a different parked car still adds 100 wanted', () => {
  const { world } = makeGame();
  world.state.cars = [];
  const carA = stageCar(world, { id: 9003, x: 40, z: 40, kind: 'parked' });
  const carB = stageCar(world, { id: 9004, x: -40, z: -40, kind: 'parked' });
  world.placePlayer(40, 40, 0);

  pressEnter(world);
  assert.equal(world.state.wanted, 100);
  assert.equal(world.state.playerCar, carA);

  pressEnter(world); // exit car A
  assert.equal(world.state.player.onFoot, true);

  world.placePlayer(-40, -40, 0);
  const before = world.state.messages.length;
  pressEnter(world);
  assert.equal(world.state.wanted, 200);
  assert.equal(world.state.playerCar, carB);
  assert.equal(carB.owned, true);
  assert.ok(newMessages(world, before).some((m) => m.includes('Car stolen!')));
});

