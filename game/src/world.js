// World — simulation glue: player, cars, wanted, missions, shop, save.
import { STEP, LANDMARKS, PLAYER, CAR, DAMAGE, REGEN_PER_SEC, SHOP } from './config.js';
import { mulberry32 } from './random.js';
import { WantedState, stealPoints } from './wanted.js';
import { MISSIONS, failsAtWanted, canComplete, bustedFine, createMissionState, currentMission } from './missions.js';
import { loadSave, storeSave } from './save.js';
import { buyBandage, buyDrink, buyBribe, useBandage } from './shop.js';
import { buildCity, collideCircle, clampToMap } from './city.js';
import { Traffic, lightPhase } from './traffic.js';
import { Police } from './police.js';
import { makePlayerMesh, makeCarMesh, makePedMesh } from './render.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class World {
  constructor(renderer, input, audio, hud, seed) {
    this.renderer = renderer;
    this.scene = renderer.scene;
    this.input = input;
    this.audio = audio;
    this.hud = hud;
    this.rng = mulberry32(seed);
    this.time = 0;
    this.clockMin = 18 * 60;
    this.phase = 'title'; // title | briefing | play | result | shop | paused | complete
    this.save = loadSave(typeof localStorage !== 'undefined' ? localStorage : null);
    this.money = this.save.money;
    this.bandages = this.save.bandages;
    this.bestWanted = this.save.bestWanted;
    this.wanted = new WantedState(0);
    this.mission = createMissionState();
    this.mission.index = Math.min(this.save.mission, 3);
    this.health = PLAYER.HEALTH_MAX;
    this.player = {
      pos: { x: LANDMARKS.GARAGE.x, z: LANDMARKS.GARAGE.z + 12 },
      heading: Math.PI,
      speed: 0,
      inCar: false,
      car: null,
      punchCd: 0,
      mesh: makePlayerMesh(),
    };
    this.scene.add(this.player.mesh);
    this.playerCars = [];
    this.city = buildCity(this.scene, this.rng);
    this.traffic = new Traffic(this.scene, this.rng);
    this.police = new Police(this.scene, this.rng);
    this.shopOpen = false;
    this.statusText = '';
    this.shotMode = false;
    this._hitCd = new Map();
    this._resultNext = null;
    this._save();
  }

  _save() {
    this.save = { money: this.money, mission: this.mission.index, bandages: this.bandages, bestWanted: this.bestWanted };
    storeSave(typeof localStorage !== 'undefined' ? localStorage : null, this.save);
  }

  get stars() {
    return this.wanted.stars;
  }

  // ---- game flow ----
  newGame() {
    this.money = 0;
    this.bandages = 0;
    this.mission = createMissionState();
    this.health = PLAYER.HEALTH_MAX;
    this.wanted = new WantedState(0);
    this._resetPlayerToGarage();
    this._save();
    this.startBriefing();
  }

  continueGame() {
    this.mission = createMissionState();
    this.mission.index = Math.min(this.save.mission, 3);
    this.health = PLAYER.HEALTH_MAX;
    this.wanted = new WantedState(0);
    this._resetPlayerToGarage();
    this.startBriefing();
  }

  _resetPlayerToGarage() {
    if (this.player.car) this._exitCar();
    this.player.pos = { x: LANDMARKS.GARAGE.x, z: LANDMARKS.GARAGE.z + 12 };
    this.player.heading = Math.PI;
    this.player.speed = 0;
  }

  startBriefing() {
    const m = currentMission(this.mission);
    if (!m) {
      this.phase = 'complete';
      this.hud.showResult('NEON HARBOR — TAMAT', 'Rook melunasi utangnya pada Ms. Vane. Kota ini milikmu sekarang.', 'Main Lagi');
      this._resultNext = 'title';
      return;
    }
    this.mission.phase = 'BRIEFING';
    this.phase = 'briefing';
    this.hud.showBriefing(m);
  }

  startMission() {
    this.mission.phase = 'ACTIVE';
    this.mission.timer = 0;
    this.mission.hasPackage = false;
    this.mission.hasPassenger = false;
    this.phase = 'play';
    this.hud.hideOverlays();
    this.hud.toast(currentMission(this.mission).objective);
    this._updateBeacon();
  }

  completeMission() {
    const m = currentMission(this.mission);
    this.money += m.reward;
    this.mission.index += 1;
    this.mission.phase = 'PASSED';
    this._save();
    this.audio.coin();
    this.phase = 'result';
    this._resultNext = 'briefing';
    this.hud.showResult(`Misi Selesai — ${m.name}`, `Hadiah $${m.reward}. Uangmu sekarang $${this.money}.`, 'Misi Berikutnya');
    this._updateBeacon();
  }

  failMission(reason) {
    this.mission.phase = 'FAILED';
    this.phase = 'result';
    this._resultNext = 'briefing';
    this.hud.showResult('Misi Gagal', reason, 'Coba Lagi');
    this._updateBeacon();
  }

  busted() {
    const fine = bustedFine(this.money);
    this.money -= fine;
    this.health = PLAYER.HEALTH_MAX;
    this.wanted = new WantedState(0);
    if (this.player.car) this._exitCar();
    this.player.pos = { x: LANDMARKS.GARAGE.x, z: LANDMARKS.GARAGE.z + 12 };
    this.player.heading = Math.PI;
    this._save();
    if (this.mission.phase === 'ACTIVE') {
      this.failMission(`BUSTED! Polisi menangkapmu. Denda $${fine}. Misi dimulai lagi dari briefing.`);
    } else {
      this.hud.toast(`BUSTED! Denda $${fine}. Kamu kembali ke garasi.`);
    }
  }

  missionTarget() {
    const m = currentMission(this.mission);
    if (!m || this.mission.phase !== 'ACTIVE') return null;
    if (m.id === 1) return LANDMARKS.GARAGE;
    if (m.id === 2) return this.mission.hasPackage ? LANDMARKS.DOWNTOWN_DROP : LANDMARKS.DOCKS_PICKUP;
    if (m.id === 3) return this.mission.hasPassenger ? LANDMARKS.DOWNTOWN_DROP : LANDMARKS.BEACH_PICKUP;
    if (m.id === 4) return LANDMARKS.HIDEOUT;
    return null;
  }

  _updateBeacon() {
    const t = this.missionTarget();
    if (t) {
      this.city.beacon.position.x = t.x;
      this.city.beacon.position.z = t.z;
      this.city.beacon.visible = true;
    } else {
      this.city.beacon.visible = false;
    }
  }

  // ---- actions ----
  tryEnterCar() {
    if (this.player.inCar) {
      this._exitCar();
      return;
    }
    const car = this._nearestEnterableCar();
    if (!car) return;
    if (car.driver) {
      // The driver bails out and flees.
      this._spawnFleeingPed(car.pos);
      car.driver = false;
    }
    this.traffic.takeCar(car);
    const wasOwned = car.owned;
    car.owned = true;
    this.player.inCar = true;
    this.player.car = car;
    this.player.speed = 0;
    this.player.mesh.visible = false;
    this.wanted.add(stealPoints(wasOwned));
    this.audio.pickup();
    if (!wasOwned) this.hud.toast('Mobil dicuri! Wanted naik.');
  }

  _nearestEnterableCar() {
    let best = this.traffic.nearestCar(this.player.pos, 4.5);
    let bestD = best ? dist(best.pos, this.player.pos) : 99;
    for (const car of this.playerCars) {
      const d = dist(car.pos, this.player.pos);
      if (d < 4.5 && d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
  }

  _exitCar() {
    const car = this.player.car;
    if (!car) return;
    this.player.inCar = false;
    this.player.car = null;
    this.player.pos = { x: car.pos.x + Math.sin(car.heading + Math.PI / 2) * 3, z: car.pos.z + Math.cos(car.heading + Math.PI / 2) * 3 };
    this.player.heading = car.heading;
    this.player.mesh.visible = true;
    if (!this.playerCars.includes(car)) this.playerCars.push(car);
  }

  tryPunch() {
    if (this.player.inCar || this.player.punchCd > 0) return;
    this.player.punchCd = PLAYER.PUNCH_COOLDOWN;
    this.audio.punch();
    const ped = this.traffic.nearestPed(this.player.pos, PLAYER.PUNCH_RANGE);
    if (ped) {
      this.traffic.flee(ped, this.player.pos);
      return;
    }
    // Punching a foot officer: +150 wanted, shove them back.
    let best = null;
    let bestD = PLAYER.PUNCH_RANGE;
    for (const f of this.police.foot) {
      const d = dist(f.pos, this.player.pos);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    if (best) {
      this.wanted.add(150);
      const dx = best.pos.x - this.player.pos.x;
      const dz = best.pos.z - this.player.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      best.pos.x += (dx / d) * 5;
      best.pos.z += (dz / d) * 5;
      best.mesh.position.set(best.pos.x, 0, best.pos.z);
      this.hud.toast('Kamu memukul polisi! Wanted naik drastis.');
    }
  }

  tryUseBandage() {
    const r = useBandage(this.bandages, this.health);
    if (!r) {
      this.hud.toast(this.bandages <= 0 ? 'Tidak ada perban. Beli di Gry Market.' : 'Health sudah penuh.');
      return;
    }
    this.bandages = r.bandages;
    this.health = r.health;
    this.hud.toast(`Perban dipakai. Health ${Math.round(this.health)}.`);
  }

  tryOpenShop() {
    if (this.player.inCar) return false;
    if (dist(this.player.pos, LANDMARKS.SHOP_POS) > 7) return false;
    this.phase = 'shop';
    this.shopOpen = true;
    this.hud.showShop(this.money, this.bandages, this.stars, this.police.nearestDist(this.player.pos));
    return true;
  }

  closeShop() {
    this.phase = 'play';
    this.shopOpen = false;
    this.hud.hideOverlays();
  }

  buyItem(id) {
    if (id === 'bandage') {
      const r = buyBandage(this.money, this.bandages);
      if (!r) return this.hud.toast('Uang tidak cukup atau perban penuh (maks 3).');
      this.money = r.money;
      this.bandages = r.bandages;
      this.hud.toast('Perban dibeli. Tekan H untuk memakai.');
    } else if (id === 'drink') {
      const r = buyDrink(this.money, this.health);
      if (!r) return this.hud.toast('Uang tidak cukup.');
      this.money = r.money;
      this.health = r.health;
      this.hud.toast(`Minuman energi! Health ${Math.round(this.health)}.`);
    } else if (id === 'bribe') {
      const r = buyBribe(this.money, this.stars, this.police.nearestDist(this.player.pos));
      if (!r) return this.hud.toast('Tidak bisa menyuap sekarang (butuh wanted 1-2, tanpa polisi < 30 m).');
      this.money = r.money;
      this.wanted.bribe();
      this.hud.toast('Polisi disuap. Wanted -1 bintang.');
    }
    this.audio.coin();
    this.hud.showShop(this.money, this.bandages, this.stars, this.police.nearestDist(this.player.pos));
  }

  _spawnFleeingPed(pos) {
    const mesh = makePedMesh(0x8a8a8a);
    mesh.position.set(pos.x, 0, pos.z);
    this.scene.add(mesh);
    const ped = {
      pos: { x: pos.x + 2, z: pos.z },
      heading: 0,
      loop: [{ x: pos.x + 40, z: pos.z }, { x: pos.x + 40, z: pos.z + 40 }],
      wp: 0,
      speed: 5,
      state: 'flee',
      timer: 3,
      fleeDir: { x: 1, z: 0 },
      mesh,
    };
    this.traffic.peds.push(ped);
  }

  // ---- simulation ----
  step() {
    const dt = STEP;
    this.time += dt;
    this.clockMin += dt * 0.5;
    this.player.punchCd = Math.max(0, this.player.punchCd - dt);
    if (this.phase !== 'play') {
      this._renderOnly();
      return;
    }
    this._handleKeys();
    this._updatePlayer(dt);
    this.traffic.update(dt);
    const ppos = this._activePos();
    const ev = this.police.update(dt, ppos, this.player.inCar, this.stars);
    if (ev.damage > 0) {
      this.health -= ev.damage;
      this.audio.crash();
    }
    if (ev.busted) {
      this.busted();
      this._renderOnly();
      return;
    }
    this._collisions(dt);
    // Wanted decay when no police is near.
    const nearest = this.police.nearestDist(ppos);
    this.wanted.decay(dt, nearest !== null && nearest < 45);
    if (this.stars > this.bestWanted) this.bestWanted = this.stars;
    if (this.stars === 0) this.health = Math.min(PLAYER.HEALTH_MAX, this.health + REGEN_PER_SEC * dt);
    this._updateMission(dt);
    if (this.health <= 0) {
      this.busted();
      this._renderOnly();
      return;
    }
    // Traffic light visuals.
    const phase = lightPhase(this.time);
    for (const l of this.city.lights) {
      const nsGreen = phase === 'NS';
      l.red.material.color.setHex(nsGreen ? 0x330000 : 0xff2222);
      l.green.material.color.setHex(nsGreen ? 0x22ff66 : 0x003300);
    }
    this._updateAudio();
    this._renderOnly();
  }

  _handleKeys() {
    const inp = this.input;
    if (inp.wasPressed('KeyE')) {
      if (!this.tryOpenShop()) this.tryEnterCar();
    }
    if (inp.wasPressed('KeyF')) this.tryPunch();
    if (inp.wasPressed('KeyH')) this.tryUseBandage();
    if (inp.wasPressed('Escape')) {
      this.phase = 'paused';
      this.hud.showOnly('pause-screen');
    }
    if (inp.touchCar) this.tryEnterCar();
    if (inp.touchHit) this.tryPunch();
  }

  _activePos() {
    return this.player.inCar && this.player.car ? this.player.car.pos : this.player.pos;
  }

  _updatePlayer(dt) {
    const inp = this.input;
    const axes = inp.moveAxes();
    if (this.player.inCar) {
      const car = this.player.car;
      const fwd = axes.y;
      const steer = axes.x;
      if (fwd > 0) car.speed += CAR.ACCEL * dt;
      else if (fwd < 0) car.speed -= (car.speed > 0.5 ? CAR.BRAKE : CAR.ACCEL * 0.6) * dt;
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
      if (inp.touchBrake || inp.down('Space')) {
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.HANDBRAKE_DECEL * dt);
      }
      car.speed = Math.max(-CAR.MAX_REVERSE, Math.min(CAR.MAX_SPEED, car.speed));
      const dirSign = car.speed >= 0 ? 1 : -1;
      car.heading += steer * CAR.TURN_RATE * dt * Math.min(1, Math.abs(car.speed) / 8) * dirSign;
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      clampToMap(car.pos, 4);
      collideCircle(car.pos, 1.7, this.city.colliders);
      car.mesh.position.set(car.pos.x, 0, car.pos.z);
      car.mesh.rotation.y = car.heading;
      this.player.pos = { ...car.pos };
      this.player.heading = car.heading;
      this.player.speed = Math.abs(car.speed);
    } else {
      const speed = inp.run ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED;
      this.player.heading += -axes.x * 2.6 * dt;
      const mx = Math.sin(this.player.heading) * axes.y;
      const mz = Math.cos(this.player.heading) * axes.y;
      this.player.pos.x += mx * speed * dt;
      this.player.pos.z += mz * speed * dt;
      clampToMap(this.player.pos, 4);
      collideCircle(this.player.pos, 0.6, this.city.colliders);
      this.player.speed = Math.abs(axes.y) * speed;
      this.player.mesh.position.set(this.player.pos.x, 0, this.player.pos.z);
      this.player.mesh.rotation.y = this.player.heading;
    }
  }

  _collisions(dt) {
    if (!this.player.inCar) return;
    const car = this.player.car;
    // Player car vs traffic cars.
    for (const other of this.traffic.allCars()) {
      const key = other;
      const d = dist(car.pos, other.pos);
      if (d < 3.4) {
        const cd = this._hitCd.get(key) || 0;
        if (cd <= 0) {
          this._hitCd.set(key, 1.2);
          this.health -= DAMAGE.COLLISION;
          this.wanted.add(30);
          this.audio.crash();
          car.speed *= 0.4;
        }
        // Push apart.
        const push = (3.4 - d) / 2;
        const nx = (car.pos.x - other.pos.x) / (d || 1);
        const nz = (car.pos.z - other.pos.z) / (d || 1);
        car.pos.x += nx * push;
        car.pos.z += nz * push;
      }
    }
    for (const [k, v] of this._hitCd) {
      const nv = v - dt;
      if (nv <= 0) this._hitCd.delete(k);
      else this._hitCd.set(k, nv);
    }
    // Player car vs pedestrians.
    const ped = this.traffic.nearestPed(car.pos, 2.2);
    if (ped && Math.abs(car.speed) > 3) {
      this.traffic.knockDown(ped);
      this.wanted.add(80);
      this.audio.crash();
      car.speed *= 0.6;
      this.hud.toast('Kamu menabrak pejalan kaki! Wanted naik.');
    }
    // Player car vs police cars: hitting one adds wanted.
    for (const pc of this.police.cars) {
      const d = dist(car.pos, pc.pos);
      if (d < 3.2) {
        const key = pc;
        const cd = this._hitCd.get(key) || 0;
        if (cd <= 0) {
          this._hitCd.set(key, 1.2);
          this.wanted.add(60);
          this.health -= DAMAGE.COLLISION;
          this.audio.crash();
          car.speed *= 0.4;
        }
      }
    }
  }

  _updateMission(dt) {
    if (this.mission.phase !== 'ACTIVE') return;
    const m = currentMission(this.mission);
    if (!m) return;
    const ppos = this._activePos();
    if (m.id === 2 && this.stars >= 5) {
      this.failMission('Wanted mencapai 5 bintang — paket gagal diantar.');
      return;
    }
    if (m.id === 3 && this.mission.hasPassenger) {
      this.mission.timer += dt;
      if (this.mission.timer >= m.timeLimit) {
        this.failMission('Waktu habis — penumpang kecewa dan pergi.');
        return;
      }
    }
    const target = this.missionTarget();
    if (!target) return;
    const d = dist(ppos, target);
    if (m.id === 1) {
      if (this.player.inCar && d < 10) this.completeMission();
    } else if (m.id === 2) {
      if (!this.mission.hasPackage && d < 6) {
        this.mission.hasPackage = true;
        this.audio.pickup();
        this.hud.toast('Paket diambil! Antar ke Downtown.');
        this._updateBeacon();
      } else if (this.mission.hasPackage && d < 8) {
        this.completeMission();
      }
    } else if (m.id === 3) {
      if (!this.mission.hasPassenger && d < 6) {
        this.mission.hasPassenger = true;
        this.mission.timer = 0;
        this.audio.pickup();
        this.hud.toast('Penumpang naik! 90 detik menuju Downtown.');
        this._updateBeacon();
      } else if (this.mission.hasPassenger && d < 8) {
        this.completeMission();
      }
    } else if (m.id === 4) {
      if (canComplete(4, d < 8, this.stars)) {
        this.completeMission();
      } else if (d < 8 && this.stars > 0) {
        this.statusText = 'Wanted harus 0 untuk menyelesaikan misi ini!';
      }
    }
  }

  _updateAudio() {
    if (!this.audio.ctx) return;
    const speed01 = this.player.inCar ? Math.abs(this.player.car.speed) / CAR.MAX_SPEED : 0;
    this.audio.setEngine(speed01, this.player.inCar);
    this.audio.setSiren(this.stars >= 1);
    this.audio.update(STEP);
  }

  _renderOnly() {
    // Camera.
    const p = this.player;
    if (this.shotMode && this.shotCam) {
      const c = this.shotCam;
      this.renderer.setCamera(c.x, c.y, c.z, c.lx, c.ly, c.lz);
    } else if (p.inCar && p.car) {
      this.renderer.chaseCamera(p.car.pos, p.car.heading, 12, 5, this.input.camYaw, this.input.camPitch);
    } else {
      this.renderer.chaseCamera(p.pos, p.heading, 9, 4, this.input.camYaw, this.input.camPitch);
    }
    this.renderer.render();
    this._updateHud();
  }

  _updateHud() {
    const m = currentMission(this.mission);
    const target = this.missionTarget();
    const hours = Math.floor(this.clockMin / 60) % 24;
    const mins = Math.floor(this.clockMin % 60);
    let objective = '—';
    if (m && this.mission.phase === 'ACTIVE') {
      objective = m.objective;
      if (m.id === 3 && this.mission.hasPassenger) {
        objective += ` (${Math.max(0, Math.ceil(m.timeLimit - this.mission.timer))} dtk)`;
      }
    } else if (m && this.mission.phase === 'BRIEFING') {
      objective = 'Baca briefing, lalu mulai misi.';
    }
    this.hud.update({
      health: this.health,
      money: this.money,
      bandages: this.bandages,
      stars: this.stars,
      inCar: this.player.inCar,
      speedKmh: this.player.inCar ? Math.abs(this.player.car.speed) * 3.6 : 0,
      clock: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
      objective,
      missionName: m ? `Misi ${m.id} — ${m.name}` : 'Neon Harbor',
      statusText: this.statusText,
    });
    this.statusText = '';
    this.hud.drawMinimap({
      player: { x: this._activePos().x, z: this._activePos().z, heading: this.player.heading },
      cars: this.traffic.allCars().map((c) => c.pos),
      police: [...this.police.cars.map((c) => c.pos), ...this.police.foot.map((f) => f.pos)],
      target,
      blink: Math.floor(this.time * 2) % 2 === 0,
    });
  }

  // Render one frame without stepping the simulation (screenshot mode).
  renderFrame() {
    this._renderOnly();
  }

  snapshot() {
    return {
      money: this.money,
      mission: this.mission.index,
      stars: this.stars,
      health: Math.round(this.health),
      inCar: this.player.inCar,
      pos: { ...this._activePos() },
    };
  }

  debugState() {
    const m = currentMission(this.mission);
    return {
      phase: this.phase,
      mission: m ? m.name : null,
      missionPhase: this.mission.phase,
      wanted: this.stars,
      health: Math.round(this.health),
      money: this.money,
      inCar: this.player.inCar,
      pos: this._activePos(),
      target: this.missionTarget(),
      policeCars: this.police.cars.length,
      footPolice: this.police.foot.length,
    };
  }

  // ---- screenshot poses (called by shots.js) ----
  setupShot(pose) {
    this.shotMode = true;
    this.phase = 'play';
    this.hud.hideOverlays();
    // Reset to a clean state, then apply the pose.
    this.wanted = new WantedState(pose.wanted || 0);
    this.mission = createMissionState();
    this.mission.index = pose.missionIndex ?? 0;
    this.mission.phase = 'ACTIVE';
    this.mission.hasPackage = !!pose.hasPackage;
    this.mission.hasPassenger = !!pose.hasPassenger;
    if (pose.missionIndex === 1) this.mission.hasPackage = true;
    this.health = PLAYER.HEALTH_MAX;
    // Clear police, then place the pose's officers.
    for (const c of [...this.police.cars]) this.police._remove(this.police.cars, c);
    for (const f of [...this.police.foot]) this.police._remove(this.police.foot, f);
    // Player on foot or in a car.
    if (pose.inCar) {
      if (!this.player.inCar) {
        const mesh = makeCarMesh(pose.carColor ?? 0x8a2f2f, false);
        mesh.position.set(pose.pos.x, 0, pose.pos.z);
        this.scene.add(mesh);
        const car = { pos: { ...pose.pos }, heading: pose.heading, speed: 0, mesh, owned: true, driver: false, parked: false, loop: null, wp: 0, color: pose.carColor ?? 0x8a2f2f };
        this.playerCars.push(car);
        this.player.inCar = true;
        this.player.car = car;
        this.player.mesh.visible = false;
      }
      this.player.car.pos = { ...pose.pos };
      this.player.car.heading = pose.heading;
      this.player.car.mesh.position.set(pose.pos.x, 0, pose.pos.z);
      this.player.car.mesh.rotation.y = pose.heading;
      this.player.pos = { ...pose.pos };
      this.player.heading = pose.heading;
    } else {
      if (this.player.inCar) this._exitCar();
      this.player.pos = { ...pose.pos };
      this.player.heading = pose.heading;
      this.player.mesh.position.set(pose.pos.x, 0, pose.pos.z);
      this.player.mesh.rotation.y = pose.heading;
    }
    // Police cars at fixed offsets for the chase shot.
    for (const off of pose.policeCars || []) {
      const c = this.police._spawnCar(this.player.pos);
      c.pos.x = pose.pos.x + off.x;
      c.pos.z = pose.pos.z + off.z;
      c.heading = pose.heading;
      c.mesh.position.set(c.pos.x, 0, c.pos.z);
      c.mesh.rotation.y = c.heading;
    }
    this._updateBeacon();
    this.shotCam = pose.cam;
    // Freeze the simulation for the shot: render a few frames, then signal ready.
    this._renderOnly();
  }
}
