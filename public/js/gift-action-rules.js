/** Pure gift-name normalization and visual action selection. */
export function normalizeGiftName(event) {
  return String(event?.giftName || '').normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd');
}

export function resolveGiftAction(event) {
  const name = normalizeGiftName(event);
  if (/\\b(rocket|ten lua)\\b/.test(name)) return 'rocket';
  if (/\\b(dragon|rong)\\b/.test(name)) return 'dragon';
  if (/\\b(donut|doughnut)\\b/.test(name)) return 'donut';
  if (/\\b(rose|hoa hong)\\b/.test(name)) return 'rose';
  return null;
}

/**
 * Resolve the actual value represented by a TikTok event.
 * Live connector events already send coins as diamondCount multiplied by
 * incremental combo delta. Do not multiply aggregated coins by delta again.
 */
export function resolveGiftReactionProfile(event = {}) {
  const diamonds = Number(event.diamondCount);
  const delta = Number(event.giftComboDelta);
  const coins = Number(event.coins ?? event.totalCoins ?? event.totalDiamonds ?? event.giftValue);
  const unitValue = Number.isFinite(diamonds) && diamonds > 0 ? diamonds : null;
  const count = Number.isFinite(delta) && delta > 0
    ? Math.min(10000, Math.floor(delta))
    : 1;
  const total = Math.min(1000000, Math.max(1,
    unitValue !== null
      ? unitValue * count
      : Number.isFinite(coins) && coins > 0 ? coins : 1
  ));

  if (total >= 1000) {
    return { tier: 'special', totalDiamonds: total, durationMs: 4400, intensity: 1, bowAmount: 0.56 };
  }
  if (total >= 500) {
    return { tier: 'large', totalDiamonds: total, durationMs: 3600, intensity: 0.94, bowAmount: 0.42 };
  }
  if (total >= 100) {
    return { tier: 'medium', totalDiamonds: total, durationMs: 2800, intensity: 0.78, bowAmount: 0.28 };
  }
  return { tier: 'small', totalDiamonds: total, durationMs: 2100, intensity: 0.62, bowAmount: 0.16 };
}

/** Bounded per-tier art direction shared by the 2D and Three.js effect paths. */
export function resolveGiftVfxProfile(profile = {}) {
  const tiers = {
    small:   { scale: 0.86, durationScale: 0.94, particles: 10, shockwaves: 1, aura: 0.18 },
    medium:  { scale: 1.00, durationScale: 1.06, particles: 18, shockwaves: 2, aura: 0.36 },
    large:   { scale: 1.24, durationScale: 1.20, particles: 30, shockwaves: 3, aura: 0.68 },
    special: { scale: 1.52, durationScale: 1.36, particles: 44, shockwaves: 4, aura: 1.00 }
  };
  const tier = Object.prototype.hasOwnProperty.call(tiers, profile?.tier)
    ? profile.tier
    : 'small';
  return { tier, ...tiers[tier] };
}

export function resolveGiftEffectDurationMs(action, profile = {}) {
  const base = { rocket: 4050, dragon: 4200, donut: 3650, rose: 2600 }[action] || 3500;
  return Math.round(base * resolveGiftVfxProfile(profile).durationScale);
}
