// Neon Harbor — boot, fixed-step loop, HUD wiring, screenshot mode.
import { Renderer } from './render.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Hud } from './hud.js';
import { World } from './world.js';
import { getShotPose } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');

const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const input = new Input();
const audio = new AudioSys();
const hud = new Hud(input);
const world = new World(renderer, input, audio, hud, seed);
window.__world = world;

hud.onNewGame = () => {
  audio.ensure();
  world.newGame();
};
hud.onContinue = () => {
  audio.ensure();
  world.continueGame();
};
hud.onBriefingStart = () => {
  audio.ensure();
  world.startMission();
};
hud.onResultOk = () => {
  if (world._resultNext === 'briefing') world.startBriefing();
  else {
    world.phase = 'title';
    hud.showStart(world.save);
  }
};
hud.onShopBuy = (id) => world.buyItem(id);
hud.onShopClose = () => world.closeShop();
hud.onResume = () => {
  world.phase = 'play';
  hud.hideOverlays();
};

if (shotName) {
  // Screenshot mode: deterministic pose, no menus, no simulation steps.
  const pose = getShotPose(shotName);
  renderer.resize(window.innerWidth, window.innerHeight);
  world.setupShot(pose);
  hud.showTouchUI(false);
  let frames = 0;
  const loop = () => {
    world.renderFrame();
    frames++;
    if (frames === 5) {
      window.__shotReady = true;
      window.__shotDebug = world.debugState();
    }
    if (frames < 8) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
} else {
  hud.showTouchUI(input.isTouch);
  hud.showStart(world.save);
  const fit = () => renderer.resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', fit);
  fit();
  window.addEventListener('pointerdown', () => audio.ensure(), { once: true });
  window.addEventListener('keydown', () => audio.ensure(), { once: true });
  window.addEventListener('beforeunload', () => world._save());

  const STEP = 1 / 60;
  let last = performance.now();
  let acc = 0;
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // Global keys for non-play phases.
    if (world.phase === 'shop' && (input.wasPressed('Escape') || input.wasPressed('KeyE'))) world.closeShop();
    else if (world.phase === 'paused' && input.wasPressed('Escape')) {
      world.phase = 'play';
      hud.hideOverlays();
    } else if (world.phase === 'briefing' && input.wasPressed('Enter')) world.startMission();
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      world.step();
      acc -= STEP;
      n++;
    }
    if (n === 5) acc = 0;
    input.endFrame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
