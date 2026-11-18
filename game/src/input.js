// One input source for desktop and touch. Keyboard + mouse on desktop, a virtual
// joystick and touch buttons on touch devices. Both feed the same controls object,
// so the game logic never knows which device is driving it.
//
// Touch UI lives in index.html (#touch-ui). It is shown only when the device
// supports touch (pointer: coarse, or 'ontouchstart', or ?touch=1 for testing).

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'brake',
};

export function isTouchDevice() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('touch') === '1') return true;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
    if ('ontouchstart' in window) return true;
    return (navigator.maxTouchPoints || 0) > 0;
  } catch {
    return false;
  }
}

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false, run: false, brake: false };
  const pressed = { enter: false, punch: false, pause: false, confirm: false, heal: false };
  const camDelta = { x: 0, y: 0 };

  // Virtual joystick state (touch): -1..1 on each axis. Forward is -y.
  const stick = { active: false, id: -1, x: 0, y: 0 };
  const touchBtn = { run: false, brake: false };
  const touch = isTouchDevice();
  if (touch) document.body.classList.add('touch');

  function press(name) { pressed[name] = true; }
  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (name) { keys[name] = true; event.preventDefault(); return; }
    if (event.code === 'KeyE') press('enter');
    else if (event.code === 'KeyF') press('punch');
    else if (event.code === 'KeyH') press('heal');
    else if (event.code === 'KeyP' || event.code === 'Escape') press('pause');
    else if (event.code === 'Enter') press('confirm');
  }
  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name) keys[name] = false;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    for (const key of Object.keys(keys)) keys[key] = false;
    touchBtn.run = false;
    touchBtn.brake = false;
  });

  // Mouse: drag on the canvas to orbit the camera; wheel zooms a little.
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return; // touch drag is handled below
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerType === 'touch') return;
    camDelta.x += event.clientX - lastX;
    camDelta.y += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  function endDrag() { dragging = false; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (event) => {
    camDelta.y += Math.sign(event.deltaY) * 12;
    event.preventDefault();
  }, { passive: false });

  // Touch: drag on the canvas (outside the controls) orbits the camera.
  let camTouchId = -1;
  let camLastX = 0;
  let camLastY = 0;
  canvas.addEventListener('touchstart', (event) => {
    for (const t of event.changedTouches) {
      if (camTouchId === -1) {
        camTouchId = t.identifier;
        camLastX = t.clientX;
        camLastY = t.clientY;
      }
    }
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (event) => {
    for (const t of event.changedTouches) {
      if (t.identifier === camTouchId) {
        camDelta.x += (t.clientX - camLastX) * 2.2;
        camDelta.y += (t.clientY - camLastY) * 2.2;
        camLastX = t.clientX;
        camLastY = t.clientY;
      }
    }
    event.preventDefault();
  }, { passive: false });
  function camTouchEnd(event) {
    for (const t of event.changedTouches) {
      if (t.identifier === camTouchId) camTouchId = -1;
    }
  }
  canvas.addEventListener('touchend', camTouchEnd);
  canvas.addEventListener('touchcancel', camTouchEnd);

  // Virtual joystick (left bottom). Knob follows the finger within the base.
  const stickZone = document.getElementById('stick-zone');
  const stickBase = document.getElementById('stick-base');
  const stickKnob = document.getElementById('stick-knob');
  function stickMove(touch) {
    const rect = stickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2;
    let dx = (touch.clientX - cx) / radius;
    let dy = (touch.clientY - cy) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    stick.x = dx;
    stick.y = dy;
    stickKnob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
  }
  function stickReset() {
    stick.active = false;
    stick.id = -1;
    stick.x = 0;
    stick.y = 0;
    stickKnob.style.transform = 'translate(0px, 0px)';
  }
  if (stickZone) {
    stickZone.addEventListener('touchstart', (event) => {
      const t = event.changedTouches[0];
      stick.active = true;
      stick.id = t.identifier;
      stickMove(t);
      event.preventDefault();
    }, { passive: false });
    stickZone.addEventListener('touchmove', (event) => {
      for (const t of event.changedTouches) {
        if (t.identifier === stick.id) stickMove(t);
      }
      event.preventDefault();
    }, { passive: false });
    stickZone.addEventListener('touchend', (event) => {
      for (const t of event.changedTouches) {
        if (t.identifier === stick.id) stickReset();
      }
    });
    stickZone.addEventListener('touchcancel', stickReset);
  }

  // Touch buttons (right bottom): ENTER (E), RUN (hold), PUNCH (F), BRAKE (hold).
  function wireButton(id, name, hold) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', (event) => {
      event.preventDefault();
      if (hold) touchBtn[name] = true;
      else press(name);
      el.classList.add('active');
    }, { passive: false });
    const release = (event) => {
      if (hold) touchBtn[name] = false;
      el.classList.remove('active');
      event.preventDefault();
    };
    el.addEventListener('touchend', release);
    el.addEventListener('touchcancel', release);
    // The same buttons also work with a mouse (handy to test on desktop).
    el.addEventListener('mousedown', () => {
      if (hold) touchBtn[name] = true;
      else press(name);
      el.classList.add('active');
    });
    el.addEventListener('mouseup', () => {
      if (hold) touchBtn[name] = false;
      el.classList.remove('active');
    });
    el.addEventListener('mouseleave', () => {
      if (hold) touchBtn[name] = false;
      el.classList.remove('active');
    });
  }
  wireButton('btn-enter', 'enter', false);
  wireButton('btn-punch', 'punch', false);
  wireButton('btn-run', 'run', true);
  wireButton('btn-brake', 'brake', true);

  /** Movement axes for this frame: x = strafe right, y = forward. */
  function axes() {
    if (stick.active) return { x: stick.x, y: -stick.y };
    let x = 0;
    let y = 0;
    if (keys.up) y += 1;
    if (keys.down) y -= 1;
    if (keys.left) x -= 1;
    if (keys.right) x += 1;
    return { x, y };
  }

  return {
    isTouch: touch,
    axes,
    run() { return keys.run || touchBtn.run; },
    brake() { return keys.brake || touchBtn.brake; },
    /** Edge-triggered actions; reading clears them. */
    takePressed(name) {
      const value = pressed[name];
      pressed[name] = false;
      return value;
    },
    /** Camera orbit deltas since last read, in pixels; reading clears them. */
    takeCamDelta() {
      const value = { x: camDelta.x, y: camDelta.y };
      camDelta.x = 0;
      camDelta.y = 0;
      return value;
    },
  };
}
