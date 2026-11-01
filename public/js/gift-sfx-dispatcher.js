const GIFT_SFX_METHODS = Object.freeze({
  'rocket-launch': 'playRocketLaunch',
  explosion: 'playExplosion',
  'dragon-whoosh': 'playDragonWhoosh',
  'dragon-roar': 'playDragonRoar',
  'donut-chime': 'playDonutChime',
  'rose-chime': 'playRoseChime'
});

/**
 * Dispatch a whitelisted gift sound to the audio engine.
 * Unknown names and unavailable methods are ignored safely.
 */
export function dispatchGiftSfx(audio, type) {
  const method = GIFT_SFX_METHODS[type];
  if (!method || !audio || typeof audio[method] !== 'function') return false;
  if (type === 'explosion') audio[method](1);
  else audio[method]();
  return true;
}
