// Distinct portrait-friendly views for the temple camera tour.
// The camera deliberately alternates between the Buddha, the resident abbot,
// the Buddha's outward point of view, and several full-hall compositions.
export const TEMPLE_CAMERA_RITUAL_PRESETS = Object.freeze([
  Object.freeze({
    name: 'buddha-front-three-quarter',
    position: Object.freeze([3.8, 8.0, 1.7]),
    targetOffsetX: 0,
    targetOffsetY: 5.0,
    targetOffsetZ: -4.7,
    processionFov: 44
  }),
  Object.freeze({
    name: 'buddha-left-profile',
    position: Object.freeze([-7.6, 7.0, -1.2]),
    targetOffsetX: 0,
    targetOffsetY: 4.9,
    targetOffsetZ: -4.7,
    processionFov: 48
  }),
  Object.freeze({
    name: 'buddha-view-across-hall',
    position: Object.freeze([0.2, 6.05, -6.5]),
    targetOffsetX: 0,
    targetOffsetY: 2.4,
    targetOffsetZ: 12.55,
    processionFov: 57
  }),
  Object.freeze({
    name: 'resident-abbot-prayer',
    position: Object.freeze([0.95, 3.55, -0.4]),
    targetOffsetX: 2.85,
    targetOffsetY: 1.45,
    targetOffsetZ: -0.1,
    processionFov: 49
  }),
  Object.freeze({
    name: 'full-hall-center',
    position: Object.freeze([0, 14, 38]),
    targetOffsetX: 0,
    targetOffsetY: 2,
    targetOffsetZ: -0.45,
    processionFov: 54
  }),
  Object.freeze({
    name: 'left-aisle-panorama',
    position: Object.freeze([-13, 8, 8]),
    targetOffsetX: 0,
    targetOffsetY: 2,
    targetOffsetZ: -1.45,
    processionFov: 58
  }),
  Object.freeze({
    name: 'right-aisle-panorama',
    position: Object.freeze([12, 9, 14]),
    targetOffsetX: 0,
    targetOffsetY: 2.2,
    targetOffsetZ: -1.45,
    processionFov: 58
  }),
  Object.freeze({
    name: 'elevated-temple-overview',
    position: Object.freeze([0, 18, 16]),
    targetOffsetX: 0,
    targetOffsetY: 1.8,
    targetOffsetZ: -0.45,
    processionFov: 60
  })
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

// Kept as a backwards-compatible helper for older callers. The live camera
// tour now uses scene-level compositions rather than repeated worshipper close-ups.
export function getTempleRitualCloseShot(preset, person) {
  if (!preset || !person) throw new TypeError('A camera preset and person position are required');
  if (preset.closePositionOffset && preset.closeLookAtOffset) {
    const [offsetX, height, offsetZ] = preset.closePositionOffset;
    const [lookX, lookY, lookZ] = preset.closeLookAtOffset;
    return {
      position: [Number(person.x) + offsetX, height, Number(person.z) + offsetZ],
      lookAt: [Number(person.x) + lookX, lookY, Number(person.z) + lookZ],
      fov: preset.closeFov
    };
  }
  return {
    position: [...preset.position],
    lookAt: [preset.targetOffsetX, preset.targetOffsetY, preset.targetOffsetZ],
    fov: preset.processionFov ?? 42
  };
}
