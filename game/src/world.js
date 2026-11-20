// Neon Harbor — world simulation: player, driving, stealing, collisions,
// wanted, police, missions, shop, save, beacon. Pure game logic + mesh sync.
import * as THREE from 'three';
import { STEP, MAP_HALF, LANDMARKS, PLAYER, WANTED, POLICE, MISSION_TIMER_SEC, CLOCK_START_HOUR } from './config.js';
import { createWanted, addPoints, decay, stealPoints, bribePoints, updateSurrounded, policeCarCount, bustedFine } from './wanted.js';
import { createMissions, PHASE, startBriefing, acceptMission, passMission, failMission, resetToIdle, checkM2Fail, tickTimer, canFinishM4 } from './missions.js';
import { createShopState, buyBandage, buyDrink, buyBribe, useBandage } from './shop.js';
import { defaultSave, loadSave, storeSave } from './save.js';
import { createTraffic, stepTraffic, carPosition, pedPosition, nearestStealable } from './traffic.js';
import { createPolice, syncPoliceCars, stepPoliceCars, stepFootPolice, nearestPoliceDist, footPoliceNear } from './police.js';
import { makeCarMesh, makePersonMesh, makePlayerMesh, updateCamera } from './render.js';
import { clampToMap, isOnRoad } from './city.js';
import { moveAxes, consumePressed, isRun, clearPressed } from './input.js';
import { ensureAudio, setEngine, setSiren, playPickup, playCoin, playCrash, playPunch } from './audio.js';

export function createWorld(scene, city, hud, input, audio) {
  const save = loadSave(localStorage);
  const w = {
    scene, city, hud, input, audio,
    time: 0,
    clockMin: CLOCK_START_HOUR * 60,
    money: save.money,
    bestWanted: save.bestWanted,
    player: {
      x: 0, z: 30, angle: 0, health: PLAYER.HEALTH,
      inCar: false, car: null, speed: 0, onFoot: true,
    },
    camYaw: 0,
    camState: { x: 0, y: 8, z: 20 },
    wanted: createWanted(),
    missions: createMissions(),
    police: createPolice(),
    traffic: createTraffic(),
    shop: createShopState(),
    shopOpen: false,
    screen: 'title', // title | playing | busted | passed | briefing
    passedTimer: 0,
    bustedTimer: 0,
    status: '',
    statusTimer: 0,
    objective: '',
    marker: null,
    shotMode: null,
    playerMesh: makePlayerMesh(),
    carMeshes: new Map(),
    pedMeshes: [],
    policeCarMeshes: [],
    policeFootMeshes: [],
    audioOn: false,
  };
  w.missions.unlocked = Math.max(1, Math.min(5, save.unlocked || 1));
  w.shop.bandages = save.bandages || 0;

  // Meshes for traffic.
  for (const car of w.traffic.cars) {
    const mesh = makeCarMesh(car.color);
    scene.add(mesh);
    w.carMeshes.set(car.id, mesh);
  }
  for (const p of w.traffic.peds) {
    const mesh = makePersonMesh([0xc2a23a, 0x3a9e5f, 0x8a5f9e, 0xc2702e][p.id % 4]);
    scene.add(mesh);
    w.pedMeshes.push(mesh);
  }
  scene.add(w.playerMesh);
  return w;
}

function saveGame(w) {
  storeSave(localStorage, {
    money: w.money,
    unlocked: w.missions.unlocked,
    bandages: w.shop.bandages,
    bestWanted: w.bestWanted,
  });
}

function setStatus(w, text, sec = 3) {
  w.status = text;
  w.statusTimer = sec;
}

function missionMarker(w) {
  const m = w.missions;
  if (m.phase !== PHASE.ACTIVE || !m.current) return null;
  const id = m.current.id;
  if (id === 1) return m.stage === 0 ? null : LANDMARKS.GARAGE;
  if (id === 2) return m.stage === 0 ? LANDMARKS.DOCKS_PICKUP : LANDMARKS.DOWNTOWN_DROP;
  if (id === 3) return m.stage === 0 ? LANDMARKS.PASSENGER_PICKUP : LANDMARKS.PASSENGER_DROP;
  if (id === 4) return LANDMARKS.ESCAPE_POINT;
  return null;
}

function missionObjective(w) {
  const m = w.missions;
  if (m.phase === PHASE.BRIEFING && m.current) {
    return `<b>${m.current.name}</b> — ${m.current.briefing}<br><span style="opacity:.8">Tekan Enter untuk terima misi</span>`;
  }
  if (m.phase !== PHASE.ACTIVE || !m.current) {
    const next = m.unlocked <= 4 ? m.unlocked : null;
    return next
      ? `Tidak ada misi aktif. Dekati <b>Garage</b> dan tekan E untuk misi ${next}.<br>Uang: $${w.money}`
      : `Semua misi selesai! Total hadiah $1.950. Bebas berkeliling Neon Harbor.`;
  }
  const id = m.current.id;
  let text = '';
  if (id === 1) text = m.stage === 0 ? 'Curi sebuah mobil (dekati mobil, tekan E)' : 'Antar mobil ke Garage';
  if (id === 2) text = m.stage === 0 ? 'Ambil paket di Docks (Portside)' : 'Antar paket ke Downtown Drop — jangan sampai 5 bintang!';
  if (id === 3) text = m.stage === 0 ? 'Jemput penumpang di utara' : `Antar penumpang ke Rooftop Bar — ${Math.ceil(m.timer)} dtk tersisa`;
  if (id === 4) text = 'Capai titik pelarian — tiba dengan wanted 0 bintang';
  return `<b>${m.current.name}</b> — ${text}<br>Hadiah: $${m.current.reward}`;
}

function nearPoint(x, z, p, r) {
  return Math.hypot(x - p.x, z - p.z) <= r;
}

function resolveSolids(w, x, z, radius) {
  // Push out of building footprints.
  for (const s of w.city.solids) {
    const dx = x - s.x;
    const dz = z - s.z;
    const ox = s.w / 2 + radius - Math.abs(dx);
    const oz = s.d / 2 + radius - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) x = s.x + Math.sign(dx || 1) * (s.w / 2 + radius);
      else z = s.z + Math.sign(dz || 1) * (s.d / 2 + radius);
    }
  }
  return { x, z };
}

export function startGame(w, fresh) {
  if (fresh) {
    w.money = 0;
    w.missions.unlocked = 1;
    w.shop.bandages = 0;
    w.bestWanted = 0;
  }
  w.player.health = PLAYER.HEALTH;
  w.player.x = 0;
  w.player.z = 30;
  w.player.angle = 0;
  w.player.inCar = false;
  w.player.car = null;
  w.player.speed = 0;
  w.wanted.points = 0;
  w.wanted.stars = 0;
  w.police.cars = [];
  w.police.foot = [];
  w.screen = 'playing';
  w.status = '';
  resetToIdle(w.missions);
  ensureAudio(w.audio);
  saveGame(w);
}

function doBusted(w) {
  const fine = bustedFine(w.money);
  w.money -= fine;
  w.player.health = PLAYER.HEALTH;
  w.player.x = LANDMARKS.GARAGE.x;
  w.player.z = LANDMARKS.GARAGE.z;
  w.player.angle = 0;
  w.player.inCar = false;
  w.player.car = null;
  w.player.speed = 0;
  w.wanted.points = 0;
  w.wanted.stars = 0;
  w.police.cars = [];
  w.police.foot = [];
  if (w.missions.phase === PHASE.ACTIVE) {
    failMission(w.missions, 'BUSTED — misi gagal, mulai lagi dari briefing.');
  }
  w.screen = 'busted';
  w.bustedTimer = 0;
  setStatus(w, `BUSTED — denda $${fine}`, 4);
  saveGame(w);
}

function trySteal(w) {
  const p = w.player;
  const car = nearestStealable(w.traffic, p.x, p.z, 5);
  if (!car) return false;
  const wasOwned = car.owned;
  car.owned = true;
  car.parked = false;
  // Stealing a moving AI car: it stops and becomes yours.
  const pos = carPosition(car);
  car.px = pos.x;
  car.pz = pos.z;
  car.angle = pos.angle;
  car.parked = true;
  p.car = car;
  p.inCar = true;
  p.speed = 0;
  p.angle = car.angle;
  const gained = stealPoints(wasOwned);
  if (gained > 0) {
    addPoints(w.wanted, gained);
    setStatus(w, 'Mobil dicuri! Wanted +1 bintang', 3);
    playPickup(w.audio);
  } else {
    setStatus(w, 'Masuk ke mobilmu sendiri', 2);
  }
  if (w.missions.phase === PHASE.ACTIVE && w.missions.current.id === 1 && w.missions.stage === 0) {
    w.missions.stage = 1;
    setStatus(w, 'Mobil didapat — antar ke Garage', 3);
  }
  return true;
}

function exitCar(w) {
  const p = w.player;
  if (!p.car) return;
  const car = p.car;
  const pos = carPosition(car);
  p.x = pos.x - Math.sin(car.angle) * 0 + Math.cos(car.angle) * 3;
  p.z = pos.z + Math.sin(car.angle) * 3;
  const c = clampToMap(p.x, p.z);
  p.x = c.x;
  p.z = c.z;
  p.angle = car.angle;
  p.inCar = false;
  p.car = null;
  p.speed = 0;
}

function punch(w) {
  const p = w.player;
  if (p.inCar) return;
  playPunch(w.audio);
  // Hit the nearest foot police or pedestrian in front.
  let best = null;
  let bestD = PLAYER.PUNCH_RANGE;
  for (const f of w.police.foot) {
    const d = Math.hypot(f.x - p.x, f.z - p.z);
    if (d < bestD) { bestD = d; best = { kind: 'police', ref: f }; }
  }
  if (!best) {
    for (const ped of w.traffic.peds) {
      const pp = pedPosition(ped);
      const d = Math.hypot(pp.x - p.x, pp.z - p.z);
      if (d < bestD) { bestD = d; best = { kind: 'ped', ref: ped }; }
    }
  }
  if (best && best.kind === 'police') {
    addPoints(w.wanted, WANTED.PUNCH_POLICE);
    setStatus(w, 'Kamu memukul polisi! Wanted naik', 3);
    // Knock the officer back.
    best.ref.x += Math.sin(p.angle) * 4;
    best.ref.z += Math.cos(p.angle) * 4;
  } else if (best) {
    // Pedestrian stumbles away.
    const pp = pedPosition(best.ref);
    best.ref.pos += best.ref.dir * 12;
    void pp;
    setStatus(w, 'Kamu memukul pejalan kaki!', 2);
  }
}

function updatePlayerOnFoot(w, dt, input) {
  const p = w.player;
  const axes = moveAxes(input);
  const run = isRun(input);
  const speed = run ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED;
  // Camera-relative movement.
  const fx = Math.sin(w.camYaw);
  const fz = Math.cos(w.camYaw);
  const rx = -Math.cos(w.camYaw);
  const rz = Math.sin(w.camYaw);
  let mx = fx * axes.y + rx * axes.x;
  let mz = fz * axes.y + rz * axes.x;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len;
    mz /= len;
    p.x += mx * speed * dt;
    p.z += mz * speed * dt;
    p.angle = Math.atan2(mx, mz);
  }
  const c = clampToMap(p.x, p.z);
  p.x = c.x;
  p.z = c.z;
  const r = resolveSolids(w, p.x, p.z, 0.6);
  p.x = r.x;
  p.z = r.z;
  // Camera orbit from mouse drag.
  w.camYaw -= input.mouseDX * 0.005;
  input.mouseDX = 0;
  input.mouseDY = 0;
}

function updateDriving(w, dt, input) {
  const p = w.player;
  const car = p.car;
  if (!car) { p.inCar = false; return; }
  const axes = moveAxes(input);
  if (axes.y > 0) p.speed += PLAYER.CAR_ACCEL * dt;
  else if (axes.y < 0) p.speed -= PLAYER.CAR_BRAKE * dt * 0.7;
  else p.speed -= Math.sign(p.speed) * 4 * dt;
  if (input.keys.has('brake')) p.speed -= Math.sign(p.speed) * 22 * dt;
  p.speed = Math.max(-8, Math.min(PLAYER.CAR_SPEED_MAX, p.speed));
  if (Math.abs(p.speed) < 0.2 && axes.y === 0) p.speed = 0;
  const steer = axes.x * PLAYER.CAR_TURN * Math.min(1, Math.abs(p.speed) / 12) * Math.sign(p.speed || 1);
  p.angle += steer * dt;
  car.angle = p.angle;
  car.px = (car.px ?? 0) + Math.sin(p.angle) * p.speed * dt;
  car.pz = (car.pz ?? 0) + Math.cos(p.angle) * p.speed * dt;
  car.parked = true;
  const c = clampToMap(car.px, car.pz);
  car.px = c.x;
  car.pz = c.z;
  const r = resolveSolids(w, car.px, car.pz, 1.6);
  car.px = r.x;
  car.pz = r.z;
  p.x = car.px;
  p.z = car.pz;
  // Chase camera follows car heading.
  let diff = p.angle - w.camYaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  w.camYaw += diff * Math.min(1, 3 * dt);
  setEngine(w.audio, Math.abs(p.speed) / PLAYER.CAR_SPEED_MAX);
}

function checkCollisions(w, dt) {
  const p = w.player;
  const px = p.x;
  const pz = p.z;
  const inCar = p.inCar;
  // Traffic cars.
  for (const car of w.traffic.cars) {
    if (car === p.car) continue;
    const pos = carPosition(car);
    const d = Math.hypot(pos.x - px, pos.z - pz);
    if (d < 3.2) {
      if (inCar && Math.abs(p.speed) > 4) {
        addPoints(w.wanted, WANTED.HIT_CAR);
        p.health -= PLAYER.COLLISION_DAMAGE;
        p.speed *= 0.4;
        playCrash(w.audio);
        setStatus(w, 'Tabrakan! Wanted naik', 2);
        // Nudge the other car away.
        car.pos += car.dir * 3;
      } else if (!inCar && !car.parked) {
        // On foot, brushed by a moving car.
        p.health -= 2;
        setStatus(w, 'Kamu tertabrak mobil!', 2);
      }
    }
  }
  // Pedestrians.
  for (const ped of w.traffic.peds) {
    const pp = pedPosition(ped);
    const d = Math.hypot(pp.x - px, pp.z - pz);
    if (d < 1.6) {
      if (inCar && Math.abs(p.speed) > 3) {
        addPoints(w.wanted, WANTED.HIT_PEDESTRIAN);
        playCrash(w.audio);
        setStatus(w, 'Kamu menabrak pejalan kaki! Wanted naik', 2);
        ped.pos += ped.dir * 15;
      } else if (!inCar) {
        ped.pos += ped.dir * 2;
      }
    }
  }
  // Police cars ram the player (only while wanted).
  for (const c of w.police.cars) {
    if (w.wanted.stars === 0) continue;
    const d = Math.hypot(c.x - px, c.z - pz);
    if (d < 3.4) {
      p.health -= PLAYER.POLICE_RAM_DAMAGE;
      playCrash(w.audio);
      // Push the player away from the police car.
      const push = 2.5;
      p.x += ((px - c.x) / (d || 1)) * push;
      p.z += ((pz - c.z) / (d || 1)) * push;
      if (inCar) p.speed *= 0.6;
      setStatus(w, 'Polisi menabrakmu!', 2);
    }
  }
  // Foot police punch.
  for (const f of w.police.foot) {
    const d = Math.hypot(f.x - px, f.z - pz);
    if (d < 1.8 && !inCar) {
      p.health -= PLAYER.POLICE_PUNCH_DAMAGE * dt * 2;
      playPunch(w.audio);
    }
  }
  void dt;
}

function updateMissions(w, dt) {
  const m = w.missions;
  const p = w.player;
  if (m.phase === PHASE.ACTIVE) {
    if (tickTimer(m, dt)) {
      setStatus(w, m.failReason, 4);
      saveGame(w);
      return;
    }
    if (checkM2Fail(m, w.wanted.stars)) {
      setStatus(w, m.failReason, 4);
      saveGame(w);
      return;
    }
    const id = m.current.id;
    if (id === 1 && m.stage === 1 && p.inCar && nearPoint(p.x, p.z, LANDMARKS.GARAGE, 8)) {
      const reward = passMission(m);
      w.money += reward;
      playCoin(w.audio);
      setStatus(w, `Mission Passed! +$${reward}`, 4);
      w.screen = 'passed';
      w.passedTimer = 0;
      saveGame(w);
    } else if (id === 2) {
      if (m.stage === 0 && nearPoint(p.x, p.z, LANDMARKS.DOCKS_PICKUP, 7)) {
        m.stage = 1;
        addPoints(w.wanted, 100);
        setStatus(w, 'Paket diambil! Polisi waspada — antar ke Downtown', 3);
        playPickup(w.audio);
      } else if (m.stage === 1 && nearPoint(p.x, p.z, LANDMARKS.DOWNTOWN_DROP, 8)) {
        const reward = passMission(m);
        w.money += reward;
        playCoin(w.audio);
        setStatus(w, `Mission Passed! +$${reward}`, 4);
        w.screen = 'passed';
        w.passedTimer = 0;
        saveGame(w);
      }
    } else if (id === 3) {
      if (m.stage === 0 && nearPoint(p.x, p.z, LANDMARKS.PASSENGER_PICKUP, 7)) {
        m.stage = 1;
        setStatus(w, 'Penumpang naik! Antar ke Rooftop Bar — 90 detik', 3);
        playPickup(w.audio);
      } else if (m.stage === 1 && nearPoint(p.x, p.z, LANDMARKS.PASSENGER_DROP, 8)) {
        const reward = passMission(m);
        w.money += reward;
        playCoin(w.audio);
        setStatus(w, `Mission Passed! +$${reward}`, 4);
        w.screen = 'passed';
        w.passedTimer = 0;
        saveGame(w);
      }
    } else if (id === 4) {
      if (canFinishM4(m, w.wanted.stars, nearPoint(p.x, p.z, LANDMARKS.ESCAPE_POINT, 9))) {
        const reward = passMission(m);
        w.money += reward;
        playCoin(w.audio);
        setStatus(w, `Mission Passed! +$${reward} — Ms. Vane lunas!`, 4);
        w.screen = 'passed';
        w.passedTimer = 0;
        saveGame(w);
      }
    }
  }
  if (m.phase === PHASE.PASSED) {
    w.passedTimer += dt;
    if (w.passedTimer > 2.5) {
      w.screen = 'playing';
      resetToIdle(m);
    }
  }
}

function syncMeshes(w) {
  const p = w.player;
  // Player mesh.
  w.playerMesh.visible = !p.inCar;
  w.playerMesh.position.set(p.x, 0, p.z);
  w.playerMesh.rotation.y = p.angle;
  // Traffic cars.
  for (const car of w.traffic.cars) {
    const mesh = w.carMeshes.get(car.id);
    if (!mesh) continue;
    if (car === p.car) {
      mesh.position.set(car.px, 0, car.pz);
      mesh.rotation.y = car.angle;
      mesh.visible = true;
      continue;
    }
    const pos = carPosition(car);
    mesh.position.set(pos.x, 0, pos.z);
    mesh.rotation.y = pos.angle;
    mesh.visible = true;
  }
  // Pedestrians.
  w.traffic.peds.forEach((ped, i) => {
    const mesh = w.pedMeshes[i];
    if (!mesh) return;
    const pp = pedPosition(ped);
    mesh.position.set(pp.x, 0, pp.z);
    mesh.rotation.y = ped.vertical ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  });
  // Police cars: rebuild meshes to match the fleet. Despawned cars lose
  // their mesh (snapshot the old list first, remove what is not in the new one).
  const nextMeshes = [];
  for (const c of w.police.cars) {
    let mesh = w.policeCarMeshes.find((m) => m.userData.ref === c);
    if (!mesh) {
      mesh = makeCarMesh(0x1a1a22, true);
      mesh.userData.ref = c;
      w.scene.add(mesh);
    }
    mesh.position.set(c.x, 0, c.z);
    mesh.rotation.y = c.angle;
    mesh.visible = true;
    nextMeshes.push(mesh);
  }
  for (const m of w.policeCarMeshes) {
    if (!nextMeshes.includes(m)) w.scene.remove(m);
  }
  w.policeCarMeshes = nextMeshes;
  // Foot police.
  while (w.policeFootMeshes.length < w.police.foot.length) {
    const mesh = makePersonMesh(0x1a2a5a);
    w.scene.add(mesh);
    w.policeFootMeshes.push(mesh);
  }
  while (w.policeFootMeshes.length > w.police.foot.length) {
    const mesh = w.policeFootMeshes.pop();
    w.scene.remove(mesh);
  }
  w.police.foot.forEach((f, i) => {
    const mesh = w.policeFootMeshes[i];
    mesh.position.set(f.x, 0, f.z);
    mesh.rotation.y = Math.atan2(p.x - f.x, p.z - f.z);
  });
  // Beacon at the mission marker.
  const marker = missionMarker(w);
  w.marker = marker;
  if (marker && w.missions.phase === PHASE.ACTIVE) {
    w.city.beacon.visible = true;
    w.city.beacon.position.set(marker.x, 30, marker.z);
    w.city.ring.visible = true;
    w.city.ring.position.set(marker.x, 0.15, marker.z);
    const pulse = 2.5 + Math.sin(w.time * 3) * 1.2;
    w.city.ring.scale.set(pulse / 3, pulse / 3, 1);
  } else {
    w.city.beacon.visible = false;
    w.city.ring.visible = false;
  }
}

export function stepWorld(w, dt) {
  const input = w.input;
  w.time += dt;
  w.clockMin += dt / 60; // 1 real second = 1 game minute
  if (w.statusTimer > 0) {
    w.statusTimer -= dt;
    if (w.statusTimer <= 0) w.status = '';
  }
  if (w.screen === 'title' || w.screen === 'busted') {
    clearPressed(input);
    return;
  }
  if (w.shopOpen) {
    // World keeps running (not a safe zone), but the player stands still.
    if (consumePressed(input, 'interact') || consumePressed(input, 'close')) {
      w.shopOpen = false;
    }
    if (consumePressed(input, 'heal')) {
      const r = useBandage(w.shop, w.player.health);
      if (r.used) w.player.health = r.health;
    }
    clearPressed(input);
  } else {
    // One E press, one action (priority order).
    if (consumePressed(input, 'interact')) {
      const p = w.player;
      if (w.missions.phase === PHASE.BRIEFING) {
        acceptMission(w.missions);
        setStatus(w, 'Misi diterima!', 2);
      } else if (!p.inCar && nearPoint(p.x, p.z, LANDMARKS.SHOP_POS, 6)) {
        w.shopOpen = true;
        w.shop.message = '';
      } else if (!p.inCar && w.missions.phase === PHASE.IDLE && nearPoint(p.x, p.z, LANDMARKS.GARAGE, 8)) {
        const def = startBriefing(w.missions, w.missions.unlocked);
        if (def) setStatus(w, `Misi: ${def.name} — tekan E untuk terima`, 4);
      } else if (!p.inCar) {
        trySteal(w);
      } else {
        exitCar(w);
      }
    }
    if (consumePressed(input, 'hit')) punch(w);
    if (consumePressed(input, 'heal')) {
      const r = useBandage(w.shop, w.player.health);
      if (r.used) {
        w.player.health = r.health;
        setStatus(w, 'Perban dipakai (+50)', 2);
      }
    }
    if (w.player.inCar) updateDriving(w, dt, input);
    else updatePlayerOnFoot(w, dt, input);
  }

  // Traffic + police.
  stepTraffic(w.traffic, dt);
  const nearestPD = nearestPoliceDist(w.police, w.player.x, w.player.z);
  decay(w.wanted, dt, nearestPD);
  if (w.wanted.stars > w.bestWanted) w.bestWanted = w.wanted.stars;
  syncPoliceCars(w.police, w.wanted.stars, w.player.x, w.player.z, w.player.angle);
  stepPoliceCars(w.police, dt, w.player.x, w.player.z, w.wanted.stars);
  stepFootPolice(w.police, dt, w.wanted.stars, w.player.x, w.player.z, !w.player.inCar);
  setSiren(w.audio, w.wanted.stars > 0);
  if (!w.player.inCar) setEngine(w.audio, 0);

  checkCollisions(w, dt);
  updateMissions(w, dt);

  // Surrounded -> BUSTED.
  const near = footPoliceNear(w.police, w.player.x, w.player.z, POLICE.SURROUND_RADIUS);
  if (updateSurrounded(w.wanted, dt, near)) {
    doBusted(w);
  }
  // Health regen only at wanted 0; health 0 -> BUSTED.
  if (w.wanted.stars === 0 && w.player.health < PLAYER.HEALTH) {
    w.player.health = Math.min(PLAYER.HEALTH, w.player.health + PLAYER.REGEN_PER_SEC * dt);
  }
  if (w.player.health <= 0) {
    doBusted(w);
  }

  // Mission start trigger: near Garage with no active mission, press E.
  // (Handled via interact above only when no mission is active.)
  if (w.missions.phase === PHASE.IDLE && !w.shopOpen) {
    if (nearPoint(w.player.x, w.player.z, LANDMARKS.GARAGE, 8)) {
      w.objective = 'Tekan E di Garage untuk mulai misi berikutnya';
    }
  }

  syncMeshes(w);
  w.objective = missionObjective(w);
}

// Interact handling for mission start (called from the key handler in main).
export function tryStartMission(w) {
  const m = w.missions;
  if (m.phase === PHASE.IDLE && nearPoint(w.player.x, w.player.z, LANDMARKS.GARAGE, 8)) {
    const def = startBriefing(m, m.unlocked);
    if (def) {
      w.screen = 'playing';
      return true;
    }
  }
  return false;
}

export function snapshot(w) {
  const p = w.player;
  return {
    health: p.health,
    money: w.money,
    bandages: w.shop.bandages,
    stars: w.wanted.stars,
    clockMin: w.clockMin,
    speedKmh: Math.abs(p.speed || 0) * 3.6,
    objective: w.objective,
    status: w.status,
    marker: w.marker,
    px: p.x,
    pz: p.z,
    heading: p.angle,
    policeDots: [...w.police.cars.map((c) => ({ x: c.x, z: c.z })), ...w.police.foot.map((f) => ({ x: f.x, z: f.z }))],
    carDots: w.traffic.cars.slice(0, 14).map((c) => {
      const pos = carPosition(c);
      return { x: pos.x, z: pos.z };
    }),
  };
}

export function debugState(w) {
  const p = w.player;
  const marker = missionMarker(w);
  return {
    player: { x: Math.round(p.x), z: Math.round(p.z), inCar: p.inCar, health: Math.round(p.health) },
    wanted: w.wanted.stars,
    mission: w.missions.current ? w.missions.current.name : 'none',
    phase: w.missions.phase,
    stage: w.missions.stage,
    beaconVisible: !!(marker && w.missions.phase === PHASE.ACTIVE),
    beaconPos: marker ? { x: marker.x, z: marker.z } : null,
    policeCars: w.police.cars.length,
    footPolice: w.police.foot.length,
  };
}

// Deterministic screenshot poses. Called once in shot mode.
export function setShotPose(w, shot) {
  const p = w.player;
  // Reset to a clean playing state.
  w.screen = 'playing';
  w.shopOpen = false;
  w.missions.phase = PHASE.IDLE;
  w.missions.current = null;
  w.wanted.points = 0;
  w.wanted.stars = 0;
  w.police.cars = [];
  w.police.foot = [];
  if (shot === 'start') {
    p.x = 0;
    p.z = 30;
    p.angle = Math.PI; // facing north (-z)
    p.inCar = false;
    p.car = null;
    w.camYaw = Math.PI;
    w.objective = '<b>First Gear</b> — Steal a car';
    w.marker = null;
  } else if (shot === 'drive') {
    const car = w.traffic.cars.find((c) => c.parked) || w.traffic.cars[0];
    car.owned = true;
    car.parked = true;
    car.px = 0;
    car.pz = 40;
    car.angle = Math.PI; // driving north
    p.car = car;
    p.inCar = true;
    p.speed = 14;
    p.x = 0;
    p.z = 40;
    p.angle = Math.PI;
    w.camYaw = Math.PI;
    w.objective = '<b>First Gear</b> — Drive to the Garage';
    w.marker = LANDMARKS.GARAGE;
  } else if (shot === 'chase') {
    const car = w.traffic.cars.find((c) => c.parked) || w.traffic.cars[0];
    car.owned = true;
    car.parked = true;
    car.px = 0;
    car.pz = 20;
    car.angle = Math.PI;
    p.car = car;
    p.inCar = true;
    p.speed = 18;
    p.x = 0;
    p.z = 20;
    p.angle = Math.PI;
    w.camYaw = Math.PI;
    addPoints(w.wanted, 300); // 3 stars
    syncPoliceCars(w.police, 3, p.x, p.z, p.angle);
    // Place 3 police cars visibly around the player.
    w.police.cars[0] && Object.assign(w.police.cars[0], { x: -8, z: 4, angle: Math.PI });
    w.police.cars[1] && Object.assign(w.police.cars[1], { x: 9, z: 10, angle: Math.PI });
    w.police.cars[2] && Object.assign(w.police.cars[2], { x: 2, z: -14, angle: 0 });
    w.objective = '<b>Harbor Run</b> — Lose the cops!';
    w.marker = LANDMARKS.DOWNTOWN_DROP;
  } else if (shot === 'mission') {
    // Approach the Docks pickup from the east along the z=0 street (heading west),
    // so the beacon column stands clear in the frame.
    const car = w.traffic.cars.find((c) => c.parked) || w.traffic.cars[0];
    car.owned = true;
    car.parked = true;
    car.px = -140;
    car.pz = 0;
    car.angle = Math.PI / 2; // heading west (-x)? angle PI/2 faces +x; use -PI/2 for west
    car.angle = -Math.PI / 2;
    p.car = car;
    p.inCar = true;
    p.speed = 10;
    p.x = -140;
    p.z = 0;
    p.angle = -Math.PI / 2;
    w.camYaw = -Math.PI / 2;
    addPoints(w.wanted, 100); // 1 star
    // Fake an active M2 so the beacon shows at the Docks.
    w.missions.unlocked = Math.max(w.missions.unlocked, 2);
    startBriefing(w.missions, 2);
    w.missions.phase = PHASE.ACTIVE;
    w.missions.stage = 0;
    w.missions.timer = MISSION_TIMER_SEC;
    w.objective = '<b>Harbor Run</b> — Pick up the package at the Docks';
    w.marker = LANDMARKS.DOCKS_PICKUP;
  }
  syncMeshes(w);
  w.objective = w.objective || missionObjective(w);
  // Snap the chase camera to its pose so the first rendered frame is settled
  // (the lerp in updateCamera would otherwise need many frames to converge).
  const dist = p.inCar ? 13 : 10;
  const height = p.inCar ? 5.5 : 6.5;
  w.camState = {
    x: p.x - Math.sin(w.camYaw) * dist,
    y: height,
    z: p.z - Math.cos(w.camYaw) * dist,
  };
}
