/**
 * Choose a stable internal render resolution for the portrait Three.js scene.
 * Low-memory / low-core devices trade a little sharpness for a meaningful
 * reduction in fragment work; stronger devices retain a crisp 1.25x buffer.
 */
export function getTemplePixelRatio({
  devicePixelRatio = 1,
  deviceMemory,
  hardwareConcurrency
} = {}) {
  const cores = Number.isFinite(hardwareConcurrency) ? hardwareConcurrency : 4;
  // Safari and some embedded browsers omit deviceMemory; infer conservatively
  // from the reported core count instead of penalizing capable desktops.
  const memory = Number.isFinite(deviceMemory) ? deviceMemory : (cores >= 8 ? 8 : 4);
  const cap = memory <= 4 || cores <= 4 ? 1 : 1.25;
  const requested = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1;
  return Math.min(Math.max(requested, 1), cap);
}
