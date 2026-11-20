// Neon Harbor — main.js
// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. Screens: title, play, paused, game over.
// ?shot=start|drive|chase|mission&seed=1 stages that scene instead of the
// loop, steps the world to settle it, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP, SAVE_KEY } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED } from './render.js';
import { createWorld } from './world.js';
import { createHud } from './hud.js';
import { parseShot } from './shots.js';
import { decodeSave } from './save.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = parseShot(window.location.search);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);
const saveRaw = (() => {
  try { return window.localStorage.getItem(SAVE_KEY) ?? ''; } catch { return ''; }
})();
const world = createWorld(renderer.scene, seed, saveRaw);
const saved = decodeSave(saveRaw);

const hud = createHud({
  onNewGame() {
    audio.resume();
    world.startNewGame();
    world.setScreen(SCREEN_PLAY);
    hud.hideTitle();
    hud.showBriefing(0);
  },
  onContinue() {
    audio.resume();
    world.continueGame();
    world.setScreen(SCREEN_PLAY);
    hud.hideTitle();
    hud.showBriefing(world.missions.index);
  },
  onBriefingGo() {
    world.beginBriefing();
    hud.hideBriefing();
  },
  onResume() {
    world.setScreen(SCREEN_PLAY);
    hud.hidePause();
  },
  onQuitToTitle() {
    world.setScreen(SCREEN_TITLE);
    hud.hidePause();
    hud.showTitle(true);
  },
  onShopClose() {
    world.closeShop();
    hud.hideShop();
  },
  onBuy(itemId) {
    const res = world.buyShopItem(itemId);
    hud.shopMessage(res.ok ? 'Bought. Thank you — drive safe.' : res.reason);
    if (res.ok) audio.coin();
  },
  onJoystick(x, y) { input.setJoystick(x, y); },
  onTouchButton(name, down) { input.setTouchButton(name, down); },
});

world.setScreen(SCREEN_TITLE);
hud.showTitle(saved.missionIndex > 0 || saved.money > 0);
if (input.state.touch) hud.showTouchUI();
window.addEventListener('touchstart', () => hud.showTouchUI(), { once: true, passive: true });

function dispatchEvents(events) {
  for (const ev of events) {
    if (ev.type === 'steal') { audio.pickup(); }
    if (ev.type === 'crash') { audio.crash(); }
    if (ev.type === 'punch' || ev.type === 'swing') { audio.punch(); }
    if (ev.type === 'hit-ped') { audio.crash(); }
    if (ev.type === 'heal') { audio.pickup(); }
    if (ev.type === 'step') { audio.pickup(); }
    if (ev.type === 'mission-passed') {
      audio.coin();
      hud.missionPassed(ev.reward, ev.next);
    }
    if (ev.type === 'mission-failed') { hud.missionFailed(ev.reason); }
    if (ev.type === 'busted') { hud.busted(ev.fine); }
    if (ev.type === 'briefing') { hud.showBriefing(ev.index); }
    if (ev.type === 'shop-open') { hud.showShop(world.player.money); }
  }
}

let last = performance.now();
let camDist = 10;

function frame(now) {
  const dt = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  const polled = input.poll();
  const enterPressed = input.take('enter');
  const punchPressed = input.take('punch');
  const healPressed = input.take('heal');
  const pausePressed = input.take('pause');
  input.take('confirm');

  if (pausePressed) {
    if (world.screen === SCREEN_PLAY) {
      world.setScreen(SCREEN_PAUSED);
      hud.showPause();
    } else if (world.screen === SCREEN_PAUSED) {
      world.setScreen(SCREEN_PLAY);
      hud.hidePause();
    }
  }
  if (world.isShopOpen() && enterPressed) {
    world.closeShop();
    hud.hideShop();
  }

  const frameInput = {
    ax: polled.ax, ay: polled.ay, run: polled.run, brake: polled.brake,
    camDX: polled.camDX, camDY: polled.camDY,
    enterPressed, punchPressed, healPressed,
  };
  input.clearCameraDrag();

  let acc = dt;
  while (acc > 0) {
    const stepDt = Math.min(STEP, acc);
    const events = world.step(frameInput, stepDt);
    dispatchEvents(events);
    // Edge flags live for one step only.
    frameInput.enterPressed = false;
    frameInput.punchPressed = false;
    frameInput.healPressed = false;
    frameInput.camDX = 0;
    frameInput.camDY = 0;
    acc -= stepDt;
  }

  // Camera: behind the player (or the car), at the shot's distance on foot.
  const target = { x: world.player.x, z: world.player.z };
  camDist += ((world.player.inCar ? 12 : 9) - camDist) * Math.min(1, 3 * dt);
  renderer.updateCamera(target, world.player.camYaw, world.player.camPitch, camDist, dt);
  renderer.render();

  // Audio follows the drive and the heat.
  audio.setEngine(Math.abs(world.player.speed) / 26, world.player.inCar);
  audio.setSiren(world.wanted.stars > 0);

  hud.update(world.snapshot());
  status.textContent = `Neon Harbor — ${world.player.inCar ? 'driving' : 'on foot'}, wanted ${world.wanted.stars} stars`;
  requestAnimationFrame(frame);
}

if (shot) {
  // Screenshot mode: stage the pose, settle the world, paint twice.
  world.setShotPose(shot);
  world.setScreen(SCREEN_PLAY);
  hud.hideTitle();
  const idle = { ax: 0, ay: 0, run: false, brake: false, camDX: 0, camDY: 0, enterPressed: false, punchPressed: false, healPressed: false };
  for (let i = 0; i < 40; i += 1) world.step(idle, STEP);
  const target = { x: world.player.x, z: world.player.z };
  renderer.updateCamera(target, shot.camYaw, shot.camPitch, shot.camDist, 1);
  renderer.render();
  renderer.updateCamera(target, shot.camYaw, shot.camPitch, shot.camDist, 1);
  renderer.render();
  hud.update(world.snapshot());
  status.textContent = `Neon Harbor — ${world.player.inCar ? 'driving' : 'on foot'}, wanted ${world.wanted.stars} stars`;
  window.__shotDebug = world.debugState();
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
