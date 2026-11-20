// Neon Harbor — input.js
// Keyboard + mouse + touch, in one place. The world reads a plain state
// object each frame; edge-triggered actions (enter car, punch, heal) are
// "pressed" flags the loop clears after reading, so one keypress is one action.

export const ACTION_ENTER = 'enter';
export const ACTION_PUNCH = 'punch';
export const ACTION_HEAL = 'heal';
export const ACTION_PAUSE = 'pause';
export const ACTION_CONFIRM = 'confirm';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'brake',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false, brake: false };
  const pressed = { enter: false, punch: false, heal: false, pause: false, confirm: false };
  const state = {
    ax: 0, ay: 0, run: false, brake: false,
    camDX: 0, camDY: 0, // accumulated mouse drag, cleared by the loop
    touch: false,
    joyX: 0, joyY: 0, // virtual joystick -1..1
    touchRun: false, touchBrake: false,
  };

  function onKeyDown(e) {
    if (e.repeat) return;
    const mapped = KEYMAP[e.code];
    if (mapped) { held[mapped] = true; e.preventDefault(); return; }
    if (e.code === 'KeyE') { pressed.enter = true; e.preventDefault(); }
    if (e.code === 'KeyF') { pressed.punch = true; e.preventDefault(); }
    if (e.code === 'KeyH') { pressed.heal = true; e.preventDefault(); }
    if (e.code === 'Escape') { pressed.pause = true; }
    if (e.code === 'Enter') { pressed.confirm = true; }
  }

  function onKeyUp(e) {
    const mapped = KEYMAP[e.code];
    if (mapped) held[mapped] = false;
  }

  // Mouse drag orbits the camera; it never punches (click is not an attack).
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  function onPointerDown(e) {
    if (e.pointerType === 'touch') return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onPointerMove(e) {
    if (!dragging || e.pointerType === 'touch') return;
    state.camDX += e.clientX - lastX;
    state.camDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onPointerUp() { dragging = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  // Touch: the first touch turns the on-screen controls on.
  window.addEventListener('touchstart', () => { state.touch = true; }, { once: true, passive: true });

  return {
    state,
    held,
    // Read and clear one edge-triggered action.
    take(action) {
      const value = pressed[action];
      pressed[action] = false;
      return value;
    },
    // Virtual joystick + touch buttons write here (hud.js calls these).
    setJoystick(x, y) { state.joyX = x; state.joyY = y; },
    setTouchButton(name, down) {
      if (name === 'run') state.touchRun = down;
      if (name === 'brake') state.touchBrake = down;
      if (name === 'car' && down) pressed.enter = true;
      if (name === 'hit' && down) pressed.punch = true;
    },
    // Poll the held keys into the frame state.
    poll() {
      let ax = 0;
      let ay = 0;
      if (held.left) ax -= 1;
      if (held.right) ax += 1;
      if (held.up) ay += 1;
      if (held.down) ay -= 1;
      // The joystick overrides the keys while it is pushed.
      if (Math.abs(state.joyX) > 0.15 || Math.abs(state.joyY) > 0.15) {
        ax = state.joyX;
        ay = -state.joyY;
      }
      state.ax = ax;
      state.ay = ay;
      state.run = held.run || state.touchRun;
      state.brake = held.brake || state.touchBrake;
      return state;
    },
    clearCameraDrag() { state.camDX = 0; state.camDY = 0; },
  };
}
