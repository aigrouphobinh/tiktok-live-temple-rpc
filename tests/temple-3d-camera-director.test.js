import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');

describe('Three.js visitor camera director', () => {
  it('moves from the fixed hall master to a real visitor shot', () => {
    expect(source).toContain('const cameraHomeFov = 42;');
    expect(source).toContain('const cameraRitualFov = 38.5;');
    expect(source).toContain('cameraTargetFov = cameraRitualFov;');
    expect(source).toContain('cameraTargetFov = cameraHomeFov;');
    expect(source).toContain('const cameraShotBlendMs = 720;');
    expect(source).toContain('const blend = 1 - Math.exp(-Math.min(50, dt) / cameraShotBlendMs);');
    expect(source).toContain('camera.fov += (cameraTargetFov - camera.fov) * blend;');
    expect(source).toContain('camera.updateProjectionMatrix();');
  });

  it('aims at the active visitor instead of a point below the floor', () => {
    expect(source).toContain('cameraRitualActive && devoteeState?.active && mainDevotee?.visible');
    expect(source).toContain('const person = mainDevotee.position;');
    expect(source).toContain('cameraTargetLookAt.set(\n          cameraFollowX + activeCameraPreset.targetOffsetX,\n          1.25,\n          person.z\n        );');
    expect(source).toContain('cameraTargetLookAt.set(person.x + side * 0.08, 1.22, person.z - 0.42);');
    expect(source).toContain('1.25,');
    expect(source).toContain('person.z');
  });

  it('chooses one restrained 3/4 angle per queue session, not per gift or visitor', () => {
    const start = source.indexOf('function beginRitualCamera()');
    const end = source.indexOf('function restoreMainCamera()', start);
    const begin = source.slice(start, end);
    expect(begin).toContain('if (cameraRitualActive) return;');
    expect(begin).toContain('cameraRitualPresets[Math.floor(Math.random() * cameraRitualPresets.length)]');
    expect(begin).toContain('cameraTargetPosition.copy(activeCameraPreset.position);');
  });

  it('returns smoothly to the master temple shot when the queue drains', () => {
    const start = source.indexOf('function restoreMainCamera()');
    const end = source.indexOf('function updateRitualCamera(dt)', start);
    const restore = source.slice(start, end);
    expect(restore).toContain('cameraRitualActive = false;');
    expect(restore).toContain('cameraTargetPosition.copy(cameraHomePosition);');
    expect(restore).toContain('cameraTargetLookAt.copy(cameraHomeTarget);');
    expect(restore).toContain('cameraTargetFov = cameraHomeFov;');
  });
});
