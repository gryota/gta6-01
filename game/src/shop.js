// Gry Market — pure shop rules. No browser APIs.
import { SHOP } from './config.js';

export const SHOP_ITEMS = [
  { id: 'bandage', name: 'Perban', price: SHOP.BANDAGE_PRICE, desc: '+50 HP, pakai dengan H (maks 3)' },
  { id: 'drink', name: 'Minuman Energi', price: SHOP.DRINK_PRICE, desc: 'Langsung +25 HP' },
  { id: 'bribe', name: 'Suap Polisi', price: SHOP.BRIBE_PRICE, desc: 'Wanted -1 bintang (wanted 1-2, tanpa polisi < 30 m)' },
];

export function canBuyBandage(money, bandages) {
  return money >= SHOP.BANDAGE_PRICE && bandages < SHOP.BANDAGE_MAX;
}

export function canBuyDrink(money) {
  return money >= SHOP.DRINK_PRICE;
}

// Bribe only at wanted 1-2 and with no police within 30 m.
export function canBuyBribe(money, stars, nearestPoliceDist) {
  return (
    money >= SHOP.BRIBE_PRICE &&
    stars >= 1 &&
    stars <= 2 &&
    (nearestPoliceDist === null || nearestPoliceDist > SHOP.BRIBE_MIN_DIST)
  );
}

export function buyBandage(money, bandages) {
  if (!canBuyBandage(money, bandages)) return null;
  return { money: money - SHOP.BANDAGE_PRICE, bandages: bandages + 1 };
}

export function buyDrink(money, health) {
  if (!canBuyDrink(money)) return null;
  return { money: money - SHOP.DRINK_PRICE, health: Math.min(100, health + SHOP.DRINK_HEAL) };
}

export function buyBribe(money, stars, nearestPoliceDist) {
  if (!canBuyBribe(money, stars, nearestPoliceDist)) return null;
  return { money: money - SHOP.BRIBE_PRICE };
}

// Use one bandage: +50 HP (capped at 100). Returns null when none left.
export function useBandage(bandages, health) {
  if (bandages <= 0) return null;
  return { bandages: bandages - 1, health: Math.min(100, health + SHOP.BANDAGE_HEAL) };
}
