// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. Screens: title, play, paused, busted,
// mission passed. Save lives in localStorage.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { MISSIONS, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { generateLayout } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createMinimap, createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createShop } from './shop.js';
import { stageShot } from './shots.js';
import { validateSave } from './save.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const layout = generateLayout(random);
const world = createWorld(random, layout);
const renderer = createRenderer(canvas, layout, random);
const minimap = createMinimap(document.getElementById('minimap'));
const input = createInput(canvas);
const audio = createAudio();
const shop = createShop(world, layout);
renderer.setShopStall(shop.stall.x, shop.stall.z);

const hud = document.getElementById('hud');
const healthBar = document.getElementById('health-bar');
const moneyEl = document.getElementById('money');
const bandagesEl = document.getElementById('bandages');
const starsEl = document.getElementById('stars');
const clockEl = document.getElementById('clock');
const objectiveEl = document.getElementById('objective');
const speedEl = document.getElementById('speed');
const speedNum = document.getElementById('speed-num');
const toastEl = document.getElementById('toast');
const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  over: document.getElementById('screen-over'),
  pass: document.getElementById('screen-pass'),
};

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.money !== 'number' || typeof save.missionIndex !== 'number') return null;
    return validateSave(save);
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    const p = world.state.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: Math.round(p.money),
      missionIndex: world.state.missionIndex,
      bestWanted: world.state.bestWanted,
      bestMoney: world.state.bestMoney,
      bandages: shop.bandages,
    }));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}

function showScreen(name) {
  for (const key of Object.keys(screens)) {
    screens[key].classList.toggle('hidden', key !== name);
  }
  hud.classList.toggle('hidden', name !== 'play' && name !== 'pause');
}

let toastTimer = null;
function toast(text) {
  toastEl.textContent = text;
  toastEl.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 2600);
}

function updateHud() {
  const s = world.state;
  const p = s.player;
  healthBar.style.width = `${Math.max(0, p.health)}%`;
  healthBar.style.background = p.health > 50
    ? 'linear-gradient(90deg,#2ecc71,#7dff5e)'
    : p.health > 25 ? 'linear-gradient(90deg,#e67e22,#ffd23e)' : 'linear-gradient(90deg,#e74c3c,#ff6b6b)';
  moneyEl.textContent = `$${Math.round(p.money)}`;
  bandagesEl.textContent = `Bandages ×${shop.bandages} · H — use`;
  let stars = '';
  for (let i = 0; i < 5; i += 1) {
    stars += i < s.stars ? '★' : '<span class="off">★</span>';
  }
  starsEl.innerHTML = stars;
  const hh = Math.floor(s.clockMin / 60) % 24;
  const mm = Math.floor(s.clockMin % 60);
  clockEl.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  objectiveEl.textContent = world.objectiveText();
  if (!p.onFoot && s.playerCar) {
    speedEl.classList.remove('hidden');
    speedNum.textContent = String(Math.round(Math.abs(s.playerCar.speed) * 3.6));
  } else {
    speedEl.classList.add('hidden');
  }
  minimap.draw(s, world.missionTarget(), shop.stall);
}

function drainWorldEvents() {
  const s = world.state;
  for (const m of s.messages) toast(m);
  s.messages.length = 0;
  for (const snd of s.sounds) {
    if (snd === 'crash') audio.crash();
    else if (snd === 'pickup') audio.pickup();
    else if (snd === 'punch') audio.punch();
    else if (snd === 'mission') audio.mission();
    else if (snd === 'busted') audio.busted();
  }
  s.sounds.length = 0;
}

function runShot(name) {
  const scene = stageShot(name, world);
  const target = world.missionTarget();
  showScreen(scene.screen === SCREEN_TITLE ? 'title' : 'play');
  if (scene.screen === SCREEN_TITLE) {
    const save = readSave();
    document.getElementById('save-line').textContent = save
      ? `Best wanted: ${'★'.repeat(save.bestWanted || 0)} · Best cash: $${save.bestMoney || 0}`
      : 'A brand-new story in Neon Harbor.';
  }
  updateHud();
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, target, world.state.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  const save = readSave();
  const saveLine = document.getElementById('save-line');
  const continueBtn = document.getElementById('btn-continue');
  if (save && save.missionIndex < MISSIONS.length) {
    saveLine.textContent = `Continue: mission ${save.missionIndex + 1} of ${MISSIONS.length} · $${save.money} · best wanted ${'★'.repeat(save.bestWanted || 0)}`;
    continueBtn.classList.remove('hidden');
  } else if (save) {
    saveLine.textContent = `Story complete! Best cash $${save.bestMoney || 0} · best wanted ${'★'.repeat(save.bestWanted || 0)}`;
    continueBtn.classList.remove('hidden');
  } else {
    saveLine.textContent = 'A brand-new story in Neon Harbor.';
  }

  function announce(message) { status.textContent = message; }

  function startGame(fromSave) {
    const sv = fromSave ? readSave() : null;
    world.reset(sv);
    shop.load(sv ? sv.bandages : 0);
    shop.close();
    world.state.cinematic = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    showScreen('play');
    audio.unlock();
    audio.setAmbient(true);
    announce('Playing Neon Harbor.');
  }

  function quitToTitle() {
    shop.close();
    writeSave();
    screen = SCREEN_TITLE;
    showScreen('title');
    const s2 = readSave();
    if (s2) {
      saveLine.textContent = `Continue: mission ${s2.missionIndex + 1} of ${MISSIONS.length} · $${s2.money}`;
      continueBtn.classList.remove('hidden');
    }
    announce('Neon Harbor. Press New Game or Continue.');
  }

  function showBusted() {
    screen = SCREEN_OVER;
    showScreen('over');
    const fine = Math.min(world.state.player.money, 150);
    document.getElementById('over-text').textContent =
      `The Neon Harbor police caught Rook. Fine: $${fine}.`;
    announce('Busted.');
  }

  function showMissionPassed() {
    screen = 'pass';
    showScreen('pass');
    const m = MISSIONS[world.state.missionIndex - 1];
    document.getElementById('pass-title').textContent = m ? `Mission Passed — ${m.name}` : 'Story Complete';
    document.getElementById('pass-text').textContent = m
      ? `Ms. Vane pays $${m.reward}. ${world.state.missionDone ? 'The debt is settled. Rook is free.' : `Next: ${MISSIONS[world.state.missionIndex].name}.`}`
      : 'Neon Harbor is yours now.';
    writeSave();
    announce('Mission passed.');
  }

  document.getElementById('btn-new').addEventListener('click', () => { audio.unlock(); audio.click(); startGame(false); });
  continueBtn.addEventListener('click', () => { audio.unlock(); audio.click(); startGame(true); });
  document.getElementById('btn-resume').addEventListener('click', () => {
    screen = SCREEN_PLAY;
    showScreen('play');
    audio.click();
  });
  document.getElementById('btn-quit').addEventListener('click', () => { audio.click(); quitToTitle(); });
  document.getElementById('btn-retry').addEventListener('click', () => {
    audio.click();
    world.respawn();
    screen = SCREEN_PLAY;
    showScreen('play');
  });
  document.getElementById('btn-restart').addEventListener('click', () => { audio.click(); startGame(false); });
  document.getElementById('btn-next').addEventListener('click', () => {
    audio.click();
    screen = SCREEN_PLAY;
    showScreen('play');
  });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  // The title screen shows the living city behind it.
  world.state.cinematic = { x: 55, y: 26, z: 118, tx: -10, ty: 22, tz: -20 };
  showScreen('title');
  announce('Neon Harbor. Press New Game to start.');

  function readControls() {
    const axes = input.axes();
    const cam = input.takeCamDelta();
    const enterPressed = input.takePressed('enter');
    if (input.takePressed('heal')) shop.useBandage();
    const idle = {
      ax: 0, ay: 0, run: false, brake: false,
      enterPressed: false, punchPressed: false, camDX: cam.x, camDY: cam.y,
    };
    // Shop open: E closes it; the player stands still, but the world keeps
    // stepping — the shop is not a safe zone.
    if (shop.open) {
      if (enterPressed) shop.close();
      return idle;
    }
    // On foot by the stall: E opens the shop instead of entering a car.
    if (enterPressed && world.state.player.onFoot && shop.nearStall()) {
      shop.openShop();
      return idle;
    }
    return {
      ax: axes.x,
      ay: axes.y,
      run: input.run(),
      brake: input.brake(),
      enterPressed,
      punchPressed: input.takePressed('punch'),
      camDX: cam.x,
      camDY: cam.y,
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    if (input.takePressed('pause')) {
      if (shop.open) {
        // Esc closes the shop first, it does not pause the game.
        shop.close();
      } else if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        showScreen('pause');
        writeSave();
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        showScreen('play');
      }
    }
    if (screen === 'pass' && input.takePressed('confirm')) {
      screen = SCREEN_PLAY;
      showScreen('play');
    }

    if (screen === SCREEN_TITLE) {
      // Backdrop life: traffic and pedestrians keep moving.
      while (accumulator >= STEP) {
        world.step(STEP, {
          ax: 0, ay: 0, run: false, brake: false,
          enterPressed: false, punchPressed: false, camDX: 0, camDY: 0,
        });
        accumulator -= STEP;
      }
      renderer.draw(world.state, SCREEN_TITLE, null, world.state.time);
      return;
    }
    if (screen === SCREEN_PLAY) {
      const wasMission = world.state.missionIndex;
      const wasDone = world.state.missionDone;
      shop.update();
      while (accumulator >= STEP) {
        world.step(STEP, readControls());
        accumulator -= STEP;
        if (world.state.busted) break;
      }
      drainWorldEvents();
      if (world.state.busted) {
        shop.close();
        showBusted();
      } else if (world.state.missionIndex !== wasMission || (world.state.missionDone && !wasDone)) {
        shop.close();
        showMissionPassed();
      }
      // Sound follows the game.
      const s = world.state;
      const inCar = !s.player.onFoot && s.playerCar;
      audio.engine(inCar ? Math.abs(s.playerCar.speed) / 27 : 0, inCar);
      const policeNear = s.cars.some((c) => c.kind === 'police') || s.peds.some((p) => p.kind === 'cop');
      audio.siren(policeNear && s.wanted > 0, 1 / 60);
      updateHud();
      renderer.draw(world.state, SCREEN_PLAY, world.missionTarget(), world.state.time);
    } else {
      accumulator = 0;
      renderer.draw(world.state, screen === SCREEN_PAUSED ? SCREEN_PAUSED : SCREEN_OVER, null, world.state.time);
    }
  }

  // Debug handle for automated play-testing (read-only state plus the world's own
  // staging helpers); the game never reads it.
  window.__game = { world, input, shop };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      showScreen('pause');
      writeSave();
    }
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
