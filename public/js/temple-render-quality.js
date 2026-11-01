/**
 * Select a render-resolution budget for the portrait Three.js scene.
 *
 * The quality tier only controls pixel ratio; it deliberately does not alter
 * scene content, shadows, materials, lighting, animation or gift effects.
 * Pixel cost (and render-target memory) grows approximately with ratio squared.
 */
export function getTempleRenderQuality({
  deviceMemory,
  hardwareConcurrency
} = {}) {
  const memory = Number.isFinite(deviceMemory) && deviceMemory > 0
    ? deviceMemory
    : null;
  const cores = Number.isFinite(hardwareConcurrency) && hardwareConcurrency > 0
    ? hardwareConcurrency
    : null;

  // A single explicit low-end signal is enough to protect constrained devices.
  if ((memory !== null && memory <= 2) || (cores !== null && cores <= 2)) {
    return { tier: 'low', maxPixelRatio: 1 };
  }

  // Missing browser hints are neutral. With no usable hints, use balanced.
  if ((memory !== null && memory <= 4) || (cores !== null && cores <= 4)
    || (memory === null && cores === null)) {
    return { tier: 'medium', maxPixelRatio: 1.15 };
  }

  // Strong devices keep the existing crisp desktop ceiling of 1.25.
  return { tier: 'high', maxPixelRatio: 1.25 };
}

/**
 * Preserve the existing public API used by temple-3d.js.
 * Invalid/missing DPR falls back to 1, and the output never upscales below 1.
 */
export function getTemplePixelRatio({
  devicePixelRatio = 1,
  deviceMemory,
  hardwareConcurrency
} = {}) {
  const quality = getTempleRenderQuality({ deviceMemory, hardwareConcurrency });
  const requested = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1;

  return Math.min(Math.max(requested, 1), quality.maxPixelRatio);
}
