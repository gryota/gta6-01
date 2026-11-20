// Save data — pure encode/decode with clamping. Storage is injected so the
// same code runs in the browser (localStorage) and in Node tests (a fake).
export const SAVE_KEY = 'neon-harbor-save-v1';

export function defaultSave() {
  return { money: 0, mission: 0, bandages: 0, bestWanted: 0 };
}

export function clampSave(s) {
  const out = defaultSave();
  if (s && typeof s === 'object') {
    out.money = Math.max(0, Math.floor(Number(s.money) || 0));
    out.mission = Math.max(0, Math.min(3, Math.floor(Number(s.mission) || 0)));
    out.bandages = Math.max(0, Math.min(3, Math.floor(Number(s.bandages) || 0)));
    out.bestWanted = Math.max(0, Math.min(5, Math.floor(Number(s.bestWanted) || 0)));
  }
  return out;
}

export function encodeSave(data) {
  return JSON.stringify(clampSave(data));
}

// Corrupt or missing data falls back to defaults — never throws.
export function decodeSave(str) {
  if (typeof str !== 'string' || !str) return defaultSave();
  try {
    return clampSave(JSON.parse(str));
  } catch {
    return defaultSave();
  }
}

export function loadSave(storage) {
  try {
    return decodeSave(storage ? storage.getItem(SAVE_KEY) : null);
  } catch {
    return defaultSave();
  }
}

export function storeSave(storage, data) {
  try {
    if (storage) storage.setItem(SAVE_KEY, encodeSave(data));
    return true;
  } catch {
    return false;
  }
}
