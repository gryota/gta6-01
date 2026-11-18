// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one stages a real
// moment of the game from a fresh world with a fixed seed, then steps the simulation
// forward with a scripted autopilot, so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

/** Drive toward a point: throttle forward, steer to face it. */
function driveToward(world, tx, tz) {
  const p = world.state.player;
  const dx = tx - p.x;
  const dz = tz - p.z;
  const want = Math.atan2(dx, dz);
  let diff = want - p.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { ax: Math.max(-1, Math.min(1, -diff * 1.4)), ay: 1, run: false, brake: false, enterPressed: false, punchPressed: false, camDX: 0, camDY: 0 };
}

function idleControls() {
  return { ax: 0, ay: 0, run: false, brake: false, enterPressed: false, punchPressed: false, camDX: 0, camDY: 0 };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: title over a living downtown. drive: Rook driving through Downtown at dusk.
 * chase: police on Rook's tail, 3 stars. mission: the Harbor Run delivery in progress.
 */
export function stageShot(name, world) {
  world.reset(null);
  const state = world.state;
  if (name !== 'drive' && name !== 'chase' && name !== 'mission') {
    // Title: let traffic and pedestrians move for 4 seconds, camera over downtown.
    for (let i = 0; i < 4 / SAMPLE; i += 1) world.step(SAMPLE, idleControls());
    world.placePlayer(0, 0, Math.PI);
    state.cinematic = { x: 55, y: 26, z: 118, tx: -10, ty: 22, tz: -20 };
    return { screen: SCREEN_TITLE };
  }
  if (name === 'drive') {
    world.givePlayerCar(-120, 0, Math.PI / 2, 13);
    world.setMission(0, 1);
    for (let i = 0; i < 6 / SAMPLE; i += 1) {
      world.step(SAMPLE, driveToward(world, 160, 0));
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // Heading north (PI) straight up the 0-road — no U-turn, no cutting corners.
    world.givePlayerCar(0, 80, Math.PI, 16);
    world.setWanted(300);
    world.spawnPoliceAt(0, 106);
    world.spawnPoliceAt(-7, 116);
    world.setMission(3, 1);
    for (let i = 0; i < 5 / SAMPLE; i += 1) {
      world.step(SAMPLE, driveToward(world, 0, -160));
    }
    // Rear view from up the road: Rook's car coming at the camera, the cruisers
    // closing in behind it — both in frame.
    const p = world.state.player;
    state.cinematic = { x: p.x - 2, y: 5.5, z: p.z - 16, tx: p.x, ty: 2, tz: p.z + 12 };
    return { screen: SCREEN_PLAY };
  }
  // mission: Harbor Run, package picked up, heading for the Volt Tower.
  world.givePlayerCar(-120, -40, Math.PI / 2, 12);
  world.setMission(1, 1);
  for (let i = 0; i < 5 / SAMPLE; i += 1) {
    world.step(SAMPLE, driveToward(world, 0, 40));
  }
  return { screen: SCREEN_PLAY };
}
