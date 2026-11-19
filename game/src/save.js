// Save validation — the single gate for save trust (plan 002).
//
// Pure module: no DOM, no imports. Any future save field must be added here
// with its range in the same commit that starts writing it.
//
// Valid means ALL of:
// - save is a non-null object (and not an array);
// - missionIndex is an integer 0–4 (4 = story done);
// - money is a finite number >= 0;
// - if bestWanted is present, it is an integer 0–5;
// - if bestMoney is present, it is a finite number >= 0;
// - if bandages is present, it is an integer >= 0 (the shop caps it at 3
//   on load already — do not cap here, only validate the type/range).
//
// Returns the save object unchanged when valid, null when invalid.

export function validateSave(save) {
  if (save === null || typeof save !== 'object' || Array.isArray(save)) return null;
  if (!Number.isInteger(save.missionIndex) || save.missionIndex < 0 || save.missionIndex > 4) return null;
  if (typeof save.money !== 'number' || !Number.isFinite(save.money) || save.money < 0) return null;
  if (save.bestWanted !== undefined
    && (!Number.isInteger(save.bestWanted) || save.bestWanted < 0 || save.bestWanted > 5)) return null;
  if (save.bestMoney !== undefined
    && (typeof save.bestMoney !== 'number' || !Number.isFinite(save.bestMoney) || save.bestMoney < 0)) return null;
  if (save.bandages !== undefined
    && (!Number.isInteger(save.bandages) || save.bandages < 0)) return null;
  return save;
}
