import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
const cssCamera = readFileSync(new URL('../public/js/camera-controller.js', import.meta.url), 'utf8');

describe('3D temple camera shot sequence', () => {
  it('keeps the main hall as the establishing shot and selects one subtle 3/4 preset per queue', () => {
    expect(scene).toContain('const cameraHomePosition = new THREE.Vector3(0, 11.75, 28.5);');
    expect(scene).toContain('const cameraHomeFov = 42;');
    expect(scene).toContain('const cameraRitualPresets = [');
    expect(scene).toContain('if (cameraRitualActive) return;');
    expect(scene).toContain("activeCameraShot = 'procession';");
    expect(scene).toContain('const cameraFollowX = person.x * 0.72;');
    expect(scene).toContain('cameraTargetPosition.set(');
    expect(scene).toContain('cameraFollowX + activeCameraPreset.position.x');
    expect(scene).toContain('cameraFollowX + activeCameraPreset.targetOffsetX');
  });

  it('keeps the visitor centered during the side entrance and inward procession', () => {
    const updateStart = scene.indexOf('function updateRitualCamera(dt)');
    const updateEnd = scene.indexOf('\n  const mats = {', updateStart);
    const update = scene.slice(updateStart, updateEnd);
    expect(update).toContain('const cameraFollowX = person.x * 0.72;');
    expect(update).toContain('cameraTargetPosition.set(');
    expect(update).toContain('cameraTargetLookAt.set(');
    expect(update).toContain('person.z');
  });

  it('moves to a real medium close-up only after the active visitor reaches the altar', () => {
    const updateStart = scene.indexOf('function updateRitualCamera(dt)');
    const updateEnd = scene.indexOf('\n  const mats = {', updateStart);
    const update = scene.slice(updateStart, updateEnd);

    expect(update).toContain("if (devoteeState.phase === 'ritual')");
    expect(update).toContain('cameraTargetPosition.set(');
    expect(update).toContain('person.x + side * 1.55');
    expect(update).toContain('person.z + 6.2');
    expect(update).toContain('cameraTargetLookAt.set(person.x + side * 0.08, 1.22, person.z - 0.42);');
    expect(update).toContain("activeCameraShot = 'altar-close';");
    expect(update).toContain('cameraTargetFov = cameraAltarCloseFov;');
    expect(scene).toContain('const cameraAltarCloseFov = 31;');
  });

  it('eases the camera position, focal length and look target instead of cutting', () => {
    const updateStart = scene.indexOf('function updateRitualCamera(dt)');
    const updateEnd = scene.indexOf('\n  const mats = {', updateStart);
    const update = scene.slice(updateStart, updateEnd);
    expect(update).toContain('camera.position.lerp(cameraTargetPosition, blend);');
    expect(update).toContain('lookTarget.lerp(cameraTargetLookAt, blend);');
    expect(update).toContain('camera.fov += (cameraTargetFov - camera.fov) * blend;');
    expect(update).toContain('camera.lookAt(lookTarget);');
    expect(update).toContain('camera.userData.shotName = activeCameraShot;');
    expect(scene).toContain('const cameraShotBlendMs = 720;');
  });

  it('returns to the establishing shot when the queue drains', () => {
    const restoreStart = scene.indexOf('function restoreMainCamera()');
    const restoreEnd = scene.indexOf('function updateRitualCamera(dt)', restoreStart);
    const restore = scene.slice(restoreStart, restoreEnd);
    expect(restore).toContain("activeCameraShot = 'home';");
    expect(restore).toContain('cameraTargetPosition.copy(cameraHomePosition);');
    expect(restore).toContain('cameraTargetLookAt.copy(cameraHomeTarget);');
    expect(restore).toContain('cameraTargetFov = cameraHomeFov;');
    expect(scene).toContain('if (!devoteeState.active && !devoteeQueue.length) restoreMainCamera();');
  });

  it('does not layer the old CSS camera transform over the Three.js shot director', () => {
    const guard = cssCamera.indexOf("if (new URLSearchParams(location.search).get('3d') === '1')");
    expect(guard).toBeGreaterThan(-1);
    expect(cssCamera.slice(guard)).toContain("rig.style.transform = 'none';");
    expect(cssCamera.slice(guard)).toContain('return;');
  });
});
