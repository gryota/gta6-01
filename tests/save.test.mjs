// Neon Harbor — save.test.mjs
// Regression tests for save validation: corrupt saves fall back to a
// fresh game, out-of-range values are clamped, valid saves pass through.

import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, parseSaveText, validateSave, loadSave, storeSave } from '../game/src/save.js';

function memStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

test('corrupt save text falls back to a fresh save', () => {
  assert.deepEqual(parseSaveText('not json at all'), defaultSave());
  assert.deepEqual(parseSaveText(''), defaultSave());
  assert.deepEqual(parseSaveText(null), defaultSave());
  assert.deepEqual(parseSaveText('{"money": }'), defaultSave());
});

test('out-of-range values are clamped', () => {
  const s = validateSave({ money: -50, missionIndex: 9, bandages: 99, bestWanted: -3 });
  assert.equal(s.money, 0);
  assert.equal(s.missionIndex, 3);
  assert.equal(s.bandages, 3);
  assert.equal(s.bestWanted, 0);
});

test('non-object saves fall back to fresh', () => {
  assert.deepEqual(validateSave(null), defaultSave());
  assert.deepEqual(validateSave([1, 2, 3]), defaultSave());
  assert.deepEqual(validateSave('hello'), defaultSave());
});

test('a valid save passes through unchanged', () => {
  const s = validateSave({ money: 650, missionIndex: 2, bandages: 1, bestWanted: 3 });
  assert.deepEqual(s, { money: 650, missionIndex: 2, bandages: 1, bestWanted: 3 });
});

test('loadSave reads the stored save; storeSave round-trips', () => {
  const storage = memStorage();
  assert.deepEqual(loadSave(storage), defaultSave());
  storeSave(storage, { money: 400, missionIndex: 1, bandages: 2, bestWanted: 2 });
  assert.deepEqual(loadSave(storage), { money: 400, missionIndex: 1, bandages: 2, bestWanted: 2 });
});

test('loadSave survives a corrupt stored value', () => {
  const { CONFIG } = { CONFIG: { saveKey: 'neon-harbor-save-v1' } };
  const storage = memStorage({ [CONFIG.saveKey]: '{broken' });
  assert.deepEqual(loadSave(storage), defaultSave());
});
