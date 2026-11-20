import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, clampSave, encodeSave, decodeSave, loadSave, storeSave } from '../game/src/save.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

test('defaults are zeroed', () => {
  assert.deepEqual(defaultSave(), { money: 0, mission: 0, bandages: 0, bestWanted: 0 });
});

test('corrupt save never crashes, falls back to defaults', () => {
  assert.deepEqual(decodeSave('not json{{'), defaultSave());
  assert.deepEqual(decodeSave(''), defaultSave());
  assert.deepEqual(decodeSave(null), defaultSave());
  assert.deepEqual(decodeSave('{"money": "abc"}'), defaultSave());
});

test('clamping keeps values in range', () => {
  assert.deepEqual(clampSave({ money: -50, mission: 9, bandages: 99, bestWanted: 7 }), {
    money: 0,
    mission: 3,
    bandages: 3,
    bestWanted: 5,
  });
  assert.deepEqual(clampSave({ money: 1234.7, mission: 2, bandages: 1, bestWanted: 3 }), {
    money: 1234,
    mission: 2,
    bandages: 1,
    bestWanted: 3,
  });
});

test('round trip through storage preserves the save', () => {
  const storage = fakeStorage();
  const data = { money: 650, mission: 2, bandages: 2, bestWanted: 4 };
  assert.equal(storeSave(storage, data), true);
  assert.deepEqual(loadSave(storage), data);
});

test('missing key loads defaults', () => {
  assert.deepEqual(loadSave(fakeStorage()), defaultSave());
});

test('encode clamps before writing', () => {
  const parsed = JSON.parse(encodeSave({ money: 50, mission: 1, bandages: 9, bestWanted: 2 }));
  assert.equal(parsed.bandages, 3);
});
