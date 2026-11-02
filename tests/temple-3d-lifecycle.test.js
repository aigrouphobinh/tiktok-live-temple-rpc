import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');

describe('Three.js lifecycle recovery', () => {
  it('uses one idempotent cleanup path for context loss and page teardown', () => {
    expect(source).toContain('let resourcesDisposed = false;');
    expect(source).toContain('function releaseWorldResources()');
    expect(source).toContain('if (resourcesDisposed) return;');
    expect(source).toContain('releaseWorldResources();');
  });

  it('uses the character state machine as the sole source of 3D visitor starts and completions', () => {
    expect(source).toContain("window.addEventListener('temple:character-start', onTempleCharacterStartForThreeD);");
    expect(source).toContain("window.addEventListener('temple:character-complete', onTempleCharacterCompleteForThreeD);");
    expect(source).toContain("window.addEventListener('temple:character-interrupted', onTempleCharacterInterruptedForThreeD);");
    expect(source).toContain('const renderedDevoteeEvents = new WeakSet();');
    expect(source).toContain('if (devoteeQueue.length >= 40) return;');
    expect(source).toContain('function finishActiveDevotee(event');
    expect(source).toContain('departingDevotees.push');
    expect(source).toContain('devoteeState.pausedAt = performance.now();');
  });

  it('does not create a second 3D visitor for any mapped gift action', () => {
    const start = source.indexOf('function handleRitual(event)');
    const end = source.indexOf('function onTempleRitual(event)', start);
    const handler = source.slice(start, end);
    expect(handler).toContain('if (hasNamedDevotee && !targetedGiftAction) enqueueDevotee(event);');
    expect(handler).not.toContain("!['rocket', 'donut'].includes(targetedGiftAction)");
  });

  it('routes Rocket and Donut into 3D target removal and waits for the gift handoff', () => {
    expect(source).toContain("import { resolveGiftAction } from './gift-action-rules.js';");
    expect(source).toContain('function ejectActiveDevotee(action');
    expect(source).toContain('devoteeState.pausedAt = 0;');
    expect(source).toContain("setDevoteePhase('rocketEject', now, devoteeState.ejectionMotionDuration)");
    expect(source).toContain("setDevoteePhase('donutChase', now, devoteeState.ejectionMotionDuration)");
    expect(source).toContain('if (hasNamedDevotee && !targetedGiftAction) enqueueDevotee(event);');
    expect(source).toContain('const hasTarget = event.detail?.hasTarget === true;');
    expect(source).toContain('const impact = hasTarget &&');
    expect(source).toContain('giftImpactPosition = impact;');
    expect(source).toContain('devoteeState.awaitingGiftHandoff = true;');
    expect(source).toContain("window.addEventListener('temple:gift-effects-complete', onTempleGiftEffectsComplete);");
    expect(source).toContain('finishGiftEjectionHandoff();');
  });

  it('keeps one-way entrance, FIFO queue order and a separate exit lane', () => {
    expect(source).toContain("enter: [[-4.55, 0, 15.3], [-4.2, 0, 13.8], [-3.85, 0, 10.8], [-3.65, 0, 8.0]]");
    expect(source).toContain("approach: [[-3.65, 0, 8.0], [-3.55, 0, 5.3], [-2.7, 0, 3.1], [-1.6, 0, 0.15], [0.0, 0, -3.55]]");
    expect(source).toContain("exit: [[0.0, 0, -3.55], [1.8, 0, -0.5], [4.8, 0, 3.0], [5.7, 0, 8.5], [6.2, 0, 13.5]]");
    expect(source).toContain('actor.target.set(-5.0, 0.05, 8.0 + index * 1.45);');
    expect(source).not.toContain('for (let slot = 0; slot < 5; slot++)');
    expect(source).toContain("setDevoteePhase('enter', now, 3600);");
    expect(source).toContain("setDevoteePhase('approach', now, 4200);");
    expect(source).toContain("mainDevotee.position.set(-3.65, 0.05, 8.0);");
  });

  it('renders queued visitors as bounded, reusable 3D actors on a separate side lane', () => {
    expect(source).toContain('const queueActors = new Map();');
    expect(source).toContain('const queueActorPool = [];');
    expect(source).toContain('const MAX_VISIBLE_QUEUE_ACTORS = 5;');
    expect(source).toContain('function createQueueActor(event)');
    expect(source).toContain('function refreshQueueActors()');
    expect(source).toContain('function releaseQueueActor(event)');
    expect(source).toContain('queueActors.get(event)');
    expect(source).toContain('actor.group.position.lerp(actor.target');
    expect(source).toContain('animateHuman(actor.avatar, now, moving, now * 0.0085 + actor.avatar.phase);');
    expect(source).toContain('actor.avatar.prayerPose');
    expect(source).toContain('if (devoteeState.active || devoteeState.awaitingGiftHandoff) refreshQueueActors();');
    expect(source).toContain('mainHuman.wardrobeMaterials[key].color.copy(queuedActor.wardrobe[key].color);');
    expect(source).toContain('box(0.92, 0.035, 7.1, mats.woodLight, -5.0, -0.105, 11.4);');
    expect(source).toContain('if (devoteeState.active || devoteeState.awaitingGiftHandoff) refreshQueueActors();');
    expect(source).toContain('actor.group.position.set(-5.0 - index * 0.08, 0.05, 15.3 + index * 0.35);');
    expect(source).toContain('actor.group.position.distanceToSquared(actor.target) > 0.018');
    expect(source).toContain('mainHuman.wardrobeMaterials[key].color.copy(queuedActor.wardrobe[key].color);');
  });

  it('keeps queue prayer hands working for both GLB and procedural character rigs', () => {
    expect(source).toContain('function applyStandingPrayerPose(avatar)');
    expect(source).toContain('if (avatar.gltfRoot && avatar.gltfRig)');
    expect(source).toContain('rig.leftArm.rotation.z = rig.leftArmRest.z + 0.54;');
    expect(source).toContain('avatar.leftArm.rotation.z = 0.54;');
    expect(source).toContain('if (actor.avatar.prayerPose && !moving) applyStandingPrayerPose(actor.avatar);');
  });

  it('stagger worship cycles across the eight background devotees', () => {
    expect(source).toContain('avatar.congregationRole = avatarIndex % 4;');
    expect(source).toContain('avatar.congregationOffset = avatar.phase * 1500;');
    expect(source).toContain('function updateCongregationWorshipPose(avatar, now)');
    expect(source).toContain('const cycleMs = 24000;');
    expect(source).toContain('bowCycles: 2,');
    expect(source).toContain('bowCycleMs: 1450,');
    expect(source).toContain('updateCongregationWorshipPose(avatar, now);');
  });

  it('gives the congregation varied clothing, posture and subtle spacing', () => {
    expect(source).toContain('const HUMAN_WARDROBE = [');
    expect(source).toContain('avatar.kneelBlend = posture.kneel;');
    expect(source).toContain('avatar.headingOffset = ((avatarIndex % 3) - 1) * 0.055;');
    expect(source).toContain('const stagger = row % 2 ? 0.16 : -0.1;');
  });

  it('performs three separate bows during the 3D ritual phase', () => {
    expect(source).toContain('bowCycles: 3,');
    expect(source).toContain('bowCycleMs: 1050,');
    expect(source).toContain("setDevoteePhase('ritual', now, Number.MAX_SAFE_INTEGER);");
    expect(source).toContain("devoteeState.phase === 'ritual'\n        ? 0");
  });

  it('animates the previous visitor leaving while the next visitor enters', () => {
    expect(source).toContain('const leaving = mainDevotee.clone(true);');
    expect(source).toContain('function finishActiveDevotee(event');
    expect(source).toContain('for (let i = departingDevotees.length - 1; i >= 0; i--)');
    expect(source).toContain('startNextDevotee(now);');
  });

  it('removes both gift event listeners when the scene is disposed', () => {
    const cleanupStart = source.indexOf('function releaseWorldResources()');
    const cleanupEnd = source.indexOf('function onVisibilityChange()', cleanupStart);
    const cleanup = source.slice(cleanupStart, cleanupEnd);

    expect(source).toContain("window.addEventListener('temple:gift-action', onTempleGiftAction);");
    expect(source).toContain("window.addEventListener('temple:gift-reaction', onTempleGiftReaction);");
    expect(cleanup).toContain("window.removeEventListener('temple:gift-action', onTempleGiftAction);");
    expect(cleanup).toContain("window.removeEventListener('temple:gift-reaction', onTempleGiftReaction);");
    expect(cleanup).toContain("window.removeEventListener('temple:character-interrupted', onTempleCharacterInterruptedForThreeD);");
    expect(cleanup).toContain("window.removeEventListener('temple:character-start', onTempleCharacterStartForThreeD);");
    expect(cleanup).toContain("window.removeEventListener('temple:character-complete', onTempleCharacterCompleteForThreeD);");
    expect(cleanup).toContain("window.removeEventListener('temple:gift-effects-complete', onTempleGiftEffectsComplete);");
  });

  it('stops the animation loop and releases scene resources after WebGL context loss', () => {
    const handler = source.slice(source.indexOf("canvas.addEventListener('webglcontextlost'"), source.indexOf("window.addEventListener('pagehide'"));
    expect(handler).toContain('event.preventDefault();');
    expect(handler).toContain('disposed = true;');
    expect(handler).toContain('stop();');
    expect(handler).toContain('releaseWorldResources();');
    expect(handler).toContain("stage.classList.remove('temple-3d-mode');");
    expect(handler).toContain("window.dispatchEvent(new Event('temple:3d-unavailable'));");
  });

  it('prevents resize callbacks from touching a disposed renderer', () => {
    const handler = source.slice(source.indexOf('function onWindowResize()'), source.indexOf("document.addEventListener('visibilitychange'"));
    expect(handler).toContain('if (disposed) return;');
    expect(handler).toContain('renderer.setSize(1080, 1920, false);');
  });

  it('shares cleanup with pagehide rather than disposing the scene twice', () => {
    const handler = source.slice(source.indexOf("window.addEventListener('pagehide'"));
    expect(handler).toContain('disposed = true;');
    expect(handler).toContain('releaseWorldResources();');
    expect(handler).not.toContain('disposeThreeObjectTree(scene)');
  });

  it('integrates the Agent 3 environment once using the active render profile', () => {
    expect(source).toContain("import { createTempleEnvironment } from './temple-environment.js';");
    expect(source.split('createTempleEnvironment({')).toHaveLength(2);
    const integrationStart = source.indexOf('const templeEnvironment = createTempleEnvironment({');
    const integrationEnd = source.indexOf('});', integrationStart);
    const integration = source.slice(integrationStart, integrationEnd);
    expect(integration).toContain('THREE,');
    expect(integration).toContain('scene,');
    expect(integration).toContain('detailLevel: renderProfile.environmentDetail');
  });

  it('disposes Agent 3 architecture before shared scene resources', () => {
    const cleanupStart = source.indexOf('function releaseWorldResources()');
    const cleanupEnd = source.indexOf('function onVisibilityChange()', cleanupStart);
    const cleanup = source.slice(cleanupStart, cleanupEnd);
    expect(cleanup).toContain('templeEnvironment.dispose();');
    expect(cleanup.indexOf('templeEnvironment.dispose();'))
      .toBeGreaterThan(-1);
    expect(cleanup.indexOf('templeEnvironment.dispose();'))
      .toBeLessThan(cleanup.indexOf('disposeThreeSceneResources(scene);'));
  });

});
