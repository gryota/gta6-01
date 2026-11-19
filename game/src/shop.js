// Neon Harbor — shop.js
// Gry Market: the night-market stall in Old Town. Pure purchase rules — the
// DOM menu lives in hud.js; this file decides what a purchase does and
// whether it is allowed. State shape: { money, bandages, health, wantedStars,
// nearestPoliceDist }.

import { CONFIG } from './config.js';

export const SHOP_ITEMS = [
  {
    id: 'bandage',
    name: 'Bandage',
    price: CONFIG.shopBandagePrice,
    desc: 'Carry it (max 3). Press H to use: +50 health, even while wanted.',
  },
  {
    id: 'energy',
    name: 'Energy Drink',
    price: CONFIG.shopEnergyPrice,
    desc: 'Drink it now: +25 health right away.',
  },
  {
    id: 'bribe',
    name: 'Bribe the Cops',
    price: CONFIG.shopBribePrice,
    desc: 'Lose 1 wanted star. Only at 1–2 stars, with no police within 30 m.',
  },
];

export function shopError(itemId, state) {
  if (itemId === 'bandage' && state.bandages >= CONFIG.shopBandageMax) return 'Bandage pouch is full (max 3).';
  if (itemId === 'bribe') {
    if (state.wantedStars < CONFIG.shopBribeMinStars || state.wantedStars > CONFIG.shopBribeMaxStars) {
      return 'Bribes only work at 1–2 stars.';
    }
    if (state.nearestPoliceDist !== null && state.nearestPoliceDist < CONFIG.shopBribeMinPoliceDist) {
      return 'Too hot — police are too close to bribe.';
    }
  }
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return 'No such item.';
  if (state.money < item.price) return 'Uang tidak cukup';
  return null;
}

/** Apply a purchase. Returns { ok, message }. Never mutates on failure. */
export function buyItem(itemId, state) {
  const error = shopError(itemId, state);
  if (error) return { ok: false, message: error };
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  state.money -= item.price;
  if (itemId === 'bandage') {
    state.bandages += 1;
    return { ok: true, message: `Bandage bought. Carrying ${state.bandages}. Press H to use it.` };
  }
  if (itemId === 'energy') {
    state.health = Math.min(100, state.health + CONFIG.shopEnergyHeal);
    return { ok: true, message: `+${CONFIG.shopEnergyHeal} health. Feeling wired.` };
  }
  // bribe: the caller lowers the wanted level by one star afterwards.
  return { ok: true, message: 'Bribe paid. One star off the heat.', bribe: true };
}

/** Use one bandage: +50 health, capped at 100. Returns true when used. */
export function useBandage(state) {
  if (state.bandages <= 0) return false;
  if (state.health >= 100) return false;
  state.bandages -= 1;
  state.health = Math.min(100, state.health + CONFIG.shopBandageHeal);
  return true;
}
