// Neon Harbor — save.js
// Save validation: a corrupt or hostile save must never crash the game.
// Everything is clamped into sane ranges; anything unparseable falls back
// to a fresh save. Pure module: the storage object is injected so tests can
// pass a fake one.

import { CONFIG } from './config.js';

export function defaultSave() {
  return { money: CONFIG.startingMoney, missionIndex: 0, bandages: 0, bestWanted: 0 };
}

function clampInt(value, min, max, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function validateSave(raw) {
  const fresh = defaultSave();
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return fresh;
  return {
    money: clampInt(raw.money, 0, 999999, fresh.money),
    missionIndex: clampInt(raw.missionIndex, 0, 3, fresh.missionIndex),
    bandages: clampInt(raw.bandages, 0, CONFIG.shopBandageMax, fresh.bandages),
    bestWanted: clampInt(raw.bestWanted, 0, 5, fresh.bestWanted),
  };
}

export function parseSaveText(text) {
  if (typeof text !== 'string' || text.trim() === '') return defaultSave();
  try {
    return validateSave(JSON.parse(text));
  } catch {
    return defaultSave();
  }
}

export function loadSave(storage) {
  try {
    const text = storage.getItem(CONFIG.saveKey);
    return parseSaveText(text);
  } catch {
    return defaultSave();
  }
}

export function storeSave(storage, save) {
  try {
    storage.setItem(CONFIG.saveKey, JSON.stringify(validateSave(save)));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage) {
  try {
    storage.removeItem(CONFIG.saveKey);
  } catch {
    // Storage unavailable; nothing to clear.
  }
}
