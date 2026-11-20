// Neon Harbor — Gry Market shop. Pure purchase logic, no DOM.
import { SHOP } from './config.js';

export function createShopState() {
  return { open: false, bandages: 0, message: '' };
}

// Buy a bandage: $40, inventory cap 3.
export function buyBandage(state, money) {
  if (money < SHOP.BANDAGE_PRICE) {
    state.message = 'Uang tidak cukup';
    return { money, bought: false };
  }
  if (state.bandages >= SHOP.BANDAGE_MAX) {
    state.message = 'Perban sudah penuh (maks 3)';
    return { money, bought: false };
  }
  state.bandages += 1;
  state.message = 'Perban dibeli';
  return { money: money - SHOP.BANDAGE_PRICE, bought: true };
}

// Buy an energy drink: $25, +25 health immediately.
export function buyDrink(state, money, health) {
  if (money < SHOP.DRINK_PRICE) {
    state.message = 'Uang tidak cukup';
    return { money, health, bought: false };
  }
  state.message = 'Minuman energi diminum (+25)';
  return { money: money - SHOP.DRINK_PRICE, health: Math.min(100, health + SHOP.DRINK_HEAL), bought: true };
}

// Bribe: $200, -1 star, only at 1-2 stars and no police within 30 m.
export function buyBribe(state, money, stars, nearestPoliceDist) {
  if (money < SHOP.BRIBE_PRICE) {
    state.message = 'Uang tidak cukup';
    return { money, ok: false };
  }
  if (stars < SHOP.BRIBE_MIN_STARS || stars > SHOP.BRIBE_MAX_STARS) {
    state.message = 'Suap hanya saat wanted 1-2 bintang';
    return { money, ok: false };
  }
  if (nearestPoliceDist !== null && nearestPoliceDist < SHOP.BRIBE_CLEAR_RADIUS) {
    state.message = 'Terlalu dekat dengan polisi';
    return { money, ok: false };
  }
  state.message = 'Polisi disuap (-1 bintang)';
  return { money: money - SHOP.BRIBE_PRICE, ok: true };
}

// Use a bandage (H key): +50 health, max 100.
export function useBandage(state, health) {
  if (state.bandages <= 0) return { health, used: false };
  state.bandages -= 1;
  return { health: Math.min(100, health + SHOP.BANDAGE_HEAL), used: true };
}
