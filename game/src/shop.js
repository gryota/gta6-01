// Neon Harbor — shop.js
// Gry Market: the night-market stall in Old Town. Pure logic (no DOM here) —
// the world hands in the player's money, health, wanted stars and whether a
// police unit is close, and gets back whether the purchase worked.
// The shop is NOT a safe zone: buying never stops a chase.

import {
  SHOP_BANDAGE_PRICE,
  SHOP_DRINK_PRICE,
  SHOP_BRIBE_PRICE,
  SHOP_BANDAGE_MAX,
  SHOP_BANDAGE_HEAL,
  SHOP_DRINK_HEAL,
  SHOP_BRIBE_MIN_STARS,
  SHOP_BRIBE_MAX_STARS,
  HEALTH_MAX,
} from './config.js';
import { bribeWanted } from './wanted.js';

export const SHOP_ITEMS = [
  { id: 'bandage', name: 'Bandage', price: SHOP_BANDAGE_PRICE, desc: 'Keep it. Press H to use: +50 health.' },
  { id: 'drink', name: 'Energy drink', price: SHOP_DRINK_PRICE, desc: '+25 health right now.' },
  { id: 'bribe', name: 'Bribe the cops', price: SHOP_BRIBE_PRICE, desc: '-1 wanted star (only at 1-2 stars, no police near).' },
];

export function canBuyBribe(wantedStars, policeNear) {
  return wantedStars >= SHOP_BRIBE_MIN_STARS
    && wantedStars <= SHOP_BRIBE_MAX_STARS
    && !policeNear;
}

// state: { money, health, bandages, wanted: {points, stars} }.
// Returns { ok, reason } and mutates state on success.
export function buyItem(state, itemId, policeNear) {
  if (itemId === 'bandage') {
    if (state.bandages >= SHOP_BANDAGE_MAX) return { ok: false, reason: 'Bandage pouch is full.' };
    if (state.money < SHOP_BANDAGE_PRICE) return { ok: false, reason: 'Uang tidak cukup' };
    state.money -= SHOP_BANDAGE_PRICE;
    state.bandages += 1;
    return { ok: true, reason: '' };
  }
  if (itemId === 'drink') {
    if (state.money < SHOP_DRINK_PRICE) return { ok: false, reason: 'Uang tidak cukup' };
    state.money -= SHOP_DRINK_PRICE;
    state.health = Math.min(HEALTH_MAX, state.health + SHOP_DRINK_HEAL);
    return { ok: true, reason: '' };
  }
  if (itemId === 'bribe') {
    if (!canBuyBribe(state.wanted.stars, policeNear)) {
      return { ok: false, reason: 'Bribe needs 1-2 stars and no police nearby.' };
    }
    if (state.money < SHOP_BRIBE_PRICE) return { ok: false, reason: 'Uang tidak cukup' };
    state.money -= SHOP_BRIBE_PRICE;
    bribeWanted(state.wanted);
    return { ok: true, reason: '' };
  }
  return { ok: false, reason: 'No such item.' };
}

// Press H: spend one bandage for +50 health (max 100). The only heal while wanted.
export function useBandage(state) {
  if (state.bandages <= 0) return { ok: false, reason: 'No bandages left.' };
  if (state.health >= HEALTH_MAX) return { ok: false, reason: 'Health is already full.' };
  state.bandages -= 1;
  state.health = Math.min(HEALTH_MAX, state.health + SHOP_BANDAGE_HEAL);
  return { ok: true, reason: '' };
}
