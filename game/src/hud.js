// Neon Harbor — hud.js
// Everything drawn on top of the 3D view: health, money, wanted stars, the
// clock, the objective line, the minimap (a 2D top-down canvas), the start
// screen, the mission banner, the Gry Market overlay, and the touch controls
// (virtual joystick + CAR / HIT / RUN / BRAKE buttons).

import { STREET_LINES, MAP_HALF, SHOP_POS, GARAGE, HIDEOUT } from './config.js';
import { SHOP_ITEMS } from './shop.js';
import { MISSION_NAMES, MISSION_BRIEFINGS } from './missions.js';

const STAR_FULL = '★';
const STAR_EMPTY = '☆';

export function createHud(callbacks) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="hud-top-left">
      <div id="health-wrap"><div id="health-bar"></div><span id="health-text">100</span></div>
      <div id="money-line">$<span id="money">0</span> &nbsp;·&nbsp; <span id="bandage-line">🩹 <span id="bandages">0</span> (H)</span></div>
      <div id="objective-line"></div>
    </div>
    <div id="hud-top-right">
      <div id="stars"></div>
      <div id="clock-line">18:00</div>
      <div id="speed-line"></div>
      <canvas id="minimap" width="180" height="180"></canvas>
    </div>
    <div id="banner" class="hidden"></div>
    <div id="briefing" class="hidden"><div id="briefing-text"></div><button id="briefing-go">Start mission</button></div>
    <div id="title-screen">
      <h1>NEON HARBOR</h1>
      <p class="tagline">A getaway driver returns to the city he owes.</p>
      <p class="story">Rook is back in Neon Harbor, and Ms. Vane owns his debt. Steal cars, run her jobs,
      stay ahead of the harbor police — and get out clean.</p>
      <div class="controls-list">
        <div>WASD — walk / drive &nbsp;·&nbsp; Mouse drag — camera</div>
        <div>E — enter car / steal / shop &nbsp;·&nbsp; F — punch &nbsp;·&nbsp; H — use bandage</div>
        <div>Shift — run &nbsp;·&nbsp; Space — handbrake &nbsp;·&nbsp; Esc — pause</div>
      </div>
      <button id="btn-new">New Game</button>
      <button id="btn-continue">Continue</button>
    </div>
    <div id="pause-screen" class="hidden"><h2>Paused</h2><button id="btn-resume">Resume</button><button id="btn-quit">Quit to title</button></div>
    <div id="shop-screen" class="hidden">
      <h2>GRY MARKET</h2>
      <p class="shop-note">Old Town night market — the cops can still reach you here.</p>
      <div id="shop-items"></div>
      <div id="shop-msg"></div>
      <button id="btn-shop-close">Close (E)</button>
    </div>
    <div id="touch-ui" class="hidden">
      <div id="joystick"><div id="joy-knob"></div></div>
      <div id="touch-buttons">
        <button data-btn="car">CAR</button>
        <button data-btn="hit">HIT</button>
        <button data-btn="run">RUN</button>
        <button data-btn="brake">BRAKE</button>
      </div>
    </div>
  `;

  const el = (id) => document.getElementById(id);
  const minimap = el('minimap');
  const mapCtx = minimap.getContext('2d');

  // --- shop overlay -------------------------------------------------------
  const shopItemsEl = el('shop-items');
  for (const item of SHOP_ITEMS) {
    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `<span class="shop-name">${item.name} — $${item.price}</span><span class="shop-desc">${item.desc}</span><button data-item="${item.id}">Buy</button>`;
    shopItemsEl.appendChild(row);
  }
  shopItemsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-item]');
    if (btn) callbacks.onBuy(btn.dataset.item);
  });
  el('btn-shop-close').addEventListener('click', () => callbacks.onShopClose());
  el('briefing-go').addEventListener('click', () => callbacks.onBriefingGo());
  el('btn-new').addEventListener('click', () => callbacks.onNewGame());
  el('btn-continue').addEventListener('click', () => callbacks.onContinue());
  el('btn-resume').addEventListener('click', () => callbacks.onResume());
  el('btn-quit').addEventListener('click', () => callbacks.onQuitToTitle());

  // --- touch controls -------------------------------------------------------
  const joystick = el('joystick');
  const knob = el('joy-knob');
  let joyId = null;
  function joyPos(touch) {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (touch.clientX - cx) / (rect.width / 2);
    let dy = (touch.clientY - cy) / (rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    return { dx, dy };
  }
  joystick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyId = t.identifier;
    const { dx, dy } = joyPos(t);
    knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    callbacks.onJoystick(dx, dy);
  }, { passive: false });
  joystick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      const { dx, dy } = joyPos(t);
      knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
      callbacks.onJoystick(dx, dy);
    }
  }, { passive: false });
  function joyEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      joyId = null;
      knob.style.transform = 'translate(0, 0)';
      callbacks.onJoystick(0, 0);
    }
  }
  joystick.addEventListener('touchend', joyEnd);
  joystick.addEventListener('touchcancel', joyEnd);
  document.querySelectorAll('#touch-buttons button').forEach((btn) => {
    const name = btn.dataset.btn;
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); callbacks.onTouchButton(name, true); }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); callbacks.onTouchButton(name, false); }, { passive: false });
  });

  function drawMinimap(snap) {
    const S = 180;
    const scale = S / (MAP_HALF * 2 + 20);
    const toX = (x) => S / 2 + x * scale;
    const toY = (z) => S / 2 + z * scale;
    mapCtx.fillStyle = '#10131c';
    mapCtx.fillRect(0, 0, S, S);
    // Sea on the west and south edges.
    mapCtx.fillStyle = '#14506e';
    mapCtx.fillRect(0, 0, 8, S);
    mapCtx.fillRect(0, S - 8, S, 8);
    // Roads.
    mapCtx.strokeStyle = '#4a505c';
    mapCtx.lineWidth = 3;
    for (const line of STREET_LINES) {
      mapCtx.beginPath(); mapCtx.moveTo(toX(line), 0); mapCtx.lineTo(toX(line), S); mapCtx.stroke();
      mapCtx.beginPath(); mapCtx.moveTo(0, toY(line)); mapCtx.lineTo(S, toY(line)); mapCtx.stroke();
    }
    // Landmarks: shop ($), garage (G), hideout (H).
    mapCtx.font = 'bold 12px sans-serif';
    mapCtx.textAlign = 'center';
    mapCtx.fillStyle = '#ffd23e';
    mapCtx.fillText('$', toX(SHOP_POS.x), toY(SHOP_POS.z) + 4);
    mapCtx.fillStyle = '#39d0c0';
    mapCtx.fillText('G', toX(GARAGE.x), toY(GARAGE.z) + 4);
    mapCtx.fillStyle = '#c98cff';
    mapCtx.fillText('H', toX(HIDEOUT.x), toY(HIDEOUT.z) + 4);
    // Mission marker (pulsing green diamond).
    if (snap.missionTarget) {
      const pulse = 3 + Math.sin(performance.now() / 250) * 1.5;
      mapCtx.fillStyle = '#39f5c8';
      mapCtx.beginPath();
      mapCtx.moveTo(toX(snap.missionTarget.x), toY(snap.missionTarget.z) - pulse - 3);
      mapCtx.lineTo(toX(snap.missionTarget.x) + pulse + 3, toY(snap.missionTarget.z));
      mapCtx.lineTo(toX(snap.missionTarget.x), toY(snap.missionTarget.z) + pulse + 3);
      mapCtx.lineTo(toX(snap.missionTarget.x) - pulse - 3, toY(snap.missionTarget.z));
      mapCtx.closePath();
      mapCtx.fill();
    }
    // Traffic (yellow), police (red), player (white + heading tick).
    mapCtx.fillStyle = '#d8c26a';
    for (const c of snap.trafficCars) mapCtx.fillRect(toX(c.x) - 1.5, toY(c.z) - 1.5, 3, 3);
    mapCtx.fillStyle = '#ff3b30';
    for (const c of snap.policeCars) {
      mapCtx.beginPath(); mapCtx.arc(toX(c.x), toY(c.z), 3, 0, Math.PI * 2); mapCtx.fill();
    }
    for (const c of snap.policeFoot) {
      mapCtx.beginPath(); mapCtx.arc(toX(c.x), toY(c.z), 2, 0, Math.PI * 2); mapCtx.fill();
    }
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath(); mapCtx.arc(toX(snap.player.x), toY(snap.player.z), 3.5, 0, Math.PI * 2); mapCtx.fill();
    mapCtx.strokeStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(toX(snap.player.x), toY(snap.player.z));
    mapCtx.lineTo(toX(snap.player.x) - Math.sin(snap.player.heading) * 8, toY(snap.player.z) - Math.cos(snap.player.heading) * 8);
    mapCtx.stroke();
    // North arrow.
    mapCtx.fillStyle = '#ffffff';
    mapCtx.font = 'bold 11px sans-serif';
    mapCtx.fillText('N', S - 10, 14);
  }

  let bannerTimer = null;
  function showBanner(text, good) {
    const b = el('banner');
    b.textContent = text;
    b.className = good ? 'good' : 'bad';
    b.classList.remove('hidden');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.add('hidden'), 3200);
  }

  return {
    update(snap) {
      el('health-bar').style.width = `${Math.max(0, snap.health)}%`;
      el('health-text').textContent = String(Math.round(snap.health));
      el('money').textContent = String(snap.money);
      el('bandages').textContent = String(snap.bandages);
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += i < snap.wantedStars ? STAR_FULL : STAR_EMPTY;
      el('stars').textContent = stars;
      el('stars').style.color = snap.wantedStars > 0 ? '#ff5c5c' : '#888888';
      const hh = String(Math.floor(snap.clockHours) % 24).padStart(2, '0');
      const mm = String(Math.floor((snap.clockHours % 1) * 60)).padStart(2, '0');
      el('clock-line').textContent = `${hh}:${mm}`;
      el('speed-line').textContent = snap.inCar ? `${Math.round(snap.speed * 3.6)} km/h` : '';
      el('objective-line').textContent = snap.objective || '';
      if (snap.missionTimer > 0) {
        el('objective-line').textContent += `  —  ${Math.ceil(snap.missionTimer)}s`;
      }
      drawMinimap(snap);
    },
    showTitle(canContinue) {
      el('title-screen').classList.remove('hidden');
      el('btn-continue').style.display = canContinue ? '' : 'none';
    },
    hideTitle() { el('title-screen').classList.add('hidden'); },
    showPause() { el('pause-screen').classList.remove('hidden'); },
    hidePause() { el('pause-screen').classList.add('hidden'); },
    showBriefing(index) {
      el('briefing-text').textContent = `${MISSION_NAMES[index]} — ${MISSION_BRIEFINGS[index]}`;
      el('briefing').classList.remove('hidden');
    },
    hideBriefing() { el('briefing').classList.add('hidden'); },
    showShop(money) {
      el('shop-msg').textContent = `Your money: $${money}`;
      el('shop-screen').classList.remove('hidden');
    },
    hideShop() { el('shop-screen').classList.add('hidden'); },
    shopMessage(text) { el('shop-msg').textContent = text; },
    showTouchUI() { el('touch-ui').classList.remove('hidden'); },
    showBanner,
    missionPassed(reward, next) {
      showBanner(`Mission Passed  +$${reward}${next ? ` — next: ${next}` : ' — story complete!'}`, true);
    },
    missionFailed(reason) {
      showBanner(`Mission Failed — ${reason}`, false);
    },
    busted(fine) {
      showBanner(`BUSTED — fined $${fine}. Back to the garage.`, false);
    },
  };
}
