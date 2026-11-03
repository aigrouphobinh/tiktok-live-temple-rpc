import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { TEMPLE_CAMERA_RITUAL_PRESETS, TEMPLE_CAMERA_SHOT_SEQUENCE, getTempleCameraShotFrame } from '../public/js/temple-camera-presets.js';

const source = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
const vectorIsFinite = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

describe('Three.js independent camera shot-action director', () => {
  it('defines eight individual shots with one dedicated action and subject each', () => {
    expect(TEMPLE_CAMERA_RITUAL_PRESETS).toHaveLength(8);
    expect(new Set(TEMPLE_CAMERA_RITUAL_PRESETS.map((shot) => shot.name)).size).toBe(8);
    expect(new Set(TEMPLE_CAMERA_RITUAL_PRESETS.map((shot) => shot.action)).size).toBe(8);
    for (const shot of TEMPLE_CAMERA_RITUAL_PRESETS) {
      expect(shot.subject.length).toBeGreaterThan(0);
      expect(shot.durationMs).toBeGreaterThan(0);
      expect(typeof shot.actionParams).toBe('object');
    }
  });


  it('prioritizes sanctuary coverage and keeps character close-ups occasional', () => {
    expect(TEMPLE_CAMERA_SHOT_SEQUENCE[0]).toBe('hall-crane-reveal');
    expect(new Set(TEMPLE_CAMERA_SHOT_SEQUENCE)).toEqual(
      new Set(TEMPLE_CAMERA_RITUAL_PRESETS.map((shot) => shot.name))
    );
    const count = (name) => TEMPLE_CAMERA_SHOT_SEQUENCE.filter((shot) => shot === name).length;
    expect(TEMPLE_CAMERA_SHOT_SEQUENCE).toHaveLength(16);
    expect(count('hall-crane-reveal')).toBe(3);
    expect(count('left-aisle-dolly')).toBe(3);
    expect(count('buddha-pov-pan')).toBe(3);
    expect(count('abbot-bow-portrait')).toBe(1);
    expect(count('devotee-tracking')).toBe(1);
    expect(count('abbot-bow-portrait') + count('devotee-tracking')).toBeLessThanOrEqual(2);
  });

  it('executes each action with valid camera coordinates and its own motion', () => {
    for (const shot of TEMPLE_CAMERA_RITUAL_PRESETS) {
      const start = getTempleCameraShotFrame(shot, 0);
      const quarter = getTempleCameraShotFrame(shot, shot.durationMs / 4);
      const middle = getTempleCameraShotFrame(shot, shot.durationMs / 2);
      const threeQuarter = getTempleCameraShotFrame(shot, shot.durationMs * 3 / 4);
      const end = getTempleCameraShotFrame(shot, shot.durationMs);
      for (const frame of [start, quarter, middle, threeQuarter, end]) {
        expect(vectorIsFinite(frame.position)).toBe(true);
        expect(vectorIsFinite(frame.lookAt)).toBe(true);
        expect(Number.isFinite(frame.fov)).toBe(true);
        expect(frame.action).toBe(shot.action);
        expect(frame.subject).toBe(shot.subject);
      }
      const cameraMoved = [quarter, middle, threeQuarter, end].some((frame) =>
        start.position.some((value, index) => Math.abs(value - frame.position[index]) > 0.05)
      );
      const viewMoved = [quarter, middle, threeQuarter, end].some((frame) =>
        start.lookAt.some((value, index) => Math.abs(value - frame.lookAt[index]) > 0.05)
      );
      expect(cameraMoved || viewMoved).toBe(true);
    }
  });

  it('orbits the Buddha independently and performs a left-to-right Buddha POV pan', () => {
    const orbit = TEMPLE_CAMERA_RITUAL_PRESETS.find((shot) => shot.action === 'buddha-orbit');
    const pov = TEMPLE_CAMERA_RITUAL_PRESETS.find((shot) => shot.action === 'buddha-pov-pan');
    expect(orbit).toBeDefined();
    expect(pov).toBeDefined();

    const orbitStart = getTempleCameraShotFrame(orbit, 0);
    const orbitEnd = getTempleCameraShotFrame(orbit, orbit.durationMs);
    expect(orbitStart.position).not.toEqual(orbitEnd.position);
    expect(orbitStart.lookAt).toEqual(orbitEnd.lookAt);

    const povLeft = getTempleCameraShotFrame(pov, pov.durationMs / 4);
    const povRight = getTempleCameraShotFrame(pov, pov.durationMs * 3 / 4);
    expect(povLeft.position).toEqual(povRight.position);
    expect(povLeft.lookAt[0]).toBeGreaterThan(0);
    expect(povRight.lookAt[0]).toBeLessThan(0);
    expect(povLeft.lookAt[0]).not.toBe(povRight.lookAt[0]);
  });

  it('gives the resident abbot a dedicated push-in and respectful-bow action', () => {
    const shot = TEMPLE_CAMERA_RITUAL_PRESETS.find((item) => item.action === 'abbot-bow-portrait');
    const start = getTempleCameraShotFrame(shot, 0);
    const end = getTempleCameraShotFrame(shot, shot.durationMs);
    expect(start.position).not.toEqual(end.position);
    expect(start.lookAt[2]).toBeCloseTo(-3.65);
    expect(source).toContain('const abbotShotBow = isAbbotPortraitAction');
    expect(source).toContain('templeAbbot.userData.headPivot.rotation.x = 0.015 + abbotBowAmount * 0.22;');
  });

  it('tracks the actual live worshipper position instead of replaying a static frame', () => {
    const shot = TEMPLE_CAMERA_RITUAL_PRESETS.find((item) => item.action === 'devotee-tracking');
    const first = getTempleCameraShotFrame(shot, 1200, { subjectPosition: [1.2, 0.1, 5.4] });
    const second = getTempleCameraShotFrame(shot, 1200, { subjectPosition: [-2.1, 0.1, 1.7] });
    expect(first.position[0]).not.toBe(second.position[0]);
    expect(first.lookAt[0]).toBeCloseTo(1.2);
    expect(second.lookAt[0]).toBeCloseTo(-2.1);
  });

  it('uses independent crane, left-dolly, right-dolly and elevated panorama paths', () => {
    const byAction = (action) => TEMPLE_CAMERA_RITUAL_PRESETS.find((shot) => shot.action === action);
    const crane = getTempleCameraShotFrame(byAction('hall-crane-reveal'), 9000);
    const left = getTempleCameraShotFrame(byAction('left-aisle-dolly'), 7800);
    const right = getTempleCameraShotFrame(byAction('right-aisle-dolly'), 7800);
    const overview = getTempleCameraShotFrame(byAction('hall-overview-orbit'), 4600);
    expect(crane.position[1]).toBeLessThan(8);
    expect(left.position[0]).toBeGreaterThan(-12.5);
    expect(right.position[0]).toBeLessThan(12.2);
    expect(overview.position[1]).toBeLessThan(10.2);
    expect(overview.fov).toBeLessThanOrEqual(46);
    expect(left.position[0]).toBeLessThan(0);
    expect(right.position[0]).toBeGreaterThan(0);

    const craneShot = byAction('hall-crane-reveal');
    for (const elapsed of [0, craneShot.durationMs / 2, craneShot.durationMs]) {
      expect(getTempleCameraShotFrame(craneShot, elapsed).position[1]).toBeLessThanOrEqual(7.8);
    }
    for (const elapsed of [0, 2300, 4600, 6900, 9200]) {
      expect(getTempleCameraShotFrame(byAction('hall-overview-orbit'), elapsed).position[1]).toBeLessThan(10.2);
    }
  });

  it('runs exactly one shot action until its own duration ends, then hands off', () => {
    expect(source).toContain('function beginCameraShot(index, now = performance.now(), mode = \'ambient\')');
    expect(source).toContain('cameraActionEndsAt = now + activeCameraPreset.durationMs;');
    expect(source).toContain('else if (now >= cameraActionEndsAt)');
    expect(source).toContain('TEMPLE_CAMERA_SHOT_SEQUENCE.map');
    expect(source).toContain('beginCameraShot(getNextCameraPresetIndex(), performance.now(), \'ritual\')');
    expect(source).not.toContain('Math.random() * cameraShotDefinitions.length');
    expect(source).toContain('getTempleCameraShotFrame(activeCameraPreset, actionElapsed');
    expect(source).toContain('camera.userData.shotAction = activeCameraAction;');
    expect(source).toContain('camera.userData.shotSubject = activeCameraSubject;');
    expect(source).toContain('camera.position.lerp(cameraTargetPosition, blend);');
    expect(source).toContain('const cameraShotBlendMs = 920;');
    expect(source).toContain('const cameraShotTransitionMs = 1900;');
    expect(source).toContain('startPosition: camera.position.clone()');
    expect(source).toContain('startLookAt: currentLookAt.clone()');
    expect(source).toContain('startFov: camera.fov');
    expect(source).toContain('activeCameraTransition.startPosition');
    expect(source).toContain('activeCameraTransition.startLookAt');
    expect(source).toContain('activeCameraTransition.startFov');
    expect(source).toContain('cameraTargetPosition.lerpVectors(');
    expect(source).toContain('cameraTargetLookAt.lerpVectors(');
    expect(source).toContain('camera.userData.shotTransitionProgress');
    expect(source).not.toContain('getTempleRitualCloseShot(activeCameraPreset');
  });

  it('keeps the camera director on one eased portrait camera and exposes action diagnostics', () => {
    expect(source).toContain('const camera = new THREE.PerspectiveCamera(42, 1080 / 1920, 0.1, 140);');
    expect(source).toContain('lookTarget.lerp(cameraTargetLookAt, blend);');
    expect(source).toContain('camera.fov += (cameraTargetFov - camera.fov) * blend;');
    expect(source).toContain('const easedProgress = linearProgress * linearProgress * linearProgress');
    expect(source).toContain('camera.lookAt(lookTarget);');
    expect(source).toContain('action: camera.userData.shotAction || \'idle\'');
    expect(source).toContain('subject: camera.userData.shotSubject || \'temple\'');
    expect(source).toContain('actionProgress: Number((camera.userData.shotProgress || 0).toFixed(3))');
  });

  it('continues with an independent ambient action when the worship queue drains', () => {
    const start = source.indexOf('function restoreMainCamera()');
    const end = source.indexOf('function updateRitualCamera(dt, now', start);
    const restore = source.slice(start, end);
    expect(restore).toContain('cameraRitualActive = false;');
    expect(restore).toContain('beginAmbientCameraShot(performance.now(), true);');
    expect(restore).not.toContain('cameraTargetPosition.copy(cameraHomePosition);');
  });
});
