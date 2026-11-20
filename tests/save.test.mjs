// Neon Harbor — save/load tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, clampSave, encodeSave, decodeSave, loadSave, storeSave, SAVE_KEY } from '../game/src/save.js';

function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

test('corrupt save falls back to defaults without crashing', () => {
  assert.deepEqual(decodeSave('not json at all'), defaultSave());
  assert.deepEqual(decodeSave(''), defaultSave());
  assert.deepEqual(decodeSave(null), defaultSave());
  assert.deepEqual(decodeSave('{"money": "lots"}'), defaultSave());
});

test('values are clamped', () => {
  const s = clampSave({ money: -50, unlocked: 99, bandages: 9, bestWanted: 9 });
  assert.equal(s.money, 0);
  assert.equal(s.unlocked, 5);
  assert.equal(s.bandages, 3);
  assert.equal(s.bestWanted, 5);
});

test('round trip through storage', () => {
  const store = memStorage();
  assert.equal(storeSave(store, { money: 450, unlocked: 3, bandages: 2, bestWanted: 4 }), true);
  const loaded = loadSave(store);
  assert.equal(loaded.money, 450);
  assert.equal(loaded.unlocked, 3);
  assert.equal(loaded.bandages, 2);
  assert.equal(loaded.bestWanted, 4);
});

test('empty storage loads defaults', () => {
  assert.deepEqual(loadSave(memStorage()), defaultSave());
});

test('encode is stable JSON', () => {
  const text = encodeSave({ money: 100, unlocked: 2, bandages: 1, bestWanted: 2 });
  assert.equal(typeof text, 'string');
  assert.deepEqual(JSON.parse(text), { money: 100, unlocked: 2, bandages: 1, bestWanted: 2 });
  void SAVE_KEY;
});
