// Neon Harbor — main.js
// Entry point: wires renderer, city, traffic, police, missions, world,
// HUD, input and audio together; runs the fixed-step loop; owns the menu
// flow (start / briefing / passed / failed / busted / pause) and the
// ?shot= screenshot mode.

import { CONFIG, STEP, MISSION_DEFS } from './config.js';
import { createRenderer } from './render.js';
import { buildCity } from './city.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { Missions, MISSION_STATUS } from './missions.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { loadSave, storeSave, clearSave, defaultSave } from './save.js';
import { parseShot } from './shots.js';

const canvas = document.getElementById('game-canvas');
const { renderer, scene, camera } = createRenderer(canvas);
const shot = parseShot(window.location.search);
const seed = shot ? shot.seed : 1;

const city = buildCity(scene, seed);
const traffic = createTraffic(scene, seed);
const police = createPolice(scene, city.colliders, seed);
const missions = new Missions();
const audio = createAudio();
const input = createInput(canvas);
const hud = createHud(document, input);

const saved = loadSave(window.localStorage);
let state = 'menu'; // menu | playing | paused
let bustedInfo = null;

const world = createWorld({
  scene,
  camera,
  city,
  traffic,
  police,
  missions,
  audio,
  input,
  hud,
  storage: window.localStorage,
  bestWanted: saved.bestWanted,
  onBusted: (info) => {
    bustedInfo = info;
    state = 'busted';
    document.getElementById('busted-fine').textContent =
      `Fine: $${info.fine}. ${info.reason}`;
    hud.show('busted');
  },
  onMissionPassed: (info) => {
    state = 'passed';
    document.getElementById('passed-title').textContent = `Mission Passed: ${info.title}`;
    document.getElementById('passed-reward').textContent = `Reward: $${info.reward}`;
    hud.show('passed');
  },
  onMissionFailed: (info) => {
    state = 'failed';
    document.getElementById('failed-reason').textContent = info.reason;
    hud.show('failed');
  },
});

function refreshHud() {
  const s = world.hudState();
  hud.setHealth(s.health);
  hud.setMoney(s.money);
  hud.setStars(s.stars);
  hud.setSpeed(s.speed, s.driving);
  hud.setObjective(missions.objectiveText());
  hud.setBandages(s.bandages);
  hud.setClock(s.clockHour);
  hud.drawMinimap(s);
}

function showBriefing() {
  const def = MISSION_DEFS[missions.index];
  document.getElementById('briefing-title').textContent = `Mission ${missions.index + 1}: ${def.title}`;
  document.getElementById('briefing-text').textContent = def.briefing;
  hud.hideAllOverlays();
  hud.show('briefing');
  state = 'briefing';
}

function startPlaying() {
  hud.hideAllOverlays();
  state = 'playing';
  audio.resume();
}

function newGame() {
  clearSave(window.localStorage);
  world.applySave(defaultSave());
  world.resetRun();
  missions.index = 0;
  missions.start();
  showBriefing();
}

function continueGame() {
  world.applySave(saved);
  world.resetRun();
  if (missions.done) {
    startPlaying();
    hud.toast('All missions complete — free roam. The city is yours.');
  } else {
    missions.start();
    showBriefing();
  }
}

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-start-mission').addEventListener('click', () => {
  missions.begin();
  if (missions.beginWantedBonus() > 0) world.wanted.add(missions.beginWantedBonus());
  startPlaying();
});
document.getElementById('btn-next-mission').addEventListener('click', () => {
  missions.advance();
  if (missions.done) {
    startPlaying();
    hud.toast('Story complete! You paid off Ms. Vane. Free roam.');
  } else {
    missions.start();
    showBriefing();
  }
});
document.getElementById('btn-retry-mission').addEventListener('click', () => {
  missions.retry();
  showBriefing();
});
document.getElementById('btn-respawn').addEventListener('click', () => {
  hud.hide('busted');
  world.resumeFromBusted();
  if (bustedInfo && bustedInfo.missionFailed) {
    missions.retry();
    showBriefing();
  } else {
    startPlaying();
  }
});
document.getElementById('btn-resume').addEventListener('click', startPlaying);
document.getElementById('btn-close-shop').addEventListener('click', () => hud.closeShop());

hud.initTouch();
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Screenshot mode: skip the menu, pose the world, warm the simulation up
// so traffic and police are in frame, then run normally. Driving shots
// hold the throttle during warm-up so the car is moving in the frame.
if (shot) {
  hud.hideAllOverlays();
  world.applySave(defaultSave());
  world.setShotPose(shot);
  state = 'playing';
  const driveTicks = { drive: 240, chase: 240, mission: 72, start: 0 }[shot.name] || 0;
  if (driveTicks > 0) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
  for (let i = 0; i < 240; i++) {
    if (i === driveTicks) window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    traffic.update(STEP, i * STEP);
    world.update(STEP);
    city.update(i * STEP);
  }
  if (driveTicks >= 240) window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
  refreshHud();
} else {
  document.getElementById('btn-continue').style.display = saved.missionIndex > 0 || saved.money > 0 ? '' : 'none';
  hud.show('start-screen');
}

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  if (state === 'playing') {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      traffic.update(STEP, world.time);
      world.update(STEP);
      city.update(world.time);
      acc -= STEP;
      steps++;
    }
    if (steps === 5) acc = 0;
    if (input.consumeAction('pause')) {
      state = 'paused';
      hud.show('paused');
    }
    refreshHud();
  } else if (state === 'paused') {
    if (input.consumeAction('pause')) startPlaying();
  } else if (state === 'menu' || state === 'briefing') {
    // Idle camera drift behind the menu.
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.05) * 60, 26, Math.cos(t * 0.05) * 60);
    camera.lookAt(0, 12, 0);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
