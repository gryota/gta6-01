// Neon Harbor — HUD (DOM) + minimap (2D canvas top-down).
import { STREET_LINES, MAP_HALF, LANDMARKS } from './config.js';

export function buildHud(root) {
  root.innerHTML = `
  <div id="hud" style="position:absolute;inset:0;pointer-events:none;font-family:system-ui,sans-serif;color:#fff">
    <div id="hud-top" style="position:absolute;top:12px;left:12px;display:flex;gap:14px;align-items:center">
      <div id="hud-health" style="background:rgba(0,0,0,.55);padding:6px 10px;border-radius:8px">❤ <span id="hud-hp">100</span></div>
      <div id="hud-money" style="background:rgba(0,0,0,.55);padding:6px 10px;border-radius:8px">$<span id="hud-cash">0</span></div>
      <div id="hud-band" style="background:rgba(0,0,0,.55);padding:6px 10px;border-radius:8px">🩹 <span id="hud-bandages">0</span> <span style="opacity:.7">(H)</span></div>
      <div id="hud-stars" style="font-size:20px;letter-spacing:2px;text-shadow:0 0 8px #000"></div>
      <div id="hud-clock" style="background:rgba(0,0,0,.55);padding:6px 10px;border-radius:8px">18:00</div>
    </div>
    <div id="hud-speed" style="position:absolute;bottom:14px;left:14px;background:rgba(0,0,0,.55);padding:8px 12px;border-radius:8px;font-size:18px">0 km/h</div>
    <div id="hud-objective" style="position:absolute;top:12px;right:12px;max-width:340px;background:rgba(0,0,0,.6);padding:10px 12px;border-radius:8px;font-size:14px;line-height:1.4"></div>
    <canvas id="minimap" width="180" height="180" style="position:absolute;right:12px;bottom:12px;border:2px solid rgba(255,255,255,.35);border-radius:8px;background:#14141c"></canvas>
    <div id="hud-status" style="position:absolute;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.6);padding:8px 14px;border-radius:8px;font-size:14px"></div>
    <div id="touch-ui" style="display:none;position:absolute;inset:0">
      <div id="joy" style="position:absolute;left:24px;bottom:70px;width:110px;height:110px;border:2px solid rgba(255,255,255,.4);border-radius:50%"></div>
      <div id="joy-knob" style="position:absolute;left:59px;bottom:105px;width:40px;height:40px;background:rgba(255,255,255,.5);border-radius:50%"></div>
      <button id="btn-car" style="position:absolute;right:24px;bottom:170px;width:64px;height:64px;border-radius:50%;font-size:13px">CAR</button>
      <button id="btn-hit" style="position:absolute;right:100px;bottom:90px;width:64px;height:64px;border-radius:50%;font-size:13px">HIT</button>
      <button id="btn-run" style="position:absolute;right:24px;bottom:90px;width:64px;height:64px;border-radius:50%;font-size:13px">RUN</button>
      <button id="btn-brake" style="position:absolute;right:100px;bottom:170px;width:64px;height:64px;border-radius:50%;font-size:13px">BRAKE</button>
    </div>
  </div>
  <div id="screen" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,6,20,.82);color:#fff;font-family:system-ui,sans-serif;z-index:5"></div>
  <div id="shop" style="position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);z-index:6;font-family:system-ui,sans-serif;color:#fff">
    <div style="background:#14141f;padding:22px 26px;border-radius:12px;border:2px solid #39ff88;min-width:320px">
      <h2 style="margin:0 0 4px;color:#39ff88">GRY MARKET</h2>
      <p style="margin:0 0 14px;opacity:.8;font-size:13px">Pasar malam Old Town — E / Esc untuk tutup</p>
      <div id="shop-items"></div>
      <p id="shop-msg" style="min-height:20px;color:#ffd27a"></p>
      <p>Uang: $<span id="shop-money">0</span></p>
    </div>
  </div>`;
  return {
    hp: root.querySelector('#hud-hp'),
    cash: root.querySelector('#hud-cash'),
    bandages: root.querySelector('#hud-bandages'),
    stars: root.querySelector('#hud-stars'),
    clock: root.querySelector('#hud-clock'),
    speed: root.querySelector('#hud-speed'),
    objective: root.querySelector('#hud-objective'),
    status: root.querySelector('#hud-status'),
    minimap: root.querySelector('#minimap'),
    screen: root.querySelector('#screen'),
    shop: root.querySelector('#shop'),
    shopItems: root.querySelector('#shop-items'),
    shopMsg: root.querySelector('#shop-msg'),
    shopMoney: root.querySelector('#shop-money'),
    touchUI: root.querySelector('#touch-ui'),
  };
}

export function renderHud(h, s) {
  h.hp.textContent = Math.ceil(s.health);
  h.cash.textContent = s.money;
  h.bandages.textContent = s.bandages;
  h.stars.textContent = '★'.repeat(s.stars) + '☆'.repeat(5 - s.stars);
  h.stars.style.color = s.stars > 0 ? '#ffd21f' : 'rgba(255,255,255,.4)';
  const hh = String(Math.floor(s.clockMin / 60) % 24).padStart(2, '0');
  const mm = String(Math.floor(s.clockMin % 60)).padStart(2, '0');
  h.clock.textContent = `${hh}:${mm}`;
  h.speed.textContent = `${Math.round(s.speedKmh)} km/h`;
  h.objective.innerHTML = s.objective || '';
  h.status.textContent = s.status || '';
  drawMinimap(h.minimap, s);
}

function drawMinimap(canvas, s) {
  const g = canvas.getContext('2d');
  const W = 180;
  const scale = W / (MAP_HALF * 2 + 20);
  const toX = (x) => (x + MAP_HALF + 10) * scale;
  const toY = (z) => (z + MAP_HALF + 10) * scale;
  g.clearRect(0, 0, W, W);
  g.fillStyle = '#14141c';
  g.fillRect(0, 0, W, W);
  // Sea.
  g.fillStyle = '#0a3a5c';
  g.fillRect(0, 0, (MAP_HALF + 10 + -182) * scale, W);
  g.fillRect(0, (182 + MAP_HALF + 10) * scale, W, W);
  // Roads.
  g.strokeStyle = '#4a4b55';
  g.lineWidth = 4;
  for (const x of STREET_LINES) {
    g.beginPath(); g.moveTo(toX(x), 0); g.lineTo(toX(x), W); g.stroke();
  }
  for (const z of STREET_LINES) {
    g.beginPath(); g.moveTo(0, toY(z)); g.lineTo(W, toY(z)); g.stroke();
  }
  // Shop marker ($).
  g.fillStyle = '#39ff88';
  g.font = 'bold 13px sans-serif';
  g.fillText('$', toX(LANDMARKS.SHOP_POS.x) - 4, toY(LANDMARKS.SHOP_POS.z) + 4);
  // Mission marker.
  if (s.marker) {
    g.fillStyle = '#22e6ff';
    g.beginPath();
    g.arc(toX(s.marker.x), toY(s.marker.z), 6, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 1.5;
    g.stroke();
  }
  // Police (red dots).
  g.fillStyle = '#ff2244';
  for (const p of s.policeDots || []) {
    g.beginPath(); g.arc(toX(p.x), toY(p.z), 2.5, 0, Math.PI * 2); g.fill();
  }
  // Traffic (grey dots).
  g.fillStyle = '#9a9aa5';
  for (const c of s.carDots || []) {
    g.fillRect(toX(c.x) - 1.5, toY(c.z) - 1.5, 3, 3);
  }
  // Player (white triangle pointing along heading).
  g.save();
  g.translate(toX(s.px), toY(s.pz));
  g.rotate(Math.atan2(Math.sin(s.heading), Math.cos(s.heading)) + Math.PI);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath();
  g.fill();
  g.restore();
  // North.
  g.fillStyle = '#fff';
  g.font = 'bold 11px sans-serif';
  g.fillText('N', 6, 14);
}

export function showScreen(h, html) {
  h.screen.innerHTML = html;
  h.screen.style.display = 'flex';
}

export function hideScreen(h) {
  h.screen.style.display = 'none';
  h.screen.innerHTML = '';
}

export function showShop(h, items, money, msg) {
  h.shop.style.display = 'flex';
  h.shopItems.innerHTML = items.map((it, i) => `
    <button data-i="${i}" style="display:block;width:100%;text-align:left;margin:6px 0;padding:10px;border-radius:8px;background:#22222f;color:#fff;border:1px solid #444;cursor:pointer">
      <b>${it.name}</b> — $${it.price} <span style="opacity:.7">${it.desc}</span>
    </button>`).join('');
  h.shopMoney.textContent = money;
  h.shopMsg.textContent = msg || '';
  h.shopItems.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      const ev = new CustomEvent('shop-buy', { detail: Number(b.dataset.i) });
      h.shop.dispatchEvent(ev);
    });
  });
}

export function hideShop(h) {
  h.shop.style.display = 'none';
}
