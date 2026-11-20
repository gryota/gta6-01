// Saves: corrupt data never crashes, numbers are clamped, round-trips work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSave, encodeSave, defaultSave } from '../game/src/save.js';

test('a fresh save starts empty', () => {
  assert.deepEqual(defaultSave(), { money: 0, missionIndex: 0, bandages: 0, bestWanted: 0 });
});

test('garbage input falls back to a fresh save', () => {
  assert.deepEqual(decodeSave(''), defaultSave());
  assert.deepEqual(decodeSave('not json {'), defaultSave());
  assert.deepEqual(decodeSave('null'), defaultSave());
  assert.deepEqual(decodeSave('[1,2,3]'), defaultSave());
  assert.deepEqual(decodeSave(null), defaultSave());
});

test('numbers are clamped into their legal ranges', () => {
  const s = decodeSave(JSON.stringify({ money: -50, missionIndex: 9, bandages: 99, bestWanted: 12 }));
  assert.equal(s.money, 0);
  assert.equal(s.missionIndex, 4);
  assert.equal(s.bandages, 3);
  assert.equal(s.bestWanted, 5);
});

test('a valid save round-trips unchanged', () => {
  const save = { money: 1250, missionIndex: 2, bandages: 2, bestWanted: 3 };
  assert.deepEqual(decodeSave(encodeSave(save)), save);
});

test('missing fields fall back to defaults', () => {
  const s = decodeSave(JSON.stringify({ money: 400 }));
  assert.equal(s.money, 400);
  assert.equal(s.missionIndex, 0);
  assert.equal(s.bandages, 0);
  assert.equal(s.bestWanted, 0);
});
