// Police — chasing cars and foot officers. Reports damage/busted events.
import { POLICE, STREET_LINES } from './config.js';
import { policeCarCount } from './wanted.js';
import { makeCarMesh, makePedMesh } from './render.js';
import { range } from './random.js';

function streetPoint(rng, near, minD, maxD) {
  for (let tries = 0; tries < 12; tries++) {
    const vertical = rng() < 0.5;
    const line = STREET_LINES[Math.floor(rng() * STREET_LINES.length)];
    const along = range(rng, -180, 180);
    const p = vertical ? { x: line, z: along } : { x: along, z: line };
    const d = Math.hypot(p.x - near.x, p.z - near.z);
    if (d >= minD && d <= maxD) return p;
  }
  return { x: near.x + 60, z: near.z };
}

export class Police {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.cars = [];
    this.foot = [];
    this.footSpawnTimer = 0;
    this.surroundTime = 0;
  }

  _spawnCar(playerPos) {
    const p = streetPoint(this.rng, playerPos, 50, 80);
    const mesh = makeCarMesh(0x1a1d24, true);
    mesh.position.set(p.x, 0, p.z);
    this.scene.add(mesh);
    const car = { pos: p, heading: 0, speed: 0, mesh, ramCd: 0 };
    this.cars.push(car);
    return car;
  }

  _spawnFoot(playerPos) {
    const p = streetPoint(this.rng, playerPos, 35, 55);
    const mesh = makePedMesh(0x1a2a4a);
    mesh.position.set(p.x, 0, p.z);
    this.scene.add(mesh);
    const f = { pos: p, heading: 0, mesh, punchCd: 0 };
    this.foot.push(f);
    return f;
  }

  _remove(list, item) {
    this.scene.remove(item.mesh);
    const i = list.indexOf(item);
    if (i >= 0) list.splice(i, 1);
  }

  nearestDist(pos) {
    let best = null;
    for (const c of this.cars) {
      const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z);
      if (best === null || d < best) best = d;
    }
    for (const f of this.foot) {
      const d = Math.hypot(f.pos.x - pos.x, f.pos.z - pos.z);
      if (best === null || d < best) best = d;
    }
    return best;
  }

  // Step the police. Returns { damage, busted } for this frame.
  update(dt, playerPos, playerInCar, stars) {
    const events = { damage: 0, busted: false };
    // Keep the car count matched to the wanted level.
    const want = policeCarCount(stars);
    while (this.cars.length < want) this._spawnCar(playerPos);
    if (stars === 0) {
      for (const c of [...this.cars]) this._remove(this.cars, c);
      for (const f of [...this.foot]) this._remove(this.foot, f);
      this.surroundTime = 0;
      return events;
    }
    // Cars chase and ram.
    for (const car of [...this.cars]) {
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 150) {
        this._remove(this.cars, car);
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, dh));
      const speed = dist < 30 ? POLICE.CAR_SPEED_NEAR : POLICE.CAR_SPEED_FAR;
      car.speed += (speed - car.speed) * Math.min(1, dt * 1.5);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.set(car.pos.x, 0, car.pos.z);
      car.mesh.rotation.y = car.heading;
      car.ramCd -= dt;
      const hitDist = playerInCar ? 2.8 : 1.9;
      if (dist < hitDist && car.ramCd <= 0) {
        car.ramCd = 1.0;
        events.damage += 6;
      }
    }
    while (this.cars.length < want) this._spawnCar(playerPos);
    // Foot police from 2 stars, at most 3, one every 4 s.
    if (stars >= POLICE.FOOT_MIN_STARS) {
      this.footSpawnTimer -= dt;
      if (this.footSpawnTimer <= 0 && this.foot.length < POLICE.FOOT_MAX) {
        this.footSpawnTimer = POLICE.FOOT_SPAWN_EVERY;
        this._spawnFoot(playerPos);
      }
    }
    let nearCount = 0;
    for (const f of [...this.foot]) {
      const dx = playerPos.x - f.pos.x;
      const dz = playerPos.z - f.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 100 || stars < POLICE.FOOT_MIN_STARS) {
        this._remove(this.foot, f);
        continue;
      }
      if (playerInCar) {
        // On foot only: officers hold position while the player drives.
        continue;
      }
      f.heading = Math.atan2(dx, dz);
      f.pos.x += Math.sin(f.heading) * POLICE.FOOT_SPEED * dt;
      f.pos.z += Math.cos(f.heading) * POLICE.FOOT_SPEED * dt;
      f.mesh.position.set(f.pos.x, 0, f.pos.z);
      f.mesh.rotation.y = f.heading;
      f.punchCd -= dt;
      if (dist < POLICE.FOOT_PUNCH_RANGE && f.punchCd <= 0) {
        f.punchCd = POLICE.FOOT_PUNCH_COOLDOWN;
        events.damage += POLICE.FOOT_PUNCH_DAMAGE;
      }
      if (dist < POLICE.SURROUND_RADIUS) nearCount++;
    }
    if (!playerInCar && nearCount >= POLICE.SURROUND_COUNT) {
      this.surroundTime += dt;
      if (this.surroundTime >= POLICE.SURROUND_TIME) {
        events.busted = true;
        this.surroundTime = 0;
      }
    } else {
      this.surroundTime = 0;
    }
    return events;
  }
}
