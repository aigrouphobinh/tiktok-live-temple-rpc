import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
const avatarSource = readFileSync(new URL('../public/js/ao-dai-avatar.js', import.meta.url), 'utf8');
const formationSource = readFileSync(new URL('../public/js/devotee-formation.js', import.meta.url), 'utf8');
const modelLoaderSource = readFileSync(new URL('../public/js/three-model-loader.js', import.meta.url), 'utf8');

describe('Three.js lifecycle recovery', () => {
  it('keeps GLB triangle counts in scope through the returned asset diagnostics', () => {
    expect(modelLoaderSource).toContain('let triangleCount = 0;');
    expect(modelLoaderSource.indexOf('let triangleCount = 0;'))
      .toBeLessThan(modelLoaderSource.indexOf('try {'));
    expect(modelLoaderSource).toContain('triangleCount,');
  });

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
    expect(source).toContain('if (devoteeQueue.length >= MAX_VISIBLE_QUEUE_ACTORS) return;');
    expect(source).toContain('function finishActiveDevotee(event');
    expect(source).toContain('event: devoteeState.event, curve: exitCurve,');
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

  it('renders Rocket as a layered tier-scaled blast with flash, smoke, shockwaves and sparks', () => {
    expect(source).toContain('function giftExplosionBurst(position, vfx, color = 0xffa52e)');
    expect(source).toContain('blending: THREE.AdditiveBlending');
    expect(source).toContain('const smokeCount = Math.min(14, 5 + vfx.shockwaves);');
    expect(source).toContain('MAX_EFFECTS - 1 - smokeCount - vfx.shockwaves');
    expect(source).toContain('giftSparkBurst(center.x, center.y + 0.12, center.z, sparkCount, color);');
    expect(source).toContain('giftExplosionBurst(impact, vfx, 0xffa52e);');
  });

  it('routes Rocket and Donut into 3D target removal and waits for the gift handoff', () => {
    expect(source).toContain("import { resolveGiftAction, resolveGiftVfxProfile } from './gift-action-rules.js';");
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

  it('keeps one-way entrance, horizontal altar formation and a separate exit lane', () => {
    expect(source).toContain("enter: [[-4.55, 0, 15.3], [-4.2, 0, 13.8], [-3.85, 0, 10.8], [-3.65, 0, 8.0]]");
    expect(source).toContain("approach: [[-3.65, 0, 8.0], [-3.55, 0, 5.3], [-2.7, 0, 3.1], [-1.6, 0, 0.15], [0.0, 0, -3.55]]");
    expect(source).toContain("exit: [[0.0, 0, -3.55], [1.8, 0, -0.5], [4.8, 0, 3.0], [5.7, 0, 8.5], [6.2, 0, 13.5]]");
    expect(source).not.toContain('for (let slot = 0; slot < 5; slot++)');
    expect(source).toContain("setDevoteePhase('enter', now, 1700);");
    expect(source).toContain("setDevoteePhase('approach', now, 3000);");
    expect(source).toContain('devoteeState.phaseDuration = duration;');
    expect(source).toContain("mainDevotee.position.set(-3.65, 0.05, 8.0);");
  });

  it('renders all waiting visitors as reusable actors in horizontal incense-offering rows', () => {
    expect(source).toContain('const queueActors = new Map();');
    expect(source).toContain('const queueActorPool = [];');
    expect(source).toContain('MAX_VISIBLE_QUEUE_ACTORS }');
    expect(source).toContain('function createQueueActor(event, appearance = getDevoteeAppearance(event))');
    expect(source).toContain('function refreshQueueActors(now = performance.now())');
    expect(source).toContain('function releaseQueueActor(event)');
    expect(source).toContain('queueActors.get(event)');
    expect(source).toContain('function setQueueActorTarget(actor, target, slot, now)');
    expect(source).toContain('function getAvailableQueueActorSlot()');
    expect(source).toContain('getCrowdNameTagLayout(slot, { columns: 1');
    expect(source).toContain('actor.nameTag.scale.set(nameTagLayout.width, nameTagLayout.height, 1);');
    expect(source).toContain('actor.slot = slot;');
    expect(source).toContain('const slot = index;');
    expect(source).toContain('actor.slot = -1;');
    expect(source).toContain('actor.moveCurve = new THREE.CatmullRomCurve3(');
    expect(source).toContain('actor.moveDurationMs = Math.max(950, actor.moveCurve.getLength() / 1.45 * 1000);');
    expect(source).toContain('actor.moveCurve.getPointAt(eased)');
    expect(source).toContain('actor.moveCurve.getTangentAt(eased)');
    expect(source).toContain('getDistanceBasedGaitPhase(\n          eased,\n          actor.moveCurve.getLength(),\n          1.2,\n          actor.avatar.phase\n        )');
    expect(source).not.toContain('actor.group.position.lerp(actor.target');
    expect(source).not.toContain('now * 0.0085 + actor.avatar.phase');
    expect(source).toContain('avatar.prayerPose = true;');
    expect(source).toContain('Compact the line after every promotion');
    expect(source).toContain('getQueueActorFormationPosition, getQueueActorEntryPosition, createQueueWorshipLedger, MAX_CONCURRENT_WORSHIPPERS, MAX_QUEUED_WORSHIPPERS, MAX_VISIBLE_QUEUE_ACTORS');
    expect(source).toContain('const entryPosition = getQueueActorEntryPosition(index);');
    expect(source).toContain('const queueFormation = getQueueActorFormationPosition(slot);');
    expect(source).toContain('const entryPosition = getQueueActorEntryPosition(index);');
    expect(source).toContain('actor.avatar.offeringIncense = false;');
    expect(source).toContain('const offeringPose = getRitualPoseState({');
    expect(source).toContain('applyHumanBow(actor.avatar, moving ? 0 : offeringPose.bowAmount, actor.avatar.kneelBlend);');
    expect(source).toContain('bowAmount: Number((actor.avatar.bowAmount || 0).toFixed(3)),');
    expect(source).toContain('offeringElapsedMs: Math.round(actor.avatar.offeringElapsedMs || 0),');
    expect(source).toContain('actor.avatar.queueWaiting = !isWorshipLane;');
    expect(source).toContain('const offeringElapsed = Number.isFinite(actor.offeringStartedAt)');
    expect(source).toContain("const entryPosition = arrivalFormation?.role === 'waiting'");
    expect(source).toContain('if (devoteeState.active || devoteeState.awaitingGiftHandoff) refreshQueueActors();');
    expect(source).toContain('queuedActor?.appearance || getDevoteeAppearance(devoteeState.event)');
    expect(source).not.toContain('continuous side procession lane');
    expect(source).toContain('if (devoteeState.active || devoteeState.awaitingGiftHandoff) refreshQueueActors();');
    expect(source).toContain('actor.moveTarget = null;');
    expect(source).toContain('actor.moveCurve = null;');
    expect(source).toContain('actor.moveStartedAt = 0;');
    expect(source).toContain('actor.moveDurationMs = 0;');
    expect(source).toContain('actor.group.position.distanceToSquared(actor.target) > 0.018');
    expect(source).toContain('queuedActor?.appearance || getDevoteeAppearance(devoteeState.event)');
  });

  it('layers the gift acknowledgement after the pause bow so it is not overwritten', () => {
    const pauseStart = source.indexOf('if (devoteeState.active && devoteeState.pausedAt)');
    const pauseEnd = source.indexOf("if (devoteeState.active && !devoteeState.pausedAt)", pauseStart);
    const pausedPose = source.slice(pauseStart, pauseEnd);
    expect(pausedPose).toContain('applyHumanBow(mainHuman, 0.12, mainHuman.kneelBlend);');
    expect(pausedPose).toContain('applyGiftThankYouGesture(mainHuman, now);');
    expect(pausedPose.indexOf('applyHumanBow(mainHuman, 0.12')).toBeLessThan(
      pausedPose.indexOf('applyGiftThankYouGesture(mainHuman, now)')
    );
  });

  it('keeps queue prayer hands working for both GLB and procedural character rigs', () => {
    expect(source).toContain('function applyGiftThankYouGesture(avatar, time)');
    expect(source).toContain('const prayerBlend = Math.max(avatar.kneelBlend || 0, avatar.prayerPose ? 1 : 0)');
    expect(source).toContain('avatar.leftArm.rotation.z = upperPose.armOpen + thankYouLift;');
    expect(source).toContain('avatar.rightArm.rotation.z = -upperPose.armOpen - thankYouLift;');
    expect(source).toContain('applyGiftThankYouGesture(avatar, time);');
  });

  it('does not spawn background NPCs when there are no corresponding viewer events', () => {
    expect(source).not.toContain('function makeDevotee(');
    expect(source).not.toContain('devoteeAvatars');
    expect(source).not.toContain('updateCongregationWorshipPose');
    expect(source).not.toContain('for(let row=0;row<4;row++)');
    expect(source).toContain('const mainHuman=makeHumanAvatar(1.72)');
    expect(source).toContain('const queueActors = new Map();');
    expect(source).toContain('backgroundNpcCount: 0,');
  });

  it('keeps both Ao Dai variants available without creating decorative extra people', () => {
    expect(avatarSource).toContain('const AO_DAI_PALETTES = Object.freeze([');
    expect(avatarSource).toContain("gender: 'female'");
    expect(avatarSource).toContain("gender: 'male'");
    expect(source).toContain('const maleRigCount = allHumanAvatars.filter((avatar) => Boolean(avatar.variants?.male)).length;');
    expect(source).toContain('const femaleRigCount = allHumanAvatars.filter((avatar) => Boolean(avatar.variants?.female)).length;');
    expect(source).not.toContain('makeDevotee(');
  });

  it('coalesces repeated events from one viewer into the existing active or queued avatar', () => {
    expect(source).toContain('function getDevoteeIdentityKey(event)');
    expect(source).toContain('getDevoteeIdentityKey(devoteeState.event) === identity');
    expect(source).toContain('const existingQueuedEvent = identity');
    expect(source).toContain('Object.assign(existingQueuedEvent, event);');
    expect(source).toContain('getDevoteeIdentityKey(departing.event) !== identity');
  });

  it('performs three separate bows during the 3D ritual phase', () => {
    expect(source).toContain('bowCycles: 3,');
    expect(source).toContain('bowCycleMs: 1500,');
    expect(source).toContain("setDevoteePhase('ritual', now, 6500);");
    expect(source).toContain("const ritualElapsed = devoteeState.phase === 'ritual' ? phaseElapsed : 0;");
    expect(source).toContain("const ritualPose = devoteeState.alreadyWorshippedInQueue");
    expect(source).toContain("bowPhase: 'already-completed-in-queue'");
  });

  it('does not promote a visitor who already worshipped in a side lane and sends them out once', () => {
    expect(source).toContain('const candidateIndex = requestedEvent\n      ? devoteeQueue.indexOf(requestedEvent)');
    expect(source).toContain('startNextDevotee(now, startedEvent);');
    expect(source).toContain('actor.avatar.queueWaiting');
    expect(source).toContain('!actor.avatar.queuedWorshipLane');
    expect(source).toContain('!actor.avatar.queueWorshipCompleted');
    expect(source).toContain('function departCompletedQueueWorship(actor, now = performance.now())');
    expect(source).toContain('devoteeQueue.splice(queueIndex, 1)');
    expect(source).toContain('departingDevotees.push({');
    expect(source).toContain('if (offeringPose.bowPhase === \'complete\' && offeringPose.kneelBlend >= 0.9)');
    expect(source).toContain('actor.avatar.queueWorshipCompleted = true;');
    expect(source).toContain('const completedQueueWorship = createQueueWorshipLedger();');
    expect(source).toContain('completedQueueWorship.mark(getDevoteeIdentityKey(event));');
    expect(source).toContain('if (completedQueueWorship.has(identity))');
    expect(source).toContain('completedQueueWorship.complete(getDevoteeIdentityKey(completedEvent));');
    expect(source).toContain('finishGiftEjectionHandoff(now, null, { startNext: false });');
    expect(formationSource).toContain('export function createQueueWorshipLedger()');
    expect(formationSource).toContain('completedIdentities.add(identity)');
    expect(formationSource).toContain('completedIdentities.delete(identity)');
  });

  it('animates the previous visitor walking out while the next visitor enters', () => {
    expect(source).toContain('const leaving = mainDevotee.clone(true);');
    expect(source).toContain('function cloneHumanAvatarForExit(leavingGroup)');
    expect(source).toContain('const leavingAvatar = cloneHumanAvatarForExit(leaving);');
    expect(source).toContain('clone.kneelBlend = 0;');
    expect(source).toContain('clone.kneeling = false;');
    expect(source).toContain('applyHumanBow(clone, 0);');
    expect(source).toContain('durationMs: 10500');
    expect(source).toContain('leaving.curve.getPointAt(eased)');
    expect(source).toContain('leaving.curve.getTangentAt(eased)');
    expect(source).toContain('animateHuman(leaving.avatar, now, true');
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
