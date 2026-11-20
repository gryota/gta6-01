// Neon Harbor — save/load (localStorage). Corrupt saves fall back to defaults.
export const SAVE_KEY = 'neon-harbor-save-v1';

export function defaultSave() {
  return { money: 0, unlocked: 1, bandages: 0, bestWanted: 0 };
}

export function clampSave(s) {
  const out = defaultSave();
  if (s && typeof s === 'object') {
    if (Number.isFinite(s.money)) out.money = Math.max(0, Math.min(999999, Math.floor(s.money)));
    if (Number.isFinite(s.unlocked)) out.unlocked = Math.max(1, Math.min(5, Math.floor(s.unlocked)));
    if (Number.isFinite(s.bandages)) out.bandages = Math.max(0, Math.min(3, Math.floor(s.bandages)));
    if (Number.isFinite(s.bestWanted)) out.bestWanted = Math.max(0, Math.min(5, Math.floor(s.bestWanted)));
  }
  return out;
}

export function encodeSave(s) {
  return JSON.stringify(clampSave(s));
}

export function decodeSave(text) {
  if (typeof text !== 'string' || !text) return defaultSave();
  try {
    return clampSave(JSON.parse(text));
  } catch {
    return defaultSave();
  }
}

export function loadSave(storage) {
  try {
    return decodeSave(storage.getItem(SAVE_KEY));
  } catch {
    return defaultSave();
  }
}

export function storeSave(storage, s) {
  try {
    storage.setItem(SAVE_KEY, encodeSave(s));
    return true;
  } catch {
    return false;
  }
}
