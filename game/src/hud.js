// HUD — DOM panels, minimap canvas, overlays, touch controls.
import { STREET_LINES, LANDMARKS } from './config.js';

export class Hud {
  constructor(input) {
    this.input = input;
    this.el = (id) => document.getElementById(id);
    this.map = this.el('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.onNewGame = null;
    this.onContinue = null;
    this.onBriefingStart = null;
    this.onResultOk = null;
    this.onShopBuy = null;
    this.onShopClose = null;
    this.onResume = null;
    this._bindButtons();
    this._bindTouch();
    this._toastTimer = null;
  }

  _bindButtons() {
    const bind = (id, fn) => {
      const b = this.el(id);
      if (b) b.addEventListener('click', () => fn && fn());
    };
    bind('btn-new', () => this.onNewGame && this.onNewGame());
    bind('btn-continue', () => this.onContinue && this.onContinue());
    bind('btn-start-mission', () => this.onBriefingStart && this.onBriefingStart());
    bind('btn-result', () => this.onResultOk && this.onResultOk());
    bind('btn-shop-close', () => this.onShopClose && this.onShopClose());
    bind('btn-resume', () => this.onResume && this.onResume());
    for (const item of ['bandage', 'drink', 'bribe']) {
      bind(`buy-${item}`, () => this.onShopBuy && this.onShopBuy(item));
    }
  }

  _bindTouch() {
    const joy = this.el('joy');
    const knob = this.el('joy-knob');
    if (!joy || !knob) return;
    const setJoy = (t) => {
      const r = joy.getBoundingClientRect();
      let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      this.input.joy = { x: dx, y: dy, active: true };
      knob.style.transform = `translate(${dx * 28}px, ${dy * 28}px)`;
    };
    joy.addEventListener('touchstart', (e) => {
      e.preventDefault();
      setJoy(e.touches[0]);
    }, { passive: false });
    joy.addEventListener('touchmove', (e) => {
      e.preventDefault();
      setJoy(e.touches[0]);
    }, { passive: false });
    const end = () => {
      this.input.joy = { x: 0, y: 0, active: false };
      knob.style.transform = 'translate(0px, 0px)';
    };
    joy.addEventListener('touchend', end);
    joy.addEventListener('touchcancel', end);
    const hold = (id, set) => {
      const b = this.el(id);
      if (!b) return;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        set(true);
      }, { passive: false });
      b.addEventListener('touchend', () => set(false));
    };
    hold('btn-touch-run', (v) => {
      this.input.touchRun = v;
    });
    hold('btn-touch-brake', (v) => {
      this.input.touchBrake = v;
    });
    const tap = (id, set) => {
      const b = this.el(id);
      if (!b) return;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        set(true);
      }, { passive: false });
    };
    tap('btn-touch-car', (v) => {
      this.input.touchCar = v;
    });
    tap('btn-touch-hit', (v) => {
      this.input.touchHit = v;
    });
  }

  showTouchUI(show) {
    const t = this.el('touch-ui');
    if (t) t.style.display = show ? 'block' : 'none';
  }

  showOnly(id) {
    for (const name of ['start-screen', 'briefing', 'result-screen', 'shop-menu', 'pause-screen']) {
      const e = this.el(name);
      if (e) e.style.display = name === id ? 'flex' : 'none';
    }
  }

  hideOverlays() {
    this.showOnly(null);
  }

  showStart(save) {
    this.showOnly('start-screen');
    const cont = this.el('btn-continue');
    if (cont) cont.style.display = save && save.mission > 0 ? 'inline-block' : 'none';
    const info = this.el('save-info');
    if (info && save) info.textContent = save.mission > 0 ? `Lanjutan: Misi ${save.mission + 1} · $${save.money}` : '';
  }

  showBriefing(mission) {
    this.showOnly('briefing');
    this.el('briefing-title').textContent = `Misi ${mission.id} — ${mission.name}`;
    this.el('briefing-text').textContent = mission.briefing;
    this.el('briefing-reward').textContent = `Hadiah: $${mission.reward}`;
  }

  showResult(title, text, buttonText = 'Lanjut') {
    this.showOnly('result-screen');
    this.el('result-title').textContent = title;
    this.el('result-text').textContent = text;
    this.el('btn-result').textContent = buttonText;
  }

  showShop(money, bandages, stars, nearestPoliceDist) {
    this.showOnly('shop-menu');
    this.el('shop-money').textContent = `$${money}`;
    this.el('shop-bandages').textContent = `${bandages}/3`;
    const bribeBtn = this.el('buy-bribe');
    if (bribeBtn) {
      const ok = money >= 200 && stars >= 1 && stars <= 2 && (nearestPoliceDist === null || nearestPoliceDist > 30);
      bribeBtn.disabled = !ok;
      bribeBtn.textContent = ok ? 'Beli — $200' : 'Beli — $200 (butuh wanted 1-2, tanpa polisi < 30 m)';
    }
    const bandBtn = this.el('buy-bandage');
    if (bandBtn) bandBtn.disabled = !(money >= 40 && bandages < 3);
    const drinkBtn = this.el('buy-drink');
    if (drinkBtn) drinkBtn.disabled = !(money >= 25);
  }

  toast(msg, ms = 2200) {
    const t = this.el('message');
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      t.style.opacity = '0';
    }, ms);
  }

  update(s) {
    const hp = this.el('health-fill');
    if (hp) hp.style.width = `${Math.max(0, s.health)}%`;
    const money = this.el('money');
    if (money) money.textContent = `$${s.money}`;
    const band = this.el('bandages');
    if (band) band.textContent = `🩹 ${s.bandages} (H)`;
    const stars = this.el('stars');
    if (stars) stars.textContent = '★'.repeat(s.stars) + '☆'.repeat(5 - s.stars);
    const speed = this.el('speed');
    if (speed) speed.textContent = s.inCar ? `${Math.round(s.speedKmh)} km/h` : '';
    const clock = this.el('clock');
    if (clock) clock.textContent = s.clock;
    const obj = this.el('objective');
    if (obj) obj.textContent = s.objective;
    const mname = this.el('mission-name');
    if (mname) mname.textContent = s.missionName;
    const status = this.el('status');
    if (status) status.textContent = s.statusText || '';
  }

  drawMinimap(snap) {
    const g = this.mapCtx;
    const S = 180;
    const scale = S / 480;
    const px = (v) => (v + 240) * scale;
    g.fillStyle = '#10131a';
    g.fillRect(0, 0, S, S);
    // Sea.
    g.fillStyle = '#0d3a5c';
    g.fillRect(0, 0, px(-210), S);
    g.fillRect(0, px(210), S, S - px(210));
    // Roads.
    g.strokeStyle = '#3a3f4a';
    g.lineWidth = 3;
    for (const l of STREET_LINES) {
      g.beginPath();
      g.moveTo(px(l), 0);
      g.lineTo(px(l), S);
      g.moveTo(0, px(l));
      g.lineTo(S, px(l));
      g.stroke();
    }
    // Shop marker ($).
    g.fillStyle = '#4ade80';
    g.font = 'bold 13px Arial';
    g.textAlign = 'center';
    g.fillText('$', px(LANDMARKS.SHOP_POS.x), px(LANDMARKS.SHOP_POS.z) + 4);
    // Mission target.
    if (snap.target) {
      g.fillStyle = '#00e5ff';
      g.beginPath();
      g.arc(px(snap.target.x), px(snap.target.z), 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#00e5ff';
      g.beginPath();
      g.arc(px(snap.target.x), px(snap.target.z), 9, 0, Math.PI * 2);
      g.stroke();
    }
    // Traffic cars (white), police (red/blue).
    g.fillStyle = '#d8d8d8';
    for (const c of snap.cars) g.fillRect(px(c.x) - 1.5, px(c.z) - 1.5, 3, 3);
    for (const p of snap.police) {
      g.fillStyle = snap.blink ? '#ff4444' : '#4488ff';
      g.beginPath();
      g.arc(px(p.x), px(p.z), 3.5, 0, Math.PI * 2);
      g.fill();
    }
    // Player arrow.
    const x = px(snap.player.x);
    const y = px(snap.player.z);
    g.save();
    g.translate(x, y);
    g.rotate(Math.atan2(Math.sin(snap.player.heading), Math.cos(snap.player.heading)));
    g.fillStyle = '#ffd27a';
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 6);
    g.lineTo(-5, 6);
    g.closePath();
    g.fill();
    g.restore();
    // North.
    g.fillStyle = '#ffffff';
    g.font = 'bold 11px Arial';
    g.fillText('N', S - 10, 12);
  }
}
