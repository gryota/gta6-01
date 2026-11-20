// Neon Harbor — input: keyboard + mouse orbit + touch (virtual joystick + buttons).
export function createInput() {
  return {
    keys: new Set(),
    // edge-triggered actions consumed once per press
    pressed: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    dragging: false,
    // touch
    touch: false,
    joyX: 0,
    joyY: 0,
    touchCar: false,
    touchHit: false,
    touchRun: false,
    touchBrake: false,
  };
}

export function attachInput(input, canvas, onAction) {
  const keymap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    Space: 'brake',
    KeyE: 'interact',
    KeyF: 'hit',
    KeyH: 'heal',
    Escape: 'close',
  };
  window.addEventListener('keydown', (e) => {
    const action = keymap[e.code];
    if (!action) return;
    if (e.code === 'Space') e.preventDefault();
    if (!input.keys.has(action)) input.pressed.add(action);
    input.keys.add(action);
    if (onAction) onAction(action);
  });
  window.addEventListener('keyup', (e) => {
    const action = keymap[e.code];
    if (action) input.keys.delete(action);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.pressed.clear();
  });
  // Mouse drag orbits the camera (never a punch).
  canvas.addEventListener('mousedown', (e) => {
    input.dragging = true;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.mouseDX += e.clientX - (input.lastX ?? e.clientX);
    input.mouseDY += e.clientY - (input.lastY ?? e.clientY);
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { input.dragging = false; });
  // Touch: show touch UI, virtual joystick on the left half.
  window.addEventListener('touchstart', () => { input.touch = true; }, { passive: true });
}

export function consumePressed(input, action) {
  if (input.pressed.has(action)) {
    input.pressed.delete(action);
    return true;
  }
  return false;
}

export function clearPressed(input) {
  input.pressed.clear();
}

// Movement axes in [-1, 1] from keyboard or joystick.
export function moveAxes(input) {
  let x = 0;
  let y = 0;
  if (input.keys.has('left')) x -= 1;
  if (input.keys.has('right')) x += 1;
  if (input.keys.has('up')) y += 1;
  if (input.keys.has('down')) y -= 1;
  if (input.touch) {
    x += input.joyX;
    y += input.joyY;
  }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}

export function isRun(input) {
  return input.keys.has('run') || input.touchRun;
}
