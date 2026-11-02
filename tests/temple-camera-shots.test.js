import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { TEMPLE_CAMERA_RITUAL_PRESETS, getTempleRitualShotIndex } from '../public/js/temple-camera-presets.js';

const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
const cssCamera = readFileSync(new URL('../public/js/camera-controller.js', import.meta.url), 'utf8');

describe('3D temple camera shot sequence', () => {
  it('cycles through all five presets during the 9.5-second altar ritual', () => {
    expect(TEMPLE_CAMERA_RITUAL_PRESETS).toHaveLength(5);
    for (let start = 0; start < 5; start++) {
      const sequence = Array.from({ length: 5 }, (_, i) =>
        getTempleRitualShotIndex(start, i * 1900 + 950, 9500, 5)
      );
      expect(new Set(sequence).size).toBe(5);
      expect(sequence[0]).toBe(start);
    }
    expect(scene).toContain('cameraSequenceStartIndex = nextIndex;');
    expect(scene).toContain('getTempleRitualShotIndex(');
    expect(scene).toContain('activeCameraPreset = cameraRitualPresets[activeCameraPresetIndex];');
  });

  it('uses distinct camera position, look target and FOV for each close angle', () => {
    const signatures = TEMPLE_CAMERA_RITUAL_PRESETS.map((preset) =>
      [preset.closePositionOffset.join(','), preset.closeLookAtOffset.join(','), preset.closeFov].join('|')
    );
    expect(new Set(signatures).size).toBe(5);
    expect(TEMPLE_CAMERA_RITUAL_PRESETS.map((preset) => preset.closeFov)).toEqual([38.5, 38.5, 40, 38.5, 38.5]);
    expect(scene).toContain("activeCameraShot = 'altar-close';");
  });

  it('eases camera movement without cuts or a second camera', () => {
    expect(scene).toContain('camera.position.lerp(cameraTargetPosition, blend);');
    expect(scene).toContain('lookTarget.lerp(cameraTargetLookAt, blend);');
    expect(scene).toContain('camera.fov += (cameraTargetFov - camera.fov) * blend;');
    expect(scene).toContain('camera.lookAt(lookTarget);');
    expect(scene).toContain('const cameraShotBlendMs = 720;');
  });

  it('keeps the old CSS transform director disabled in 3D mode', () => {
    const guard = cssCamera.indexOf("if (new URLSearchParams(location.search).get('3d') === '1')");
    expect(guard).toBeGreaterThan(-1);
    const legacyDirector = cssCamera.indexOf('const presets = [', guard);
    const threeDGuard = cssCamera.slice(guard, legacyDirector);
    expect(legacyDirector).toBeGreaterThan(guard);
    expect(threeDGuard).toContain("rig.style.transform = 'none';");
    expect(threeDGuard).toContain('} else {');
    expect(threeDGuard).not.toContain('return;');
  });

  it('returns to the fixed elevated master view after the active queue drains', () => {
    const start = scene.indexOf('function restoreMainCamera()');
    const end = scene.indexOf('function updateRitualCamera(dt, now', start);
    const restore = scene.slice(start, end);
    expect(restore).toContain("activeCameraShot = 'home';");
    expect(restore).toContain('cameraTargetPosition.copy(cameraHomePosition);');
    expect(restore).toContain('cameraTargetLookAt.copy(cameraHomeTarget);');
    expect(restore).toContain('cameraTargetFov = cameraHomeFov;');
  });
});