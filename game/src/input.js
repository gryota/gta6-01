// Neon Harbor — input.js
// Keyboard + mouse + touch input in one place. The world reads the frame
// axes every tick; one-shot actions (E, F, H, pause) are edge-triggered and
// consumed once. Touch devices get a virtual joystick and CAR / HIT / RUN /
// BRAKE buttons; the HUD shows them only when this module reports touch.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let lookDX = 0;
  let lookDY = 0;
  let wheelDelta = 0;
  let dragging = false;
  let dragMoved = 0;
  let lastX = 0;
  let lastY = 0;

  const touch = {
    active: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    joyX: 0,
    joyY: 0,
    run: false,
    brake: false,
    car: false,
    hit: false,
  };

  const ACTION_KEYS = { KeyE: 'interact', KeyF: 'punch', KeyH: 'bandage', KeyM: 'mute', Escape: 'pause', KeyP: 'pause' };

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    if (ACTION_KEYS[e.code]) pressed.add(ACTION_KEYS[e.code]);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseDown(e) {
    dragging = true;
    dragMoved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onMouseMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    lookDX += dx;
    lookDY += dy;
  }
  function onMouseUp() {
    if (dragging && dragMoved < 6) pressed.add('punch');
    dragging = false;
  }
  function onWheel(e) {
    wheelDelta += e.deltaY;
    e.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Touch buttons are plain DOM elements with data-touch attributes; the HUD
  // wires them to these handlers. Joystick state is set by the HUD too.
  function touchButton(name, down) {
    if (name === 'car') touch.car = down;
    if (name === 'hit') touch.hit = down;
    if (name === 'run') touch.run = down;
    if (name === 'brake') touch.brake = down;
    if (down && name === 'car') pressed.add('interact');
    if (down && name === 'hit') pressed.add('punch');
  }

  function setJoystick(x, y) {
    touch.joyX = Math.max(-1, Math.min(1, x));
    touch.joyY = Math.max(-1, Math.min(1, y));
  }

  function axis() {
    const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const strafe = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.run;
    const handbrake = keys.has('Space') || touch.brake;
    // Touch joystick: up is forward.
    const joyFwd = -touch.joyY;
    const joyStrafe = touch.joyX;
    return {
      forward: Math.max(-1, Math.min(1, fwd + joyFwd)),
      strafe: Math.max(-1, Math.min(1, strafe + joyStrafe)),
      run,
      handbrake,
    };
  }

  function consumeAction(name) {
    if (pressed.has(name)) {
      pressed.delete(name);
      return true;
    }
    return false;
  }

  function consumeLook() {
    const out = { dx: lookDX, dy: lookDY, wheel: wheelDelta };
    lookDX = 0;
    lookDY = 0;
    wheelDelta = 0;
    return out;
  }

  return { keys, touch, axis, consumeAction, consumeLook, touchButton, setJoystick };
}
