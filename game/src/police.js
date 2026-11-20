// Neon Harbor — police AI: chase cars + foot police.
import { POLICE } from './config.js';
import { mulberry32 } from './random.js';

export function createPolice() {
  return {
    cars: [], // {x, z, angle, speed}
    foot: [], // {x, z, spawnTimer}
    spawnTimer: 0,
  };
}

export function policeCarCount(stars) {
  return Math.min(1 + stars, 5);
}

// Keep the police-car fleet at the right size for the wanted level.
// New cars spawn behind the player.
export function syncPoliceCars(p, stars, px, pz, playerAngle) {
  const want = policeCarCount(stars);
  const rand = mulberry32(1234 + Math.floor(performance.now() / 1000));
  while (p.cars.length < want) {
    const back = 26 + rand() * 10;
    const side = (rand() - 0.5) * 20;
    const bx = px - Math.sin(playerAngle) * back + Math.cos(playerAngle) * side;
    const bz = pz - Math.cos(playerAngle) * back - Math.sin(playerAngle) * side;
    p.cars.push({ x: bx, z: bz, angle: playerAngle, speed: 0 });
  }
  while (p.cars.length > want) p.cars.pop();
}

export function stepPoliceCars(p, dt, px, pz, stars = 0) {
  for (const c of p.cars) {
    if (stars === 0) {
      // No wanted level: patrol straight ahead, do not chase or ram.
      // Turn around at the map edge.
      if (Math.abs(c.x) > 195 || Math.abs(c.z) > 195) c.angle += Math.PI;
      c.x += Math.sin(c.angle) * 9 * dt;
      c.z += Math.cos(c.angle) * 9 * dt;
      continue;
    }
    const dx = px - c.x;
    const dz = pz - c.z;
    const dist = Math.hypot(dx, dz) || 1;
    const targetAngle = Math.atan2(dx, dz);
    let diff = targetAngle - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const speed = dist < 25 ? POLICE.CHASE_NEAR : POLICE.CHASE_FAR;
    c.speed = speed;
    c.x += Math.sin(c.angle) * speed * dt;
    c.z += Math.cos(c.angle) * speed * dt;
  }
}

// Foot police: spawn from 2 stars, max 3, every 4 s, near the player.
export function stepFootPolice(p, dt, stars, px, pz, onFoot) {
  if (stars < POLICE.FOOT_MIN_STARS) {
    p.foot = [];
    p.spawnTimer = 0;
    return;
  }
  p.spawnTimer += dt;
  if (p.spawnTimer >= POLICE.FOOT_SPAWN_SEC && p.foot.length < POLICE.FOOT_MAX) {
    p.spawnTimer = 0;
    const a = Math.random() * Math.PI * 2;
    p.foot.push({ x: px + Math.cos(a) * 22, z: pz + Math.sin(a) * 22 });
  }
  for (const f of p.foot) {
    const dx = px - f.x;
    const dz = pz - f.z;
    const d = Math.hypot(dx, dz) || 1;
    f.x += (dx / d) * POLICE.FOOT_SPEED * dt;
    f.z += (dz / d) * POLICE.FOOT_SPEED * dt;
  }
  // Foot police only matter when the player is on foot; keep them listed anyway.
  void onFoot;
}

export function nearestPoliceDist(p, px, pz) {
  let best = null;
  for (const c of p.cars) {
    const d = Math.hypot(c.x - px, c.z - pz);
    if (best === null || d < best) best = d;
  }
  for (const f of p.foot) {
    const d = Math.hypot(f.x - px, f.z - pz);
    if (best === null || d < best) best = d;
  }
  return best;
}

export function footPoliceNear(p, px, pz, radius) {
  let n = 0;
  for (const f of p.foot) {
    if (Math.hypot(f.x - px, f.z - pz) <= radius) n++;
  }
  return n;
}
