// Neon Harbor — hud.js
// Heads-up display, minimap, menus and touch controls. All DOM lives in
// index.html; this module reads and writes it, draws the top-down minimap
// on its canvas, and runs the Gry Market menu.

import { CONFIG } from './config.js';
import { SHOP_ITEMS } from './shop.js';

const MAP_SIZE = 180;
const MAP_SCALE = MAP_SIZE / (CONFIG.worldHalf * 2);

function toMap(x, z) {
  return [(x + CONFIG.worldHalf) * MAP_SCALE, (z + CONFIG.worldHalf) * MAP_SCALE];
}

export function createHud(doc, input) {
  const $ = (id) => doc.getElementById(id);
  const els = {
    healthFill: $('health-fill'),
    healthNum: $('health-num'),
    money: $('money'),
    stars: $('stars'),
    speed: $('speed'),
    objective: $('objective-text'),
    bandages: $('bandages'),
    clock: $('clock'),
    toast: $('toast'),
    minimap: $('minimap'),
    shop: $('shop'),
    shopMoney: $('shop-money'),
    shopItems: $('shop-items'),
    shopMsg: $('shop-msg'),
  };
  const mapCtx = els.minimap.getContext('2d');
  let toastTimer = 0;

  function setHealth(hp) {
    els.healthFill.style.width = `${Math.max(0, Math.min(100, hp))}%`;
    els.healthFill.style.background = hp > 50 ? '#4ac25a' : hp > 25 ? '#d8b93a' : '#c23a3a';
    els.healthNum.textContent = `${Math.ceil(hp)}`;
  }

  function setMoney(m) {
    els.money.textContent = `$${m.toLocaleString('en-US')}`;
  }

  function setStars(n) {
    els.stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    els.stars.style.color = n > 0 ? '#ffd23a' : '#666';
  }

  function setSpeed(kmh, driving) {
    els.speed.textContent = driving ? `${Math.round(kmh)} km/h` : '';
  }

  function setObjective(text) {
    els.objective.textContent = text;
  }

  function setBandages(n) {
    els.bandages.textContent = `🩹 ${n}  [H]`;
  }

  function setClock(hour) {
    const h = Math.floor(hour) % 24;
    const m = Math.floor((hour % 1) * 60);
    els.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function toast(msg, ms = 3000) {
    els.toast.textContent = msg;
    els.toast.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.style.opacity = '0';
    }, ms);
  }

  function drawMinimap(state) {
    const g = mapCtx;
    g.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    g.fillStyle = '#0d0d12';
    g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Sea along the west and south edges.
    g.fillStyle = '#14405e';
    g.fillRect(0, 0, 4, MAP_SIZE);
    g.fillRect(0, MAP_SIZE - 4, MAP_SIZE, 4);
    // Roads.
    g.strokeStyle = '#3a3d42';
    g.lineWidth = 3;
    for (const line of CONFIG.roadLines) {
      const [mx] = toMap(line, 0);
      const [, mz] = toMap(0, line);
      g.beginPath();
      g.moveTo(mx, 0);
      g.lineTo(mx, MAP_SIZE);
      g.stroke();
      g.beginPath();
      g.moveTo(0, mz);
      g.lineTo(MAP_SIZE, mz);
      g.stroke();
    }
    // Gry Market.
    const [sx, sy] = toMap(CONFIG.shop.x, CONFIG.shop.z);
    g.fillStyle = '#4ac25a';
    g.fillRect(sx - 3, sy - 3, 6, 6);
    g.fillStyle = '#0d0d12';
    g.font = 'bold 6px Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('$', sx, sy + 0.5);
    // Mission marker.
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      g.fillStyle = '#ffd23a';
      g.beginPath();
      g.moveTo(mx, my - 6);
      g.lineTo(mx + 5, my);
      g.lineTo(mx, my + 6);
      g.lineTo(mx - 5, my);
      g.closePath();
      g.fill();
    }
    // Cars and police.
    for (const car of state.cars) {
      const [mx, my] = toMap(car.x, car.z);
      g.fillStyle = car.kind === 'police' ? '#ff3a3a' : '#dddddd';
      g.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }
    for (const cop of state.footPolice) {
      const [mx, my] = toMap(cop.x, cop.z);
      g.fillStyle = '#ff3a3a';
      g.beginPath();
      g.arc(mx, my, 2, 0, Math.PI * 2);
      g.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.playerX, state.playerZ);
    g.save();
    g.translate(px, py);
    g.rotate(Math.atan2(-Math.sin(state.heading), -Math.cos(state.heading)) + Math.PI / 2);
    g.fillStyle = '#4ad4ff';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4, 5);
    g.lineTo(-4, 5);
    g.closePath();
    g.fill();
    g.restore();
    // North.
    g.fillStyle = '#888';
    g.font = 'bold 10px Arial';
    g.textAlign = 'left';
    g.fillText('N', 4, 12);
  }

  // --- Overlays.
  function show(id) {
    const el = $(id);
    if (el) el.style.display = 'flex';
  }
  function hide(id) {
    const el = $(id);
    if (el) el.style.display = 'none';
  }
  function hideAllOverlays() {
    for (const id of ['start-screen', 'briefing', 'passed', 'failed', 'busted', 'paused', 'shop']) hide(id);
  }

  // --- Gry Market menu.
  let shopState = null;
  let shopOnBuy = null;
  let shopOnClose = null;

  function renderShop() {
    els.shopMoney.textContent = `$${shopState.money.toLocaleString('en-US')}`;
    els.shopItems.innerHTML = '';
    for (const item of SHOP_ITEMS) {
      const row = doc.createElement('div');
      row.className = 'shop-row';
      const owned = item.id === 'bandage' ? ` (carrying ${shopState.bandages}/3)` : '';
      row.innerHTML = `<b>${item.name}</b> — $${item.price}${owned}<br><span class="shop-desc">${item.desc}</span>`;
      const btn = doc.createElement('button');
      btn.textContent = 'Buy';
      btn.addEventListener('click', () => {
        const res = shopOnBuy(item.id);
        els.shopMsg.textContent = res.message;
        renderShop();
      });
      row.appendChild(btn);
      els.shopItems.appendChild(row);
    }
  }

  function openShop(state, onBuy, onClose) {
    shopState = state;
    shopOnBuy = onBuy;
    shopOnClose = onClose;
    els.shopMsg.textContent = '';
    renderShop();
    show('shop');
  }

  function closeShop() {
    hide('shop');
    if (shopOnClose) shopOnClose();
  }

  // --- Touch controls: joystick + buttons, only on touch devices.
  function initTouch() {
    const ui = $('touch-ui');
    if (!input.touch.active) {
      ui.style.display = 'none';
      return;
    }
    ui.style.display = 'block';
    const base = $('joy-base');
    const knob = $('joy-knob');
    let joyId = null;
    function joyMove(e) {
      const r = base.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2);
      let dy = (e.clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      input.setJoystick(dx, dy);
      knob.style.transform = `translate(${dx * 32}px, ${dy * 32}px)`;
    }
    base.addEventListener('pointerdown', (e) => {
      joyId = e.pointerId;
      base.setPointerCapture(joyId);
      joyMove(e);
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId === joyId) joyMove(e);
    });
    function joyEnd(e) {
      if (e.pointerId !== joyId) return;
      joyId = null;
      input.setJoystick(0, 0);
      knob.style.transform = 'translate(0, 0)';
    }
    base.addEventListener('pointerup', joyEnd);
    base.addEventListener('pointercancel', joyEnd);
    for (const btn of doc.querySelectorAll('[data-touch]')) {
      const name = btn.getAttribute('data-touch');
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        input.touchButton(name, true);
      });
      btn.addEventListener('pointerup', () => input.touchButton(name, false));
      btn.addEventListener('pointerleave', () => input.touchButton(name, false));
    }
  }

  return {
    setHealth,
    setMoney,
    setStars,
    setSpeed,
    setObjective,
    setBandages,
    setClock,
    toast,
    drawMinimap,
    show,
    hide,
    hideAllOverlays,
    openShop,
    closeShop,
    initTouch,
  };
}
