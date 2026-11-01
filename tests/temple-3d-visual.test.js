import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { findBestAnimationClip } from '../public/js/three-animation-utils.js';

const css = readFileSync(new URL('../public/css/live.css', import.meta.url), 'utf8');

describe('3D sanctuary visual treatment', () => {
  it('adds a non-interactive cinematic vignette only in 3D mode', () => {
    expect(css).toContain('.stage-9x16.temple-3d-mode::after');
    expect(css).toContain('pointer-events: none;');
    expect(css).toContain('radial-gradient(ellipse at 50% 43%');
    expect(css).toContain('linear-gradient(180deg');
  });

  it('turns procedural devotees toward incoming gifts with a bounded head acknowledgement', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('giftReactionUntil: 0');
    expect(scene).toContain('const giftReaction = getGiftReactionBlend(avatar.giftReactionUntil - time) * (avatar.giftReactionProfile?.intensity || 0.55);');
    expect(scene).toContain('avatar.head.rotation.y = Math.sin(time*0.0011+avatar.phase)*0.035 + giftReaction * 0.2;');
    expect(scene).toContain('avatar.head.rotation.z = Math.sin(time*0.0014+avatar.phase)*0.008 + giftReaction * Math.sin(avatar.phase) * 0.035;');
    expect(scene).toContain('const resolved = profile || { tier: \'small\', intensity: 0.55, bowAmount: 0.08, durationMs: 1800 };');
    expect(scene).toContain('const reactionUntil = performance.now() + resolved.durationMs;');
    expect(scene).toContain('if (resolved.intensity >= (avatar.giftReactionProfile?.intensity || 0)) avatar.giftReactionProfile = resolved;');
    expect(scene).toContain('for (const avatar of allHumanAvatars) {');
    expect(scene).toContain('avatar.giftReactionUntil = Math.max(avatar.giftReactionUntil, reactionUntil);');
    expect(scene).toContain('if (resolved.intensity >= (avatar.giftReactionProfile?.intensity || 0)) avatar.giftReactionProfile = resolved;');
  });

  it('updates gratitude intensity for combo frames without replaying the world gift effect', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    const engine = readFileSync(new URL('../public/js/gift-action-engine.js', import.meta.url), 'utf8');
    expect(engine).toContain("new CustomEvent('temple:gift-reaction'");
    expect(engine).toContain('resolveGiftReactionProfile(event)');
    expect(scene).toContain('function onTempleGiftReaction(event)');
    expect(scene).toContain('applyGiftReactionProfile(event.detail?.reactionProfile);');
    expect(scene).toContain("window.addEventListener('temple:gift-reaction', onTempleGiftReaction);");
    expect(scene).toContain('// Combo frames update gratitude intensity without replaying the 3D gift effect.');
  });

  it('turns the devotee crowd toward the live audience and adds a restrained thank-you expression', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('avatar.root.rotation.y = Math.PI * (1 - giftReaction);');
    expect(scene).toContain('avatar.smile.scale.x = 1 + giftReaction * 0.2;');
    expect(scene).toContain('avatar.smile.scale.y = 1 + giftReaction * 0.12 - avatar.bowAmount * 0.12;');
    expect(scene).toContain('for (const eyeWhite of avatar.eyeWhites) eyeWhite.scale.x = 1 + giftReaction * 0.045;');
    expect(scene).toContain('// Devotees briefly turn from the altar toward the live audience, then ease back.');
  });

  it('scales the thank-you bow and hand gesture from the incoming gift tier', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const strength = blend * profile.intensity;');
    expect(scene).toContain('avatar.upperBody.rotation.x = upperPose.torsoLean - blend * profile.bowAmount;');
    expect(scene).toContain('const thankYouLift = strength * (0.92 + Math.sin(time * 0.007) * 0.025);');
    expect(scene).toContain('getGiftReactionBlend(avatar.giftReactionUntil - time) * (avatar.giftReactionProfile?.intensity || 0.55)');
  });

  it('raises both hands into a restrained thank-you gesture during gift reactions', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('function applyGiftThankYouGesture(avatar, time)');
    expect(scene).toContain('const thankYouLift = strength * (0.92 + Math.sin(time * 0.007) * 0.025);');
    expect(scene).toContain('avatar.leftArm.rotation.z = upperPose.armOpen + thankYouLift;');
    expect(scene).toContain('avatar.rightArm.rotation.z = -upperPose.armOpen - thankYouLift;');
    expect(scene).toContain('avatar.leftHand.rotation.z = -upperPose.armOpen * 0.18 - blend * 0.06;');
    expect(scene).toContain('avatar.rightHand.rotation.z = upperPose.armOpen * 0.18 + blend * 0.06;');
    expect(scene).toContain('applyGiftThankYouGesture(avatar, time);');
    expect(scene).toContain('applyGiftThankYouGesture(mainHuman, now);');
    expect(scene).toContain('if (avatar.gltfRoot) return;');
  });

  it('animates subtle torso breathing and head micro-movements without moving the planted root', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('root, upperBody, torso, head, eyeWhites, eyePupils, eyebrows, smile,');
    expect(scene).toContain('const breathCycle = time * 0.00135 + avatar.phase;');
    expect(scene).toContain('avatar.torso.scale.y = 1 + breath * 0.012;');
    expect(scene).toContain('avatar.torso.position.y = 0.40 + breath * 0.0025;');
    expect(scene).toContain('avatar.head.rotation.x = Math.sin(time*0.00082+avatar.phase*0.7)*0.012 - giftReaction * 0.025;');
    expect(scene).toContain('avatar.root.position.y = (walking ? 0 : Math.sin(time*0.0015+avatar.phase)*0.012) - avatar.kneelBlend * 0.1;');
  });

  it('adds animated blinking, eye gaze and a restrained bow expression to procedural faces', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const eyeWhites = [], eyePupils = [], eyebrows = [];');
    expect(scene).toContain('eyeWhites, eyePupils, eyebrows, smile,');
    expect(scene).toContain('const blinkCycle = ((time * 0.001 + avatar.phase * 0.17) % 4.6 + 4.6) % 4.6;');
    expect(scene).toContain('avatar.eyeWhites[index].scale.y = eyeOpen;');
    expect(scene).toContain('avatar.eyePupils[index].position.x = Math.sin(time*0.00065+avatar.phase)*0.006 + giftReaction * (index === 0 ? 0.009 : -0.009);');
    expect(scene).toContain('avatar.eyePupils[index].position.y = giftReaction * 0.008;');
    expect(scene).toContain('for (const { mesh, side } of avatar.eyebrows) mesh.rotation.z = -side * 0.12 + giftReaction * side * 0.035;');
    expect(scene).toContain('avatar.head.rotation.z = Math.sin(time*0.0014+avatar.phase)*0.008 + giftReaction * Math.sin(avatar.phase) * 0.035;');
    expect(scene).toContain('avatar.smile.scale.y = 1 + giftReaction * 0.12 - avatar.bowAmount * 0.12;');
  });

  it('builds articulated palms and fingers for the procedural devotee', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const leftHand = new THREE.Group();');
    expect(scene).toContain('const rightHand = new THREE.Group();');
    expect(scene).toContain('Small articulated palms and separated fingers keep the prayer gesture readable at scene scale.');
    expect(scene).toContain('for(let finger=0;finger<4;finger++){');
    expect(scene).toContain('root, upperBody, torso, head, eyeWhites, eyePupils, eyebrows, smile, leftArm, rightArm, leftHand, rightHand,');
    expect(scene).toContain('avatar.leftHand.rotation.z = -upperPose.armOpen * 0.18;');
    expect(scene).toContain('avatar.rightHand.rotation.z = upperPose.armOpen * 0.18;');
  });

  it('uses the shared upper-body pose for a procedural kneeling bow', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('getHumanUpperPose, getRitualPoseState');
    expect(scene).toContain('function applyHumanBow(avatar, amount, kneelBlend = 0)');
    expect(scene).toContain('const upperPose = getHumanUpperPose({ kneelBlend, bowAmount: amount });');
    expect(scene).toContain('avatar.upperBody.rotation.x = upperPose.torsoLean;');
    expect(scene).toContain('avatar.head.rotation.x = upperPose.headCounter;');
    expect(scene).toContain('avatar.leftArm.rotation.x = upperPose.armReach;');
    expect(scene).toContain('avatar.rightArm.rotation.x = upperPose.armReach;');
    expect(scene).toContain('applyHumanBow(mainHuman, ritualPose.bowAmount, ritualPose.kneelBlend);');
  });

  it('sequences the main devotee through approach, kneel and bow with a shared timeline', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain("getHumanFootPose, getHumanUpperPose, getRitualPoseState, getGiftReactionBlend } from './three-gait-utils.js';");
    expect(scene).toContain('mainHuman.kneelBlend = ritualPose.kneelBlend;');
    expect(scene).toContain('mainHuman.kneeling = ritualPose.kneelBlend > 0.035;');
    expect(scene).toContain('avatar.root.position.y = (walking ? 0 : Math.sin(time*0.0015+avatar.phase)*0.012) - avatar.kneelBlend * 0.1;');
    expect(scene).toContain('animateHuman(mainHuman, now, ritualPose.walking, walkPhase);');
    expect(scene).toContain('applyHumanBow(mainHuman, ritualPose.bowAmount, ritualPose.kneelBlend);');
    expect(scene).toContain('devoteeState.arrivedAt = now;');
    expect(scene).toContain('mainHuman.kneelBlend = 0;');
  });

  it('adds an instanced gilded outer aureole and warm focal glow', async () => {
    const scene = (await import('node:fs')).readFileSync(
      new URL('../public/js/temple-3d.js', import.meta.url), 'utf8'
    );
    expect(scene).toContain('new THREE.TorusGeometry(2.3,0.035,8,96)');
    expect(scene).toContain('new THREE.InstancedMesh(');
    expect(scene).toContain('new THREE.SphereGeometry(0.045,8,6), mats.goldBright, 32');
    expect(scene).toContain('new THREE.PointLight(0xffbd69, 8, 7, 2)');
  });

  it('uses one static instanced mesh for gilded column fluting', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('new THREE.CylinderGeometry(0.012, 0.012, 5.9, 6)');
    expect(scene).toContain('mats.goldBright, 10 * 8');
    expect(scene).toContain('columnFlutes.instanceMatrix.setUsage(THREE.StaticDrawUsage)');
    expect(scene).toContain('columnFlutes.castShadow = false');
  });

  it('adds instanced brass collars to the foot and crown of each timber column', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('new THREE.TorusGeometry(0.49, 0.035, 8, 24)');
    expect(scene).toContain('new THREE.InstancedMesh(columnCollarGeometry, mats.goldBright, 10 * 2)');
    expect(scene).toContain('for (const y of [0.86, 7.18])');
    expect(scene).toContain('columnCollars.instanceMatrix.setUsage(THREE.StaticDrawUsage)');
    expect(scene).toContain('world.add(columnCollars)');
  });

  it('frames the processional carpet with low curbs and brass inlay', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('box(0.22, 0.16, 27.2, mats.stone, side * 3.08, 0.025, 3)');
    expect(scene).toContain('box(0.035, 0.025, 27.0, mats.goldBright, side * 3.19, 0.115, 3)');
    expect(scene).toContain('for (const z of [16.8, 17.45])');
  });

  it('adds low raised galleries beyond both side-column rows', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const x = side * 9.15');
    expect(scene).toContain('box(2.35, 0.18, 25.5, mats.wood, x, -0.055, 2.2)');
    expect(scene).toContain('box(2.2, 0.045, 25.2, mats.stone, x, 0.06, 2.2)');
    expect(scene).toContain('side * 10.25');
  });

  it('adds open timber balustrades along both raised gallery edges', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const railX = side * 10.18');
    expect(scene).toContain('box(0.14, 0.14, 24.8, mats.woodLight, railX, 0.66, 2.2)');
    expect(scene).toContain('box(0.1, 0.09, 24.8, mats.goldBright, railX, 0.79, 2.2)');
    expect(scene).toContain('sphere(0.075, mats.goldBright, railX, 1.02, z, 1, 0.7, 1)');
  });

  it('separates the 3D footer into independent floating console panels', () => {
    expect(css).toContain('3D HUD refinement: split the legacy footer');
    expect(css).toContain('.stage-9x16.temple-3d-mode .hud-left-col::before');
    expect(css).toContain('.stage-9x16.temple-3d-mode .hud-right-leaderboard::before');
    expect(css).toContain('height: 276px;');
    expect(css).toContain('background: transparent;');
  });

  it('cache-busts the live stylesheet so the 3D HUD redesign reaches browsers', () => {
    const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
    expect(html).toContain('/css/live.css?v=3d-ritual-console-20261101-6');
  });

  it('replaces the compact legacy cards with a sculpted 3D broadcast console', () => {
    expect(css).toContain('3D BROADCAST INTERFACE');
    expect(css).toContain('.stage-9x16.temple-3d-mode .bottom-hud-bar');
    expect(css).toContain('height: 218px;');
    expect(css).toContain('border-radius: 22px 8px 22px 8px;');
    expect(css).toContain('.stage-9x16.temple-3d-mode .hud-gift-card:hover');
    expect(css).toContain('font-size: 38px;');
    expect(css).toContain('.stage-9x16.temple-3d-mode .hud-right-leaderboard');
    expect(css).toContain('height: 188px;');
  });

  it('builds a distinct ceremonial 3D interaction console without changing 2D markup behavior', () => {
    const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
    expect(html).toContain('hud-panel-kicker');
    expect(html).toContain('NGHI LỄ • CÚNG DƯỜNG');
    expect(css).toContain('.stage-9x16.temple-3d-mode .hud-panel-kicker');
    expect(css).toContain('.stage-9x16.temple-3d-mode .hud-gift-card:nth-child(3)::before');
    expect(css).toContain('.stage-9x16.temple-3d-mode .leader-item:first-child .leader-rank');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('models the bell, wooden fish and fortune cylinder as 3D sanctuary props', async () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('function makeRitualStation(x, z, kind)');
    expect(scene).toContain("makeRitualStation(-3.75, -1.2, 'bell')");
    expect(scene).toContain("makeRitualStation(3.75, -1.2, 'woodfish')");
    expect(scene).toContain("makeRitualStation(3.75, -5.4, 'fortune')");
    expect(scene).toContain('const ritualStations = [];');
    expect(scene).toContain('camera.position.set(0, 10.5, 23);');
    expect(scene).toContain('camera.lookAt(0, 4.4, -5.5);');
  });

  it('makes modeled ritual stations directly clickable through raycasting', async () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('new THREE.Raycaster()');
    expect(scene).toContain('ritualRaycaster.intersectObjects(ritualHitMeshes, false)');
    expect(scene).toContain("bell: 'ringBell'");
    expect(scene).toContain("woodfish: 'strikeWoodenFish'");
    expect(scene).toContain("fortune: 'drawFortune'");
    expect(scene).toContain("canvas.addEventListener('pointerup', onWorldPointerUp)");
    expect(scene).toContain("canvas.addEventListener('pointermove', onWorldPointerMove");
    expect(scene).toContain("window.dispatchEvent(new CustomEvent('temple:ritual'");
    expect(scene).toContain('canvas.removeEventListener(\'pointerup\', onWorldPointerUp)');
    expect(scene).toContain('canvas.removeEventListener(\'pointermove\', onWorldPointerMove)');
  });

  it('requires pointer down and pointer up on the same station before firing a ritual', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('let pressedRitualStation = null;');
    expect(scene).toContain("canvas.addEventListener('pointerdown', onWorldPointerDown)");
    expect(scene).toContain('if (!station || station !== pressedStation) return;');
    expect(scene).toContain("canvas.addEventListener('pointercancel', onWorldPointerCancel)");
    expect(scene).toContain("canvas.removeEventListener('pointerdown', onWorldPointerDown)");
    expect(scene).toContain("canvas.removeEventListener('pointercancel', onWorldPointerCancel)");
  });

  it('animates each physical ritual prop when its matching ritual event fires', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain("station.userData.ritualKind = kind;");
    expect(scene).toContain('station.userData.animation.bellPivot = bellPivot');
    expect(scene).toContain('station.userData.animation.malletPivot = malletPivot');
    expect(scene).toContain('station.userData.animation.fortuneDrum = fortuneDrum');
    expect(scene).toContain("ringBell: 'bell'");
    expect(scene).toContain("strikeWoodenFish: 'woodfish'");
    expect(scene).toContain("drawFortune: 'fortune'");
    expect(scene).toContain('animation.bellPivot.rotation.z = Math.sin(progress * Math.PI * 8)');
    expect(scene).toContain('animation.malletPivot.rotation.z = Math.sin(progress * Math.PI * 4)');
    expect(scene).toContain('animation.fortuneDrum.rotation.y = Math.PI * 2 * 3 * spinEase');
    expect(scene).toContain('updateRitualStationAnimations(now)');
  });

  it('enables pointer and touch input only for the active 3D canvas', () => {
    const canvasRule = css.slice(css.lastIndexOf('.stage-9x16.temple-3d-mode #temple3dCanvas'));
    expect(canvasRule).toContain('pointer-events: auto;');
    expect(canvasRule).toContain('touch-action: manipulation;');
    const baseCanvas = css.slice(css.indexOf('#temple3dCanvas {'), css.indexOf('#temple3dCanvas[hidden]'));
    expect(baseCanvas).toContain('pointer-events: none;');
  });

  it('places ritual feedback at the visible 3D station coordinates', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain("makeRing(-3.75, 1.85, -1.2, 0xffe18a)");
    expect(scene).toContain('makeRing(3.75, 0.9, -1.2)');
    expect(scene).toContain('makeRing(3.75, 0.85, -5.4, 0xffdf83)');
  });

  it('keeps the procedural statue as fallback and gates local GLB replacement behind models=1', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain("get('models') === '1'");
    expect(scene).toContain("loadGLTFAsset('/assets/models/buddha-selected.glb'");
    expect(scene).toContain('if (disposed) {');
    expect(scene).toContain('statue.add(asset.root)');
    expect(scene).toContain('Optional Buddha GLB unavailable; keeping procedural statue');
    expect(scene).toContain('const statue = new THREE.Group()');
  });

  it('normalizes bundled GLB assets and keeps GLTFLoader lazy-loaded', () => {
    const loader = readFileSync(new URL('../public/js/three-model-loader.js', import.meta.url), 'utf8');
    expect(loader).toContain("url.startsWith('/assets/models/')");
    expect(loader).toContain("import('three/addons/loaders/GLTFLoader.js')");
    expect(loader).toContain('root.scale.setScalar(scale)');
    expect(loader).toContain('-normalizedBounds.min.y');
    expect(loader).toContain('disposeThreeSceneResources(root)');
  });

  it('recognizes common Mixamo and side-suffixed GLB bone naming conventions', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain("leftArm: ['leftupperarm', 'leftarm', 'upperarmleft', 'armleft', 'upperarml', 'arml', 'lupperarm', 'larm', 'jbiplupperarm']");
    expect(scene).toContain("rightArm: ['rightupperarm', 'rightarm', 'upperarmright', 'armright', 'upperarmr', 'armr', 'rupperarm', 'rarm', 'jbiprupperarm']");
    expect(scene).toContain("leftLeg: ['leftupperleg', 'leftupleg', 'leftthigh', 'leftleg', 'upperlegleft', 'thighleft', 'upperlegl', 'thighl', 'legl', 'lupperleg', 'lthigh', 'lleg', 'jbiplupperleg']");
    expect(scene).toContain("rightLeg: ['rightupperleg', 'rightupleg', 'rightthigh', 'rightleg', 'upperlegright', 'thighright', 'upperlegr', 'thighr', 'legr', 'rupperleg', 'rthigh', 'rleg', 'jbiprupperleg']");
    expect(scene).toContain('const aliasIndex = aliases.findIndex((alias) => name === alias || name.endsWith(alias));');
  });

  it('supports VRM J_Bip and Unity-style side-prefixed bone names', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain("'lupperarm', 'larm'");
    expect(scene).toContain("'rupperarm', 'rarm'");
    expect(scene).toContain("'lupperleg', 'lthigh', 'lleg'");
    expect(scene).toContain("'rupperleg', 'rthigh', 'rleg'");
    expect(scene).toContain("'spine01', 'spine1', 'spine02', 'spine2'");
  });

  it('maps VRM J_Bip central and limb bones and keeps neck separate for bowing', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain("spine: ['spine', 'spine01', 'spine1', 'spine02', 'spine2', 'chest', 'upperbody', 'jbipcspine', 'jbipcchest']");
    expect(scene).toContain("neck: ['neck', 'jbipcneck']");
    expect(scene).toContain("'jbipchead'");
    expect(scene).toContain("'jbiplupperarm'");
    expect(scene).toContain("'jbiprupperarm'");
    expect(scene).toContain("'jbiplupperleg'");
    expect(scene).toContain("'jbiprupperleg'");
    expect(scene).toContain('neckRest: bones.neck?.rotation.clone()');
    expect(scene).toContain('rig.neck.rotation.x = rig.neckRest.x - amount * 0.12;');
  });

  it('selects the strongest bone alias instead of relying on GLB traversal order', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const boneScores = {};');
    expect(scene).toContain('const aliasIndex = aliases.findIndex((alias) => name === alias || name.endsWith(alias));');
    expect(scene).toContain('const exact = name === aliases[aliasIndex];');
    expect(scene).toContain('const score = (exact ? 20000 : 10000) - aliasIndex * 100 + aliases[aliasIndex].length;');
    expect(scene).toContain("if (score > (boneScores[slot] || 0))");
    expect(scene).toContain("'rig:', Object.fromEntries(Object.entries(allHumanAvatars[0]?.gltfRig || {})");
  });

  it('diagnoses ordered GLB leg chains and measures world-space segment lengths', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const inspectLegChain = (upper, lower, foot) => {');
    expect(scene).toContain('!descendsFrom(lower, upper) || !descendsFrom(foot, lower)');
    expect(scene).toContain('model.updateWorldMatrix(true, true);');
    expect(scene).toContain('upperLength: Number(upperPosition.distanceTo(lowerPosition).toFixed(4))');
    expect(scene).toContain('lowerLength: Number(lowerPosition.distanceTo(footPosition).toFixed(4))');
    expect(scene).toContain('left: allHumanAvatars[0]?.gltfRig?.leftLegChain');
    expect(scene).toContain('right: allHumanAvatars[0]?.gltfRig?.rightLegChain');
    expect(scene).toContain('do not enable world-space IK until the');
  });

  it('reports available GLB animation names, duration, tracks and targets', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain("'available clips:', animations.map((clip) => ({");
    expect(scene).toContain("name: clip.name || '(unnamed)'");
    expect(scene).toContain('duration: Number.isFinite(clip.duration)');
    expect(scene).toContain('tracks: clip.tracks.length');
    expect(scene).toContain("track.name.split('.')[0]");
  });

  it('recognizes descriptive locomotion, rest and prostration clip names', () => {
    const clips = [
      { name: 'Standing Idle' },
      { name: 'Walk Forward' },
      { name: 'Prayer-Kneel' }
    ];
    const actions = findBestAnimationClip(clips);
    expect(actions.idle).toBe(clips[0]);
    expect(actions.walk).toBe(clips[1]);
    expect(actions.bow).toBe(clips[2]);
  });

  it('blends fallback gait smoothly and restores the rig pose after walking', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('function applyGLTFFallbackWalk(avatar, gaitPhase, weight = 1)');
    expect(scene).toContain("import { getFootPlantingPose, getFootPlantingStep, getHumanFootPose, getHumanUpperPose, getRitualPoseState, getGiftReactionBlend } from './three-gait-utils.js';");
    expect(scene).toContain('const leftStep = getFootPlantingStep(gaitPhase + avatar.phase);');
    expect(scene).toContain('const rightStep = getFootPlantingStep(gaitPhase + avatar.phase + Math.PI);');
    expect(scene).toContain('const leftKnee = new THREE.Group(); leftKnee.position.y = -0.24; leftLeg.add(leftKnee);');
    expect(scene).toContain('const rightKnee = new THREE.Group(); rightKnee.position.y = -0.24; rightLeg.add(rightKnee);');
    expect(scene).toContain('avatar.leftKnee.rotation.x = leftFootPose.kneeRotationX;');
    expect(scene).toContain('avatar.leftFoot.position.y = -0.24 + leftFootPose.footLift;');
    expect(scene.match(/avatar\.root\.position\.y = walking \? 0/g)).toHaveLength(1);
    expect(scene).toContain('leftKnee: bones.leftKnee');
    expect(scene).toContain('leftFoot: bones.leftFoot');
    expect(scene).toContain('rig.leftKnee.rotation.x = base(rig.leftKnee, rig.leftKneeRest) + leftPose.kneeFlex * weight;');
    expect(scene).toContain('const walkTarget = walking && !avatar.gltfActions?.walk ? 1 : 0;');
    expect(scene).toContain('const walkBlend = 1 - Math.exp(-delta / 0.16);');
    expect(scene).toContain('avatar.gltfWalkBlend += (walkTarget - avatar.gltfWalkBlend) * walkBlend;');
    expect(scene).toContain('applyGLTFFallbackWalk(avatar, gaitPhase, avatar.gltfWalkBlend)');
    expect(scene).toContain('const base = (bone, rest) => avatar.gltfActions?.idle ? bone?.rotation.x : rest?.x;');
    expect(scene).toContain('avatar.gltfWalkBlend = 0;');
    expect(scene).toContain('function animateHuman(avatar, time, walking = false, walkPhase = null)');
    expect(scene).toContain('const gaitPhase = Number.isFinite(walkPhase) ? walkPhase : time * 0.009;');
    expect(scene).toContain('const eased = travel * travel * (3 - 2 * travel);');
    expect(scene).toContain('const walkPhase = (eased * 11.2 / 2.2) * Math.PI * 2;');
  });

  it('returns a manually posed GLB bow to rest when the bow state ends', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('if (!avatar.gltfActions?.bow) applyHumanBow(avatar, avatar.bowing ? avatar.bowAmount : 0);');
    expect(scene).toContain('rig.spine.rotation.x = rig.spineRest.x - amount * 0.46;');
    expect(scene).toContain('rig.head.rotation.x = rig.headRest.x + amount * 0.16;');
  });

  it('does not fade an animation action out against itself when states share a fallback clip', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    const start = scene.indexOf('function playGLTFHumanAction(avatar, mode)');
    const end = scene.indexOf('function applyHumanBow(', start);
    const action = scene.slice(start, end);
    expect(action).toContain('avatar.gltfCurrentClip === clip');
    expect(action).toContain('current.setLoop(isBow ? THREE.LoopOnce : THREE.LoopRepeat');
    expect(action).toContain('current.stopFading().setEffectiveWeight(1);');
    expect(action).toContain('next.stopFading().setEffectiveWeight(1);');
    expect(action).toContain('if (current && current !== next) current.stopFading().fadeOut(0.18);');
    expect(action).toContain('avatar.gltfCurrentClip = clip;');
    expect(action).toContain('avatar.gltfCurrentAction?.stopFading().fadeOut(0.18);');
    expect(scene).toContain('avatar.gltfCurrentClip = null;');
  });

  it('keeps the hidden source GLB in the scene so cloned avatar resources have one disposal owner', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    const start = scene.indexOf('async function upgradeDevoteesFromGLB()');
    const end = scene.indexOf('function animateHuman(', start);
    const loader = scene.slice(start, end);
    expect(loader).toContain('asset.root.visible = false;');
    expect(loader).toContain('world.add(asset.root);');
    expect(loader.indexOf('world.add(asset.root);')).toBeLessThan(loader.indexOf('clone(asset.root)'));
    expect(loader).toContain('SkeletonUtils');
  });

  it('supports optional rigged devotee GLBs while preserving procedural fallback', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain("loadGLTFAsset('/assets/models/devotee-selected.glb'");
    expect(scene).toContain("import('three/addons/utils/SkeletonUtils.js')");
    expect(scene).toContain('allHumanAvatars.map(() => clone(asset.root))');
    expect(scene).toContain('new THREE.AnimationMixer(model)');
    expect(scene).toContain('findBestAnimationClip(animations)');


    expect(scene).toContain('function applyHumanBow(avatar, amount, kneelBlend = 0)');
    expect(scene).toContain("Optional devotee GLB unavailable; keeping procedural characters");
    expect(scene).toContain('void upgradeDevoteesFromGLB()');
  });

  it('keeps the vignette below the live HUD layer', () => {
    const overlay = css.slice(css.lastIndexOf('.stage-9x16.temple-3d-mode::after'));
    const hudLayer = css.slice(0, css.lastIndexOf('.stage-9x16.temple-3d-mode::after'));
    expect(overlay).toContain('z-index: 2;');
    expect(hudLayer).toContain('.stage-9x16.temple-3d-mode .minimal-top-bar');
    expect(hudLayer).toContain('.stage-9x16.temple-3d-mode .bottom-hud-bar');
    expect(hudLayer).toContain('z-index: 30;');
  });

  it('adds the antique-brass perimeter frame only to the 3D stage', () => {
    expect(css).toContain('.stage-9x16.temple-3d-mode::before');
    expect(css).toContain('inset: 16px;');
    expect(css).toContain('border: 3px solid rgba(186, 137, 51, .82);');
    expect(css).toContain('border-radius: 34px;');
    expect(css).toContain('pointer-events: none;');
  });

  it('uses warm ivory stone for the Buddha and the aureole in the reference palette', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('color: 0xbdb29c');
    expect(scene).toContain('color: 0x76674f');
    expect(scene).toContain('color: 0xe5d8bf');
    expect(scene).toContain('color:0xa59a83');
  });


  it('builds layered red side altar niches with gilded inner mouldings', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('box(1.34, 3.55, 0.05, mats.redBright, x, 4.05, -10.90)');
    expect(scene).toContain('box(0.065, 3.68, 0.1, mats.gold, x + side * 0.72, 4.05, -10.78)');
    expect(scene).toContain('box(1.5, 0.075, 0.1, mats.goldBright, x, y, -10.78)');
    expect(scene).toContain('sphere(0.075, mats.goldBright, x + side * 0.72, y, -10.69, 1, 1, 0.55)');
  });


  it('finishes the offering table with a lacquered front apron and gilded seal', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('box(5.32, 0.3, 0.12, mats.redBright, 0, 1.38, 0.755, offeringTable)');
    expect(scene).toContain('box(5.28, 0.035, 0.15, mats.goldBright, 0, 1.55, 0.765, offeringTable)');
    expect(scene).toContain('const tableSeal = box(0.25, 0.25, 0.065, mats.goldBright, 0, 1.38, 0.84, offeringTable)');
    expect(scene).toContain('tableSeal.rotation.z = Math.PI / 4;');
  });


  it('softens shadow acne and animates independent warm temple light sources', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('key.shadow.bias = -0.00018; key.shadow.normalBias = 0.025; key.shadow.radius = 3;');
    expect(scene).toContain('buddhaLight.intensity = 33 + Math.sin(elapsed * 0.0018) * 1.6;');
    expect(scene).toContain('altarFill.intensity = 17 + Math.sin(elapsed * 0.0045 + 0.8) * 2.2;');
    expect(scene).toContain('Math.sin(elapsed * 0.007 + i) * 0.35');
  });

  it('keeps low-cost ambient incense wisps moving above the altar burner', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const incenseSmokeGeometry = new THREE.SphereGeometry(0.105, 8, 6)');
    expect(scene).toContain('const incenseWisps = Array.from({ length: 6 }');
    expect(scene).toContain('function updateIncenseWisps(time)');
    expect(scene).toContain('wisp.material.opacity = 0.105 * envelope');
    expect(scene).toContain('updateIncenseWisps(now);');
  });

  it('adds restrained per-tile color variation without increasing the courtyard draw-call count', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const tilePalette = index === 0');
    expect(scene).toContain('instances.setColorAt(instanceIndex, tileColors[paletteIndex])');
    expect(scene).toContain('if (instances.instanceColor) instances.instanceColor.needsUpdate = true;');
    expect(scene).toContain('new THREE.InstancedMesh(tileGeometry, material, tilePositions[index].length)');
  });

  it('builds two instanced lotus tiers from a curved tapered petal mesh', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('function createLotusPetalGeometry()');
    expect(scene).toContain('geometry.computeVertexNormals();');
    expect(scene).toContain('new THREE.InstancedMesh(lotusPetalGeometry, mats.redBright, redCount)');
    expect(scene).toContain('new THREE.InstancedMesh(lotusPetalGeometry, mats.goldBright, goldCount)');
    expect(scene).toContain('createLotusPetalRing(16, 1.46, 0.02, 1.0, 0.1)');
    expect(scene).toContain('createLotusPetalRing(12, 1.12, 0.1, 0.78, 0.06)');
    expect(scene).toContain('petals.instanceMatrix.setUsage(THREE.StaticDrawUsage)');
  });

  it('finishes the Buddha pedestal with static brass mouldings and a beaded red tier', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const pedestalTrimGeometry = new THREE.TorusGeometry(1.94, 0.026, 8, 64)');
    expect(scene).toContain('new THREE.InstancedMesh(pedestalTrimGeometry, mats.goldBright, 2)');
    expect(scene).toContain('pedestalTrim.instanceMatrix.setUsage(THREE.StaticDrawUsage)');
    expect(scene).toContain('new THREE.InstancedMesh(pedestalStudGeometry, mats.goldBright, 32)');
    expect(scene).toContain('pedestalStuds.instanceMatrix.setUsage(THREE.StaticDrawUsage)');
    expect(scene).toContain('pedestalTrim.castShadow = false;');
    expect(scene).toContain('pedestalStuds.castShadow = false;');
    expect(scene).toContain('world.add(pedestalTrim);');
    expect(scene).toContain('world.add(pedestalStuds);');
  });


  it('renders the Buddha hair curls as one static instanced batch', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const hairCurlRows = [9, 7, 5, 3]');
    expect(scene).toContain('const hairCurlCount = hairCurlRows.reduce((total, count) => total + count, 0)');
    expect(scene).toContain('new THREE.SphereGeometry(0.075, 24, 16)');
    expect(scene).toContain('new THREE.InstancedMesh(hairCurlGeometry, mats.statueShadow, hairCurlCount)');
    expect(scene).toContain('hairCurls.instanceMatrix.setUsage(THREE.StaticDrawUsage)');
    expect(scene).toContain('hairCurls.castShadow = true;');
    expect(scene).toContain('hairCurls.receiveShadow = false;');
    expect(scene).toContain('statue.add(hairCurls);');
    expect(scene).not.toContain('sphere(0.075,mats.statueShadow');
  });


  it('adds a raised stone robe hem with a recessed shadow groove', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const robeHemCurve = new THREE.CatmullRomCurve3([');
    expect(scene).toContain('new THREE.TubeGeometry(robeHemCurve, 48, 0.032, 8, false)');
    expect(scene).toContain('mats.statueLight');
    expect(scene).toContain('const robeHemGrooveCurve = new THREE.CatmullRomCurve3(');
    expect(scene).toContain('new THREE.TubeGeometry(robeHemGrooveCurve, 48, 0.014, 6, false)');
    expect(scene).toContain('robeHem.castShadow = true;');
    expect(scene).toContain('robeHemGroove.castShadow = false;');
    expect(scene).toContain('statue.add(robeHem);');
    expect(scene).toContain('statue.add(robeHemGroove);');
  });


  it('adds paired carved seams and ivory ridges over both Buddha shoulders', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const shoulderSeam = [');
    expect(scene).toContain('robeFold(shoulderSeam, 0.016);');
    expect(scene).toContain('new THREE.TubeGeometry(shoulderRidge, 32, 0.01, 6, false)');
    expect(scene).toContain('mats.statueLight');
    expect(scene).toContain('ridgeMesh.castShadow = false;');
    expect(scene).toContain('statue.add(ridgeMesh);');
  });


  it('adds two restrained diagonal robe folds across the Buddha chest', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('Two restrained chest folds follow the robe diagonally toward the lap.');
    expect(scene).toContain('robeFold([[-0.38,3.28,0.69],[-0.12,3.18,0.77],[0.16,3.04,0.75],[0.39,2.9,0.67]],0.018);');
    expect(scene).toContain('robeFold([[-0.3,3.12,0.73],[-0.04,3.02,0.79],[0.22,2.88,0.73],[0.43,2.76,0.62]],0.014);');
  });


  it('adds subtle finger creases and a raised thumb contour to the Buddha mudra', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('Fine finger creases define the joined hands without changing the meditation pose.');
    expect(scene).toContain('for (let finger = 0; finger < 3; finger++)');
    expect(scene).toContain('], 0.008);');
    expect(scene).toContain('A soft raised contour separates the thumbs at the centre of the mudra.');
    expect(scene).toContain('statueLine([[-0.12,2.79,0.88],[0,2.84,0.9],[0.12,2.79,0.88]],0.012,mats.statueLight);');
  });


  it('adds restrained lower eyelid, cheek and lower-lip details to the Buddha face', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('Lower eyelids and cheek transitions soften the serene carved expression.');
    expect(scene).toContain('], 0.012, mats.statueLight);');
    expect(scene).toContain('], 0.014, mats.statueShadow);');
    expect(scene).toContain('A restrained lower-lip crease adds definition without a pronounced smile.');
    expect(scene).toContain('statueLine([[-0.105,4.27,0.685],[0,4.255,0.715],[0.105,4.27,0.685]],0.009,mats.statueLight);');
  });


  it('adds carved inner-ear grooves and fine temple arcs to the Buddha head', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('Shallow inner-ear grooves make the elongated stone ears read as sculpted forms.');
    expect(scene).toContain('[side * 0.64, 4.68, 0.105]');
    expect(scene).toContain('], 0.012);');
    expect(scene).toContain('Fine temple arcs connect the curled cap to the head silhouette.');
    expect(scene).toContain('], 0.014, mats.statueLight);');
  });


  it('adds a lightweight deterministic mineral grain bump map to Buddha stone materials', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('A tiny deterministic grayscale bump tile gives the carved stone a restrained mineral grain.');
    expect(scene).toContain('new Uint8Array(stoneGrainSize * stoneGrainSize * 4)');
    expect(scene).toContain('new THREE.DataTexture(');
    expect(scene).toContain('stoneGrain.repeat.set(3, 3);');
    expect(scene).toContain('material.bumpMap = stoneGrain;');
    expect(scene).toContain('material.bumpScale = material === mats.statueStone ? 0.022 : 0.012;');
  });


  it('adds a restrained curved neckline and collar ridge to blend the Buddha neck into the shoulders', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('A shallow curved neckline softens the join between neck, shoulders and chest.');
    expect(scene).toContain('new THREE.TubeGeometry(necklineCurve, 32, 0.018, 6, false)');
    expect(scene).toContain('new THREE.TubeGeometry(collarRidgeCurve, 32, 0.01, 6, false)');
    expect(scene).toContain('neckline.castShadow = false;');
    expect(scene).toContain('collarRidge.castShadow = false;');
  });


  it('uses one continuous paired robe contour from shoulder toward the resting hands', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('One continuous shoulder-to-hand robe contour avoids stacked parallel seams.');
    expect(scene).toContain('const shoulderSeam = [');
    expect(scene).toContain('[side * 0.34, 2.78, 0.68]');
    expect(scene).toContain('robeFold(shoulderSeam, 0.016);');
    expect(scene).toContain('new THREE.TubeGeometry(shoulderRidge, 32, 0.01, 6, false)');
    expect(scene).toContain('ridgeMesh.castShadow = false;');
    expect(scene).not.toContain('const armEdge = [');
  });


  it('adds restrained paired robe creases at the Buddha elbows', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('Small paired elbow creases connect the upper-arm drape to the resting forearms.');
    expect(scene).toContain('const elbowCrease = [');
    expect(scene).toContain('robeFold(elbowCrease, 0.012);');
    expect(scene).toContain('new THREE.TubeGeometry(elbowRidgeCurve, 16, 0.008, 6, false)');
    expect(scene).toContain('elbowRidge.castShadow = false;');
    expect(scene).toContain('statue.add(elbowRidge);');
  });


});
  it('eases the devotee bow pose smoothly into and out of the ritual', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const ritualPose = getRitualPoseState({');
    expect(scene).toContain('elapsedAfterArrival: devoteeState.arrivedAt ? now - devoteeState.arrivedAt : 0,');
    expect(scene).toContain('remainingMs: ritualUntil - now');
    expect(scene).toContain('mainHuman.kneelBlend = ritualPose.kneelBlend;');
    expect(scene).toContain('applyHumanBow(mainHuman, ritualPose.bowAmount, ritualPose.kneelBlend);');
  });

  it('routes procedural avatars through the shared idle, walk and kneel foot-pose controller', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain("import { getFootPlantingPose, getFootPlantingStep, getHumanFootPose, getHumanUpperPose, getRitualPoseState, getGiftReactionBlend }");
    expect(scene).toContain("const footMode = walking ? 'walk' : avatar.kneeling ? 'kneel' : 'idle';");
    expect(scene).toContain("getHumanFootPose({ mode: footMode, phase: gaitPhase + avatar.phase, blend: footMode === 'kneel' ? avatar.kneelBlend : 1 });");
    expect(scene).toContain("getHumanFootPose({ mode: footMode, phase: gaitPhase + avatar.phase + Math.PI, blend: footMode === 'kneel' ? avatar.kneelBlend : 1 });");
    expect(scene).toContain('avatar.leftFoot.position.y = -0.24 + leftFootPose.footLift;');
  });

  it('retains hidden procedural fallbacks without disposing shared cached geometry', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('for (const child of avatar.root.children) child.visible = false;');
    expect(scene).toContain('for (const child of statue.children) child.visible = false;');
    expect(scene).not.toContain('disposeThreeObjectTree(child)');
    expect(scene).not.toContain('node.geometry.dispose()');
  });

