import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { TEMPLE_CAMERA_RITUAL_PRESETS, getTempleRitualCloseShot, getTempleRitualShotIndex } from '../public/js/temple-camera-presets.js';

const source = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');

describe('Three.js five-shot ritual camera director', () => {
  it('defines five distinct shot identities and advances through all five in one ritual', () => {
    expect(TEMPLE_CAMERA_RITUAL_PRESETS.map((preset) => preset.name)).toEqual([
      'left-three-quarter', 'right-three-quarter', 'center-elevated', 'left-side', 'right-side'
    ]);
    const sequence = Array.from({ length: 5 }, (_, shot) =>
      getTempleRitualShotIndex(3, (shot + 0.5) * 1900, 9500, 5)
    );
    expect(sequence).toEqual([3, 4, 0, 1, 2]);
    expect(new Set(sequence).size).toBe(5);
  });

  it('frames the altar a little farther back with a wider close-up', () => {
    for (const preset of TEMPLE_CAMERA_RITUAL_PRESETS) {
      const shot = getTempleRitualCloseShot(preset, { x: 0, z: -3.55 });
      expect(shot.position[2]).toBeGreaterThanOrEqual(7.85);
      expect(shot.fov).toBeGreaterThan(38);
      expect(shot.lookAt[1]).toBeGreaterThan(1.4);
    }
    expect(getTempleRitualCloseShot(TEMPLE_CAMERA_RITUAL_PRESETS[0], { x: 0, z: -3.55 }).position[2]).toBeCloseTo(8.05);
    expect(source).toContain('getTempleRitualCloseShot(activeCameraPreset, person)');
  });

  it('keeps a single camera and eases position, look target and focal length', () => {
    expect(source).toContain('const camera = new THREE.PerspectiveCamera(42, 1080 / 1920, 0.1, 140);');
    expect(source).toContain('const cameraShotBlendMs = 720;');
    expect(source).toContain('camera.position.lerp(cameraTargetPosition, blend);');
    expect(source).toContain('lookTarget.lerp(cameraTargetLookAt, blend);');
    expect(source).toContain('camera.fov += (cameraTargetFov - camera.fov) * blend;');
    expect(source).toContain('camera.lookAt(lookTarget);');
    expect(source).toContain('camera.userData.shotSequenceIndex = cameraRitualActive ? activeCameraPresetIndex : -1;');
    expect(source).toContain('updateRitualCamera(dt, now);');
  });

  it('returns smoothly to the master temple shot when the queue drains', () => {
    const start = source.indexOf('function restoreMainCamera()');
    const end = source.indexOf('function updateRitualCamera(dt, now', start);
    const restore = source.slice(start, end);
    expect(restore).toContain('cameraRitualActive = false;');
    expect(restore).toContain('cameraTargetPosition.copy(cameraHomePosition);');
    expect(restore).toContain('cameraTargetLookAt.copy(cameraHomeTarget);');
    expect(restore).toContain('cameraTargetFov = cameraHomeFov;');
  });
});