// Neon Harbor — save.js
// localStorage save handling, pure logic (no window access here — the caller
// passes the raw string in and takes the JSON string out). A corrupt save
// never crashes the game: it falls back to a fresh start, and every number
// is clamped into its legal range.

import { SAVE_KEY, MONEY_MAX, SHOP_BANDAGE_MAX } from './config.js';

export const SAVE_KEY_NAME = SAVE_KEY;

export function defaultSave() {
  return { money: 0, missionIndex: 0, bandages: 0, bestWanted: 0 };
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// Parse and validate a saved JSON string. Returns a clean save object.
export function decodeSave(raw) {
  const clean = defaultSave();
  if (typeof raw !== 'string' || raw.length === 0) return clean;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return clean;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return clean;
  clean.money = clampInt(parsed.money, 0, MONEY_MAX, 0);
  clean.missionIndex = clampInt(parsed.missionIndex, 0, 4, 0);
  clean.bandages = clampInt(parsed.bandages, 0, SHOP_BANDAGE_MAX, 0);
  clean.bestWanted = clampInt(parsed.bestWanted, 0, 5, 0);
  return clean;
}

export function encodeSave(save) {
  const clean = {
    money: clampInt(save.money, 0, MONEY_MAX, 0),
    missionIndex: clampInt(save.missionIndex, 0, 4, 0),
    bandages: clampInt(save.bandages, 0, SHOP_BANDAGE_MAX, 0),
    bestWanted: clampInt(save.bestWanted, 0, 5, 0),
  };
  return JSON.stringify(clean);
}
