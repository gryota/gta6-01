// Neon Harbor — screenshot poses (?shot=start|drive|chase|mission&seed=1).
export const SHOTS = ['start', 'drive', 'chase', 'mission'];

export function readShotParam() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (shot && SHOTS.includes(shot)) return shot;
  return null;
}

export function readSeedParam() {
  const q = new URLSearchParams(window.location.search);
  const seed = Number(q.get('seed'));
  return Number.isFinite(seed) ? seed : 1;
}
