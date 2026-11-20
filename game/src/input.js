// Keyboard + mouse + touch input. No game logic here.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.camYaw = 0;
    this.camPitch = 0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    // Touch controls (shown only on touch devices).
    this.joy = { x: 0, y: 0, active: false };
    this.touchRun = false;
    this.touchCar = false;
    this.touchHit = false;
    this.touchBrake = false;
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.dragging = false;
    });
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      canvas.addEventListener('mousedown', (e) => {
        this.dragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      });
      window.addEventListener('mousemove', (e) => {
        if (!this.dragging) return;
        this.camYaw -= (e.clientX - this.lastX) * 0.005;
        this.camPitch = Math.max(-0.5, Math.min(0.6, this.camPitch + (e.clientY - this.lastY) * 0.004));
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      });
      window.addEventListener('mouseup', () => {
        this.dragging = false;
      });
    }
  }

  down(code) {
    return this.keys.has(code);
  }

  // Edge-triggered: true once per physical press.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.touchCar = false;
    this.touchHit = false;
    this.touchBrake = false;
  }

  // Movement axes: x = strafe right, y = forward.
  moveAxes() {
    let x = 0;
    let y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.joy.active) {
      x += this.joy.x;
      y += -this.joy.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  get run() {
    return this.down('ShiftLeft') || this.down('ShiftRight') || this.touchRun;
  }
}
