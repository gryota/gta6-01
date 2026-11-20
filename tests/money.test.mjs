// Neon Harbor — money rules tests (rewards + fines).
import test from 'node:test';
import assert from 'node:assert/strict';
import { totalRewards } from '../game/src/missions.js';
import { bustedFine } from '../game/src/wanted.js';

test('mission rewards total $1950 (250+400+500+800)', () => {
  assert.equal(totalRewards(), 1950);
});

test('busted fine is flat $150, never more than the money on hand', () => {
  assert.equal(bustedFine(1950), 150);
  assert.equal(bustedFine(150), 150);
  assert.equal(bustedFine(149), 149);
  assert.equal(bustedFine(0), 0);
});

test('a full playthrough earns $1950 minus at most a few fines', () => {
  const earned = totalRewards();
  const afterOneBust = earned - bustedFine(earned);
  assert.equal(afterOneBust, 1800);
});
