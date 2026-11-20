// Neon Harbor — boot + fixed-step loop + screens + shot mode.
import * as THREE from 'three';
import { STEP } from './config.js';
import { buildCity } from './city.js';
import { createRenderer, createScene, updateCamera } from './render.js';
import { createWorld, startGame, stepWorld, snapshot, setShotPose, debugState } from './world.js';
import { createInput, attachInput } from './input.js';
import { createAudio } from './audio.js';
import { buildHud, renderHud, showScreen, hideScreen, showShop, hideShop } from './hud.js';
import { readShotParam } from './shots.js';
import { buyBandage, buyDrink, buyBribe } from './shop.js';
import { bribePoints } from './wanted.js';
import { SHOP } from './config.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const scene = createScene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const city = buildCity();
scene.add(city.group);

const hudRoot = document.getElementById('hud-root');
const hud = buildHud(hudRoot);
const input = createInput();
const audio = createAudio();
attachInput(input, canvas);

const world = createWorld(scene, city, hud, input, audio);
window.__world = world;
window.__shotReady = false;
window.__shotDebug = null;

const SHOP_ITEMS = [
  { name: 'Perban', price: SHOP.BANDAGE_PRICE, desc: '+50 health (H untuk pakai, maks 3)' },
  { name: 'Minuman energi', price: SHOP.DRINK_PRICE, desc: 'langsung +25 health' },
  { name: 'Suap polisi', price: SHOP.BRIBE_PRICE, desc: '-1 bintang (wanted 1-2, polisi jauh)' },
];

function refreshShop() {
  showShop(hud, SHOP_ITEMS, world.money, world.shop.message);
  hud.shopMoney.textContent = world.money;
}
hud.shop.addEventListener('shop-buy', (e) => {
  const i = e.detail;
  if (i === 0) {
    const r = buyBandage(world.shop, world.money);
    world.money = r.money;
  } else if (i === 1) {
    const r = buyDrink(world.shop, world.money, world.player.health);
    world.money = r.money;
    world.player.health = r.health;
  } else if (i === 2) {
    // Distance to nearest police, computed from the world state.
    let nearest = null;
    for (const c of world.police.cars) {
      const d = Math.hypot(c.x - world.player.x, c.z - world.player.z);
      if (nearest === null || d < nearest) nearest = d;
    }
    for (const f of world.police.foot) {
      const d = Math.hypot(f.x - world.player.x, f.z - world.player.z);
      if (nearest === null || d < nearest) nearest = d;
    }
    const r = buyBribe(world.shop, world.money, world.wanted.stars, nearest);
    world.money = r.money;
    if (r.ok) bribePoints(world.wanted);
  }
  refreshShop();
});

function titleScreen() {
  return `
  <div style="text-align:center;max-width:560px;padding:20px">
    <h1 style="font-size:52px;margin:0;color:#ff4fd8;text-shadow:0 0 24px #ff4fd8">NEON HARBOR</h1>
    <p style="font-size:15px;line-height:1.6;opacity:.9">Rook, sopir pelarian, kembali ke kota dan berutang pada fixer Ms. Vane.
    Lunasi lewat pekerjaan — curi mobil, antar paket, dan jangan sampai tertangkap.</p>
    <p style="font-size:13px;line-height:1.7;opacity:.75">WASD jalan / mengemudi &nbsp;·&nbsp; E masuk mobil / interaksi &nbsp;·&nbsp; F pukul &nbsp;·&nbsp; H perban<br>
    Shift lari &nbsp;·&nbsp; Space handbrake &nbsp;·&nbsp; Mouse drag putar kamera</p>
    <button id="btn-new" style="font-size:18px;padding:12px 28px;margin:6px;border-radius:10px;background:#ff4fd8;color:#fff;border:none;cursor:pointer">New Game</button>
    <button id="btn-continue" style="font-size:18px;padding:12px 28px;margin:6px;border-radius:10px;background:#22222f;color:#fff;border:1px solid #555;cursor:pointer">Continue</button>
    <p style="font-size:12px;opacity:.55">Kota, karakter, dan cerita 100% original — tanpa aset game lain.</p>
  </div>`;
}

function bustedScreen() {
  return `
  <div style="text-align:center;max-width:480px;padding:20px">
    <h1 style="font-size:44px;margin:0;color:#ff2244">BUSTED</h1>
    <p style="font-size:15px;line-height:1.6">Polisi menangkapmu. Denda dibayar, misi aktif gagal.<br>Kamu bangun lagi di Garage.</p>
    <button id="btn-respawn" style="font-size:18px;padding:12px 28px;border-radius:10px;background:#ff2244;color:#fff;border:none;cursor:pointer">Lanjutkan</button>
  </div>`;
}

function passedScreen(name, reward) {
  return `
  <div style="text-align:center;max-width:480px;padding:20px">
    <h1 style="font-size:40px;margin:0;color:#39ff88">MISSION PASSED</h1>
    <p style="font-size:17px">${name} — <b>+$${reward}</b></p>
  </div>`;
}

function bindScreenButtons() {
  const btnNew = document.getElementById('btn-new');
  if (btnNew) btnNew.addEventListener('click', () => { startGame(world, true); hideScreen(hud); });
  const btnContinue = document.getElementById('btn-continue');
  if (btnContinue) btnContinue.addEventListener('click', () => { startGame(world, false); hideScreen(hud); });
  const btnRespawn = document.getElementById('btn-respawn');
  if (btnRespawn) btnRespawn.addEventListener('click', () => { world.screen = 'playing'; hideScreen(hud); });
}

// ---- Shot mode: ?shot=start|drive|chase|mission ----
const shot = readShotParam();
let lastScreen = '';
let acc = 0;
let last = performance.now();

if (shot) {
  world.shotMode = shot;
  setShotPose(world, shot);
  // Render a few frames so the scene settles, then flag ready.
  let frames = 0;
  const renderShot = () => {
    const p = world.player;
    updateCamera(camera, p.x, p.z, world.camYaw, p.inCar, 0, STEP, world.camState);
    renderer.render(scene, camera);
    const s = snapshot(world);
    s.status = '';
    renderHud(hud, s);
    hideScreen(hud);
    frames++;
    window.__shotDebug = debugState(world);
    if (frames >= 5) {
      window.__shotReady = true;
      return;
    }
    requestAnimationFrame(renderShot);
  };
  requestAnimationFrame(renderShot);
} else {
  showScreen(hud, titleScreen());
  bindScreenButtons();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      stepWorld(world, STEP);
      acc -= STEP;
      steps++;
    }
    // Screens.
    if (world.screen === 'title' && lastScreen !== 'title') {
      showScreen(hud, titleScreen());
      bindScreenButtons();
    } else if (world.screen === 'busted' && lastScreen !== 'busted') {
      showScreen(hud, bustedScreen());
      bindScreenButtons();
    } else if (world.screen === 'passed' && lastScreen !== 'passed') {
      const m = world.missions.current;
      showScreen(hud, passedScreen(m ? m.name : 'Mission', m ? m.reward : 0));
    } else if (world.screen === 'playing' && lastScreen !== 'playing') {
      hideScreen(hud);
    }
    lastScreen = world.screen;
    // Shop overlay.
    if (world.shopOpen) refreshShop();
    else hideShop(hud);
    // Touch UI.
    if (input.touch) hud.touchUI.style.display = 'block';
    // Camera + render.
    const p = world.player;
    updateCamera(camera, p.x, p.z, world.camYaw, p.inCar, Math.abs(p.speed || 0) / 34, dt, world.camState);
    renderer.render(scene, camera);
    renderHud(hud, snapshot(world));
    window.__shotDebug = debugState(world);
  }
  requestAnimationFrame(frame);
}
