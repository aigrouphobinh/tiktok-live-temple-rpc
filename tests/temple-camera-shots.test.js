import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { TEMPLE_CAMERA_RITUAL_PRESETS, getTempleCameraShotFrame } from '../public/js/temple-camera-presets.js';

const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
const cssCamera = readFileSync(new URL('../public/js/camera-controller.js', import.meta.url), 'utf8');

describe('3D temple shot action sequence', () => {
  it('uses eight separate named actions instead of a shared close-up sequence', () => {
    expect(TEMPLE_CAMERA_RITUAL_PRESETS).toHaveLength(8);
    expect(new Set(TEMPLE_CAMERA_RITUAL_PRESETS.map((shot) => shot.action)).size).toBe(8);
    expect(TEMPLE_CAMERA_RITUAL_PRESETS.map((shot) => shot.action)).toEqual([
      'buddha-orbit',
      'buddha-pov-pan',
      'abbot-bow-portrait',
      'devotee-tracking',
      'hall-crane-reveal',
      'left-aisle-dolly',
      'right-aisle-dolly',
      'hall-overview-orbit'
    ]);
    expect(scene).toContain('const cameraShotDefinitions = TEMPLE_CAMERA_RITUAL_PRESETS;');
    expect(scene).toContain('function beginCameraShot(index, now = performance.now(), mode = \'ambient\')');
    expect(scene).toContain('cameraActionEndsAt = now + activeCameraPreset.durationMs;');
  });

  it('runs the Buddha POV pan and the abbot portrait as different camera actions', () => {
    const pov = TEMPLE_CAMERA_RITUAL_PRESETS.find((shot) => shot.action === 'buddha-pov-pan');
    const abbot = TEMPLE_CAMERA_RITUAL_PRESETS.find((shot) => shot.action === 'abbot-bow-portrait');
    const povFrame = getTempleCameraShotFrame(pov, pov.durationMs / 4);
    const abbotFrame = getTempleCameraShotFrame(abbot, abbot.durationMs);
    expect(povFrame.position).toEqual(pov.actionParams.camera);
    expect(povFrame.lookAt[0]).toBeGreaterThan(0);
    expect(abbotFrame.lookAt).toEqual(abbot.actionParams.target);
    expect(abbotFrame.position).toEqual(abbot.actionParams.endPosition);
  });

  it('executes each shot only for its own duration before handing the camera to the next action', () => {
    expect(scene).toContain('else if (now >= cameraActionEndsAt)');
    expect(scene).toContain('beginCameraShot(getNextCameraPresetIndex(), now, \'ritual\');');
    expect(scene).toContain('beginCameraShot(getNextCameraPresetIndex(), now, \'ambient\');');
    expect(scene).toContain('camera.userData.shotAction = activeCameraAction;');
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
});
