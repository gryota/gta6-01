// Gry Market — Rook's supply stall in the Old Town night market.
//
// One file, one job: the shop menu, buying, the bandage inventory, and using a
// bandage. The shop is NOT a safe zone: the world keeps stepping (traffic,
// police, wanted decay) while the menu is open, so the law can still catch
// Rook mid-purchase. All prices and rules come from the gta6-01 brief.
//
// The world itself (world.js) is frozen, so this module works on the world's
// public state only — player money/health, stars/wanted, police positions —
// and talks back through state.messages / state.sounds, which main.js drains.

export const SHOP_ITEMS = [
  {
    id: 'bandage',
    name: 'Bandage',
    desc: '+50 health. Stored in inventory (max 3). Use any time with H — the only way to heal while wanted > 0.',
    price: 40,
  },
  {
    id: 'energy',
    name: 'Energy Drink',
    desc: 'Instant +25 health when bought. Not stored.',
    price: 25,
  },
  {
    id: 'bribe',
    name: 'Police Bribe',
    desc: 'Wanted -1 star. Only when wanted is 1–2 and no police within 30 m.',
    price: 200,
  },
];

export const MAX_BANDAGES = 3;
export const BANDAGE_HEAL = 50;
export const ENERGY_HEAL = 25;
export const BRIBE_PRICE = 200;
export const BRIBE_MAX_RADIUS = 30;
export const STALL_RADIUS = 4.5;

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

/** Is (x, z) clear of every building collider, with `margin` to spare? */
function pointClear(x, z, colliders, margin) {
  for (const c of colliders) {
    if (x > c.minX - margin && x < c.maxX + margin && z > c.minZ - margin && z < c.maxZ + margin) {
      return false;
    }
  }
  return true;
}

/**
 * Pick the stall's spot: on the Old Town sidewalk just south of the -160 road,
 * at a block centre, clear of buildings so Rook can always walk up to it.
 * The city layout is seeded, so this is computed from the real colliders.
 */
export function findStallSpot(layout) {
  const colliders = layout.colliders || [];
  const candidates = [];
  for (const bx of [-120, -40, 40, 120]) {
    for (const dz of [-168, -171, -174]) candidates.push({ x: bx, z: dz });
    for (const dx of [-14, 14]) candidates.push({ x: bx + dx, z: -168 });
  }
  for (const spot of candidates) {
    if (pointClear(spot.x, spot.z, colliders, 2.5)) return spot;
  }
  return { x: -40, z: -168 };
}

export function createShop(world, layout) {
  const stall = findStallSpot(layout);
  const shop = {
    stall,
    open: false,
    bandages: 0,
    hintShown: false,
  };

  // ---- DOM: one overlay panel, built once, shown/hidden. ----
  const overlay = document.createElement('div');
  overlay.id = 'shop-overlay';
  overlay.className = 'hidden';
  overlay.innerHTML = `
    <div class="shop-panel">
      <h2>GRY MARKET</h2>
      <p class="shop-sub">Old Town Night Market — bandages, energy drinks, and… shortcuts.</p>
      <p class="shop-cash">Money: <b id="shop-money">$0</b> &nbsp;·&nbsp; Bandages: <b id="shop-bandages">×0</b></p>
      <div id="shop-items"></div>
      <p class="shop-note">E / Esc — close &nbsp;·&nbsp; H — use bandage &nbsp;·&nbsp; Not a safe zone: police can still attack while you shop.</p>
      <button id="shop-close" type="button">Close (E)</button>
    </div>`;
  document.body.appendChild(overlay);
  const itemsEl = overlay.querySelector('#shop-items');
  const moneyEl = overlay.querySelector('#shop-money');
  const bandagesEl = overlay.querySelector('#shop-bandages');
  for (const item of SHOP_ITEMS) {
    const row = document.createElement('div');
    row.className = 'shop-item';
    row.innerHTML = `
      <div class="shop-item-info">
        <b>${item.name} — $${item.price}</b>
        <span>${item.desc}</span>
      </div>
      <button type="button" data-item="${item.id}">Buy</button>`;
    row.querySelector('button').addEventListener('click', () => { shop.buy(item.id); });
    itemsEl.appendChild(row);
  }
  overlay.querySelector('#shop-close').addEventListener('click', () => { shop.close(); });

  function refreshPanel() {
    moneyEl.textContent = `$${Math.round(world.state.player.money)}`;
    bandagesEl.textContent = `×${shop.bandages}`;
  }

  function msg(text) { world.state.messages.push(text); }
  function sound(name) { world.state.sounds.push(name); }

  function policeWithin(radius) {
    const p = world.state.player;
    const r2 = radius * radius;
    for (const car of world.state.cars) {
      if (car.kind === 'police' && dist2(car.x, car.z, p.x, p.z) < r2) return true;
    }
    for (const ped of world.state.peds) {
      if (ped.kind === 'cop' && ped.down <= 0 && dist2(ped.x, ped.z, p.x, p.z) < r2) return true;
    }
    return false;
  }

  shop.nearStall = function nearStall() {
    const p = world.state.player;
    return p.onFoot && dist2(p.x, p.z, stall.x, stall.z) < STALL_RADIUS * STALL_RADIUS;
  };

  shop.openShop = function openShop() {
    shop.open = true;
    refreshPanel();
    overlay.classList.remove('hidden');
  };
  shop.close = function close() {
    shop.open = false;
    overlay.classList.add('hidden');
  };

  shop.load = function load(savedBandages) {
    shop.bandages = Number.isInteger(savedBandages) && savedBandages >= 0
      ? Math.min(MAX_BANDAGES, savedBandages) : 0;
  };

  /** Called once per frame by main.js while playing: the "press E" hint. */
  shop.update = function update() {
    if (!shop.open && shop.nearStall()) {
      if (!shop.hintShown) {
        shop.hintShown = true;
        msg('Gry Market — press E to shop.');
      }
    } else if (!shop.nearStall()) {
      shop.hintShown = false;
    }
  };

  shop.buy = function buy(id) {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (!item) return false;
    const p = world.state.player;

    if (!Number.isFinite(p.money) || p.money < 0) {
      msg('Not enough money.');
      return false;
    }
    if (id === 'bandage' && shop.bandages >= MAX_BANDAGES) {
      msg('Bandage inventory full (max 3).');
      return false;
    }
    if (id === 'energy' && p.health >= 100) {
      msg("Health is full — don't waste money.");
      return false;
    }
    if (id === 'bribe') {
      if (world.state.stars < 1 || world.state.stars > 2) {
        msg('Bribes only work at wanted level 1–2.');
        return false;
      }
      if (policeWithin(BRIBE_MAX_RADIUS)) {
        msg("Too close to the police — can't bribe.");
        return false;
      }
    }
    if (p.money < item.price) {
      msg('Not enough money.');
      return false;
    }

    p.money -= item.price;
    if (id === 'bandage') {
      shop.bandages += 1;
      msg(`Bandage bought — $${item.price}. Bandages: ×${shop.bandages}. Press H to use.`);
    } else if (id === 'energy') {
      p.health = Math.min(100, p.health + ENERGY_HEAL);
      msg(`Energy Drink — $${item.price}. +${ENERGY_HEAL} health.`);
    } else if (id === 'bribe') {
      world.state.wanted = Math.max(0, world.state.wanted - 100);
      msg('Police bribed. Wanted -1 star.');
    }
    sound('pickup');
    refreshPanel();
    return true;
  };

  /** H: use one bandage, any time — the only heal while wanted > 0. */
  shop.useBandage = function useBandage() {
    const p = world.state.player;
    if (shop.bandages <= 0) {
      msg('No bandages. Buy at Gry Market (E).');
      return false;
    }
    if (p.health >= 100) {
      msg('Health is full.');
      return false;
    }
    shop.bandages -= 1;
    p.health = Math.min(100, p.health + BANDAGE_HEAL);
    msg(`Bandage used. +${BANDAGE_HEAL} health. Left: ×${shop.bandages}.`);
    sound('pickup');
    refreshPanel();
    return true;
  };

  return shop;
}
