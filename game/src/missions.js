// Missions — pure rules (rewards, fail/complete conditions). No browser APIs.
export const MISSIONS = [
  {
    id: 1,
    name: 'First Gear',
    reward: 250,
    briefing: 'Ms. Vane: "Rook, kamu berutang padaku. Curi mobil dan antar ke garasiku."',
    objective: 'Curi mobil, lalu antar ke garasi',
  },
  {
    id: 2,
    name: 'Harbor Run',
    reward: 400,
    briefing: 'Ms. Vane: "Ambil paket di dermaga Portside, antar ke Downtown. Jangan sampai wanted 5 bintang!"',
    objective: 'Ambil paket di Portside, antar ke Downtown',
    failAtWanted: 5,
  },
  {
    id: 3,
    name: 'Night Shift',
    reward: 500,
    briefing: 'Penumpang menunggu di Beachfront. Antar tepat waktu — 90 detik!',
    objective: 'Antar penumpang ke Downtown dalam 90 detik',
    timeLimit: 90,
  },
  {
    id: 4,
    name: 'The Vane Job',
    reward: 800,
    briefing: 'Ms. Vane: "Pekerjaan terakhir. Capai hideout — dan pastikan wanted NOL."',
    objective: 'Capai hideout dengan wanted 0',
  },
];

export function totalReward() {
  return MISSIONS.reduce((s, m) => s + m.reward, 0);
}

// Mission 2 fails the moment wanted reaches 5 stars.
export function failsAtWanted(missionId, stars) {
  const m = MISSIONS.find((x) => x.id === missionId);
  return !!m && !!m.failAtWanted && stars >= m.failAtWanted;
}

// Mission 4 completes only at the hideout with wanted exactly 0.
export function canComplete(missionId, atTarget, stars) {
  if (missionId === 4) return atTarget && stars === 0;
  return atTarget;
}

// Busted fine is flat: the smaller of your money and $150.
export function bustedFine(money) {
  return Math.min(Math.max(0, money), 150);
}

export function createMissionState() {
  return { index: 0, phase: 'IDLE', timer: 0, hasPackage: false, hasPassenger: false };
}

export function currentMission(state) {
  return MISSIONS[state.index] ?? null;
}

export function nextMission(state) {
  return MISSIONS[state.index + 1] ?? null;
}
