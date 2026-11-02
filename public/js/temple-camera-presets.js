// Five deliberately distinct views for one continuous 9:16 Three.js camera.
// Altar close-ups sit farther back and use a wider FOV than the previous framing.
export const TEMPLE_CAMERA_RITUAL_PRESETS = Object.freeze([
  Object.freeze({ name: 'left-three-quarter', position: Object.freeze([-3.0, 11.15, 27.2]), targetOffsetX: -1.12, targetOffsetY: 1.22, targetOffsetZ: 0, processionFov: 39, closePositionOffset: Object.freeze([-1.6, 6.6, 10.3]), closeLookAtOffset: Object.freeze([-0.3, 1.55, -0.6]), closeFov: 38.5 }),
  Object.freeze({ name: 'right-three-quarter', position: Object.freeze([3.0, 11.15, 27.2]), targetOffsetX: 1.12, targetOffsetY: 1.22, targetOffsetZ: 0, processionFov: 39, closePositionOffset: Object.freeze([1.6, 6.6, 10.3]), closeLookAtOffset: Object.freeze([0.3, 1.55, -0.6]), closeFov: 40 }),
  Object.freeze({ name: 'center-elevated', position: Object.freeze([0.15, 13.05, 30.2]), targetOffsetX: 0.05, targetOffsetY: 1.82, targetOffsetZ: 0.35, processionFov: 40.5, closePositionOffset: Object.freeze([0.15, 7.5, 11.0]), closeLookAtOffset: Object.freeze([0.05, 1.6, -0.55]), closeFov: 40 }),
  Object.freeze({ name: 'left-side', position: Object.freeze([-4.2, 10.45, 25.35]), targetOffsetX: -1.62, targetOffsetY: 1.1, targetOffsetZ: -0.15, processionFov: 38.5, closePositionOffset: Object.freeze([-2.1, 6.4, 10.2]), closeLookAtOffset: Object.freeze([-0.45, 1.5, -0.5]), closeFov: 38.5 }),
  Object.freeze({ name: 'right-side', position: Object.freeze([4.2, 10.45, 25.35]), targetOffsetX: 1.62, targetOffsetY: 1.1, targetOffsetZ: -0.15, processionFov: 38.5, closePositionOffset: Object.freeze([2.1, 6.4, 10.2]), closeLookAtOffset: Object.freeze([0.45, 1.5, -0.5]), closeFov: 39 })
]);

export function getTempleRitualShotIndex(startIndex, elapsedMs, durationMs, shotCount = TEMPLE_CAMERA_RITUAL_PRESETS.length) {
  const count = Math.max(1, Math.trunc(Number(shotCount)) || 1);
  const rawStart = Math.trunc(Number(startIndex)) || 0;
  const start = ((rawStart % count) + count) % count;
  const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : count;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const progress = Math.min(0.999999, elapsed / duration);
  const step = Math.min(count - 1, Math.floor(progress * count));
  return (start + step) % count;
}

export function getTempleRitualCloseShot(preset, person) {
  if (!preset || !person) throw new TypeError('A camera preset and person position are required');
  const [offsetX, height, offsetZ] = preset.closePositionOffset;
  const [lookX, lookY, lookZ] = preset.closeLookAtOffset;
  return {
    position: [Number(person.x) + offsetX, height, Number(person.z) + offsetZ],
    lookAt: [Number(person.x) + lookX, lookY, Number(person.z) + lookZ],
    fov: preset.closeFov
  };
}