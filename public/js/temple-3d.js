import { disposeThreeObjectTree, disposeThreeSceneResources } from './three-resource-utils.js';
import { getFootPlantingPose, getFootPlantingStep, getHumanUpperPose, getRitualPoseState, getScheduledGiftReactionBlend, getWalkBodyPose, getDistanceBasedGaitPhase, getHumanFootTransitionPose } from './three-gait-utils.js';
import { getTempleRenderProfile } from './temple-render-quality.js';
import { createTempleEnvironment } from './temple-environment.js';
import { resolveGiftAction, resolveGiftVfxProfile } from './gift-action-rules.js';
import { createAoDaiAvatarVariants, getAoDaiAppearance } from './ao-dai-avatar.js';
import { getAvailableFormationSlot, getCrowdNameTagLayout, getQueueActorFormationPosition, getQueueActorEntryPosition, createQueueWorshipLedger, MAX_CONCURRENT_WORSHIPPERS, MAX_VISIBLE_QUEUE_ACTORS, getQueueActorFormationSlots, WAITING_SEAT_COLUMNS, WAITING_SEAT_ROWS } from './devotee-formation.js';
import { formatDevoteePrayerLabel } from './devotee-labels.js';
import { TEMPLE_CAMERA_RITUAL_PRESETS, getTempleCameraShotFrame } from './temple-camera-presets.js';

/**
 * Full 3D temple world. The 2D artwork remains the fallback, but is hidden
 * while this world is active. Coordinates are world-space, not screen-space.
 */
const enabled = new URLSearchParams(location.search).get('3d') === '1';
const stage = document.getElementById('stage9x16');
const canvas = document.getElementById('temple3dCanvas');

if (enabled && stage && canvas) {
  stage.classList.add('temple-3d-mode');
  boot().catch((error) => {
    const failure = {
      name: error?.name || 'Error',
      message: error?.message || String(error),
      stack: error?.stack || null,
      failedAt: new Date().toISOString()
    };
    // Keep the actual boot failure visible to the browser audit and support
    // diagnostics. A warning alone was silently discarded by the visual audit.
    window.__TEMPLE_3D_BOOT_ERROR__ = failure;
    console.error('[Temple3D] World boot failed; restoring 2D scene:', failure);
    stage.classList.remove('temple-3d-mode');
    canvas.hidden = true;
    window.__TEMPLE_3D_READY__ = false;
    window.dispatchEvent(new Event('temple:3d-unavailable'));
  });
}

async function boot() {
  const THREE = await import('three');
  // Read optional skin configuration before any avatar is constructed below.
  // makeHumanAvatar() is called before the later model-loading section.
  const devoteeModelsRequested = new URLSearchParams(location.search).get('devoteeModels') === '1';
  const renderProfile = getTempleRenderProfile({
    devicePixelRatio: window.devicePixelRatio || 1,
    deviceMemory: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency
  });
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: true,
    powerPreference: 'high-performance',
    // Only CI's explicit profileAudit path preserves the last WebGL frame so
    // the audit can capture the transient five-worshipper moment directly.
    preserveDrawingBuffer: new URLSearchParams(location.search).has('profileAudit')
  });
  renderer.setPixelRatio(renderProfile.pixelRatio);
  renderer.setSize(1080, 1920, false);
  // Cache the device limit once; reuse it for image and procedural textures.
  const maxTextureAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  renderer.setClearColor(0x160904, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x705a43);
  scene.fog = new THREE.FogExp2(0x766047, 0.0075);
  const camera = new THREE.PerspectiveCamera(42, 1080 / 1920, 0.1, 140);
  const cameraHomePosition = new THREE.Vector3(0, 11.75, 28.5);
  const cameraHomeTarget = new THREE.Vector3(0, -1.5, -5.5);
  const cameraHomeFov = 42;
  const cameraRitualFov = 38.5;
  const cameraShotBlendMs = 720;
  camera.position.copy(cameraHomePosition);
  camera.lookAt(cameraHomeTarget);
  // Camera director: a shot is an independent action with its own path,
  // subject, runtime and hand-off. Only one shot action owns the camera at a time.
  const cameraShotDefinitions = TEMPLE_CAMERA_RITUAL_PRESETS;
  let cameraPresetCursor = -1;
  let activeCameraPresetIndex = -1;
  let activeCameraPreset = null;
  let cameraActionStartedAt = 0;
  let cameraActionEndsAt = 0;
  let cameraTargetPosition = cameraHomePosition.clone();
  let cameraTargetLookAt = cameraHomeTarget.clone();
  let cameraTargetFov = cameraHomeFov;
  let cameraRitualActive = false;
  let activeCameraShot = 'idle';
  let activeCameraAction = 'idle';
  let activeCameraSubject = 'temple';
  let activeCameraProgress = 0;

  function getNextCameraPresetIndex() {
    const count = cameraShotDefinitions.length;
    if (count <= 1) return 0;
    return cameraPresetCursor < 0
      ? Math.floor(Math.random() * count)
      : (cameraPresetCursor + 1) % count;
  }

  function beginCameraShot(index, now = performance.now(), mode = 'ambient') {
    const count = cameraShotDefinitions.length;
    const safeIndex = ((Math.trunc(index) % count) + count) % count;
    activeCameraPresetIndex = safeIndex;
    cameraPresetCursor = safeIndex;
    activeCameraPreset = cameraShotDefinitions[safeIndex];
    cameraActionStartedAt = now;
    cameraActionEndsAt = now + activeCameraPreset.durationMs;
    activeCameraAction = activeCameraPreset.action;
    activeCameraSubject = activeCameraPreset.subject;
    activeCameraProgress = 0;
    activeCameraShot = mode + ':' + activeCameraPreset.name;
  }

  function beginAmbientCameraShot(now = performance.now(), force = false) {
    if (cameraRitualActive || (!force && now < cameraActionEndsAt)) return;
    beginCameraShot(getNextCameraPresetIndex(), now, 'ambient');
  }

  function beginRitualCamera() {
    let nextIndex = Math.floor(Math.random() * cameraShotDefinitions.length);
    if (cameraShotDefinitions.length > 1 && nextIndex === cameraPresetCursor) {
      nextIndex = (nextIndex + 1) % cameraShotDefinitions.length;
    }
    cameraRitualActive = true;
    beginCameraShot(nextIndex, performance.now(), 'ritual');
  }

  function restoreMainCamera() {
    const wasRitualActive = cameraRitualActive;
    cameraRitualActive = false;
    // Continue with a new independent ambient action, never snap to a fixed home angle.
    if (wasRitualActive || cameraActionEndsAt === 0) {
      beginAmbientCameraShot(performance.now(), true);
    }
  }

  function updateRitualCamera(dt, now = performance.now()) {
    const blend = 1 - Math.exp(-Math.min(50, dt) / cameraShotBlendMs);
    if (!cameraRitualActive) {
      beginAmbientCameraShot(now);
    } else if (now >= cameraActionEndsAt) {
      // Each action completes before the next shot takes control.
      beginCameraShot(getNextCameraPresetIndex(), now, 'ritual');
    }

    if (!activeCameraPreset) return;
    const actionElapsed = Math.max(0, now - cameraActionStartedAt);
    const subjectPosition = devoteeState?.active && mainDevotee?.visible
      ? [mainDevotee.position.x, mainDevotee.position.y, mainDevotee.position.z]
      : null;
    const shotFrame = getTempleCameraShotFrame(activeCameraPreset, actionElapsed, {
      subjectPosition
    });
    activeCameraProgress = shotFrame.progress;
    activeCameraAction = shotFrame.action;
    activeCameraSubject = shotFrame.subject;
    cameraTargetPosition.set(...shotFrame.position);
    cameraTargetLookAt.set(...shotFrame.lookAt);
    cameraTargetFov = shotFrame.fov;

    camera.position.lerp(cameraTargetPosition, blend);
    const lookTarget = camera.userData.lookTarget || (camera.userData.lookTarget = cameraHomeTarget.clone());
    lookTarget.lerp(cameraTargetLookAt, blend);
    camera.fov += (cameraTargetFov - camera.fov) * blend;
    if (Math.abs(camera.fov - cameraTargetFov) > 0.015) camera.updateProjectionMatrix();
    camera.lookAt(lookTarget);
    camera.userData.shotName = activeCameraShot;
    camera.userData.shotPreset = activeCameraPreset.name;
    camera.userData.shotAction = activeCameraAction;
    camera.userData.shotSubject = activeCameraSubject;
    camera.userData.shotProgress = activeCameraProgress;
    camera.userData.shotSequenceIndex = activeCameraPresetIndex;
  }
  // Runtime camera diagnostics let browser audits confirm the preset actually rendered.
  window.__TEMPLE_CAMERA_DIAGNOSTIC__ = () => ({
    active: cameraRitualActive,
    mode: cameraRitualActive ? 'ritual' : 'ambient',
    phase: devoteeState.phase,
    shotName: camera.userData.shotName || 'idle',
    preset: camera.userData.shotPreset || 'idle',
    action: camera.userData.shotAction || 'idle',
    subject: camera.userData.shotSubject || 'temple',
    actionProgress: Number((camera.userData.shotProgress || 0).toFixed(3)),
    sequenceIndex: Number.isInteger(camera.userData.shotSequenceIndex) ? camera.userData.shotSequenceIndex : -1,
    fov: Number(camera.fov.toFixed(2)),
    position: { x: Number(camera.position.x.toFixed(3)), y: Number(camera.position.y.toFixed(3)), z: Number(camera.position.z.toFixed(3)) },
    lookAt: camera.userData.lookTarget ? { x: Number(camera.userData.lookTarget.x.toFixed(3)), y: Number(camera.userData.lookTarget.y.toFixed(3)), z: Number(camera.userData.lookTarget.z.toFixed(3)) } : null
  });
  const mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x48200e, roughness: 0.55, metalness: 0.18 }),
    woodLight: new THREE.MeshStandardMaterial({ color: 0x79401b, roughness: 0.48, metalness: 0.25 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe6ae45, roughness: 0.3, metalness: 0.78 }),
    goldBright: new THREE.MeshStandardMaterial({ color: 0xffdf83, roughness: 0.24, metalness: 0.62, emissive: 0x70400b, emissiveIntensity: 0.25 }),
    red: new THREE.MeshPhysicalMaterial({ color: 0x741321, roughness: 0.48, metalness: 0.22, clearcoat: 0.28, clearcoatRoughness: 0.32 }),
    redBright: new THREE.MeshPhysicalMaterial({ color: 0x9d2030, roughness: 0.4, metalness: 0.3, clearcoat: 0.42, clearcoatRoughness: 0.22 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x777a7c, roughness: 0.92 }),
    statueStone: new THREE.MeshStandardMaterial({ color: 0xc28a32, roughness: 0.44, metalness: 0.68 }),
    statueShadow: new THREE.MeshStandardMaterial({ color: 0x704415, roughness: 0.52, metalness: 0.58 }),
    statueLight: new THREE.MeshStandardMaterial({ color: 0xf0c567, roughness: 0.32, metalness: 0.62 }),
    ivory: new THREE.MeshStandardMaterial({ color: 0xffe0a0, roughness: 0.35, metalness: 0.18 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xe7ad6b, roughness: 0.52 }),
    robe: new THREE.MeshStandardMaterial({ color: 0x71859a, roughness: 0.82 }),
    robeDark: new THREE.MeshStandardMaterial({ color: 0x3e5367, roughness: 0.86 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1d100b, roughness: 0.65 }),
    lotus: new THREE.MeshStandardMaterial({ color: 0xe9829a, roughness: 0.42, side: THREE.DoubleSide }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x315a35, roughness: 0.85 })
  };

  // Procedural micro-roughness breaks up the perfectly uniform finish on
  // lacquer, carved timber and gilding without adding image assets.
  const detailTextureSize = 64;
  const makeRoughnessTexture = (kind) => {
    const data = new Uint8Array(detailTextureSize * detailTextureSize * 4);
    for (let y = 0; y < detailTextureSize; y++) {
      for (let x = 0; x < detailTextureSize; x++) {
        const index = (y * detailTextureSize + x) * 4;
        const grain = (Math.sin(y * 1.17 + Math.sin(x * 0.19) * 2.2)
          + Math.sin(y * 0.37 + x * 0.11) * 0.32) * 0.5;
        const noise = ((Math.imul(x + 17, 374761393) ^ Math.imul(y + 29, 668265263)) >>> 24) / 255;
        let value;
        if (kind === 'wood') value = 178 + grain * 30 + noise * 13;
        else if (kind === 'lacquer') value = 82 + grain * 10 + noise * 9;
        else if (kind === 'stone') value = 222 + grain * 7 + noise * 10;
        else value = 112 + grain * 8 + noise * 15;
        const channel = Math.max(0, Math.min(255, Math.round(value)));
        data[index] = data[index + 1] = data[index + 2] = channel;
        data[index + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, detailTextureSize, detailTextureSize, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(kind === 'wood' ? 2 : kind === 'stone' ? 4 : 3, kind === 'wood' ? 5 : kind === 'stone' ? 4 : 3);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = maxTextureAnisotropy;
    texture.needsUpdate = true;
    return texture;
  };
  const woodRoughness = makeRoughnessTexture('wood');
  const lacquerRoughness = makeRoughnessTexture('lacquer');
  const goldRoughness = makeRoughnessTexture('gold');
  const stoneRoughness = makeRoughnessTexture('stone');
  for (const material of [mats.wood, mats.woodLight]) material.roughnessMap = woodRoughness;
  for (const material of [mats.red, mats.redBright]) material.roughnessMap = lacquerRoughness;
  for (const material of [mats.gold, mats.goldBright]) material.roughnessMap = goldRoughness;
  for (const material of [mats.statueStone, mats.statueShadow, mats.statueLight]) material.roughnessMap = stoneRoughness;
  // A tiny deterministic grayscale bump tile gives the carved stone a restrained mineral grain.
  const stoneGrainSize = 64;
  const stoneGrainData = new Uint8Array(stoneGrainSize * stoneGrainSize * 4);
  for (let y = 0; y < stoneGrainSize; y++) {
    for (let x = 0; x < stoneGrainSize; x++) {
      const index = (y * stoneGrainSize + x) * 4;
      let grain = (Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263)) | 0;
      grain = Math.imul(grain ^ (grain >>> 13), 1274126177);
      grain = (grain ^ (grain >>> 16)) & 255;
      const value = 112 + Math.round(grain * 0.28);
      stoneGrainData[index] = value;
      stoneGrainData[index + 1] = value;
      stoneGrainData[index + 2] = value;
      stoneGrainData[index + 3] = 255;
    }
  }
  const stoneGrain = new THREE.DataTexture(
    stoneGrainData, stoneGrainSize, stoneGrainSize, THREE.RGBAFormat
  );
  stoneGrain.wrapS = THREE.RepeatWrapping;
  stoneGrain.wrapT = THREE.RepeatWrapping;
  stoneGrain.repeat.set(3, 3);
  stoneGrain.magFilter = THREE.LinearFilter;
  stoneGrain.minFilter = THREE.LinearMipmapLinearFilter;
  stoneGrain.generateMipmaps = true;
  stoneGrain.anisotropy = maxTextureAnisotropy;
  stoneGrain.needsUpdate = true;
  for (const material of [mats.statueStone, mats.statueShadow, mats.statueLight]) {
    material.bumpMap = stoneGrain;
    material.bumpScale = material === mats.statueStone ? 0.022 : 0.012;
    material.roughness = material === mats.statueLight ? 0.34 : (material === mats.statueStone ? 0.46 : 0.54);
    material.metalness = material === mats.statueShadow ? 0.58 : 0.66;
    material.needsUpdate = true;
  }
  mats.statueStone.emissive.setHex(0x512b08);
  mats.statueStone.emissiveIntensity = 0.085;
  mats.statueLight.emissive.setHex(0x5d390b);
  mats.statueLight.emissiveIntensity = 0.055;

  const world = new THREE.Group();
  scene.add(world);

  // Reuse immutable primitive geometry across repeated architectural pieces.
  // This reduces duplicate GPU buffers while preserving independent transforms/materials.
  const primitiveGeometryCache = new Map();
  const getPrimitiveGeometry = (key, create) => {
    if (!primitiveGeometryCache.has(key)) primitiveGeometryCache.set(key, create());
    return primitiveGeometryCache.get(key);
  };
  const box = (w, h, d, material, x, y, z, parent = world) => {
    const geometry = getPrimitiveGeometry(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };
  const cylinder = (rt, rb, h, material, x, y, z, parent = world, radial = 24) => {
    const geometry = getPrimitiveGeometry(`cylinder:${rt}:${rb}:${h}:${radial}`, () => new THREE.CylinderGeometry(rt, rb, h, radial));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };
  const sphere = (r, material, x, y, z, sx = 1, sy = 1, sz = 1, parent = world) => {
    const geometry = getPrimitiveGeometry(`sphere:${r}:24:16`, () => new THREE.SphereGeometry(r, 24, 16));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const plane = (w, h, material, x, y, z, rx = -Math.PI / 2) => {
    const geometry = getPrimitiveGeometry(`plane:${w}:${h}`, () => new THREE.PlaneGeometry(w, h));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.rotation.x = rx; mesh.receiveShadow = true; world.add(mesh); return mesh;
  };
  const imageTextureLoader = new THREE.TextureLoader();
  const imageTextureStatus = {};
  function addSanctuaryImagePlane(name, url, width, height, position, rotation = [0, 0, 0], options = {}) {
    const texture = imageTextureLoader.load(url, () => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxTextureAnisotropy;
      texture.needsUpdate = true;
      imageTextureStatus[name] = 'loaded';
    }, undefined, (error) => {
      imageTextureStatus[name] = error?.message || 'failed';
      console.warn(`[Temple3D] Sanctuary texture failed: ${name}`, error);
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const material = options.unlit
      ? new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false })
      : new THREE.MeshStandardMaterial({
          map: texture,
          roughness: options.roughness ?? 0.78,
          metalness: options.metalness ?? 0.08,
          side: THREE.DoubleSide
        });
    // Painted backdrop artwork must keep its designed brightness and not be
    // darkened by scene fog or PBR lighting.
    material.fog = options.fog ?? !options.unlit;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    world.add(mesh);
    imageTextureStatus[name] = 'loading';
    window.__TEMPLE_TEXTURE_DIAGNOSTICS__ = imageTextureStatus;
    return mesh;
  }

  // Full-width illuminated rear mural closes the dark void above and beside
  // the narrow ceiling fascia. It sits behind pillars, altar and Buddha.
  addSanctuaryImagePlane(
    'BrightUpperHallBackdrop',
    '/assets/temple-kit/upper-hall-backdrop.svg',
    19.2, 11.6, [0, 8.05, -12.62], [0, 0, 0],
    { unlit: true }
  );
  scene.add(new THREE.HemisphereLight(0xffe4b9, 0x382011, 2.25));
  const ambient = new THREE.AmbientLight(0xffd79a, 0.92); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffdfaa, 3.65);
  key.position.set(-7, 15, 8); key.castShadow = true;
  key.shadow.mapSize.set(renderProfile.shadowMapSize, renderProfile.shadowMapSize); key.shadow.camera.left = -14; key.shadow.camera.right = 14;
  key.shadow.camera.top = 18; key.shadow.camera.bottom = -18;
  key.shadow.bias = -0.00018; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
  scene.add(key);
  // A warm, brighter focal fill keeps the bronze-gold statue readable without bleaching its carved planes.
  const buddhaLight = new THREE.PointLight(0xffd6a0, 20, 20, 2);
  buddhaLight.position.set(0, 6.8, -7); scene.add(buddhaLight);
  const portraitFill = new THREE.DirectionalLight(0xffe9c8, 0.95);
  portraitFill.position.set(0, 8, 13);
  portraitFill.castShadow = false;
  scene.add(portraitFill);
  window.__TEMPLE_LIGHTING_DIAGNOSTIC__ = {
    exposure: renderer.toneMappingExposure,
    ambientIntensity: ambient.intensity,
    hemisphereIntensity: 2.25,
    keyIntensity: key.intensity,
    portraitFillIntensity: portraitFill.intensity
  };

  // A restrained rear-side rim separates the ivory statue from the dark altar.
  // It deliberately casts no shadows; gift light is layered onto this same light.
  const statueRimTarget = new THREE.Object3D();
  statueRimTarget.position.set(0, 4.1, -8.25);
  scene.add(statueRimTarget);
  const statueRimLight = new THREE.DirectionalLight(0xffc982, 0.82);
  statueRimLight.position.set(5.5, 8.5, -12.5);
  statueRimLight.target = statueRimTarget;
  statueRimLight.castShadow = false;
  scene.add(statueRimLight);

  // Layered altar lighting: two soft, non-shadow-casting spots shape the focal area
  // without changing the fixed master camera or adding expensive shadow maps.
  const altarTargets = [];
  for (const x of [-4.2, 4.2]) {
    const target = new THREE.Object3D();
    target.position.set(0, 2.8, -8.1); scene.add(target); altarTargets.push(target);
    const spot = new THREE.SpotLight(0xffd18a, 34, 20, Math.PI / 5.2, 0.72, 1.4);
    spot.position.set(x, 9.1, -2.8);
    spot.target = target;
    spot.castShadow = false;
    scene.add(spot);
  }
  const altarFill = new THREE.PointLight(0xffad5a, 21, 10, 2);
  altarFill.position.set(0, 2.8, -5.4); scene.add(altarFill);

  // Courtyard floor, raised processional path and inlaid gold borders.
  plane(22, 36, mats.stone, 0, -0.18, 1);
  // Instance the courtyard tiles: hundreds of repeated meshes become two draw calls.
  const tileGeometry = new THREE.BoxGeometry(1.08, 0.035, 1.08);
  const tilePositions = [[], []];
  for (let z = -14; z < 19; z += 1.15) {
    for (let x = -9; x < 10; x += 1.15) {
      tilePositions[Math.round(x + z) % 2 ? 0 : 1].push([x, -0.13, z]);
    }
  }
  const tileTransform = new THREE.Object3D();
  [mats.stone, mats.wood].forEach((material, index) => {
    const instances = new THREE.InstancedMesh(tileGeometry, material, tilePositions[index].length);
    instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    instances.castShadow = false;
    instances.receiveShadow = true;
    const tilePalette = index === 0
      ? [0x77736d, 0x817c73, 0x898276, 0x706d68, 0x928878]
      : [0x48200e, 0x512713, 0x5a2c16, 0x60331a, 0x42200f];
    const tileColors = tilePalette.map((color) => new THREE.Color(color));
    tilePositions[index].forEach(([x, y, z], instanceIndex) => {
      tileTransform.position.set(x, y, z);
      tileTransform.updateMatrix();
      instances.setMatrixAt(instanceIndex, tileTransform.matrix);
      // Subtle per-tile tint breaks up the repeated grid without extra draw calls.
      const paletteIndex = (instanceIndex * 7 + Math.round((x + 9) * 3) + Math.round((z + 14) * 5)) % tileColors.length;
      instances.setColorAt(instanceIndex, tileColors[paletteIndex]);
    });
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
    world.add(instances);
  });
  box(5.8, 0.12, 27, mats.red, 0, -0.02, 3);
  // A woven lotus carpet texture replaces the unpatterned red runway surface.
  addSanctuaryImagePlane(
    'LotusProcessionalCarpet',
    '/assets/temple-kit/red-lotus-carpet.svg',
    5.55, 26.82, [0, 0.046, 3], [-Math.PI / 2, 0, 0],
    { roughness: 0.88, metalness: 0.06 }
  );
  box(0.12, 0.035, 27, mats.gold, -2.82, 0.06, 3);
  box(0.12, 0.035, 27, mats.gold, 2.82, 0.06, 3);
  // Low stone curbs and a second fine brass inlay frame the processional carpet.
  // Their restrained height preserves the open sightline from the fixed camera.
  for (const side of [-1, 1]) {
    box(0.22, 0.16, 27.2, mats.stone, side * 3.08, 0.025, 3);
    box(0.035, 0.025, 27.0, mats.goldBright, side * 3.19, 0.115, 3);
    box(1.05, 0.045, 27.0, mats.woodLight, side * 3.82, -0.105, 3);
  }
  // Broad threshold slabs visually anchor the near end of the aisle.
  for (const z of [16.8, 17.45]) {
    box(6.45, 0.07, 0.12, mats.gold, 0, 0.045, z);
  }
  // Fine woven edge stitches replace the bright transverse bars that looked
  // like game checkpoints. The central carpet remains visually quiet for feet.
  for (const side of [-1, 1]) {
    for (let z = -8.4; z <= 15.2; z += 0.62) {
      box(0.035, 0.012, 0.085, mats.gold, side * 2.62, 0.052, z);
    }
  }
  // Two discreet lotus emblems anchor only the entrance and altar ends.
  for (const z of [-7.2, 13.2]) {
    const emblem = new THREE.Group(); emblem.position.set(0, 0.085, z); world.add(emblem);
    cylinder(0.22, 0.22, 0.022, mats.gold, 0, 0, 0, emblem, 24);
    for (let p = 0; p < 8; p++) {
      const a = p * Math.PI / 4;
      const petal = sphere(0.105, mats.goldBright, Math.cos(a) * 0.18, 0.024, Math.sin(a) * 0.18, 0.58, 0.18, 1, emblem);
      petal.rotation.y = -a;
    }
  }

  // Rear sanctuary dais and altar.
  box(11, 0.65, 3.2, mats.wood, 0, 0.15, -9.4);
  box(10.4, 0.12, 2.8, mats.gold, 0, 0.55, -9.35);
  box(8.4, 1.0, 1.1, mats.woodLight, 0, 1.05, -10.45);
  for (let x = -3.8; x <= 3.8; x += 0.95) {
    cylinder(0.12, 0.16, 0.82, mats.goldBright, x, 1.12, -9.7, world, 12);
  }

  // Carved red-and-gold altar screen behind the Buddha, kept in the rear focal plane.
  box(9.2, 5.5, 0.28, mats.red, 0, 4.05, -11.25);
  box(9.55, 0.22, 0.42, mats.goldBright, 0, 6.86, -11.22);
  box(9.55, 0.22, 0.42, mats.goldBright, 0, 1.24, -11.22);
  for (const x of [-4.65, -2.35, 0, 2.35, 4.65]) {
    box(0.12, 5.45, 0.38, mats.gold, x, 4.05, -11.02);
  }
  for (const y of [2.0, 3.05, 4.1, 5.15, 6.2]) {
    box(9.0, 0.055, 0.36, mats.gold, 0, y, -11.0);
  }
  // Central carved medallion and side relief panels.
  cylinder(0.92, 0.92, 0.1, mats.gold, 0, 4.25, -10.98, world, 48).rotation.x = Math.PI / 2;
  cylinder(0.72, 0.72, 0.12, mats.redBright, 0, 4.25, -10.9, world, 48).rotation.x = Math.PI / 2;
  // Repeated brass rosettes and ruby centres enrich the recessed side panels.
  // Instancing keeps the ornamentation to two draw calls for the whole screen.
  const panelRosetteGeometry = new THREE.TorusGeometry(0.085, 0.012, 6, 20);
  const panelRosettes = new THREE.InstancedMesh(panelRosetteGeometry, mats.goldBright, 10);
  const panelGemGeometry = new THREE.SphereGeometry(0.043, 10, 8);
  const panelGems = new THREE.InstancedMesh(panelGemGeometry, mats.redBright, 10);
  const panelOrnamentTransform = new THREE.Object3D();
  let panelOrnamentIndex = 0;
  for (const panelX of [-3.45, 3.45]) {
    for (const ornamentY of [2.72, 3.38, 4.05, 4.72, 5.38]) {
      panelOrnamentTransform.position.set(panelX, ornamentY, -10.79);
      panelOrnamentTransform.rotation.set(0, 0, 0);
      panelOrnamentTransform.scale.set(1, 1, 1);
      panelOrnamentTransform.updateMatrix();
      panelRosettes.setMatrixAt(panelOrnamentIndex, panelOrnamentTransform.matrix);
      panelOrnamentTransform.position.z = -10.765;
      panelOrnamentTransform.scale.set(1, 1, 0.52);
      panelOrnamentTransform.updateMatrix();
      panelGems.setMatrixAt(panelOrnamentIndex, panelOrnamentTransform.matrix);
      panelOrnamentIndex++;
    }
  }
  panelRosettes.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  panelGems.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  panelRosettes.castShadow = panelGems.castShadow = false;
  panelRosettes.receiveShadow = panelGems.receiveShadow = true;
  world.add(panelRosettes, panelGems);

  // Painted red-and-gold sanctuary backdrop: a true image texture replaces
  // the plain procedural lattice at the rear focal plane while leaving Buddha in front.
  addSanctuaryImagePlane(
    'PaintedAmitabhaAltarBackdrop',
    '/assets/temple-kit/altar-screen.svg',
    9.18, 5.35, [0, 4.05, -10.62], [0, 0, 0],
    { unlit: true }
  );
  for (const x of [-3.45, 3.45]) {
    box(1.55, 3.8, 0.12, mats.woodLight, x, 4.05, -10.98);
    // Recessed cinnabar panels sit behind the brass lattice, adding a second
    // architectural plane instead of leaving the side screens visually flat.
    box(1.34, 3.55, 0.05, mats.redBright, x, 4.05, -10.90);
    for (let y = 2.55; y <= 5.55; y += 0.75) {
      box(1.42, 0.045, 0.08, mats.goldBright, x, y, -10.88);
    }
    for (let dx = -0.48; dx <= 0.49; dx += 0.48) {
      box(0.045, 3.55, 0.08, mats.goldBright, x + dx, 4.05, -10.88);
    }
    // Fine inner mouldings catch the warm altar light and make each niche
    // read as a framed cabinet, matching the reference's red-and-gold screen.
    for (const side of [-1, 1]) {
      box(0.065, 3.68, 0.1, mats.gold, x + side * 0.72, 4.05, -10.78);
    }
    for (const y of [2.19, 5.91]) {
      box(1.5, 0.075, 0.1, mats.goldBright, x, y, -10.78);
    }
    for (const y of [2.3, 5.8]) {
      for (const side of [-1, 1]) {
        sphere(0.075, mats.goldBright, x + side * 0.72, y, -10.69, 1, 1, 0.55);
      }
    }
  }

  // Foreground offering table with bronze incense burner, candles, vases and fruit.
  const offeringTable = new THREE.Group();
  offeringTable.position.set(0, 0, -5.85);
  world.add(offeringTable);
  box(5.6, 0.2, 1.45, mats.woodLight, 0, 1.62, 0, offeringTable);
  box(5.72, 0.09, 1.55, mats.gold, 0, 1.77, 0, offeringTable);
  box(5.35, 0.12, 1.3, mats.red, 0, 1.86, 0, offeringTable);
  // A lacquered front apron makes the altar table read as a crafted piece of
  // temple furniture instead of a stack of plain rectangular slabs.
  box(5.32, 0.3, 0.12, mats.redBright, 0, 1.38, 0.755, offeringTable);
  box(5.28, 0.035, 0.15, mats.goldBright, 0, 1.55, 0.765, offeringTable);
  box(5.28, 0.035, 0.15, mats.gold, 0, 1.21, 0.765, offeringTable);
  const tableSeal = box(0.25, 0.25, 0.065, mats.goldBright, 0, 1.38, 0.84, offeringTable);
  tableSeal.rotation.z = Math.PI / 4;
  sphere(0.07, mats.red, 0, 1.38, 0.89, 1, 1, 0.38, offeringTable);
  for (const x of [-2.35, -1.2, 1.2, 2.35]) {
    sphere(0.055, mats.goldBright, x, 1.38, 0.84, 1, 1, 0.45, offeringTable);
  }
  for (const x of [-2.35, -0.8, 0.8, 2.35]) {
    box(0.18, 1.35, 0.18, mats.wood, x, 0.9, 0, offeringTable);
    box(0.42, 0.12, 1.32, mats.gold, x, 0.38, 0, offeringTable);
  }
  // Central bronze incense vessel.
  const bronze = new THREE.MeshStandardMaterial({ color: 0x8a5428, roughness: 0.34, metalness: 0.82 });
  const incense = new THREE.Group(); incense.position.set(0, 1.92, 0.02); offeringTable.add(incense);
  cylinder(0.42, 0.5, 0.16, bronze, 0, 0, 0, incense, 32);
  sphere(0.43, bronze, 0, 0.2, 0, 1, 0.58, 1, incense);
  const burnerRim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.055, 8, 32), mats.goldBright);
  burnerRim.rotation.x = Math.PI / 2; burnerRim.position.y = 0.28; incense.add(burnerRim);
  cylinder(0.12, 0.2, 0.32, bronze, 0, 0.47, 0, incense, 24);
  sphere(0.2, mats.gold, 0, 0.68, 0, 1, 0.38, 1, incense);
  for (let i = -1; i <= 1; i++) {
    const stick = cylinder(0.018, 0.022, 0.78, mats.woodLight, i * 0.11, 1.0, 0, incense, 8);
    stick.rotation.z = i * 0.12;
  }
  // Persistent incense wisps rise from the burner even between ritual events.
  // Shared geometry/material keep the idle ambience inexpensive and allocation-free per frame.
  const incenseSmokeGeometry = new THREE.SphereGeometry(0.105, 8, 6);
  const incenseSmokeMaterial = new THREE.MeshBasicMaterial({
    color: 0xd8cbb8, transparent: true, opacity: 0.0, depthWrite: false
  });
  // Incense is ambient decoration: scale its transparent draw calls with the
  // selected device tier while preserving a visible plume on low-end devices.
  const incenseWispCount = renderProfile.tier === 'low' ? 3
    : renderProfile.tier === 'medium' ? 4 : 6;
  const incenseWisps = Array.from({ length: incenseWispCount }, (_, index) => {
    const wisp = new THREE.Mesh(incenseSmokeGeometry, incenseSmokeMaterial.clone());
    wisp.scale.set(0.72 + (index % 3) * 0.18, 1.9 + (index % 2) * 0.45, 0.72 + (index % 2) * 0.12);
    wisp.userData.phase = index / 6;
    wisp.userData.drift = index % 2 ? 1 : -1;
    world.add(wisp);
    return wisp;
  });
  function updateIncenseWisps(time) {
    incenseWisps.forEach((wisp, index) => {
      const phase = ((time * 0.00022 + wisp.userData.phase) % 1);
      const rise = phase;
      const envelope = Math.sin(Math.PI * phase);
      wisp.position.set(
        Math.sin(phase * Math.PI * 2 + index) * 0.16 + wisp.userData.drift * phase * 0.18,
        3.34 + rise * 1.55,
        -5.82 + Math.cos(phase * Math.PI * 2 + index) * 0.08
      );
      wisp.rotation.z = Math.sin(phase * Math.PI * 2 + index) * 0.22;
      wisp.material.opacity = 0.105 * envelope;
      const swell = 0.82 + envelope * 0.34;
      wisp.scale.set(0.72 * swell, (1.9 + (index % 2) * 0.45) * swell, 0.72 * swell);
    });
  }

  // Paired bronze vases with lotus stems.
  for (const side of [-1, 1]) {
    const vase = new THREE.Group(); vase.position.set(side * 1.72, 1.91, 0.02); offeringTable.add(vase);
    cylinder(0.22, 0.3, 0.12, bronze, 0, 0.05, 0, vase, 24);
    sphere(0.25, bronze, 0, 0.28, 0, 0.9, 1.15, 0.9, vase);
    cylinder(0.11, 0.17, 0.34, bronze, 0, 0.56, 0, vase, 20);
    cylinder(0.16, 0.16, 0.08, mats.goldBright, 0, 0.75, 0, vase, 20);
    const stem = cylinder(0.018, 0.025, 0.72, mats.leaf, 0, 1.1, 0, vase, 8);
    stem.rotation.z = side * -0.14;
    for (let petal = 0; petal < 5; petal++) {
      const angle = petal * Math.PI * 2 / 5;
      const bloom = sphere(0.12, mats.lotus, Math.cos(angle) * 0.12, 1.48, Math.sin(angle) * 0.12, 0.65, 0.55, 1, vase);
      bloom.rotation.y = -angle;
    }
  }
  // Small fruit offerings and warm butter lamps.
  for (const [x, color] of [[-0.92, 0xe5a52f], [-0.55, 0xb82e32], [0.55, 0xb82e32], [0.92, 0xe5a52f]]) {
    const fruitMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.42 });
    sphere(0.18, fruitMaterial, x, 2.03, 0.12, 1, 1.08, 1, offeringTable);
  }
  const flameMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc45a, emissive: 0xff7a18, emissiveIntensity: 1.2, roughness: 0.4
  });
  for (const x of [-2.45, 2.45]) {
    cylinder(0.16, 0.2, 0.22, mats.goldBright, x, 1.98, 0.05, offeringTable, 20);
    sphere(0.075, flameMaterial, x, 2.17, 0.05, 0.72, 1.5, 0.72, offeringTable);
  }
  const offeringFlames = offeringTable.children.filter((child) => child.material === flameMaterial);
  const offeringGlow = new THREE.PointLight(0xffa044, 7, 5, 2);
  offeringGlow.position.set(0, 2.6, -5.8); world.add(offeringGlow);

  // Layered lotus pedestal.
  cylinder(2.05, 1.8, 0.55, mats.wood, 0, 1.0, -8.25, world, 48);
  cylinder(1.82, 2.0, 0.28, mats.redBright, 0, 1.38, -8.25, world, 48);
  cylinder(1.62, 1.82, 0.2, mats.gold, 0, 1.62, -8.25, world, 48);

  // Fine brass beads and double mouldings finish the carved pedestal drum.
  const pedestalTrimGeometry = new THREE.TorusGeometry(1.94, 0.026, 8, 64);
  const pedestalTrim = new THREE.InstancedMesh(pedestalTrimGeometry, mats.goldBright, 2);
  const pedestalTrimTransform = new THREE.Object3D();
  [[0.78, 0.95], [1.2, 1.04]].forEach(([y, scale], index) => {
    pedestalTrimTransform.position.set(0, y, -8.25);
    pedestalTrimTransform.rotation.set(Math.PI / 2, 0, 0);
    pedestalTrimTransform.scale.setScalar(scale);
    pedestalTrimTransform.updateMatrix();
    pedestalTrim.setMatrixAt(index, pedestalTrimTransform.matrix);
  });
  pedestalTrim.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  pedestalTrim.castShadow = false;
  pedestalTrim.receiveShadow = true;
  world.add(pedestalTrim);

  const pedestalStudGeometry = new THREE.SphereGeometry(0.052, 8, 6);
  const pedestalStuds = new THREE.InstancedMesh(pedestalStudGeometry, mats.goldBright, 32);
  const pedestalStudTransform = new THREE.Object3D();
  for (let i = 0; i < 32; i++) {
    const angle = i * Math.PI * 2 / 32;
    pedestalStudTransform.position.set(
      Math.cos(angle) * 1.93,
      1.38,
      -8.25 + Math.sin(angle) * 1.93
    );
    pedestalStudTransform.scale.set(1, 1, 0.72);
    pedestalStudTransform.rotation.y = -angle;
    pedestalStudTransform.updateMatrix();
    pedestalStuds.setMatrixAt(i, pedestalStudTransform.matrix);
  }
  pedestalStuds.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  pedestalStuds.castShadow = false;
  pedestalStuds.receiveShadow = true;
  world.add(pedestalStuds);

  // Seven front-facing lotus-seed plaques decorate the red pedestal band.
  // The shallow Z offsets follow the cylinder's curved face rather than floating flat.
  const pedestalPlaqueXs = [-1.35, -0.9, -0.45, 0, 0.45, 0.9, 1.35];
  const pedestalPlaqueGeometry = new THREE.BoxGeometry(0.19, 0.19, 0.035);
  const pedestalPlaques = new THREE.InstancedMesh(pedestalPlaqueGeometry, mats.goldBright, pedestalPlaqueXs.length);
  const pedestalGemGeometry = new THREE.SphereGeometry(0.052, 10, 8);
  const pedestalGems = new THREE.InstancedMesh(pedestalGemGeometry, mats.red, pedestalPlaqueXs.length);
  const pedestalPlaqueTransform = new THREE.Object3D();
  pedestalPlaqueXs.forEach((x, index) => {
    const faceZ = -8.25 + Math.sqrt(1.94 * 1.94 - x * x);
    pedestalPlaqueTransform.position.set(x, 1.38, faceZ + 0.018);
    pedestalPlaqueTransform.rotation.set(0, 0, Math.PI / 4);
    pedestalPlaqueTransform.scale.set(1, 1, 1);
    pedestalPlaqueTransform.updateMatrix();
    pedestalPlaques.setMatrixAt(index, pedestalPlaqueTransform.matrix);
    pedestalPlaqueTransform.position.z = faceZ + 0.047;
    pedestalPlaqueTransform.rotation.set(0, 0, 0);
    pedestalPlaqueTransform.scale.set(1, 1, 0.5);
    pedestalPlaqueTransform.updateMatrix();
    pedestalGems.setMatrixAt(index, pedestalPlaqueTransform.matrix);
  });
  pedestalPlaques.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  pedestalGems.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  pedestalPlaques.castShadow = pedestalGems.castShadow = false;
  pedestalPlaques.receiveShadow = pedestalGems.receiveShadow = true;
  world.add(pedestalPlaques, pedestalGems);

  const lotusThrone = new THREE.Group(); lotusThrone.position.set(0, 1.7, -8.25); world.add(lotusThrone);
  // Special gifts briefly reveal a soft gold aura around the lotus without adding lights.
  const lotusGiftAuraMaterial = new THREE.MeshBasicMaterial({
    color: 0xffc978, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  const lotusGiftAura = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.035, 8, 96), lotusGiftAuraMaterial);
  lotusGiftAura.rotation.x = Math.PI / 2;
  lotusGiftAura.position.y = 0.24;
  lotusThrone.add(lotusGiftAura);
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    const petal = sphere(0.55, i % 2 ? mats.redBright : mats.goldBright,
      Math.cos(a) * 1.4, 0.2 + Math.sin(a) * 0.08, Math.sin(a) * 1.4, 0.52, 0.24, 1, lotusThrone);
    petal.rotation.y = -a;
  }

  // Sculpted upright lotus leaves: one shared curved surface, instanced in two
  // nested rings to create a layered throne without dozens of individual draws.
  function createLotusPetalGeometry() {
    const lengthSegments = 12;
    const widthSegments = 8;
    const positions = [];
    const indices = [];
    for (let row = 0; row <= lengthSegments; row++) {
      const t = row / lengthSegments;
      const taper = Math.pow(Math.sin(Math.PI * t), 0.72);
      const halfWidth = 0.34 * taper * (0.84 + 0.16 * t);
      for (let column = 0; column <= widthSegments; column++) {
        const u = (column / widthSegments) * 2 - 1;
        const petalRidge = Math.max(0, 1 - u * u);
        positions.push(
          u * halfWidth,
          t,
          0.08 + 0.19 * Math.sin(Math.PI * t) + 0.07 * petalRidge * Math.sin(Math.PI * t)
        );
      }
    }
    for (let row = 0; row < lengthSegments; row++) {
      for (let column = 0; column < widthSegments; column++) {
        const a = row * (widthSegments + 1) + column;
        const b = a + widthSegments + 1;
        const c = a + 1;
        const d = b + 1;
        indices.push(a, c, b, c, d, b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  const lotusPetalGeometry = createLotusPetalGeometry();
  // A fine raised midrib follows the sculpted crown of each petal.
  const lotusVeinCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.1, 0.17),
    new THREE.Vector3(0, 0.34, 0.275),
    new THREE.Vector3(0, 0.58, 0.31),
    new THREE.Vector3(0, 0.9, 0.17)
  ]);
  const lotusVeinGeometry = new THREE.TubeGeometry(lotusVeinCurve, 16, 0.009, 5, false);
  const lotusPetalRings = [];
  function createLotusPetalRing(count, radius, y, size, lean = 0.08) {
    const ring = new THREE.Group();
    lotusThrone.add(ring);
    lotusPetalRings.push(ring);
    const redCount = Math.ceil(count / 2);
    const goldCount = Math.floor(count / 2);
    const redPetals = new THREE.InstancedMesh(lotusPetalGeometry, mats.redBright, redCount);
    const goldPetals = new THREE.InstancedMesh(lotusPetalGeometry, mats.goldBright, goldCount);
    const petalVeins = new THREE.InstancedMesh(lotusVeinGeometry, mats.goldBright, count);
    const redSlots = [];
    const goldSlots = [];
    const transform = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      transform.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      transform.rotation.set(Math.cos(angle) * lean, Math.PI / 2 - angle, Math.sin(angle) * lean);
      transform.scale.set(size, size, size);
      transform.updateMatrix();
      petalVeins.setMatrixAt(i, transform.matrix);
      if (i % 2 === 0) {
        redPetals.setMatrixAt(redSlots.length, transform.matrix);
        redSlots.push(i);
      } else {
        goldPetals.setMatrixAt(goldSlots.length, transform.matrix);
        goldSlots.push(i);
      }
    }
    for (const petals of [redPetals, goldPetals, petalVeins]) {
      petals.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      petals.castShadow = false;
      petals.receiveShadow = false;
    }
    ring.add(redPetals, goldPetals, petalVeins);
    return ring;
  }
  // Broader, fuller lotus tiers frame the seated statue clearly in the 9:16 view.
  createLotusPetalRing(20, 1.62, 0.02, 1.22, 0.1);
  createLotusPetalRing(16, 1.22, 0.1, 0.96, 0.06);

  // A fixed, low-cost point cloud carries warm sparks from the lotus toward
  // the Buddha halo during special gifts. Buffers are reused every frame.
  const lotusSparkCount = 32;
  const lotusSparkPositions = new Float32Array(lotusSparkCount * 3);
  const lotusSparkPhases = new Float32Array(lotusSparkCount);
  const lotusSparkSpeeds = new Float32Array(lotusSparkCount);
  const lotusSparkRadii = new Float32Array(lotusSparkCount);
  for (let i = 0; i < lotusSparkCount; i++) {
    lotusSparkPhases[i] = i / lotusSparkCount;
    lotusSparkSpeeds[i] = 0.16 + (i % 5) * 0.025;
    lotusSparkRadii[i] = 1.08 + (i % 4) * 0.11;
  }
  const lotusSparkGeometry = new THREE.BufferGeometry();
  lotusSparkGeometry.setAttribute('position', new THREE.BufferAttribute(lotusSparkPositions, 3));
  const lotusSparkMaterial = new THREE.PointsMaterial({
    color: 0xffd58a, size: 0.085, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  const lotusSparks = new THREE.Points(lotusSparkGeometry, lotusSparkMaterial);
  lotusThrone.add(lotusSparks);

  // Seated stone Buddha statue: sculpted silhouette, robe folds, calm face and halo.
  const statue = new THREE.Group(); statue.position.set(0, 1.8, -8.25); statue.scale.set(1.16, 1, 1.04); world.add(statue);
  // Cross-legged lotus posture and layered robe silhouette.
  sphere(1.12, mats.statueStone, 0, 1.45, 0.12, 1.35, 0.42, 0.82, statue);
  sphere(0.78, mats.statueStone, 0, 2.18, -0.02, 0.9, 1.15, 0.72, statue);
  sphere(0.72, mats.statueLight, 0, 2.0, 0.12, 1.18, 0.42, 0.9, statue);
  // A pair of fine front-facing fillets follows the curved lower robe/base silhouette.
  // Their depth is sampled from the seated base ellipsoid so the transition reads as carved-in.
  const statueBaseBandPoints = [];
  const statueBaseHighlightPoints = [];
  for (let i = 0; i <= 20; i++) {
    const x = -1.12 + (i / 20) * 2.24;
    const surfaceZ = 0.12 + 0.82 * Math.sqrt(Math.max(0.08,
      1 - ((1.24 - 1.45) / 0.42) ** 2 - (x / 1.512) ** 2));
    statueBaseBandPoints.push(new THREE.Vector3(x, 1.24, surfaceZ + 0.012));
    statueBaseHighlightPoints.push(new THREE.Vector3(x, 1.29, surfaceZ + 0.018));
  }
  const statueBaseBand = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(statueBaseBandPoints), 48, 0.018, 6, false),
    mats.goldBright
  );
  const statueBaseHighlight = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(statueBaseHighlightPoints), 48, 0.009, 6, false),
    mats.statueLight
  );
  for (const detail of [statueBaseBand, statueBaseHighlight]) {
    detail.castShadow = false;
    detail.receiveShadow = false;
  }
  statue.add(statueBaseBand, statueBaseHighlight);
  sphere(0.76, mats.statueStone, 0, 3.35, 0.02, 1.16, 1.2, 0.9, statue);
  // A continuous shoulder mantle gives the upper body a clear carved silhouette at portrait scale.
  sphere(0.8, mats.statueStone, 0, 3.72, -0.015, 1.18, 0.72, 0.8, statue);
  // A shallow curved neckline softens the join between neck, shoulders and chest.
  const necklineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.48, 3.98, 0.43),
    new THREE.Vector3(-0.28, 3.91, 0.53),
    new THREE.Vector3(0, 3.88, 0.56),
    new THREE.Vector3(0.28, 3.91, 0.53),
    new THREE.Vector3(0.48, 3.98, 0.43)
  ]);
  const neckline = new THREE.Mesh(
    new THREE.TubeGeometry(necklineCurve, 32, 0.018, 6, false),
    mats.statueShadow
  );
  neckline.castShadow = false;
  neckline.receiveShadow = false;
  statue.add(neckline);
  const collarRidgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.42, 4.015, 0.445),
    new THREE.Vector3(-0.22, 3.965, 0.545),
    new THREE.Vector3(0, 3.945, 0.575),
    new THREE.Vector3(0.22, 3.965, 0.545),
    new THREE.Vector3(0.42, 4.015, 0.445)
  ]);
  const collarRidge = new THREE.Mesh(
    new THREE.TubeGeometry(collarRidgeCurve, 32, 0.01, 6, false),
    mats.statueLight
  );
  collarRidge.castShadow = false;
  collarRidge.receiveShadow = false;
  statue.add(collarRidge);
  // Robe drapes over both shoulders and falls across the lap.
  const robeFold = (points, radius = 0.035) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x,y,z]) => new THREE.Vector3(x,y,z)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 8, false), mats.statueShadow);
    mesh.castShadow = true; statue.add(mesh); return mesh;
  };
  // Subtle neck tendons and shoulder drape creases bridge the head into the robe.
  for (const side of [-1, 1]) {
    const neckContour = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.22, 4.2, 0.235),
      new THREE.Vector3(side * 0.24, 4.08, 0.275),
      new THREE.Vector3(side * 0.2, 3.96, 0.305)
    ]);
    const neckContourMesh = new THREE.Mesh(
      new THREE.TubeGeometry(neckContour, 18, 0.009, 6, false), mats.statueLight
    );
    neckContourMesh.castShadow = false;
    neckContourMesh.receiveShadow = false;
    statue.add(neckContourMesh);
    const shoulderDrape = [
      [side * 0.39, 3.98, 0.46],
      [side * 0.55, 3.88, 0.51],
      [side * 0.68, 3.72, 0.51]
    ];
    robeFold(shoulderDrape, 0.014);
    const shoulderDrapeHighlight = new THREE.CatmullRomCurve3(shoulderDrape.map(([x, y, z]) =>
      new THREE.Vector3(x - side * 0.018, y + 0.018, z + 0.012)
    ));
    const shoulderDrapeHighlightMesh = new THREE.Mesh(
      new THREE.TubeGeometry(shoulderDrapeHighlight, 18, 0.007, 6, false), mats.statueLight
    );
    shoulderDrapeHighlightMesh.castShadow = false;
    shoulderDrapeHighlightMesh.receiveShadow = false;
    statue.add(shoulderDrapeHighlightMesh);
  }
  // One continuous shoulder-to-hand robe contour avoids stacked parallel seams.
  robeFold([[-0.58,4.02,0.18],[-0.44,3.55,0.57],[-0.18,3.02,0.72],[0.34,2.52,0.67],[0.72,2.25,0.4]],0.045);
  robeFold([[0.58,4.0,0.18],[0.7,3.55,0.48],[0.5,3.1,0.67],[0.15,2.65,0.72],[-0.42,2.34,0.55]],0.035);
  for (let k=0;k<5;k++) {
    const x=-0.42+k*0.21;
    const lapFoldPoints = [[x,2.55,0.72],[x*1.3,2.25,0.82],[x*1.7,1.95,0.78]];
    robeFold(lapFoldPoints,0.022);
    const lapFoldHighlight = new THREE.CatmullRomCurve3(lapFoldPoints.map(([px, py, pz]) =>
      new THREE.Vector3(px + 0.028, py + 0.012, pz + 0.018)
    ));
    const lapFoldGroove = new THREE.CatmullRomCurve3(lapFoldPoints.map(([px, py, pz]) =>
      new THREE.Vector3(px - 0.026, py - 0.012, pz + 0.008)
    ));
    const highlightMesh = new THREE.Mesh(
      new THREE.TubeGeometry(lapFoldHighlight, 24, 0.008, 6, false), mats.statueLight
    );
    const grooveMesh = new THREE.Mesh(
      new THREE.TubeGeometry(lapFoldGroove, 24, 0.007, 6, false), mats.statueShadow
    );
    highlightMesh.castShadow = grooveMesh.castShadow = false;
    highlightMesh.receiveShadow = grooveMesh.receiveShadow = false;
    statue.add(highlightMesh, grooveMesh);
  }
  // Small paired elbow creases connect the upper-arm drape to the resting forearms.
  for (const side of [-1, 1]) {
    const elbowCrease = [
      [side * 0.53, 3.22, 0.61],
      [side * 0.64, 3.17, 0.64],
      [side * 0.75, 3.2, 0.59]
    ];
    robeFold(elbowCrease, 0.012);
    const elbowRidgeCurve = new THREE.CatmullRomCurve3(elbowCrease.map(([x, y, z]) =>
      new THREE.Vector3(x, y + 0.026, z + 0.012)
    ));
    const elbowRidge = new THREE.Mesh(
      new THREE.TubeGeometry(elbowRidgeCurve, 16, 0.008, 6, false),
      mats.statueLight
    );
    elbowRidge.castShadow = false;
    elbowRidge.receiveShadow = false;
    statue.add(elbowRidge);
    // A short side-torso pleat and lower elbow fold create a quiet layered transition.
    const sideTorsoPleat = [
      [side * 0.48, 3.48, 0.71],
      [side * 0.57, 3.42, 0.72],
      [side * 0.66, 3.33, 0.67]
    ];
    robeFold(sideTorsoPleat, 0.01);
    const sideTorsoPleatRidge = new THREE.CatmullRomCurve3(sideTorsoPleat.map(([x, y, z]) =>
      new THREE.Vector3(x - side * 0.016, y + 0.014, z + 0.012)
    ));
    const sideTorsoPleatRidgeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(sideTorsoPleatRidge, 16, 0.006, 6, false), mats.statueLight
    );
    sideTorsoPleatRidgeMesh.castShadow = false;
    sideTorsoPleatRidgeMesh.receiveShadow = false;
    statue.add(sideTorsoPleatRidgeMesh);
    const elbowLowerFold = [
      [side * 0.56, 3.105, 0.635],
      [side * 0.66, 3.085, 0.645],
      [side * 0.75, 3.115, 0.585]
    ];
    robeFold(elbowLowerFold, 0.009);
    const elbowLowerFoldRidge = new THREE.CatmullRomCurve3(elbowLowerFold.map(([x, y, z]) =>
      new THREE.Vector3(x, y + 0.018, z + 0.01)
    ));
    const elbowLowerFoldMesh = new THREE.Mesh(
      new THREE.TubeGeometry(elbowLowerFoldRidge, 16, 0.0055, 6, false), mats.statueLight
    );
    elbowLowerFoldMesh.castShadow = false;
    elbowLowerFoldMesh.receiveShadow = false;
    statue.add(elbowLowerFoldMesh);
  }
  // Two restrained chest folds follow the robe diagonally toward the lap.
  robeFold([[-0.38,3.28,0.69],[-0.12,3.18,0.77],[0.16,3.04,0.75],[0.39,2.9,0.67]],0.018);
  robeFold([[-0.3,3.12,0.73],[-0.04,3.02,0.79],[0.22,2.88,0.73],[0.43,2.76,0.62]],0.014);
  // Fine upper-chest pleats carry the robe's drape from the neckline into the chest.
  for (const side of [-1, 1]) {
    const upperChestPleat = [
      [side * 0.14, 3.72, 0.69],
      [side * 0.2, 3.56, 0.77],
      [side * 0.28, 3.4, 0.78]
    ];
    robeFold(upperChestPleat, 0.011);
    const upperChestPleatRidge = new THREE.CatmullRomCurve3(upperChestPleat.map(([x, y, z]) =>
      new THREE.Vector3(x + side * 0.018, y + 0.012, z + 0.014)
    ));
    const upperChestPleatRidgeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(upperChestPleatRidge, 18, 0.006, 6, false), mats.statueLight
    );
    upperChestPleatRidgeMesh.castShadow = false;
    upperChestPleatRidgeMesh.receiveShadow = false;
    statue.add(upperChestPleatRidgeMesh);
  }
  // A single shoulder seam continues down the outer arm toward the resting hand.
  // Its offset ivory ridge is subtle and does not cast shadows.
  for (const side of [-1, 1]) {
    const shoulderSeam = [
      [side * 0.62, 4.02, 0.2],
      [side * 0.76, 3.82, 0.43],
      [side * 0.78, 3.55, 0.53],
      [side * 0.69, 3.12, 0.56],
      [side * 0.48, 2.88, 0.62],
      [side * 0.34, 2.78, 0.68]
    ];
    robeFold(shoulderSeam, 0.016);
    const shoulderRidge = new THREE.CatmullRomCurve3(shoulderSeam.map(([x, y, z]) =>
      new THREE.Vector3(x - side * 0.045, y + 0.018, z + 0.018)
    ));
    const ridgeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(shoulderRidge, 32, 0.01, 6, false),
      mats.statueLight
    );
    ridgeMesh.castShadow = false;
    ridgeMesh.receiveShadow = false;
    statue.add(ridgeMesh);
  }
  // A raised hem and its shallow shadow groove make the lap robe read as layered stone.
  const robeHemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.82, 2.34, 0.45),
    new THREE.Vector3(-0.62, 2.16, 0.68),
    new THREE.Vector3(-0.28, 2.08, 0.82),
    new THREE.Vector3(0, 2.06, 0.85),
    new THREE.Vector3(0.28, 2.08, 0.82),
    new THREE.Vector3(0.62, 2.16, 0.68),
    new THREE.Vector3(0.82, 2.34, 0.45)
  ]);
  const robeHem = new THREE.Mesh(
    new THREE.TubeGeometry(robeHemCurve, 48, 0.032, 8, false),
    mats.statueLight
  );
  robeHem.castShadow = true;
  robeHem.receiveShadow = false;
  statue.add(robeHem);
  const robeHemGrooveCurve = new THREE.CatmullRomCurve3(
    robeHemCurve.getPoints(24).map((point) => new THREE.Vector3(point.x, point.y - 0.075, point.z - 0.018))
  );
  const robeHemGroove = new THREE.Mesh(
    new THREE.TubeGeometry(robeHemGrooveCurve, 48, 0.014, 6, false),
    mats.statueShadow
  );
  robeHemGroove.castShadow = false;
  robeHemGroove.receiveShadow = false;
  statue.add(robeHemGroove);
  // Neck, head, elongated ears and ushnisha.
  cylinder(0.28,0.32,0.42,mats.statueStone,0,4.05,0,statue,24);
  sphere(0.66,mats.statueStone,0,4.62,0.02,0.98,1.1,0.82,statue);
  // Soft cheek and chin masses turn the face from a narrow mask into a fuller, calm sculpture.
  sphere(0.25, mats.statueStone, -0.285, 4.49, 0.49, 0.96, 0.78, 0.78, statue);
  sphere(0.25, mats.statueStone, 0.285, 4.49, 0.49, 0.96, 0.78, 0.78, statue);
  // Paired mandibular volumes broaden the lower face and blend the cheeks into a rounded jaw.
  sphere(0.19, mats.statueStone, -0.205, 4.365, 0.49, 1.02, 0.78, 0.78, statue);
  sphere(0.19, mats.statueStone, 0.205, 4.365, 0.49, 1.02, 0.78, 0.78, statue);
  sphere(0.22, mats.statueStone, 0, 4.32, 0.49, 0.9, 0.66, 0.78, statue);
  sphere(0.36,mats.statueShadow,0,5.42,0.02,0.82,0.72,0.78,statue);
  sphere(0.13,mats.statueStone,-0.62,4.55,0.02,0.55,1.2,0.62,statue);
  sphere(0.13,mats.statueStone,0.62,4.55,0.02,0.55,1.2,0.62,statue);
  // Curled hair cap: preserve the sculpted layout in one static draw batch.
  const hairCurlRows = [9, 7, 5, 3];
  const hairCurlCount = hairCurlRows.reduce((total, count) => total + count, 0);
  const hairCurlGeometry = new THREE.SphereGeometry(0.075, 24, 16);
  const hairCurls = new THREE.InstancedMesh(hairCurlGeometry, mats.statueShadow, hairCurlCount);
  const hairCurlTransform = new THREE.Object3D();
  let hairCurlIndex = 0;
  hairCurlRows.forEach((count, row) => {
    for (let k = 0; k < count; k++) {
      const x = (k - (count - 1) / 2) * 0.13;
      hairCurlTransform.position.set(x, 5.18 + row * 0.12, 0.43);
      hairCurlTransform.scale.set(1, 1, 0.85);
      hairCurlTransform.updateMatrix();
      hairCurls.setMatrixAt(hairCurlIndex++, hairCurlTransform.matrix);
    }
  });
  hairCurls.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  hairCurls.castShadow = true;
  hairCurls.receiveShadow = false;
  statue.add(hairCurls);
  // Continue the curled cap down both temples with a compact shared-mesh batch.
  const templeCurlCount = 8;
  const templeCurls = new THREE.InstancedMesh(hairCurlGeometry, mats.statueShadow, templeCurlCount);
  const templeCurlTransform = new THREE.Object3D();
  let templeCurlIndex = 0;
  for (const side of [-1, 1]) {
    for (let row = 0; row < 4; row++) {
      templeCurlTransform.position.set(side * (0.53 - row * 0.018), 5.13 - row * 0.105, 0.36 + row * 0.035);
      templeCurlTransform.scale.set(0.78, 0.82, 0.72);
      templeCurlTransform.updateMatrix();
      templeCurls.setMatrixAt(templeCurlIndex++, templeCurlTransform.matrix);
    }
  }
  templeCurls.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  templeCurls.castShadow = true;
  templeCurls.receiveShadow = false;
  statue.add(templeCurls);
  sphere(0.1,mats.statueStone,0,5.78,0.02,1,1.1,1,statue);
  // A pair of tight curl courses follows the ushnisha ellipsoid instead of floating as a flat crown row.
  const ushnishaCurlPolarAngles = [0.56, 0.98];
  const ushnishaCurlCounts = [8, 12];
  const ushnishaCurlCount = ushnishaCurlCounts.reduce((total, count) => total + count, 0);
  const ushnishaCurlGeometry = new THREE.SphereGeometry(0.045, 16, 12);
  const ushnishaCurls = new THREE.InstancedMesh(
    ushnishaCurlGeometry, mats.statueShadow, ushnishaCurlCount
  );
  const ushnishaCurlTransform = new THREE.Object3D();
  let ushnishaCurlIndex = 0;
  ushnishaCurlPolarAngles.forEach((polarAngle, ringIndex) => {
    const count = ushnishaCurlCounts[ringIndex];
    for (let curl = 0; curl < count; curl++) {
      const angle = (curl / count) * Math.PI * 2 + ringIndex * 0.13;
      const sinPolar = Math.sin(polarAngle);
      ushnishaCurlTransform.position.set(
        0.2952 * sinPolar * Math.cos(angle),
        5.42 + 0.2592 * Math.cos(polarAngle),
        0.02 + 0.2808 * sinPolar * Math.sin(angle)
      );
      ushnishaCurlTransform.scale.setScalar(0.72);
      ushnishaCurlTransform.updateMatrix();
      ushnishaCurls.setMatrixAt(ushnishaCurlIndex++, ushnishaCurlTransform.matrix);
    }
  });
  ushnishaCurls.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  ushnishaCurls.instanceMatrix.needsUpdate = true;
  ushnishaCurls.name = 'BuddhaUshnishaCurls';
  ushnishaCurls.castShadow = true;
  ushnishaCurls.receiveShadow = false;
  statue.add(ushnishaCurls);
  // The nose is modeled as a continuous stone volume first; fine lines only describe its transitions.
  sphere(0.085, mats.statueStone, 0, 4.515, 0.69, 0.62, 1.45, 0.68, statue);
  sphere(0.075, mats.statueStone, 0, 4.425, 0.725, 0.92, 0.78, 0.72, statue);
  for (const side of [-1, 1]) {
    sphere(0.052, mats.statueStone, side * 0.092, 4.435, 0.69, 0.92, 0.72, 0.68, statue);
  }
  // Calm eyes, brows, nose and lips, carved shallow into the stone.
  const statueLine=(points,radius,material=mats.statueShadow)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(([x,y,z])=>new THREE.Vector3(x,y,z)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,18,radius,8,false),material);
    mesh.castShadow=true;statue.add(mesh);return mesh;
  };
  // Shallow inner-ear grooves make the elongated stone ears read as sculpted forms.
  for (const side of [-1, 1]) {
    statueLine([
      [side * 0.64, 4.68, 0.105],
      [side * 0.67, 4.58, 0.145],
      [side * 0.65, 4.45, 0.13],
      [side * 0.62, 4.42, 0.105]
    ], 0.012);
    statueLine([
      [side * 0.64, 4.58, 0.15],
      [side * 0.61, 4.53, 0.16],
      [side * 0.62, 4.49, 0.145]
    ], 0.009, mats.statueLight);
  }
  // Fine temple arcs connect the curled cap to the head silhouette.
  for (const side of [-1, 1]) {
    statueLine([
      [side * 0.56, 5.02, 0.49],
      [side * 0.52, 4.91, 0.55],
      [side * 0.49, 4.79, 0.57]
    ], 0.014, mats.statueLight);
  }
  for(const side of [-1,1]){
    statueLine([[side*0.43,4.75,0.59],[side*0.3,4.78,0.68],[side*0.16,4.75,0.7]],0.022);
    statueLine([[side*0.42,4.94,0.58],[side*0.28,4.99,0.65],[side*0.14,4.96,0.68]],0.025,mats.statueLight);
  }
  // Fine upper-lid folds and outer eye corners define the closed, meditative gaze.
  for (const side of [-1, 1]) {
    statueLine([
      [side * 0.43, 4.79, 0.59],
      [side * 0.31, 4.81, 0.665],
      [side * 0.18, 4.79, 0.695]
    ], 0.01, mats.statueShadow);
    statueLine([
      [side * 0.45, 4.755, 0.585],
      [side * 0.39, 4.735, 0.625]
    ], 0.008, mats.statueLight);
    statueLine([
      [side * 0.49, 4.77, 0.555],
      [side * 0.53, 4.745, 0.52]
    ], 0.008, mats.statueShadow);
  }
  // Lower eyelids and cheek transitions soften the serene carved expression.
  for (const side of [-1, 1]) {
    statueLine([
      [side * 0.43, 4.72, 0.59],
      [side * 0.3, 4.69, 0.665],
      [side * 0.17, 4.72, 0.69]
    ], 0.012, mats.statueLight);
    statueLine([
      [side * 0.49, 4.58, 0.52],
      [side * 0.38, 4.48, 0.62],
      [side * 0.2, 4.43, 0.68]
    ], 0.014, mats.statueShadow);
  }
  // Soft cheekbone highlights and jaw transitions give the face a gently sculpted profile.
  for (const side of [-1, 1]) {
    statueLine([
      [side * 0.5, 4.625, 0.53],
      [side * 0.37, 4.565, 0.635],
      [side * 0.22, 4.535, 0.685]
    ], 0.012, mats.statueLight);
    statueLine([
      [side * 0.48, 4.36, 0.54],
      [side * 0.34, 4.245, 0.625],
      [side * 0.16, 4.205, 0.685]
    ], 0.01, mats.statueShadow);
    statueLine([
      [side * 0.31, 4.205, 0.64],
      [side * 0.2, 4.17, 0.68],
      [side * 0.08, 4.16, 0.7]
    ], 0.008, mats.statueLight);
  }
  // A restrained lower-lip crease adds definition without a pronounced smile.
  statueLine([[-0.105,4.27,0.685],[0,4.255,0.715],[0.105,4.27,0.685]],0.009,mats.statueLight);
  // Refine the nose wings and philtrum with restrained, shallow stone carving.
  for (const side of [-1, 1]) {
    statueLine([
      [side * 0.045, 4.455, 0.716],
      [side * 0.105, 4.425, 0.704],
      [side * 0.145, 4.438, 0.68]
    ], 0.012, mats.statueShadow);
    statueLine([
      [side * 0.055, 4.405, 0.718],
      [side * 0.085, 4.395, 0.714]
    ], 0.008, mats.statueShadow);
    statueLine([
      [side * 0.025, 4.385, 0.721],
      [side * 0.04, 4.355, 0.72],
      [side * 0.075, 4.337, 0.705]
    ], 0.009, mats.statueLight);
  }
  statueLine([[-0.13,4.315,0.686],[0,4.325,0.718],[0.13,4.315,0.686]],0.011,mats.statueLight);
  statueLine([[0,4.78,0.69],[0.02,4.55,0.76],[-0.06,4.48,0.72]],0.035,mats.statueLight);
  statueLine([[-0.16,4.34,0.66],[0,4.30,0.72],[0.16,4.34,0.66]],0.024,mats.statueShadow);
  // The Buddha's urna is a restrained stone relief, not a metallic jewel.
  // A shallow shadow cradle and tiny ivory rise keep the forehead mark legible at portrait scale.
  statueLine([
    [-0.026, 5.025, 0.535],
    [-0.018, 5.042, 0.545],
    [0, 5.047, 0.55],
    [0.018, 5.042, 0.545],
    [0.026, 5.025, 0.535]
  ], 0.0055, mats.statueShadow);
  statueLine([
    [-0.015, 5.047, 0.548],
    [0, 5.052, 0.553],
    [0.015, 5.047, 0.548]
  ], 0.004, mats.statueLight);
  sphere(0.019, mats.statueLight, 0, 5.03, 0.557, 0.82, 1.12, 0.48, statue);

  // Hands rest together in a meditation mudra above the crossed legs.
  // Build the palms and digits as rounded stone volumes; avoid thin tube strokes that
  // read as spokes at portrait scale. Fingers extend toward the viewer in parallel.
  for (const side of [-1, 1]) {
    sphere(0.19, mats.statueStone, side * 0.19, 2.705, 0.755, 1.12, 0.48, 0.62, statue);
    for (let finger = 0; finger < 4; finger++) {
      const x = side * (0.085 + finger * 0.052);
      const length = 0.19 - finger * 0.012;
      const z = 0.83 + (finger % 2) * 0.012;
      sphere(0.052, mats.statueLight, x, 2.665, z + length * 0.48,
        0.58, 0.52, length / 0.052, statue);
      // Small knuckle reliefs sit flush with the finger volumes.
      sphere(0.018, mats.statueStone, x, 2.69, z + 0.035, 0.82, 0.55, 0.72, statue);
    }
  }
  // The thumbs curve inward and meet softly above the joined palms.
  for (const side of [-1, 1]) {
    sphere(0.065, mats.statueLight, side * 0.115, 2.775, 0.865, 1.0, 0.72, 1.35, statue);
    sphere(0.058, mats.statueLight, side * 0.055, 2.805, 0.91, 1.0, 0.72, 1.25, statue);
  }
  sphere(0.018, mats.statueShadow, 0, 2.84, 0.925, 0.8, 0.6, 0.7, statue);
  // Fine wrist transitions and palm creases finish the joined meditation hands.
  for (const side of [-1, 1]) {
    const wristCrease = [
      [side * 0.31, 2.69, 0.82],
      [side * 0.38, 2.705, 0.817],
      [side * 0.445, 2.72, 0.79]
    ];
    statueLine(wristCrease, 0.008, mats.statueShadow);
    statueLine(wristCrease.map(([x, y, z]) => [x - side * 0.008, y + 0.014, z + 0.004]), 0.0055, mats.statueLight);
    const palmCrease = [
      [side * 0.105, 2.655, 0.795],
      [side * 0.2, 2.665, 0.806],
      [side * 0.295, 2.69, 0.795]
    ];
    statueLine(palmCrease, 0.007, mats.statueShadow);
    statueLine(palmCrease.map(([x, y, z]) => [x + side * 0.006, y + 0.012, z + 0.005]), 0.005, mats.statueLight);
  }
  // Broad carved stone aureole behind the Buddha.
  const halo = new THREE.Group(); halo.position.set(0,5.25,-8.8); world.add(halo);
  const haloStone = new THREE.MeshStandardMaterial({color:0xa59a83,roughness:0.9,metalness:0.02,side:THREE.DoubleSide});
  const haloDisc = new THREE.Mesh(new THREE.CircleGeometry(2.05,64),haloStone); halo.add(haloDisc);
  const haloRim = new THREE.Mesh(new THREE.TorusGeometry(2.05,0.12,12,96),mats.statueLight); halo.add(haloRim);
  const haloInner = new THREE.Mesh(new THREE.TorusGeometry(1.82,0.035,8,96),mats.goldBright); haloInner.position.z=0.03; halo.add(haloInner);
  // Fine outer filigree gives the aureole a finished ceremonial edge without
  // adding dozens of independent draw calls.
  const haloOuter = new THREE.Mesh(new THREE.TorusGeometry(2.3,0.035,8,96),mats.gold);
  haloOuter.position.z = -0.025;
  halo.add(haloOuter);
  const haloBeads = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.045,8,6), mats.goldBright, 32
  );
  const haloBeadTransform = new THREE.Object3D();
  for (let i = 0; i < 32; i++) {
    const angle = i * Math.PI * 2 / 32;
    haloBeadTransform.position.set(Math.cos(angle) * 2.3, Math.sin(angle) * 2.3, 0.025);
    haloBeadTransform.updateMatrix();
    haloBeads.setMatrixAt(i, haloBeadTransform.matrix);
  }
  haloBeads.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  halo.add(haloBeads);
  const haloGiftAuraMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd58a, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  const haloGiftAura = new THREE.Mesh(new THREE.TorusGeometry(2.48, 0.055, 8, 112), haloGiftAuraMaterial);
  haloGiftAura.position.z = 0.08;
  halo.add(haloGiftAura);
  const haloGlow = new THREE.PointLight(0xffbd69, 8, 7, 2);
  haloGlow.position.set(0, 5.25, -8.55);
  world.add(haloGlow);
  for(let n=0;n<24;n++){
    const a=n*Math.PI/12;
    const ray=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.42,8),mats.statueLight);
    ray.position.set(Math.cos(a)*2.2,Math.sin(a)*2.2,0);
    ray.rotation.z=a-Math.PI/2;halo.add(ray);
  }
  // Repeating carved flame leaves turn the plain disc into a traditional aureole.
  for(let n=0;n<12;n++){
    const a=n*Math.PI/6;
    const flameShape=new THREE.Shape();
    flameShape.moveTo(-0.13,-0.12);
    flameShape.quadraticCurveTo(-0.22,0.12,0,0.42);
    flameShape.quadraticCurveTo(0.22,0.12,0.13,-0.12);
    flameShape.quadraticCurveTo(0,-0.02,-0.13,-0.12);
    const flameMesh=new THREE.Mesh(new THREE.ShapeGeometry(flameShape),haloStone);
    flameMesh.position.set(Math.cos(a)*1.72,Math.sin(a)*1.72,0.055);
    flameMesh.rotation.z=a-Math.PI/2;
    halo.add(flameMesh);
    const vein=new THREE.Mesh(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0,-0.08,0.07),
        new THREE.Vector3(0.015,0.08,0.07),
        new THREE.Vector3(0,0.28,0.07)
      ]),10,0.012,6,false
    ),mats.statueLight);
    vein.position.copy(flameMesh.position);
    vein.rotation.z=flameMesh.rotation.z;
    halo.add(vein);
  }

  // Painted Buddhist ceiling fascia: a warm, ornamented upper backdrop fills
  // the dark void above the altar without placing an opaque roof in the camera path.
  const ceilingFascia = new THREE.Group();
  ceilingFascia.name = 'PaintedBuddhistCeilingFascia';
  ceilingFascia.position.set(0, 9.45, -11.78);
  world.add(ceilingFascia);
  const fasciaPanelMat = new THREE.MeshStandardMaterial({
    color: 0xd7b77b, roughness: 0.86, metalness: 0.08,
    emissive: 0x38200c, emissiveIntensity: 0.12
  });
  const fasciaInsetMat = new THREE.MeshStandardMaterial({
    color: 0x7d2630, roughness: 0.72, metalness: 0.12
  });
  box(11.8, 3.25, 0.16, mats.wood, 0, 0, 0, ceilingFascia);
  box(11.52, 3.0, 0.08, fasciaPanelMat, 0, 0, 0.105, ceilingFascia);
  box(11.3, 0.075, 0.1, mats.goldBright, 0, 1.43, 0.17, ceilingFascia);
  box(11.3, 0.075, 0.1, mats.goldBright, 0, -1.43, 0.17, ceilingFascia);
  for (const x of [-5.55, 5.55]) {
    box(0.075, 2.86, 0.1, mats.goldBright, x, 0, 0.17, ceilingFascia);
  }
  // The upper wall now uses a painted Buddhist mural image rather than five
  // isolated circles; the original frame remains visible around the artwork.
  addSanctuaryImagePlane(
    'PaintedLotusCeilingMural',
    '/assets/temple-kit/ceiling-mural.svg',
    11.0, 2.76, [0, 9.45, -11.555], [0, 0, 0],
    { unlit: true }
  );
  // Small warm fill keeps the painted panel legible without washing out the Buddha.
  const muralLight = new THREE.PointLight(0xffd99c, 8, 17, 2);
  muralLight.position.set(0, 10.2, -8.8);
  world.add(muralLight);

  // Resident abbot: a calm, bald monk in layered saffron robes, standing beside
  // the offering table with palms joined. Kept separate from the TikTok visitor queue.
  function makeTempleAbbot() {
    const root = new THREE.Group();
    root.name = 'TempleResidentAbbot';
    root.position.set(2.85, 0.035, -3.65);
    // Turn diagonally toward the congregation rather than keeping his back to it.
    root.rotation.y = Math.atan2(-2.85, 2.3);
    root.scale.setScalar(1.34);

    const robe = new THREE.MeshStandardMaterial({ color: 0xc96e1f, roughness: 0.88, metalness: 0.025 });
    const robeLight = new THREE.MeshStandardMaterial({ color: 0xe58d35, roughness: 0.82, metalness: 0.035 });
    const robeShadow = new THREE.MeshStandardMaterial({ color: 0x873e17, roughness: 0.92 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb98260, roughness: 0.86 });
    const faceShadow = new THREE.MeshStandardMaterial({ color: 0x57372a, roughness: 0.9 });
    const eyes = new THREE.MeshStandardMaterial({ color: 0x241811, roughness: 0.58 });

    sphere(0.12, robeShadow, -0.13, 0.105, 0.015, 1.35, 0.38, 1.72, root);
    sphere(0.12, robeShadow, 0.13, 0.105, 0.015, 1.35, 0.38, 1.72, root);
    cylinder(0.245, 0.37, 1.25, robe, 0, 0.76, 0, root, 28);
    const breathingTorso = sphere(0.34, robe, 0, 1.32, 0, 1.08, 0.9, 0.78, root);
    sphere(0.37, robeLight, 0, 1.48, -0.02, 1.04, 0.47, 0.76, root);

    const foldCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.29, 1.57, 0.11),
      new THREE.Vector3(-0.13, 1.36, 0.24),
      new THREE.Vector3(0.02, 1.08, 0.30),
      new THREE.Vector3(0.15, 0.72, 0.29)
    ]);
    const robeFoldMesh = new THREE.Mesh(
      new THREE.TubeGeometry(foldCurve, 24, 0.022, 7, false), robeShadow
    );
    robeFoldMesh.castShadow = true;
    root.add(robeFoldMesh);

    const addLimb = (start, end, radius, material) => {
      const from = new THREE.Vector3(...start);
      const to = new THREE.Vector3(...end);
      const direction = to.clone().sub(from);
      const length = direction.length();
      const geometry = getPrimitiveGeometry(
        `abbot-limb:${radius}:${length.toFixed(3)}`,
        () => new THREE.CylinderGeometry(radius * 0.92, radius, length, 12)
      );
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(from).add(to).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    };
    for (const side of [-1, 1]) {
      addLimb([side * 0.29, 1.48, 0.02], [side * 0.16, 1.30, 0.25], 0.145, robeLight);
      addLimb([side * 0.16, 1.30, 0.25], [side * 0.055, 1.34, 0.37], 0.095, robe);
      sphere(0.09, robeLight, side * 0.18, 1.29, 0.24, 1.05, 1.12, 1.0, root);
      sphere(0.078, skin, side * 0.045, 1.345, 0.405, 0.72, 1.45, 0.48, root);
      sphere(0.055, skin, side * 0.026, 1.405, 0.418, 0.82, 0.78, 0.44, root);
    }

    const headPivot = new THREE.Group();
    headPivot.name = 'AbbotRespectfulBowHeadPivot';
    headPivot.position.set(0, 1.72, 0);
    root.add(headPivot);
    cylinder(0.12, 0.14, 0.2, skin, 0, -0.11, 0.015, headPivot, 18);
    sphere(0.245, skin, 0, 0.10, 0.02, 0.9, 1.07, 0.82, headPivot);
    for (const side of [-1, 1]) {
      sphere(0.055, skin, side * 0.22, 0.10, 0.005, 0.78, 1.08, 0.65, headPivot);
      sphere(0.018, eyes, side * 0.083, 0.13, 0.216, 0.78, 0.8, 0.45, headPivot);
      const brow = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.14, 0.18, 0.198),
        new THREE.Vector3(side * 0.085, 0.205, 0.214),
        new THREE.Vector3(side * 0.035, 0.18, 0.218)
      ]);
      const browMesh = new THREE.Mesh(
        new THREE.TubeGeometry(brow, 10, 0.009, 5, false), faceShadow
      );
      browMesh.castShadow = false;
      headPivot.add(browMesh);
    }
    sphere(0.032, skin, 0, 0.065, 0.232, 0.88, 1.25, 0.9, headPivot);
    const mouth = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.055, 0, 0.211),
      new THREE.Vector3(0, -0.012, 0.224),
      new THREE.Vector3(0.055, 0, 0.211)
    ]);
    const mouthMesh = new THREE.Mesh(new THREE.TubeGeometry(mouth, 10, 0.008, 5, false), faceShadow);
    mouthMesh.castShadow = false;
    headPivot.add(mouthMesh);

    root.userData.kind = 'resident-abbot';
    root.userData.pose = 'standing-prayer';
    root.userData.breathingTorso = breathingTorso;
    root.userData.headPivot = headPivot;
    world.add(root);
    window.__TEMPLE_ABBOT_DIAGNOSTIC__ = {
      visible: true, kind: 'resident-abbot', pose: 'standing-prayer',
      position: root.position.toArray(), height: 2.61, facing: 'devotees', bowAmount: 0
    };
    return root;
  }
  const templeAbbot = makeTempleAbbot();

  // Main hall architecture: paired carved pillars and short side crossbeams; roof intentionally removed.
  for (const x of [-7.2, 7.2]) {
    for (const z of [-10, -4, 2, 8, 13]) {
      cylinder(0.42, 0.5, 8.2, mats.woodLight, x, 4.05, z, world, 24);
      cylinder(0.62, 0.62, 0.42, mats.gold, x, 0.32, z, world, 24);
      cylinder(0.58, 0.68, 0.35, mats.goldBright, x, 7.95, z, world, 24);
      cylinder(0.47, 0.47, 0.18, mats.red, x, 5.4, z, world, 24);
    }
  }
  // Fine gilded fluting on the timber columns: one instanced draw call
  // keeps the repeated architectural detail inexpensive on live-stream devices.
  const columnFluteGeometry = new THREE.CylinderGeometry(0.012, 0.012, 5.9, 6);
  const columnFlutes = new THREE.InstancedMesh(
    columnFluteGeometry, mats.goldBright, 10 * 8
  );
  const fluteTransform = new THREE.Object3D();
  let fluteIndex = 0;
  for (const x of [-7.2, 7.2]) {
    for (const z of [-10, -4, 2, 8, 13]) {
      for (let rib = 0; rib < 8; rib++) {
        const angle = rib * Math.PI / 4;
        fluteTransform.position.set(
          x + Math.cos(angle) * 0.432,
          4.05,
          z + Math.sin(angle) * 0.432
        );
        fluteTransform.updateMatrix();
        columnFlutes.setMatrixAt(fluteIndex++, fluteTransform.matrix);
      }
    }
  }
  columnFlutes.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  columnFlutes.castShadow = false;
  columnFlutes.receiveShadow = true;
  world.add(columnFlutes);

  // Slim brass collars finish the foot and crown of each timber column.
  // One instanced batch keeps this architectural polish to a single extra draw call.
  const columnCollarGeometry = new THREE.TorusGeometry(0.49, 0.035, 8, 24);
  const columnCollars = new THREE.InstancedMesh(columnCollarGeometry, mats.goldBright, 10 * 2);
  const collarTransform = new THREE.Object3D();
  let collarIndex = 0;
  for (const x of [-7.2, 7.2]) {
    for (const z of [-10, -4, 2, 8, 13]) {
      for (const y of [0.86, 7.18]) {
        collarTransform.position.set(x, y, z);
        collarTransform.rotation.set(Math.PI / 2, 0, 0);
        collarTransform.scale.set(1, 1, 1);
        collarTransform.updateMatrix();
        columnCollars.setMatrixAt(collarIndex++, collarTransform.matrix);
      }
    }
  }
  columnCollars.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  columnCollars.castShadow = false;
  columnCollars.receiveShadow = true;
  world.add(columnCollars);

  // Front-facing ruby-and-brass diamond plaques add a carved rhythm to each
  // pillar without changing its silhouette or introducing per-piece draw calls.
  const columnPlaqueGeometry = new THREE.BoxGeometry(0.16, 0.16, 0.035);
  const columnPlaques = new THREE.InstancedMesh(columnPlaqueGeometry, mats.goldBright, 10 * 3);
  const columnPlaqueGemGeometry = new THREE.SphereGeometry(0.052, 10, 8);
  const columnPlaqueGems = new THREE.InstancedMesh(columnPlaqueGemGeometry, mats.redBright, 10 * 3);
  const plaqueTransform = new THREE.Object3D();
  let plaqueIndex = 0;
  for (const x of [-7.2, 7.2]) {
    for (const z of [-10, -4, 2, 8, 13]) {
      for (const y of [1.55, 4.05, 6.55]) {
        plaqueTransform.position.set(x, y, z + 0.445);
        plaqueTransform.rotation.set(0, 0, Math.PI / 4);
        plaqueTransform.scale.set(1, 1, 1);
        plaqueTransform.updateMatrix();
        columnPlaques.setMatrixAt(plaqueIndex, plaqueTransform.matrix);
        plaqueTransform.position.z = z + 0.47;
        plaqueTransform.rotation.set(0, 0, 0);
        plaqueTransform.scale.set(1, 1, 0.42);
        plaqueTransform.updateMatrix();
        columnPlaqueGems.setMatrixAt(plaqueIndex, plaqueTransform.matrix);
        plaqueIndex++;
      }
    }
  }
  columnPlaques.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  columnPlaqueGems.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  columnPlaques.castShadow = columnPlaqueGems.castShadow = false;
  columnPlaques.receiveShadow = columnPlaqueGems.receiveShadow = true;
  world.add(columnPlaques, columnPlaqueGems);

  // Keep the central sightline to the Buddha open. Full-width crossbeams and
  // the low ceiling slab previously projected as opaque black bands over the altar.
  for (const z of [-10, -4, 2, 8, 13]) {
    box(1.6,0.28,0.42,mats.wood, -7.2,8.15,z);
    box(1.6,0.28,0.42,mats.wood, 7.2,8.15,z);
  }
  // Open-air sanctuary: keep the upper sightline clear while the side pillars frame the altar.

  // Raised side galleries add a second architectural plane beyond the columns.
  // Keep them low and peripheral so the Buddha remains the dominant focal point.
  for (const side of [-1, 1]) {
    const x = side * 9.15;
    box(2.35, 0.18, 25.5, mats.wood, x, -0.055, 2.2);
    box(2.2, 0.045, 25.2, mats.stone, x, 0.06, 2.2);
    box(0.055, 0.035, 25.0, mats.goldBright, side * 10.25, 0.1, 2.2);
    for (const z of [-9.8, -3.5, 2.8, 9.1, 14.2]) {
      box(2.05, 0.035, 0.07, mats.gold, x, 0.095, z);
    }
  }

  // Open timber balustrades finish the outer edge of each raised gallery.
  // The waist-high rails define the space without forming walls across the camera view.
  for (const side of [-1, 1]) {
    const railX = side * 10.18;
    box(0.14, 0.14, 24.8, mats.woodLight, railX, 0.66, 2.2);
    box(0.1, 0.09, 24.8, mats.goldBright, railX, 0.79, 2.2);
    for (let z = -9.2; z <= 14.0; z += 3.3) {
      box(0.18, 0.82, 0.18, mats.woodLight, railX, 0.48, z);
      box(0.25, 0.09, 0.25, mats.gold, railX, 0.94, z);
      sphere(0.075, mats.goldBright, railX, 1.02, z, 1, 0.7, 1);
    }
  }

  // Lunar New Year dressing: yellow mai and pink peach blossoms, lucky red couplets,
  // and warm red lanterns bring a clear Tet identity while keeping the Buddha visible.
  const tetBlossomMaterials = {
    mai: new THREE.MeshStandardMaterial({ color: 0xffd35a, roughness: 0.58, metalness: 0.08 }),
    peach: new THREE.MeshStandardMaterial({ color: 0xf0a2b3, roughness: 0.62, metalness: 0.04 }),
    center: new THREE.MeshStandardMaterial({ color: 0xffed9a, roughness: 0.42, metalness: 0.26 })
  };
  const springDecorTrees = [];
  function makeTetBlossomTree(side) {
    const tree = new THREE.Group();
    tree.name = side < 0 ? 'TetMaiBlossomTree' : 'TetPeachBlossomTree';
    tree.position.set(side * 4.28, 0, -9.22);
    tree.userData.phase = side < 0 ? 0.4 : 2.2;
    world.add(tree);

    cylinder(0.34, 0.27, 0.5, mats.redBright, 0, 0.27, 0, tree, 24);
    cylinder(0.38, 0.38, 0.075, mats.goldBright, 0, 0.51, 0, tree, 24);
    cylinder(0.25, 0.31, 0.09, mats.gold, 0, 0.045, 0, tree, 24);

    const branch = (points, radius) => {
      const curve = new THREE.CatmullRomCurve3(points.map((point) =>
        new THREE.Vector3(point[0], point[1], point[2])
      ));
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 7, false), mats.woodLight);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      tree.add(mesh);
    };
    branch([[0, 0.48, 0], [0.04, 1.18, 0], [-side * 0.12, 1.8, 0.02], [-side * 0.48, 2.48, 0.05]], 0.065);
    branch([[0.01, 1.25, 0], [side * 0.28, 1.78, 0.02], [side * 0.62, 2.34, 0.05], [side * 0.86, 2.82, 0.07]], 0.044);
    branch([[-side * 0.1, 1.8, 0.02], [-side * 0.42, 2.08, 0.04], [-side * 0.86, 2.12, 0.06]], 0.032);
    branch([[-side * 0.3, 2.18, 0.03], [-side * 0.25, 2.67, 0.06], [-side * 0.36, 3.05, 0.07]], 0.026);

    const clusters = [
      [-side * 0.54, 2.53, 0.11], [-side * 0.88, 2.13, 0.1],
      [side * 0.62, 2.37, 0.11], [side * 0.88, 2.85, 0.11],
      [-side * 0.31, 3.04, 0.1], [side * 0.31, 1.85, 0.1],
      [-side * 0.08, 2.45, 0.13]
    ];
    const petalMaterial = side < 0 ? tetBlossomMaterials.mai : tetBlossomMaterials.peach;
    for (const [cx, cy, cz] of clusters) {
      for (let petal = 0; petal < 5; petal++) {
        const angle = petal * Math.PI * 2 / 5;
        const bloom = sphere(0.068, petalMaterial,
          cx + Math.cos(angle) * 0.075, cy + Math.sin(angle) * 0.075, cz,
          0.78, 1.15, 0.48, tree);
        bloom.rotation.z = angle;
        bloom.castShadow = false;
      }
      sphere(0.034, tetBlossomMaterials.center, cx, cy, cz + 0.045, 1, 1, 0.72, tree).castShadow = false;
    }
    springDecorTrees.push(tree);
    return tree;
  }
  makeTetBlossomTree(-1);
  makeTetBlossomTree(1);

  function makeTetCouplet(label, x) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1024;
    const context = canvas.getContext('2d');
    context.fillStyle = '#9d1722';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#eac66c';
    context.lineWidth = 13;
    context.strokeRect(13, 13, canvas.width - 26, canvas.height - 26);
    context.lineWidth = 4;
    context.strokeRect(27, 27, canvas.width - 54, canvas.height - 54);
    context.fillStyle = '#ffe09a';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = 'bold 132px serif';
    context.shadowColor = 'rgba(255,215,120,.55)';
    context.shadowBlur = 18;
    context.fillText(label, 128, 485, 190);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxTextureAnisotropy;
    const material = new THREE.MeshStandardMaterial({
      map: texture, roughness: 0.58, metalness: 0.08,
      emissive: 0x5a1008, emissiveIntensity: 0.18,
      side: THREE.DoubleSide
    });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.85), material);
    plaque.name = `TetLuckyCouplet_${label}`;
    plaque.position.set(x, 4.25, -10.985);
    plaque.castShadow = false;
    plaque.receiveShadow = false;
    world.add(plaque);
    box(0.72, 0.085, 0.12, mats.goldBright, x, 5.72, -10.94);
    box(0.72, 0.085, 0.12, mats.goldBright, x, 2.78, -10.94);
    return plaque;
  }
  makeTetCouplet('PHÚC', -4.55);
  makeTetCouplet('LỘC', 4.55);

  const tetLanterns = [];
  for (const side of [-1, 1]) {
    const lantern = new THREE.Group();
    lantern.name = 'TetRedLantern';
    lantern.position.set(side * 5.45, 5.62, -10.55);
    world.add(lantern);
    cylinder(0.22, 0.25, 0.52, mats.redBright, 0, -0.04, 0, lantern, 20);
    cylinder(0.25, 0.25, 0.075, mats.goldBright, 0, 0.25, 0, lantern, 20);
    cylinder(0.25, 0.25, 0.075, mats.goldBright, 0, -0.33, 0, lantern, 20);
    cylinder(0.035, 0.035, 0.28, mats.gold, 0, -0.5, 0, lantern, 10);
    sphere(0.055, mats.redBright, 0, -0.67, 0, 1, 1.35, 1, lantern);
    const light = new THREE.PointLight(0xffc067, 8, 4.4, 2);
    light.position.set(0, -0.02, 0);
    lantern.add(light);
    tetLanterns.push(light);
  }
  window.__TEMPLE_TET_DIAGNOSTIC__ = {
    enabled: true, season: 'Lunar New Year / Tet',
    blossomTreeCount: springDecorTrees.length, coupletCount: 2,
    redLanternCount: tetLanterns.length, couplets: ['PHÚC', 'LỘC']
  };

  // Lanterns with warm emissive cores along the side aisles.
  const lanterns = [];
  for (const x of [-5.8, 5.8]) {
    for (const z of [-7, -1, 5, 11]) {
      const lantern = new THREE.Group(); lantern.position.set(x, 6.6, z); world.add(lantern);
      box(0.72, 0.12, 0.72, mats.gold, 0, 0.6, 0, lantern);
      box(0.55, 1.05, 0.55, mats.ivory, 0, 0, 0, lantern);
      box(0.72, 0.12, 0.72, mats.goldBright, 0, -0.58, 0, lantern);
      // Four distributed point lights illuminate all eight lanterns. The
      // remaining fixtures stay visible under the scene's existing key/fill lights,
      // avoiding eight extra point lights.
      if (z === -7 || z === 5) {
        const light = new THREE.PointLight(0xffb84d, 13, 5, 2);
        light.position.set(0, 0, 0);
        lantern.add(light);
        lanterns.push(light);
      }
    }
  }

  // Brass incense burner in the front of the dais.
  const burner = new THREE.Group(); burner.position.set(0, 0.2, -5.6); world.add(burner);
  cylinder(0.62, 0.8, 0.45, mats.gold, 0, 0.45, 0, burner, 32);
  cylinder(0.72, 0.72, 0.16, mats.goldBright, 0, 0.72, 0, burner, 32);
  cylinder(0.08, 0.08, 0.9, mats.woodLight, 0, 1.28, 0, burner, 12);
  sphere(0.11, mats.redBright, 0, 1.76, 0, 1, 1, 1, burner);

  // Three ritual stations are modeled as actual sanctuary props, not flat HUD icons.
  // They sit just inside the side colonnade, within the fixed portrait camera frustum.
  const ritualStations = [];
  function makeRitualStation(x, z, kind) {
    const station = new THREE.Group();
    station.name = kind === 'bell' ? 'StandingAltarBellStation' : `RitualStation:${kind}`;
    station.position.set(kind === 'bell' ? -2.2 : x, kind === 'bell' ? 1.92 : 0.16, kind === 'bell' ? -5.85 : z);
    station.userData.ritualKind = kind;
    station.userData.animation = {
      startedAt: 0, duration: 0,
      bellPivot: null, malletPivot: null, drum: null, fortuneDrum: null
    };
    world.add(station);
    if (kind === 'bell') {
      // The altar surface is y=1.92. The lacquered stand rests directly on it,
      // and the bronze bell stands upright on its flared lower rim.
      box(0.92, 0.14, 0.92, mats.wood, 0, 0.07, 0, station);
      box(0.98, 0.045, 0.98, mats.gold, 0, 0.16, 0, station);
      const bellPivot = new THREE.Group();
      bellPivot.position.set(0, 0.18, 0);
      station.add(bellPivot);
      cylinder(0.38, 0.46, 0.72, mats.gold, 0, 0.36, 0, bellPivot, 32);
      cylinder(0.47, 0.47, 0.08, mats.goldBright, 0, 0.055, 0, bellPivot, 32);
      cylinder(0.17, 0.21, 0.12, mats.gold, 0, 0.75, 0, bellPivot, 20);
      sphere(0.085, mats.goldBright, 0, 0.84, 0, 1, 1.15, 1, bellPivot);
      const clapper = cylinder(0.026, 0.026, 0.22, mats.goldBright, 0, 0.36, 0, bellPivot, 10);
      clapper.position.z = 0.01;
      station.userData.animation.bellPivot = bellPivot;
      station.userData.standingOnAltar = true;
    } else {
      box(1.55, 0.22, 1.45, mats.wood, 0, 0, 0, station);
      box(1.62, 0.07, 1.52, mats.gold, 0, 0.14, 0, station);
      box(1.42, 0.12, 1.32, mats.woodLight, 0, 0.23, 0, station);
    }
    if (kind === 'bell') {
      // The upright bell rocks gently on its pedestal when struck.
    } else if (kind === 'woodfish') {
      const drum = new THREE.Mesh(new THREE.SphereGeometry(0.48, 24, 18), mats.red);
      drum.scale.set(1.2, 0.76, 0.82); drum.position.set(0, 0.72, 0);
      drum.castShadow = true; station.add(drum);
      sphere(0.09, mats.goldBright, 0, 0.76, 0.39, 1, 0.7, 0.35, station);
      const malletPivot = new THREE.Group();
      malletPivot.position.set(0.58, 1.05, 0);
      station.add(malletPivot);
      const mallet = cylinder(0.055, 0.055, 0.72, mats.woodLight, 0, -0.29, 0, malletPivot, 10);
      mallet.rotation.z = -0.65;
      station.userData.animation.malletPivot = malletPivot;
      station.userData.animation.drum = drum;
    } else {
      // Keep all fortune-cylinder details under one pivot for a believable spin.
      const fortuneDrum = new THREE.Group();
      fortuneDrum.position.set(0, 0.72, 0);
      station.add(fortuneDrum);
      cylinder(0.34, 0.42, 0.82, mats.red, 0, 0, 0, fortuneDrum, 12);
      cylinder(0.38, 0.38, 0.08, mats.goldBright, 0, 0.42, 0, fortuneDrum, 16);
      cylinder(0.38, 0.38, 0.08, mats.gold, 0, -0.42, 0, fortuneDrum, 16);
      for (let i = 0; i < 9; i++) {
        const angle = i * Math.PI * 2 / 9;
        cylinder(0.018, 0.018, 0.72, mats.woodLight, Math.cos(angle) * 0.2, 0, Math.sin(angle) * 0.2, fortuneDrum, 6);
      }
      sphere(0.1, mats.goldBright, 0, 0.53, 0, 1, 0.8, 1, fortuneDrum);
      station.userData.animation.fortuneDrum = fortuneDrum;
    }
    ritualStations.push(station);
  }
  makeRitualStation(-2.2, -5.85, 'bell');
  makeRitualStation(3.75, -1.2, 'woodfish');
  makeRitualStation(3.75, -5.4, 'fortune');

  // Raycast the visible 3D props so the world itself becomes the ritual menu.
  // The existing ritual event bus remains the single source of action behavior.
  const ritualActionByKind = {
    bell: 'ringBell',
    woodfish: 'strikeWoodenFish',
    fortune: 'drawFortune'
  };
  const ritualHitMeshes = [];
  for (const station of ritualStations) {
    const kind = station.userData.ritualKind;
    station.traverse((object) => {
      if (!object.isMesh) return;
      object.userData.ritualKind = kind;
      ritualHitMeshes.push(object);
    });
  }
  const ritualRaycaster = new THREE.Raycaster();
  const ritualPointer = new THREE.Vector2();
  let hoveredRitualStation = null;
  let pressedRitualStation = null;

  function ritualStationAtPointer(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    ritualPointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    ritualRaycaster.setFromCamera(ritualPointer, camera);
    const hit = ritualRaycaster.intersectObjects(ritualHitMeshes, false)[0];
    return hit?.object?.userData?.ritualKind
      ? ritualStations.find((station) => station.userData.ritualKind === hit.object.userData.ritualKind)
      : null;
  }

  function triggerRitualStation(kind) {
    const station = ritualStations.find((item) => item.userData.ritualKind === kind);
    if (!station) return;
    const animation = station.userData.animation;
    animation.startedAt = performance.now();
    animation.duration = kind === 'bell' ? 1400 : kind === 'woodfish' ? 720 : 1900;
  }

  function updateRitualStationAnimations(now) {
    for (const station of ritualStations) {
      const animation = station.userData.animation;
      if (!animation.startedAt) continue;
      const progress = Math.min(1, (now - animation.startedAt) / animation.duration);
      const fade = 1 - progress;
      if (animation.bellPivot) {
        animation.bellPivot.rotation.z = Math.sin(progress * Math.PI * 8) * 0.17 * fade;
      }
      if (animation.malletPivot) {
        animation.malletPivot.rotation.z = Math.sin(progress * Math.PI * 4) * 0.46 * fade;
        if (animation.drum) {
          animation.drum.scale.y = 0.76 + Math.max(0, Math.cos(progress * Math.PI * 4)) * 0.055 * fade;
        }
      }
      if (animation.fortuneDrum) {
        const spinEase = 1 - Math.pow(1 - progress, 3);
        animation.fortuneDrum.rotation.y = Math.PI * 2 * 3 * spinEase;
      }
      if (progress >= 1) {
        animation.startedAt = 0;
        if (animation.bellPivot) animation.bellPivot.rotation.z = 0;
        if (animation.malletPivot) animation.malletPivot.rotation.z = 0;
        if (animation.drum) animation.drum.scale.y = 0.76;
      }
    }
  }

  function setHoveredRitualStation(station) {
    if (hoveredRitualStation === station) return;
    if (hoveredRitualStation) hoveredRitualStation.scale.setScalar(1);
    hoveredRitualStation = station;
    if (hoveredRitualStation) hoveredRitualStation.scale.setScalar(1.045);
    canvas.style.cursor = hoveredRitualStation ? 'pointer' : '';
  }

  function onWorldPointerMove(event) {
    if (!event.isPrimary) return;
    setHoveredRitualStation(ritualStationAtPointer(event));
  }

  function onWorldPointerDown(event) {
    if (!event.isPrimary || event.button !== 0) return;
    pressedRitualStation = ritualStationAtPointer(event);
  }

  function onWorldPointerUp(event) {
    if (!event.isPrimary || event.button !== 0) return;
    const station = ritualStationAtPointer(event);
    const pressedStation = pressedRitualStation;
    pressedRitualStation = null;
    if (!station || station !== pressedStation) return;
    const action = ritualActionByKind[station.userData.ritualKind];
    if (action) {
      window.dispatchEvent(new CustomEvent('temple:ritual', { detail: { type: action } }));
    }
  }

  function onWorldPointerCancel() {
    pressedRitualStation = null;
  }

  function onWorldPointerLeave() {
    setHoveredRitualStation(null);
  }
  canvas.addEventListener('pointermove', onWorldPointerMove, { passive: true });
  canvas.addEventListener('pointerdown', onWorldPointerDown);
  canvas.addEventListener('pointerup', onWorldPointerUp);
  canvas.addEventListener('pointercancel', onWorldPointerCancel);
  canvas.addEventListener('pointerleave', onWorldPointerLeave);

  // Stylized human devotees replace the temporary animal crowd.
  // The avatar is deliberately built from lightweight Three.js geometry so it
  // is local, deterministic and does not depend on a third-party model host.
  const allHumanAvatars = [];
  // Male/female Vietnamese Ao Dai avatars. Both variants are prebuilt once
  // per visitor and share identical animation pivots, so switching clothing
  // never resets the current walk, queue or ritual state.
  const devoteeAppearanceAssignments = new WeakMap();
  let nextDevoteeAppearanceIndex = 0;

  function getDevoteeAppearance(event) {
    if (event && typeof event === 'object') {
      const existing = devoteeAppearanceAssignments.get(event);
      if (existing) return existing;
      const appearance = getAoDaiAppearance(nextDevoteeAppearanceIndex++);
      devoteeAppearanceAssignments.set(event, appearance);
      return appearance;
    }
    return getAoDaiAppearance(nextDevoteeAppearanceIndex++);
  }

  function setHumanAppearance(avatar, appearance = getAoDaiAppearance(0)) {
    const gender = appearance?.gender === 'female' ? 'female' : 'male';
    const rig = avatar.variants[gender];
    for (const [variantGender, variant] of Object.entries(avatar.variants)) {
      // Recycled queue actors may already have an imported GLTF body. Never
      // reactivate the procedural Ao Dai fallback when changing their outfit.
      variant.group.visible = !avatar.gltfRoot && variantGender === gender;
    }
    avatar.gender = gender;
    avatar.appearance = {
      gender,
      paletteIndex: Number.isInteger(appearance?.paletteIndex) ? appearance.paletteIndex : 0,
      sequence: Number.isInteger(appearance?.sequence) ? appearance.sequence : 0
    };
    for (const key of [
      'upperBody', 'torso', 'tunicShell', 'head',
      'eyeWhites', 'eyePupils', 'eyebrows', 'smile',
      'leftArm', 'rightArm', 'leftHand', 'rightHand',
      'leftLeg', 'rightLeg', 'leftKnee', 'rightKnee',
      'leftFoot', 'rightFoot', 'wardrobeMaterials'
    ]) {
      avatar[key] = rig[key];
    }
    return avatar;
  }

  function makeHumanAvatar(height = 1.55, appearance = getAoDaiAppearance(allHumanAvatars.length)) {
    const root = new THREE.Group();
    // The altar is at -Z; turn the avatar away from the +Z camera so devotees face it.
    root.rotation.y = Math.PI;
    const variants = createAoDaiAvatarVariants(THREE, { height, appearance });
    root.add(variants.male.group, variants.female.group);
    const avatar = {
      root,
      variants,
      phase: Math.random() * Math.PI * 2,
      headingOffset: 0,
      prayerPose: false,
      gltfRoot: null,
      gltfMixer: null,
      gltfActions: null,
      gltfActionName: null,
      gltfLastTime: 0,
      lastHumanPoseTime: 0,
      walkBlend: 0,
      gltfRig: null,
      bowing: false,
      bowAmount: 0,
      kneeling: false,
      kneelBlend: 0,
      giftReactionStartedAt: 0,
      giftReactionUntil: 0,
      giftReactionProfile: { tier: 'small', intensity: 0.62, bowAmount: 0.16, durationMs: 2100 },
      queueWaiting: false,
      queuedWorshipLane: false,
      ritualBowPhase: 'idle',
      ritualBowCycle: 0
    };
    setHumanAppearance(avatar, appearance);
    allHumanAvatars.push(avatar);
    if (devoteeModelsRequested && devoteeModelAssets) void upgradeDevoteesFromGLB();
    return avatar;
  }

  function playGLTFHumanAction(avatar, mode) {
    if (!avatar.gltfMixer || !avatar.gltfActions) return false;
    const clip = avatar.gltfActions[mode] || (mode !== 'idle' ? avatar.gltfActions.idle : null);
    if (!clip) {
      // Do not leave a previous walk/bow action running when this rig has no
      // clip for the requested state and no idle clip to fall back to.
      avatar.gltfCurrentAction?.stopFading().fadeOut(0.18);
      avatar.gltfCurrentAction = null;
      avatar.gltfCurrentClip = null;
      avatar.gltfActionName = null;
      return false;
    }
    const isBow = mode === 'bow' && clip === avatar.gltfActions.bow;
    const current = avatar.gltfCurrentAction;
    if (current && avatar.gltfCurrentClip === clip) {
      // Several state names can resolve to the same idle clip. Cancel any
      // interrupted fade before reusing the action, or it may keep fading out.
      current.stopFading().setEffectiveWeight(1);
      current.setLoop(isBow ? THREE.LoopOnce : THREE.LoopRepeat, isBow ? 1 : Infinity);
      current.clampWhenFinished = isBow;
      avatar.gltfActionName = mode;
      return true;
    }
    const next = avatar.gltfMixer.clipAction(clip);
    // Actions are cached by the mixer. A quick A -> B -> A transition can
    // otherwise reuse an action that still has a previous fade scheduled.
    next.stopFading().setEffectiveWeight(1);
    if (isBow) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
    }
    next.reset().fadeIn(0.18).play();
    if (current && current !== next) current.stopFading().fadeOut(0.18);
    avatar.gltfCurrentAction = next;
    avatar.gltfCurrentClip = clip;
    avatar.gltfActionName = mode;
    return true;
  }

  function applyHumanBow(avatar, amount, kneelBlend = 0) {
    avatar.bowing = amount > 0.035;
    avatar.bowAmount = amount;
    if (avatar.gltfRoot) {
      const rig = avatar.gltfRig;
      const prayer = Math.min(1, Math.max(0, kneelBlend));
      // Quaternius clips provide locomotion, but a generic bow clip does not
      // reliably lower the pelvis or fold the legs into a kneeling posture.
      // Compose a controlled, reversible kneel pose on the mapped leg chain.
      if (rig?.leftLeg && rig.leftLegRest) {
        rig.leftLeg.rotation.x = rig.leftLegRest.x - prayer * 0.28;
      }
      if (rig?.rightLeg && rig.rightLegRest) {
        rig.rightLeg.rotation.x = rig.rightLegRest.x - prayer * 0.28;
      }
      if (rig?.leftKnee && rig.leftKneeRest) {
        rig.leftKnee.rotation.x = rig.leftKneeRest.x + prayer * 1.18;
      }
      if (rig?.rightKnee && rig.rightKneeRest) {
        rig.rightKnee.rotation.x = rig.rightKneeRest.x + prayer * 1.18;
      }
      if (rig?.leftFoot && rig.leftFootRest) {
        rig.leftFoot.rotation.x = rig.leftFootRest.x - prayer * 0.72;
      }
      if (rig?.rightFoot && rig.rightFootRest) {
        rig.rightFoot.rotation.x = rig.rightFootRest.x - prayer * 0.72;
      }
      avatar.gltfRoot.position.y = (avatar.gltfBasePositionY ?? 1) - prayer * 0.20;

      // If a real bow/prostration clip exists, let it drive the torso and head;
      // otherwise use the mapped spine joints for a predictable three-bow arc.
      if (!avatar.gltfActions?.bow) {
        if (rig?.spine && rig.spineRest) rig.spine.rotation.x = rig.spineRest.x - amount * 0.46;
        if (rig?.neck && rig.neckRest) rig.neck.rotation.x = rig.neckRest.x - amount * 0.12;
        if (rig?.head && rig.headRest) rig.head.rotation.x = rig.headRest.x + amount * 0.16;
      }
      if (rig?.leftArm && rig.leftArmRest) {
        rig.leftArm.rotation.x = rig.leftArmRest.x - prayer * 0.48 - amount * 0.12;
        rig.leftArm.rotation.z = rig.leftArmRest.z + prayer * 0.54 + amount * 0.035;
      }
      if (rig?.rightArm && rig.rightArmRest) {
        rig.rightArm.rotation.x = rig.rightArmRest.x - prayer * 0.48 - amount * 0.12;
        rig.rightArm.rotation.z = rig.rightArmRest.z - prayer * 0.54 - amount * 0.035;
      }
      return;
    }
    const upperPose = getHumanUpperPose({ kneelBlend, bowAmount: amount });
    avatar.upperBody.rotation.x = upperPose.torsoLean;
    avatar.head.rotation.x = upperPose.headCounter;
    avatar.leftArm.rotation.x = upperPose.armReach;
    avatar.rightArm.rotation.x = upperPose.armReach;
    avatar.leftArm.rotation.z = upperPose.armOpen;
    avatar.rightArm.rotation.z = -upperPose.armOpen;
    avatar.leftHand.rotation.z = -upperPose.handRoll;
    avatar.rightHand.rotation.z = upperPose.handRoll;
    avatar.leftHand.rotation.x = upperPose.wristPitch;
    avatar.rightHand.rotation.x = upperPose.wristPitch;
  }

  let devoteeModelAssets = null;
  let devoteeModelLoadPromise = null;

  async function upgradeDevoteesFromGLB() {
    try {
      const [{ loadGLTFAsset }, { clone }, { findBestAnimationClip }] = await Promise.all([
        import('./three-model-loader.js?v=quaternius-glTF-20261102-1'),
        import('three/addons/utils/SkeletonUtils.js'),
        import('./three-animation-utils.js')
      ]);
      // Keep one hidden source per gender; clone safely for each live devotee.
      if (!devoteeModelLoadPromise) {
        devoteeModelLoadPromise = Promise.all([
          loadGLTFAsset('/assets/models/glTF/Casual_Male.gltf', { targetHeight: 1.72, centerXZ: true }),
          loadGLTFAsset('/assets/models/glTF/Casual_Female.gltf', { targetHeight: 1.72, centerXZ: true })
        ]).then(([male, female]) => {
          if (disposed) { male.dispose(); female.dispose(); return null; }
          male.root.visible = false;
          female.root.visible = false;
          world.add(male.root, female.root);
          return { male, female };
        }).catch((error) => { devoteeModelLoadPromise = null; throw error; });
      }
      devoteeModelAssets = await devoteeModelLoadPromise;
      if (!devoteeModelAssets || disposed) return;
      const pendingAvatars = allHumanAvatars.filter((avatar) => !avatar.gltfRoot);
      for (const avatar of pendingAvatars) {
        const asset = avatar.gender === 'female' ? devoteeModelAssets.female : devoteeModelAssets.male;
        const animations = asset.animations || [];
        const gltfActions = findBestAnimationClip(animations);
        // The shared source roots are intentionally hidden in the world.
        // SkeletonUtils.clone preserves Object3D.visible, so explicitly enable
        // each per-avatar clone before attaching it or it remains invisible.
        const model = clone(asset.root);
        model.visible = true;
        model.traverse((node) => { node.visible = true; });
        // loadGLTFAsset currently applies a shared -1 world-unit vertical
        // pivot offset (used by the Buddha placement pipeline). Devotees are
        // parented directly at their floor position, so cancel that offset
        // here; otherwise the lower body is buried and only the head/torso show.
        model.position.y += 1;
        // Queue avatars use a shorter procedural rig than the main devotee.
        // Match the imported character height to the avatar's intended size.
        const intendedHeight = avatar.root.userData?.intendedHeight
          || (avatar.queueWaiting ? 1.36 : 1.72);
        const heightFactor = THREE.MathUtils.clamp(intendedHeight / 1.72, 0.72, 1.05);
        model.scale.multiplyScalar(heightFactor);
        avatar.root.add(model);
        // Hide procedural fallback only after the imported model is attached.
        // Their primitive geometry/materials may be shared with cached meshes.
        // Hide only the two procedural body variants. Other children may
        // be live name-tag sprites or profile attachments and must stay visible.
        for (const variant of Object.values(avatar.variants || {})) {
          if (variant?.group) variant.group.visible = false;
        }
        avatar.gltfRoot = model;
        avatar.gltfBasePositionY = model.position.y;
        avatar.gltfActions = gltfActions;
        avatar.gltfMixer = animations.length ? new THREE.AnimationMixer(model) : null;
        avatar.gltfActionName = null;
        avatar.gltfCurrentAction = null;
        avatar.gltfCurrentClip = null;
        avatar.gltfLastTime = 0;
        avatar.gltfWalkBlend = 0;
        const bones = {};
        const normalizedBoneName = (value) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const boneAliases = {
          spine: ['spine', 'spine01', 'spine1', 'spine02', 'spine2', 'chest', 'upperbody', 'jbipcspine', 'jbipcchest'],
          neck: ['neck', 'jbipcneck'],
          head: ['head', 'jbipchead'],
          leftArm: ['leftupperarm', 'leftarm', 'upperarmleft', 'armleft', 'upperarml', 'arml', 'lupperarm', 'larm', 'jbiplupperarm'],
          rightArm: ['rightupperarm', 'rightarm', 'upperarmright', 'armright', 'upperarmr', 'armr', 'rupperarm', 'rarm', 'jbiprupperarm'],
          leftLeg: ['leftupperleg', 'leftupleg', 'leftthigh', 'leftleg', 'upperlegleft', 'thighleft', 'upperlegl', 'thighl', 'legl', 'lupperleg', 'lthigh', 'lleg', 'jbiplupperleg'],
          leftKnee: ['leftlowerleg', 'leftcalf', 'leftshin', 'lowerlegleft', 'calfleft', 'shinleft', 'lowerlegl', 'calfl', 'shinl', 'llowerleg', 'lcalf', 'lshin', 'jbipllowerleg'],
          leftFoot: ['leftfoot', 'footleft', 'footl', 'lfoot', 'jbiplfoot'],
          rightLeg: ['rightupperleg', 'rightupleg', 'rightthigh', 'rightleg', 'upperlegright', 'thighright', 'upperlegr', 'thighr', 'legr', 'rupperleg', 'rthigh', 'rleg', 'jbiprupperleg'],
          rightKnee: ['rightlowerleg', 'rightcalf', 'rightshin', 'lowerlegright', 'calfright', 'shinright', 'lowerlegr', 'calfr', 'shinr', 'rlowerleg', 'rcalf', 'rshin', 'jbiprlowerleg'],
          rightFoot: ['rightfoot', 'footright', 'footr', 'rfoot', 'jbiprfoot']
        };
        const boneScores = {};
        model.traverse((node) => {
          if (!node.isBone) return;
          const name = normalizedBoneName(node.name);
          for (const [slot, aliases] of Object.entries(boneAliases)) {
            const aliasIndex = aliases.findIndex((alias) => name === alias || name.endsWith(alias));
            if (aliasIndex < 0) continue;
            // Prefer exact, earlier and more specific aliases over broad suffix
            // matches; traversal order must not decide which joint drives a pose.
            const exact = name === aliases[aliasIndex];
            const score = (exact ? 20000 : 10000) - aliasIndex * 100 + aliases[aliasIndex].length;
            if (score > (boneScores[slot] || 0)) {
              bones[slot] = node;
              boneScores[slot] = score;
            }
          }
        });
        avatar.gltfRig = {
          spine: bones.spine,
          neck: bones.neck,
          head: bones.head,
          leftArm: bones.leftArm,
          rightArm: bones.rightArm,
          spineRest: bones.spine?.rotation.clone(),
          neckRest: bones.neck?.rotation.clone(),
          headRest: bones.head?.rotation.clone(),
          leftArmRest: bones.leftArm?.rotation.clone(),
          rightArmRest: bones.rightArm?.rotation.clone(),
          leftLeg: bones.leftLeg,
          rightLeg: bones.rightLeg,
          leftKnee: bones.leftKnee,
          rightKnee: bones.rightKnee,
          leftFoot: bones.leftFoot,
          rightFoot: bones.rightFoot,
          leftLegRest: bones.leftLeg?.rotation.clone(),
          rightLegRest: bones.rightLeg?.rotation.clone(),
          leftKneeRest: bones.leftKnee?.rotation.clone(),
          rightKneeRest: bones.rightKnee?.rotation.clone(),
          leftFootRest: bones.leftFoot?.rotation.clone(),
          rightFootRest: bones.rightFoot?.rotation.clone()
        };

        // Report whether name-matched leg joints form usable ordered chains.
        // This is diagnostic only: do not enable world-space IK until the
        // selected asset's rest pose and bend axes have been visually checked.
        const inspectLegChain = (upper, lower, foot) => {
          const descendsFrom = (node, ancestor) => {
            for (let parent = node?.parent; parent; parent = parent.parent) {
              if (parent === ancestor) return true;
            }
            return false;
          };
          if (!upper?.isBone || !lower?.isBone || !foot?.isBone
            || !descendsFrom(lower, upper) || !descendsFrom(foot, lower)) {
            return { valid: false, upper: upper?.name || null, lower: lower?.name || null, foot: foot?.name || null };
          }
          model.updateWorldMatrix(true, true);
          const upperPosition = upper.getWorldPosition(new THREE.Vector3());
          const lowerPosition = lower.getWorldPosition(new THREE.Vector3());
          const footPosition = foot.getWorldPosition(new THREE.Vector3());
          return {
            valid: true,
            upper: upper.name,
            lower: lower.name,
            foot: foot.name,
            upperLength: Number(upperPosition.distanceTo(lowerPosition).toFixed(4)),
            lowerLength: Number(lowerPosition.distanceTo(footPosition).toFixed(4))
          };
        };
        avatar.gltfRig.leftLegChain = inspectLegChain(bones.leftLeg, bones.leftKnee, bones.leftFoot);
        avatar.gltfRig.rightLegChain = inspectLegChain(bones.rightLeg, bones.rightKnee, bones.rightFoot);
      }
      console.info(`[Temple3D] Quaternius glTF applied to ${pendingAvatars.length} new characters.`,
        'available clips:', Object.fromEntries(['male', 'female'].map((gender) => [gender,
          (devoteeModelAssets[gender].animations || []).map((clip) => ({
            name: clip.name || '(unnamed)',
            duration: Number.isFinite(clip.duration) ? Number(clip.duration.toFixed(2)) : null,
            tracks: clip.tracks.length,
            targets: [...new Set(clip.tracks.map((track) => track.name.split('.')[0]))].slice(0, 12)
          }))
        ])),
        'rig:', Object.fromEntries(Object.entries(allHumanAvatars.find((avatar) => avatar.gltfRoot)?.gltfRig || {})
          .filter(([key, value]) => !key.endsWith('Rest') && value?.isBone)
          .map(([key, value]) => [key, value.name])),
        'leg chains:', {
          left: allHumanAvatars.find((avatar) => avatar.gltfRoot)?.gltfRig?.leftLegChain || { valid: false },
          right: allHumanAvatars.find((avatar) => avatar.gltfRoot)?.gltfRig?.rightLegChain || { valid: false }
        });
    } catch (error) {
      console.warn('[Temple3D] Optional devotee GLB unavailable; keeping procedural characters:', error);
    }
  }

  function applyGLTFFallbackWalk(avatar, gaitPhase, weight = 1) {
    const rig = avatar.gltfRig;
    if (!rig) return;
    const leftPose = getFootPlantingPose(gaitPhase + avatar.phase);
    const rightPose = getFootPlantingPose(gaitPhase + avatar.phase + Math.PI);
    const leftStep = leftPose.step;
    const rightStep = rightPose.step;
    const amount = 0.34 * weight;
    // Preserve the idle clip's evaluated pose when one exists. With no clips,
    // return to the captured rest pose instead of freezing on the last gait.
    const base = (bone, rest) => avatar.gltfActions?.idle ? bone?.rotation.x : rest?.x;
    if (rig.leftLeg && rig.leftLegRest) rig.leftLeg.rotation.x = base(rig.leftLeg, rig.leftLegRest) - leftStep * amount;
    if (rig.rightLeg && rig.rightLegRest) rig.rightLeg.rotation.x = base(rig.rightLeg, rig.rightLegRest) - rightStep * amount;
    if (rig.leftKnee && rig.leftKneeRest) rig.leftKnee.rotation.x = base(rig.leftKnee, rig.leftKneeRest) + leftPose.kneeFlex * weight;
    if (rig.rightKnee && rig.rightKneeRest) rig.rightKnee.rotation.x = base(rig.rightKnee, rig.rightKneeRest) + rightPose.kneeFlex * weight;
    if (rig.leftFoot && rig.leftFootRest) rig.leftFoot.rotation.x = base(rig.leftFoot, rig.leftFootRest) + leftStep * amount * 0.45 - leftPose.kneeFlex * weight * 0.65;
    if (rig.rightFoot && rig.rightFootRest) rig.rightFoot.rotation.x = base(rig.rightFoot, rig.rightFootRest) + rightStep * amount * 0.45 - rightPose.kneeFlex * weight * 0.65;
    if (rig.leftArm && rig.leftArmRest) rig.leftArm.rotation.x = base(rig.leftArm, rig.leftArmRest) + rightStep * amount * 0.62;
    if (rig.rightArm && rig.rightArmRest) rig.rightArm.rotation.x = base(rig.rightArm, rig.rightArmRest) + leftStep * amount * 0.62;
  }

  function getAvatarGiftReactionBlend(avatar, time) {
    const duration = Math.max(1, avatar.giftReactionProfile?.durationMs || 1800);
    return getScheduledGiftReactionBlend(
      time,
      avatar.giftReactionStartedAt,
      avatar.giftReactionUntil,
      duration
    );
  }

  function applyGiftThankYouGesture(avatar, time) {
    if (avatar.gltfRoot) return;
    const blend = getAvatarGiftReactionBlend(avatar, time);
    // Standing prayer avatars must keep palms together; this base pose is
    // now composed with the gift acknowledgement instead of being written
    // over it by a second animation function later in the frame.
    const prayerBlend = Math.max(avatar.kneelBlend || 0, avatar.prayerPose ? 1 : 0);
    const upperPose = getHumanUpperPose({ kneelBlend: prayerBlend, bowAmount: avatar.bowAmount });
    // Sweep both forearms inward and upward so the palms meet at chest height.
    // Recompute from the ritual base pose every frame to avoid rotation drift.
    const profile = avatar.giftReactionProfile || { intensity: 0.55, bowAmount: 0.08 };
    const strength = blend * profile.intensity;
    avatar.upperBody.rotation.x = upperPose.torsoLean - blend * profile.bowAmount;
    const thankYouLift = strength * (0.92 + Math.sin(time * 0.007) * 0.025);
    avatar.leftArm.rotation.x = upperPose.armReach - strength * 0.08;
    avatar.rightArm.rotation.x = upperPose.armReach - strength * 0.08;
    avatar.leftArm.rotation.z = upperPose.armOpen + thankYouLift;
    avatar.rightArm.rotation.z = -upperPose.armOpen - thankYouLift;
    avatar.leftHand.rotation.z = -upperPose.armOpen * 0.18 - blend * 0.06;
    avatar.rightHand.rotation.z = upperPose.armOpen * 0.18 + blend * 0.06;
  }

  function animateHuman(avatar, time, walking = false, walkPhase = null) {
    const poseDelta = avatar.lastHumanPoseTime
      ? Math.min(0.05, Math.max(0, (time - avatar.lastHumanPoseTime) / 1000))
      : 1 / 30;
    avatar.lastHumanPoseTime = time;
    const walkTarget = walking ? 1 : 0;
    avatar.walkBlend += (walkTarget - avatar.walkBlend) * (1 - Math.exp(-poseDelta / 0.18));
    if (avatar.queueWaiting) {
      // People beyond the five simultaneous worshippers meditate while waiting.
      const waitingKneelTarget = walking ? 0 : 1;
      avatar.kneelBlend += (waitingKneelTarget - (avatar.kneelBlend || 0))
        * (1 - Math.exp(-poseDelta / 0.34));
      avatar.kneeling = avatar.kneelBlend > 0.65;
      avatar.prayerPose = true;
      avatar.bowAmount = 0;
    }
    if (avatar.queuedWorshipLane && walking) {
      // A seated visitor rises naturally while walking into one of the four
      // shared prayer positions behind the main worshipper.
      avatar.kneelBlend += (0 - (avatar.kneelBlend || 0))
        * (1 - Math.exp(-poseDelta / 0.34));
      avatar.kneeling = avatar.kneelBlend > 0.65;
      avatar.prayerPose = false;
      avatar.bowAmount = 0;
    }
    const gaitPhase = Number.isFinite(walkPhase) ? walkPhase : time * 0.009;
    const swing = Math.sin(gaitPhase + avatar.phase);
    const leftStep = getFootPlantingStep(gaitPhase + avatar.phase);
    const rightStep = getFootPlantingStep(gaitPhase + avatar.phase + Math.PI);
    const giftReaction = getAvatarGiftReactionBlend(avatar, time) * (avatar.giftReactionProfile?.intensity || 0.55);
    // Devotees briefly turn from the altar toward the live audience, then ease back.
    avatar.root.rotation.y = Math.PI * (1 - giftReaction) + (avatar.headingOffset || 0);
    if (avatar.gltfRoot) {
      const mode = walking ? 'walk' : avatar.bowing ? 'bow' : 'idle';
      playGLTFHumanAction(avatar, mode);
      const delta = avatar.gltfLastTime ? Math.min(0.05, Math.max(0, (time - avatar.gltfLastTime) / 1000)) : 1 / 30;
      avatar.gltfMixer?.update(delta);
      avatar.gltfLastTime = time;
      const walkTarget = walking && !avatar.gltfActions?.walk ? 1 : 0;
      const walkBlend = 1 - Math.exp(-delta / 0.16);
      avatar.gltfWalkBlend += (walkTarget - avatar.gltfWalkBlend) * walkBlend;
      if (!avatar.gltfActions?.walk) applyGLTFFallbackWalk(avatar, gaitPhase, avatar.gltfWalkBlend);
      // Apply zero as well as non-zero bow amounts so a manual bow pose always
      // blends back to rest when the ritual state ends and no bow clip exists.
      if (!avatar.gltfActions?.bow) applyHumanBow(avatar, avatar.bowing ? avatar.bowAmount : 0);
      avatar.root.position.y = walking ? 0 : Math.sin(time*0.0015+avatar.phase)*0.012;
      return;
    }
    const idleArmLeft = Math.sin(time*0.0017+avatar.phase)*0.035;
    const idleArmRight = Math.sin(time*0.0017+avatar.phase+1)*0.035;
    avatar.leftArm.rotation.x = idleArmLeft * (1 - avatar.walkBlend) + rightStep * 0.42 * avatar.walkBlend;
    avatar.rightArm.rotation.x = idleArmRight * (1 - avatar.walkBlend) + leftStep * 0.42 * avatar.walkBlend;
    const leftFootPose = getHumanFootTransitionPose({
      phase: gaitPhase + avatar.phase, walkBlend: avatar.walkBlend, kneelBlend: avatar.kneelBlend
    });
    const rightFootPose = getHumanFootTransitionPose({
      phase: gaitPhase + avatar.phase + Math.PI, walkBlend: avatar.walkBlend, kneelBlend: avatar.kneelBlend
    });
    avatar.leftLeg.rotation.x = leftFootPose.hipRotationX;
    avatar.rightLeg.rotation.x = rightFootPose.hipRotationX;
    avatar.leftKnee.rotation.x = leftFootPose.kneeRotationX;
    avatar.rightKnee.rotation.x = rightFootPose.kneeRotationX;
    avatar.leftFoot.rotation.x = leftFootPose.footRotationX;
    avatar.rightFoot.rotation.x = rightFootPose.footRotationX;
    avatar.leftFoot.position.y = -0.24 + leftFootPose.footLift;
    avatar.rightFoot.position.y = -0.24 + rightFootPose.footLift;
    const breathCycle = time * 0.00135 + avatar.phase;
    const breath = Math.sin(breathCycle);
    const walkBody = getWalkBodyPose(gaitPhase + avatar.phase, avatar.walkBlend);
    // Counter-sway the trunk against alternating steps; keep the amplitudes
    // deliberately small so the visitor looks grounded rather than bouncy.
    avatar.root.position.x = walkBody.lateralSway;
    avatar.root.rotation.z = walkBody.torsoLean;
    avatar.torso.scale.y = 1 + breath * 0.012;
    avatar.torso.position.y = 0.40 + breath * 0.0025 + walkBody.bodyBob;
    if (avatar.tunicShell) {
      avatar.tunicShell.scale.y = 1 + breath * 0.006;
      avatar.tunicShell.position.y = 0.105 + breath * 0.0015 + walkBody.bodyBob * 0.18;
    }
    avatar.torso.rotation.y = giftReaction * 0.035 + walkBody.torsoTwist;
    avatar.head.rotation.y = Math.sin(time*0.0011+avatar.phase)*0.035 + giftReaction * 0.2;
    avatar.head.rotation.x = Math.sin(time*0.00082+avatar.phase*0.7)*0.012 - giftReaction * 0.045;
    // A tiny alternating head tilt keeps the group feeling attentive rather than mechanically synchronized.
    avatar.head.rotation.z = Math.sin(time*0.0014+avatar.phase)*0.008 + giftReaction * Math.sin(avatar.phase) * 0.035;
    const blinkCycle = ((time * 0.001 + avatar.phase * 0.17) % 4.6 + 4.6) % 4.6;
    const blinkPulse = Math.max(0, 1 - Math.abs(blinkCycle - 0.12) / 0.12);
    const blink = Math.min(1, blinkPulse * 0.94 + avatar.kneelBlend * 0.12);
    for (let index=0; index<avatar.eyeWhites.length; index++) {
      const eyeOpen = 1 - blink * 0.9;
      avatar.eyeWhites[index].scale.y = eyeOpen;
      avatar.eyePupils[index].scale.y = eyeOpen;
      avatar.eyePupils[index].position.x = Math.sin(time*0.00065+avatar.phase)*0.006 + giftReaction * (index === 0 ? 0.009 : -0.009);
      avatar.eyePupils[index].position.y = giftReaction * 0.008;
    }
    // A subtle wider smile and attentive eyes make the thank-you readable at portrait scale.
    avatar.smile.scale.x = 1 + giftReaction * 0.2;
    avatar.smile.scale.y = 1 + giftReaction * 0.12 - avatar.bowAmount * 0.12;
    for (const eyeWhite of avatar.eyeWhites) eyeWhite.scale.x = 1 + giftReaction * 0.045;
    // Lift the brows subtly and direct the pupils toward the viewer during thanks.
    for (const { mesh, side } of avatar.eyebrows) mesh.rotation.z = -side * 0.12 + giftReaction * side * 0.035;
    avatar.root.position.y = (walking ? walkBody.bodyBob * 0.45 : Math.sin(time*0.0015+avatar.phase)*0.012)
      - avatar.kneelBlend * 0.1 - Math.max(0, avatar.bowAmount || 0) * 0.14;
    if (avatar.queueWaiting && !walking) {
      applyHumanBow(avatar, avatar.bowAmount, avatar.kneelBlend);
    }
    applyGiftThankYouGesture(avatar, time);
    if (avatar.queueWaiting && !walking && getAvatarGiftReactionBlend(avatar, time) < 0.04) {
      applySutraReadingPose(avatar, time);
    }
  }
  // No ambient NPC crowd is spawned. Every visible person must correspond to an actual viewer event.

  const mainDevotee=new THREE.Group();
  mainDevotee.visible=false;mainDevotee.position.set(0,0.05,7.5);world.add(mainDevotee);
  const mainHuman=makeHumanAvatar(1.72);mainDevotee.add(mainHuman.root);
  // The avatar is a separate transparent circular sprite, outside the
  // variable-width name plate. This keeps the portrait large and prevents the
  // dark name-box background from appearing behind the avatar.
  function createDevoteeNameTag(options = {}) {
    const featured = options.featured === true;
    const plateCanvas = document.createElement('canvas');
    plateCanvas.width = 520;
    plateCanvas.height = 192;
    const plateContext = plateCanvas.getContext('2d');
    const plateTexture = new THREE.CanvasTexture(plateCanvas);
    plateTexture.colorSpace = THREE.SRGBColorSpace;
    plateTexture.minFilter = THREE.LinearFilter;
    plateTexture.generateMipmaps = false;

    const avatarCanvas = document.createElement('canvas');
    avatarCanvas.width = 256;
    avatarCanvas.height = 256;
    const avatarContext = avatarCanvas.getContext('2d');
    const avatarTexture = new THREE.CanvasTexture(avatarCanvas);
    avatarTexture.colorSpace = THREE.SRGBColorSpace;
    avatarTexture.minFilter = THREE.LinearFilter;
    avatarTexture.generateMipmaps = false;

    const plateMaterial = new THREE.SpriteMaterial({
      map: plateTexture, transparent: true, depthTest: false, depthWrite: false
    });
    const avatarMaterial = new THREE.SpriteMaterial({
      map: avatarTexture, transparent: true, depthTest: false, depthWrite: false
    });
    const tag = new THREE.Group();
    tag.name = featured ? 'FeaturedDevoteeNameTag' : 'DevoteeNameTag';
    tag.position.set(0, 2.18, 0);
    const plateSprite = new THREE.Sprite(plateMaterial);
    const avatarSprite = new THREE.Sprite(avatarMaterial);
    plateSprite.renderOrder = 30;
    avatarSprite.renderOrder = 31;
    tag.add(plateSprite, avatarSprite);

    let avatarImage = null;
    let avatarUrl = '';
    let profileName = featured ? 'Bảo Ngọc' : 'Thí Chủ Hữu Duyên';
    let imageRequest = 0;
    let profileRevision = 0;
    let tagHeight = featured ? 0.56 : 0.30;

    function syncTagSize() {
      const plateWidth = (plateCanvas.width / plateCanvas.height) * tagHeight;
      const avatarDiameter = tagHeight * (featured ? 1.34 : 1.48);
      // The portrait centre sits exactly on the plate's left edge. Half of
      // the portrait therefore floats outside the box on a transparent canvas.
      plateSprite.scale.set(plateWidth, tagHeight, 1);
      plateSprite.position.set(avatarDiameter * 0.25, 0, 0);
      avatarSprite.scale.set(avatarDiameter, avatarDiameter, 1);
      avatarSprite.position.set(avatarDiameter * 0.25 - plateWidth / 2, 0, 0);
    }

    function drawAvatar() {
      const size = avatarCanvas.width;
      const center = size / 2;
      const radius = 112;
      // Leave a clearly visible medallion band inside the avatar, rather than
      // the nearly hairline inset that was hard to notice at 9:16 output size.
      const photoRadius = 88;
      avatarContext.clearRect(0, 0, size, size);

      // A visible warm gold/brown medallion sits inside the circular frame.
      // The portrait is inset slightly so this backing remains visible as an
      // inner ring; everything outside the circle stays fully transparent.
      avatarContext.save();
      avatarContext.beginPath();
      avatarContext.arc(center, center, radius, 0, Math.PI * 2);
      avatarContext.clip();
      const backing = avatarContext.createRadialGradient(
        center - 34, center - 42, 12,
        center, center, radius
      );
      backing.addColorStop(0, '#f8dfa0');
      backing.addColorStop(0.55, '#bd8438');
      backing.addColorStop(1, '#633719');
      avatarContext.fillStyle = backing;
      avatarContext.fillRect(0, 0, size, size);

      avatarContext.beginPath();
      avatarContext.arc(center, center, photoRadius, 0, Math.PI * 2);
      avatarContext.clip();
      if (avatarImage) {
        const photoSize = photoRadius * 2;
        const ratio = Math.max(photoSize / avatarImage.width, photoSize / avatarImage.height);
        const sw = photoSize / ratio;
        const sh = photoSize / ratio;
        avatarContext.drawImage(
          avatarImage,
          (avatarImage.width - sw) / 2,
          (avatarImage.height - sh) / 2,
          sw,
          sh,
          center - photoRadius,
          center - photoRadius,
          photoSize,
          photoSize
        );
      } else {
        avatarContext.fillStyle = '#fff0c2';
        avatarContext.font = '700 108px "Be Vietnam Pro", Arial, sans-serif';
        avatarContext.textAlign = 'center';
        avatarContext.textBaseline = 'middle';
        avatarContext.fillText((profileName[0] || 'T').toLocaleUpperCase('vi-VN'), center, center + 3);
      }
      avatarContext.restore();

      // A thin ivory-gold separator makes the portrait sit visibly inside
      // the warm circular backing instead of blending into the medallion.
      avatarContext.beginPath();
      avatarContext.arc(center, center, photoRadius + 2, 0, Math.PI * 2);
      avatarContext.lineWidth = 4;
      avatarContext.strokeStyle = 'rgba(255, 238, 190, 0.96)';
      avatarContext.stroke();

      avatarContext.beginPath();
      avatarContext.arc(center, center, radius, 0, Math.PI * 2);
      avatarContext.lineWidth = 12;
      avatarContext.strokeStyle = '#f5ce78';
      avatarContext.shadowColor = 'rgba(255, 195, 91, 0.72)';
      avatarContext.shadowBlur = 12;
      avatarContext.stroke();
      avatarContext.shadowBlur = 0;
      avatarTexture.needsUpdate = true;
    }

    function drawProfile() {
      const name = profileName;
      const fontSize = featured ? 58 : 50;
      const fontSpec = `700 ${fontSize}px "Be Vietnam Pro", Arial, sans-serif`;
      // Keep generous room on both sides of the text. In particular, the
      // right reserve protects the final glyph and its glow from the rounded
      // plate border when the name is rendered through the 9:16 canvas texture.
      const nameLeftPadding = featured ? 205 : 195;
      const nameRightPadding = featured ? 190 : 170;

      plateContext.font = fontSpec;
      const firstMeasure = Math.ceil(plateContext.measureText(name).width);
      let requiredWidth = Math.max(
        520,
        firstMeasure + nameLeftPadding + nameRightPadding
      );
      if (plateCanvas.width !== requiredWidth) {
        plateCanvas.width = requiredWidth;
      }

      // Resizing a canvas resets all context state. Measure again on the
      // actual post-resize context/font that will paint the final text, then
      // grow the canvas if that measurement needs more room.
      let context = plateCanvas.getContext('2d');
      context.font = fontSpec;
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      const finalMeasuredWidth = Math.ceil(context.measureText(name).width);
      requiredWidth = Math.max(
        520,
        finalMeasuredWidth + nameLeftPadding + nameRightPadding
      );
      if (plateCanvas.width !== requiredWidth) {
        plateCanvas.width = requiredWidth;
        context = plateCanvas.getContext('2d');
        context.font = fontSpec;
        context.textAlign = 'left';
        context.textBaseline = 'middle';
      }

      context.clearRect(0, 0, plateCanvas.width, plateCanvas.height);
      context.beginPath();
      context.roundRect(0, 15, plateCanvas.width, 162, 38);
      context.fillStyle = 'rgba(24, 12, 5, 0.92)';
      context.fill();
      context.lineWidth = featured ? 7 : 5;
      context.strokeStyle = featured ? 'rgba(255, 232, 160, 1)' : 'rgba(255, 218, 139, 0.96)';
      context.stroke();

      context.font = fontSpec;
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      context.direction = 'ltr';
      context.fillStyle = '#fff0c2';
      context.shadowColor = 'rgba(255, 190, 74, 0.55)';
      context.shadowBlur = 10;
      context.fillText(name, nameLeftPadding, 98);
      context.shadowBlur = 0;
      plateTexture.needsUpdate = true;
      syncTagSize();
      drawAvatar();
    }

    function setProfile(nameValue, urlValue) {
      profileName = String(nameValue || 'Thí Chủ Hữu Duyên').trim() || 'Thí Chủ Hữu Duyên';
      const revision = ++profileRevision;
      const nextUrl = typeof urlValue === 'string' && /^https:\/\//i.test(urlValue) ? urlValue : '';
      if (nextUrl !== avatarUrl) {
        avatarUrl = nextUrl;
        avatarImage = null;
        const request = ++imageRequest;
        if (nextUrl) {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => {
            if (request !== imageRequest) return;
            avatarImage = image;
            drawAvatar();
          };
          image.onerror = () => {
            if (request !== imageRequest) return;
            avatarImage = null;
            drawAvatar();
          };
          image.src = nextUrl;
        }
      }
      drawProfile();

      // Canvas text can be measured with Arial during the first frame if the
      // webfont is still loading. Re-measure and resize once the requested font
      // is ready, but never let an older async request overwrite a newer name.
      if (document.fonts?.load) {
        document.fonts.load(`700 ${featured ? 58 : 50}px "Be Vietnam Pro"`, profileName)
          .then(() => {
            if (revision === profileRevision) drawProfile();
          })
          .catch(() => {});
      }
    }

    tag.userData.setSize = (heightValue) => {
      const height = Number(heightValue);
      if (Number.isFinite(height) && height > 0) {
        tagHeight = height;
        syncTagSize();
      }
    };
    tag.userData.setName = (name) => setProfile(name, avatarUrl);
    tag.userData.setProfile = setProfile;
    setProfile(profileName, '');
    return tag;
  }
  function createDevoteeWishBubble(options = {}) {
    const compact = options.compact === true;
    const canvas = document.createElement('canvas');
    canvas.width = compact ? 512 : 1024;
    canvas.height = compact ? 56 : 144;
    const context = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture, transparent: true, depthTest: false, depthWrite: false
    }));
    // Compact labels sit just above each seated devotee's nameplate. The
    // wider featured label remains reserved for the central active visitor.
    sprite.position.set(0, compact ? 2.20 : 2.78, 0);
    sprite.scale.set(compact ? 1.78 : 3.45, compact ? 0.20 : 0.42, 1);
    sprite.renderOrder = 31;

    function setWish(value) {
      const fallback = 'Nguyện cầu gia đình bình an, vạn sự cát tường';
      const wish = compact
        ? formatDevoteePrayerLabel(value)
        : String(value || fallback).trim() || fallback;
      sprite.userData.wishText = wish;
      const padY = compact ? 5 : 13;
      const cornerRadius = compact ? 22 : 54;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.beginPath();
      context.roundRect(compact ? 9 : 18, padY, canvas.width - (compact ? 18 : 36), canvas.height - padY * 2, cornerRadius);
      context.fillStyle = 'rgba(31, 15, 7, 0.96)';
      context.fill();
      context.lineWidth = compact ? 4 : 5;
      context.strokeStyle = 'rgba(255, 210, 116, 0.98)';
      context.stroke();
      context.font = compact
        ? '600 18px "Be Vietnam Pro", Arial, sans-serif'
        : '600 48px "Be Vietnam Pro", Arial, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#ffe9b0';
      context.shadowColor = 'rgba(255, 184, 64, 0.5)';
      context.shadowBlur = compact ? 6 : 10;
      context.fillText(wish, canvas.width / 2, canvas.height / 2, compact ? 450 : 900);
      context.shadowBlur = 0;
      texture.needsUpdate = true;
    }

    sprite.userData.setWish = setWish;
    setWish('');
    return sprite;
  }
  const devoteeNameTag = createDevoteeNameTag({ featured: true });
  const devoteeWishBubble = createDevoteeWishBubble();
  mainHuman.root.add(devoteeNameTag, devoteeWishBubble);
  function updateMainDevoteeName(user, avatarUrl, wish) {
    devoteeNameTag.userData.setProfile(user || 'Bảo Ngọc', avatarUrl || '');
    devoteeWishBubble.userData.setWish(wish || '');
  }
  const devoteeQueue = [];
  // Normalize viewer identity so repeated comments/gifts from one TikTok user
  // update the same avatar instead of creating one character per event.
  function getDevoteeIdentityKey(event) {
    const uniqueId = String(event?.uniqueId || '').trim().replace(/^@+/, '').toLowerCase();
    const user = String(event?.user || '').trim().replace(/^@+/, '').toLowerCase();
    const identity = uniqueId || user;
    return identity ? `viewer:${identity}` : null;
  }
  // The 2D state machine owns ordering; this scene only renders that same FIFO.
  const renderedDevoteeEvents = new WeakSet();
  const completedQueueWorship = createQueueWorshipLedger();
  const queueActors = new Map();
  const queueActorPool = [];
  // Real TikTok room members occupy the 36 waiting seats; the remaining four
  // positions stay reserved for the active/queued worship lane.
  const liveViewerRoster = new Map();
  const liveViewerActors = new Map();
  const departingDevotees = [];
  // The main devotee plus four adjacent queue positions can worship together;
  // the remaining real viewers are rendered in the seated congregation grid.

  function getAvailableQueueActorSlot() {
    // Four side-lane places are reserved for ritual queue actors. The other
    // 36 formation slots belong exclusively to passive live viewers.
    return getAvailableFormationSlot(
      [...queueActors.values()].map((actor) => actor.slot),
      MAX_CONCURRENT_WORSHIPPERS - 1
    );
  }

  // Expose a read-only runtime snapshot for the visual audit and browser
  // troubleshooting. It confirms that both local Ao Dai variants are active
  // and that the former imported Girl GLB is not replacing the crowd.
  function getAoDaiRuntimeDiagnostics() {
    const maleCount = allHumanAvatars.filter((avatar) => avatar.gender === 'male').length;
    const femaleCount = allHumanAvatars.filter((avatar) => avatar.gender === 'female').length;
    const maleRigCount = allHumanAvatars.filter((avatar) => Boolean(avatar.variants?.male)).length;
    const femaleRigCount = allHumanAvatars.filter((avatar) => Boolean(avatar.variants?.female)).length;
    return {
      source: 'ao-dai-local',
      avatarCount: allHumanAvatars.length,
      maleCount,
      femaleCount,
      maleRigCount,
      femaleRigCount,
      visibleQueueActors: [...queueActors.values()].filter((actor) => actor.group.visible).length,
      seatedLiveViewerCount: [...liveViewerActors.values()].filter((actor) => !actor.leaving).length,
      departingLiveViewerCount: [...liveViewerActors.values()].filter((actor) => actor.leaving).length,
      pendingLiveViewerCount: Math.max(0, liveViewerRoster.size - liveViewerActors.size),
      backgroundNpcCount: 0,
      legacyGirlGlbEnabled: false
    };
  }
  window.__TEMPLE_AODAI_DIAGNOSTIC__ = getAoDaiRuntimeDiagnostics;

  function createCongregationSeatPlaceholders() {
    const positions = getQueueActorFormationSlots();
    const dummy = new THREE.Object3D();

    function createLayer(name, geometry, material, yOffset, rotationX = 0) {
      const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
      mesh.name = name;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

      positions.forEach((position, index) => {
        const scale = position.role === 'worship' ? 1 : 0.86;
        dummy.position.set(position.x, position.y + yOffset * scale, position.z);
        dummy.rotation.set(rotationX, 0, 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      world.add(mesh);
      return mesh;
    }

    const baseGeometry = getPrimitiveGeometry('congregation-seat-base', () =>
      new THREE.CylinderGeometry(0.39, 0.43, 0.14, 32));
    const topGeometry = getPrimitiveGeometry('congregation-seat-top', () =>
      new THREE.CylinderGeometry(0.35, 0.39, 0.025, 32));
    const rimGeometry = getPrimitiveGeometry('lotus-seat-rim', () =>
      new THREE.TorusGeometry(0.38, 0.018, 8, 36));

    createLayer('CongregationSeatBases', baseGeometry, mats.redBright, 0.09);
    createLayer('CongregationSeatGoldTops', topGeometry, mats.gold, 0.17);
    createLayer('CongregationSeatLotusRims', rimGeometry, mats.goldBright, 0.185, -Math.PI / 2);

    return Object.freeze({
      count: positions.length,
      worshipCount: positions.filter(({ role }) => role === 'worship').length,
      waitingCount: positions.filter(({ role }) => role === 'waiting').length
    });
  }

  // Keep all 40 empty/occupied places visible from scene boot. Visitors only
  // provide the avatar and name/prayer labels; the shared instanced seat layers
  // avoid allocating three new meshes for every queue actor.
  const congregationSeatPlaceholders = createCongregationSeatPlaceholders();

  function createSutraBook(avatar) {
    const book = new THREE.Group();
    book.name = 'DevoteeSutraBook';
    // A small red scripture with ivory pages and a restrained gilt spine.
    box(0.35, 0.035, 0.24, mats.red, 0, 0, 0, book);
    box(0.322, 0.012, 0.215, mats.ivory, 0, 0.022, 0, book);
    box(0.018, 0.012, 0.23, mats.goldBright, 0, 0.025, 0, book);
    for (const x of [-0.135, 0.135]) {
      box(0.008, 0.004, 0.17, mats.gold, x, 0.031, 0, book);
    }
    book.position.set(0, 0.48, -0.34);
    book.rotation.x = -0.08;
    avatar.root.add(book);
    return book;
  }

  function applySutraReadingPose(avatar, time) {
    if (avatar.gltfRoot || !avatar.upperBody) return;
    const breath = Math.sin(time * 0.0013 + avatar.phase) * 0.018;
    avatar.upperBody.rotation.x = 0.025 + breath;
    // Elbows draw gently inward and hands rest over the open scripture on the lap.
    avatar.leftArm.rotation.x = -0.24 + breath;
    avatar.rightArm.rotation.x = -0.24 + breath;
    avatar.leftArm.rotation.z = 0.48;
    avatar.rightArm.rotation.z = -0.48;
    avatar.leftHand.rotation.x = -0.08;
    avatar.rightHand.rotation.x = -0.08;
    avatar.leftHand.rotation.z = -0.06;
    avatar.rightHand.rotation.z = 0.06;
  }

  function createQueueActor(event, appearance = getDevoteeAppearance(event)) {
    const group = new THREE.Group();
    const avatar = makeHumanAvatar(1.36, appearance);
    avatar.prayerPose = true;
    avatar.queueWaiting = true;
    avatar.kneelBlend = 0;
    avatar.kneeling = false;
    avatar.bowAmount = 0;
    avatar.headingOffset = -0.08;
    group.add(avatar.root);
    avatar.queueWorshipCompleted = false;
    const seat = { visible: false };
    const sutraBook = createSutraBook(avatar);
    const nameTag = createDevoteeNameTag();
    nameTag.position.set(0, 1.82, 0);
    nameTag.userData.setSize(0.30);
    const prayerTag = createDevoteeWishBubble({ compact: true });
    avatar.root.add(nameTag, prayerTag);
    nameTag.userData.setProfile(event.user || 'Thí Chủ', event.avatar || '');
    prayerTag.userData.setWish(event.wish || event.prayer || event.comment || '');
    // The congregation is background seating, not the shadow-casting focal subject.
    group.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = false;
      node.receiveShadow = false;
    });
    group.visible = true;
    world.add(group);
    return {
      group, avatar, nameTag, prayerTag, seat, sutraBook, event, appearance, slot: -1,
      target: new THREE.Vector3(-3.48, 0.05, 8.35),
      moveTarget: null,
      moveCurve: null,
      moveStartedAt: 0,
      moveDurationMs: 0
    };
  }

  function getAvailableLiveViewerSeat() {
    const occupied = [...liveViewerActors.values()].map((actor) => actor.slot - (MAX_CONCURRENT_WORSHIPPERS - 1));
    const seatIndex = getAvailableFormationSlot(
      occupied,
      MAX_VISIBLE_QUEUE_ACTORS - (MAX_CONCURRENT_WORSHIPPERS - 1)
    );
    return seatIndex < 0 ? -1 : (MAX_CONCURRENT_WORSHIPPERS - 1) + seatIndex;
  }

  function syncLiveViewerSeats(now = performance.now()) {
    for (const [identity, viewer] of liveViewerRoster) {
      if (liveViewerActors.has(identity)) continue;
      const slot = getAvailableLiveViewerSeat();
      if (slot < 0) break;
      const formation = getQueueActorFormationPosition(slot);
      const entry = getQueueActorEntryPosition(slot);
      if (!formation || !entry || formation.role !== 'waiting') continue;
      const appearance = getDevoteeAppearance(viewer);
      let actor = queueActorPool.pop();
      if (actor) {
        setHumanAppearance(actor.avatar, appearance);
        actor.avatar.queueWaiting = true;
        actor.avatar.queuedWorshipLane = false;
        actor.avatar.queueWorshipCompleted = false;
        actor.avatar.prayerPose = true;
        actor.avatar.kneelBlend = 0;
        actor.avatar.kneeling = false;
        actor.avatar.bowAmount = 0;
        actor.avatar.offeringIncense = false;
        actor.event = viewer;
        actor.appearance = appearance;
        actor.group.visible = true;
        actor.nameTag.userData.setProfile(viewer.user || 'Thí Chủ', viewer.avatar || '');
        actor.prayerTag.userData.setWish(viewer.wish || viewer.prayer || viewer.comment || '');
      } else {
        actor = createQueueActor(viewer, appearance);
      }
      actor.slot = slot;
      actor.avatar.queueWaiting = true;
      actor.avatar.queuedWorshipLane = false;
      actor.avatar.queueWorshipCompleted = false;
      actor.avatar.prayerPose = true;
      actor.group.scale.setScalar(0.86);
      actor.seat.visible = false;
      actor.sutraBook.visible = true;
      actor.group.position.set(entry.x, entry.y, entry.z);
      actor.group.rotation.set(0, 0, 0);
      actor.moveTarget = null;
      actor.moveCurve = null;
      actor.moveStartedAt = 0;
      actor.moveDurationMs = 0;
      actor.offeringStartedAt = 0;
      liveViewerActors.set(identity, actor);
      setQueueActorTarget(
        actor,
        new THREE.Vector3(formation.x, formation.y, formation.z),
        slot,
        now
      );
    }
  }

  function cancelLiveViewerDeparture(actor) {
    const departureIndex = departingDevotees.findIndex((item) => item.liveViewerActor === actor);
    if (departureIndex < 0) return false;
    departingDevotees.splice(departureIndex, 1);
    actor.leaving = false;
    actor.avatar.queueWaiting = true;
    actor.avatar.prayerPose = true;
    actor.avatar.kneeling = false;
    actor.avatar.kneelBlend = 0;
    actor.avatar.bowing = false;
    actor.avatar.bowAmount = 0;
    actor.group.visible = true;
    return true;
  }

  function onTempleViewerEnter(event) {
    const viewer = event?.detail;
    const identity = getDevoteeIdentityKey(viewer);
    if (!viewer || !identity) return;
    if (
      (devoteeState.active && getDevoteeIdentityKey(devoteeState.event) === identity)
      || devoteeQueue.some((queued) => getDevoteeIdentityKey(queued) === identity)
      || [...queueActors.values()].some((actor) => getDevoteeIdentityKey(actor.event) === identity)
    ) return;
    liveViewerRoster.delete(identity);
    liveViewerRoster.set(identity, {
      ...viewer,
      wish: viewer.wish || 'Vừa vào Chánh Điện, thành tâm hướng Phật'
    });
    while (liveViewerRoster.size > 300) {
      const oldestIdentity = liveViewerRoster.keys().next().value;
      liveViewerRoster.delete(oldestIdentity);
      const oldActor = liveViewerActors.get(oldestIdentity);
      if (oldActor && !oldActor.leaving) {
        liveViewerActors.delete(oldestIdentity);
        oldActor.group.visible = false;
        oldActor.event = null;
        oldActor.moveCurve = null;
        oldActor.moveTarget = null;
        queueActorPool.push(oldActor);
      }
    }
    const seated = liveViewerActors.get(identity);
    if (seated) {
      const resumedDeparture = cancelLiveViewerDeparture(seated);
      seated.event = liveViewerRoster.get(identity);
      seated.nameTag.userData.setProfile(viewer.user || 'Thí Chủ', viewer.avatar || '');
      seated.prayerTag.userData.setWish(liveViewerRoster.get(identity).wish);
      if (resumedDeparture) {
        const formation = getQueueActorFormationPosition(seated.slot);
        if (formation) {
          setQueueActorTarget(
            seated,
            new THREE.Vector3(formation.x, formation.y, formation.z),
            seated.slot,
            performance.now()
          );
        }
      }
    }
    syncLiveViewerSeats();
  }

  function onTempleViewerLeave(event) {
    const viewer = event?.detail;
    const identity = getDevoteeIdentityKey(viewer);
    if (!viewer || !identity) return;
    liveViewerRoster.delete(identity);

    // A person who has already triggered a ritual is in the separate FIFO
    // system; let that promised worship/exit animation finish normally.
    if (
      (devoteeState.active && getDevoteeIdentityKey(devoteeState.event) === identity)
      || devoteeQueue.some((queued) => getDevoteeIdentityKey(queued) === identity)
      || [...queueActors.values()].some((actor) => getDevoteeIdentityKey(actor.event) === identity)
    ) return;

    const actor = liveViewerActors.get(identity);
    if (!actor || actor.leaving) return;
    const now = performance.now();
    const start = actor.group.position.clone();
    const side = start.x < 0 ? -1 : 1;
    const exitCurve = new THREE.CatmullRomCurve3([
      start,
      start.clone().add(new THREE.Vector3(side * 0.55, 0, 1.25)),
      new THREE.Vector3(side * 4.8, 0.05, 3.0),
      new THREE.Vector3(side * 5.7, 0.05, 8.5),
      new THREE.Vector3(side * 6.2, 0.05, 13.5)
    ], false, 'centripetal');

    actor.leaving = true;
    actor.avatar.queueWaiting = false;
    actor.avatar.queuedWorshipLane = false;
    actor.avatar.queueWorshipCompleted = false;
    actor.avatar.prayerPose = false;
    actor.avatar.kneeling = false;
    actor.avatar.kneelBlend = 0;
    actor.avatar.bowing = false;
    actor.avatar.bowAmount = 0;
    actor.avatar.ritualBowPhase = 'leaving-temple';
    applyHumanBow(actor.avatar, 0);
    actor.seat.visible = false;
    actor.sutraBook.visible = false;
    actor.moveTarget = null;
    actor.moveCurve = null;
    actor.moveStartedAt = 0;
    actor.moveDurationMs = 0;

    // Keep the seat reserved until the character reaches the door. The actor
    // is returned to queueActorPool after the walk, not destroyed/recreated.
    departingDevotees.push({
      group: actor.group,
      avatar: actor.avatar,
      event: actor.event,
      curve: exitCurve,
      startedAt: now,
      durationMs: Math.max(3600, exitCurve.getLength() / 1.45 * 1000),
      liveViewerActor: actor,
      liveViewerIdentity: identity
    });
  }

  function releaseLiveViewerActor(event) {
    const identity = getDevoteeIdentityKey(event);
    if (!identity) return false;
    liveViewerRoster.delete(identity);
    const actor = liveViewerActors.get(identity);
    if (!actor) return false;
    liveViewerActors.delete(identity);
    actor.group.visible = false;
    actor.event = null;
    actor.moveCurve = null;
    actor.moveTarget = null;
    actor.moveStartedAt = 0;
    actor.moveDurationMs = 0;
    queueActorPool.push(actor);
    return true;
  }

  function updateLiveViewerActors(now) {
    for (const actor of liveViewerActors.values()) {
      if (actor.leaving) continue;
      if (actor.moveCurve) {
        const progress = Math.min(1, Math.max(
          0,
          (now - actor.moveStartedAt) / Math.max(1, actor.moveDurationMs)
        ));
        const eased = progress * progress * (3 - 2 * progress);
        const point = actor.moveCurve.getPointAt(eased);
        const tangent = actor.moveCurve.getTangentAt(eased);
        actor.group.position.copy(point);
        actor.group.rotation.y = Math.atan2(tangent.x, tangent.z) - Math.PI;
        animateHuman(actor.avatar, now, progress < 1, getDistanceBasedGaitPhase(
          eased, actor.moveCurve.getLength(), 1.2, actor.avatar.phase
        ));
        if (progress >= 1) {
          actor.group.position.copy(actor.target);
          actor.group.rotation.set(0, 0, 0);
          actor.moveCurve = null;
          actor.moveStartedAt = 0;
          actor.moveDurationMs = 0;
          actor.avatar.queueWaiting = true;
        }
      } else {
        actor.avatar.offeringElapsedMs = 0;
        actor.avatar.bowing = false;
        actor.avatar.bowAmount = 0;
        actor.avatar.ritualBowPhase = 'meditating';
        animateHuman(actor.avatar, now, false);
        applyHumanBow(actor.avatar, 0, actor.avatar.kneelBlend);
      }
    }
  }

  function setQueueActorTarget(actor, target, slot, now) {
    if (actor.moveTarget && actor.moveTarget.distanceToSquared(target) < 0.001) return;
    actor.target.copy(target);
    actor.moveTarget = target.clone();
    const start = actor.group.position.clone();
    const distance = start.distanceTo(target);
    if (distance < 0.05) {
      actor.group.position.copy(target);
      actor.moveCurve = null;
      actor.moveStartedAt = 0;
      actor.moveDurationMs = 0;
      actor.offeringStartedAt = now;
      return;
    }
    const middle = start.clone().lerp(target, 0.5);
    middle.x += (slot % 2 === 0 ? 1 : -1) * 0.045;
    actor.moveCurve = new THREE.CatmullRomCurve3(
      [start, middle, target.clone()],
      false,
      'centripetal'
    );
    actor.moveStartedAt = now;
    // A natural walking pace keeps each visitor's entrance readable.
    actor.moveDurationMs = Math.max(950, actor.moveCurve.getLength() / 1.45 * 1000);
  }

  function refreshQueueActors(now = performance.now()) {
    const visibleEvents = devoteeQueue.slice(0, MAX_CONCURRENT_WORSHIPPERS - 1);
    for (const [event, actor] of queueActors) {
      if (visibleEvents.includes(event)) continue;
      queueActors.delete(event);
      actor.group.visible = false;
      actor.event = null;
      queueActorPool.push(actor);
    }
    visibleEvents.forEach((event, index) => {
      let actor = queueActors.get(event);
      if (!actor) {
        const slot = getAvailableQueueActorSlot();
        if (slot < 0) return;
        const appearance = getDevoteeAppearance(event);
        actor = queueActorPool.pop();
        if (actor) setHumanAppearance(actor.avatar, appearance);
        else actor = createQueueActor(event, appearance);
        actor.slot = slot;
        const nameTagLayout = getCrowdNameTagLayout(slot, { columns: 1, width: 1.72, height: 0.28, staggerY: 0 });
        actor.nameTag.position.set(0, nameTagLayout.y, 0);
        actor.nameTag.userData.setSize(nameTagLayout.height);
        actor.avatar.queueWaiting = true;
        actor.avatar.queueWorshipCompleted = false;
        actor.avatar.prayerPose = true;
        actor.avatar.kneelBlend = 0;
        actor.avatar.kneeling = false;
        actor.avatar.bowAmount = 0;
        actor.appearance = appearance;
        actor.event = event;
        actor.group.visible = true;
        // Enter just outside the actor's assigned slot, then move into the
        // first free inner seat before filling farther rows and outer columns.
        const entryPosition = getQueueActorEntryPosition(slot);
        actor.group.position.set(entryPosition.x, entryPosition.y, entryPosition.z);
        actor.group.rotation.set(0, 0, 0);
        actor.moveTarget = null;
        actor.moveCurve = null;
        actor.moveStartedAt = 0;
        actor.moveDurationMs = 0;
        actor.offeringStartedAt = 0;
        actor.nameTag.userData.setProfile(event.user || 'Thí Chủ', event.avatar || '');
        actor.prayerTag.userData.setWish(event.wish || event.prayer || event.comment || '');
        queueActors.set(event, actor);
      }
      // Compact the line after every promotion: each remaining visitor
      // advances one slot instead of leaving an empty space at the front.
      const slot = index;
      if (actor.slot !== slot) {
        actor.slot = slot;
        const nameTagLayout = getCrowdNameTagLayout(slot, { columns: 1, width: 1.72, height: 0.28, staggerY: 0 });
        actor.nameTag.position.set(0, nameTagLayout.y, 0);
        actor.nameTag.userData.setSize(nameTagLayout.height);
      }
      const queueFormation = getQueueActorFormationPosition(slot);
      const isWorshipLane = queueFormation?.role === 'worship';
      const queuePosition = new THREE.Vector3(queueFormation.x, queueFormation.y, queueFormation.z);
      actor.avatar.queueWaiting = !isWorshipLane;
      actor.avatar.queuedWorshipLane = isWorshipLane;
      // The fixed 40-seat instanced grid stays visible; never add a duplicate actor seat.
      actor.seat.visible = false;
      actor.sutraBook.visible = !isWorshipLane;
      actor.group.scale.setScalar(isWorshipLane ? 1 : 0.86);
      actor.avatar.offeringIncense = false;
      actor.avatar.prayerPose = !isWorshipLane;
      setQueueActorTarget(actor, queuePosition, slot, now);
    });
  }

  function departCompletedQueueWorship(actor, now = performance.now()) {
    if (!actor || !actor.event || !actor.avatar.queueWorshipCompleted) return false;
    const event = actor.event;
    completedQueueWorship.mark(getDevoteeIdentityKey(event));
    const queueIndex = devoteeQueue.indexOf(event);
    if (queueIndex >= 0) devoteeQueue.splice(queueIndex, 1);
    queueActors.delete(event);

    const start = actor.group.position.clone();
    const side = start.x < 0 ? -1 : 1;
    const exitCurve = new THREE.CatmullRomCurve3([
      start,
      start.clone().add(new THREE.Vector3(side * 0.38, 0, 1.0)),
      new THREE.Vector3(side * 4.8, 0.05, 3.0),
      new THREE.Vector3(side * 5.7, 0.05, 8.5),
      new THREE.Vector3(side * 6.2, 0.05, 13.5)
    ], false, 'centripetal');

    // Their three bows are finished. Stand, leave via the matching side aisle,
    // and keep the event marked rendered so the later FIFO callback cannot
    // resurrect this same viewer at the main altar.
    actor.avatar.queueWaiting = false;
    actor.avatar.queuedWorshipLane = false;
    actor.avatar.queueWorshipCompleted = true;
    actor.avatar.prayerPose = false;
    actor.avatar.kneeling = false;
    actor.avatar.kneelBlend = 0;
    actor.avatar.bowing = false;
    actor.avatar.bowAmount = 0;
    actor.avatar.ritualBowPhase = 'complete';
    actor.avatar.ritualBowCycle = 3;
    actor.seat.visible = false;
    actor.sutraBook.visible = false;
    actor.group.scale.setScalar(0.86);
    departingDevotees.push({
      group: actor.group,
      avatar: actor.avatar,
      event,
      curve: exitCurve,
      startedAt: now,
      durationMs: Math.max(4200, exitCurve.getLength() / 1.35 * 1000)
    });
    return true;
  }

  function releaseQueueActor(event) {
    const actor = queueActors.get(event);
    if (!actor) return null;
    queueActors.delete(event);
    const result = {
      position: actor.group.position.clone(),
      appearance: actor.appearance || actor.avatar.appearance,
      worshipCompleted: Boolean(actor.avatar.queueWorshipCompleted)
    };
    actor.group.visible = false;
    actor.event = null;
    actor.moveTarget = null;
    actor.moveCurve = null;
    actor.moveStartedAt = 0;
    actor.moveDurationMs = 0;
    actor.slot = -1;
    queueActorPool.push(actor);
    return result;
  }
  const devoteeState = {
    active: false, phase: 'idle', event: null, startedAt: 0,
    phaseStartedAt: 0, phaseDuration: 0, curve: null, arrivedAt: 0,
    ejectionStart: null, ejectionAction: null, ejectionMotionDuration: 0,
    awaitingGiftHandoff: false, pausedAt: 0, alreadyWorshippedInQueue: false
  };
  const devoteeRoutes = {
    enter: [[-4.55, 0, 15.3], [-4.2, 0, 13.8], [-3.85, 0, 10.8], [-3.65, 0, 8.0]],
    approach: [[-3.65, 0, 8.0], [-3.55, 0, 5.3], [-2.7, 0, 3.1], [-1.6, 0, 0.15], [0.0, 0, -3.55]],
    exit: [[0.0, 0, -3.55], [1.8, 0, -0.5], [4.8, 0, 3.0], [5.7, 0, 8.5], [6.2, 0, 13.5]]
  };
  function getDevoteeFlowDiagnostics(now = performance.now()) {
    const phaseElapsedMs = devoteeState.active
      ? Math.max(0, now - devoteeState.phaseStartedAt)
      : 0;
    const phaseProgress = devoteeState.phaseDuration > 0
      ? Math.min(1, phaseElapsedMs / devoteeState.phaseDuration)
      : 0;
    const queue = [...queueActors.values()]
      .filter((actor) => actor.group.visible)
      .sort((a, b) => a.group.position.z - b.group.position.z)
      .map((actor) => ({
        user: actor.event?.user || '',
        prayerLabel: actor.prayerTag?.userData?.wishText || '',
        slot: actor.slot,
        gender: actor.avatar.gender,
        kneelBlend: Number((actor.avatar.kneelBlend || 0).toFixed(3)),
        bowAmount: Number((actor.avatar.bowAmount || 0).toFixed(3)),
        queueWaiting: Boolean(actor.avatar.queueWaiting),
        queuedWorshipLane: Boolean(actor.avatar.queuedWorshipLane),
        offeringElapsedMs: Math.round(actor.avatar.offeringElapsedMs || 0),
        offeringStartedAt: Number.isFinite(actor.offeringStartedAt) ? Math.round(actor.offeringStartedAt) : null,
        moveStartedAt: Number.isFinite(actor.moveStartedAt) ? Math.round(actor.moveStartedAt) : null,
        moveDurationMs: Number.isFinite(actor.moveDurationMs) ? Math.round(actor.moveDurationMs) : null,
        ritualBowPhase: actor.avatar.ritualBowPhase || 'idle',
        ritualBowCycle: actor.avatar.ritualBowCycle || 0,
        queueWorshipCompleted: Boolean(actor.avatar.queueWorshipCompleted),
        moving: Boolean(actor.moveCurve),
        position: {
          x: Number(actor.group.position.x.toFixed(2)),
          z: Number(actor.group.position.z.toFixed(2))
        },
        target: {
          x: Number(actor.target.x.toFixed(2)),
          z: Number(actor.target.z.toFixed(2))
        }
      }));
    return {
      active: devoteeState.active,
      activeUser: devoteeState.event?.user || null,
      phase: devoteeState.phase,
      phaseElapsedMs: Math.round(phaseElapsedMs),
      phaseProgress: Number(phaseProgress.toFixed(3)),
      kneelBlend: Number((mainHuman.kneelBlend || 0).toFixed(3)),
      bowAmount: Number((mainHuman.bowAmount || 0).toFixed(3)),
      bowPhase: mainHuman.ritualBowPhase || 'idle',
      bowCycle: mainHuman.ritualBowCycle || 0,
      alreadyWorshippedInQueue: Boolean(devoteeState.alreadyWorshippedInQueue),
      queueLength: devoteeQueue.length,
      visibleQueueActors: queue.length,
      seatedLiveViewerCount: [...liveViewerActors.values()].filter((actor) => !actor.leaving).length,
      departingLiveViewerCount: [...liveViewerActors.values()].filter((actor) => actor.leaving).length,
      pendingLiveViewerCount: Math.max(0, liveViewerRoster.size - liveViewerActors.size),
      seatedWaitingActors: queue.filter((actor) => actor.queueWaiting).length,
      completedSideWorshipPendingFifo: completedQueueWorship.size,
      visibleSeatingCapacity: MAX_VISIBLE_QUEUE_ACTORS,
      visibleSeatPlaceholderCount: congregationSeatPlaceholders.count,
      worshipSeatPlaceholderCount: congregationSeatPlaceholders.worshipCount,
      waitingSeatPlaceholderCount: congregationSeatPlaceholders.waitingCount,
      waitingSeatGrid: { columns: WAITING_SEAT_COLUMNS, rows: WAITING_SEAT_ROWS, fillOrder: 'altar-center-out' },
      visibleActiveActor: Boolean(devoteeState.active && mainDevotee.visible),
      maxConcurrentWorshippers: MAX_CONCURRENT_WORSHIPPERS,
      visibleWorshipQueueActors: queue.filter((actor) => actor.queuedWorshipLane).length,
      centralDevoteeActuallyWorshipping: Boolean(
        devoteeState.active
        && mainDevotee.visible
        && devoteeState.phase === 'ritual'
        && mainHuman.kneelBlend >= 0.9
      ),
      centralDevoteeBowAmount: Number((mainHuman.bowAmount || 0).toFixed(3)),
      simultaneousWorshippers: Math.min(
        MAX_CONCURRENT_WORSHIPPERS,
        (devoteeState.active
          && mainDevotee.visible
          && devoteeState.phase === 'ritual'
          && mainHuman.kneelBlend >= 0.9 ? 1 : 0)
          + queue.filter((actor) => actor.avatar.queuedWorshipLane
            && !actor.moving
            && actor.kneelBlend >= 0.9).length
      ),
      visibleSceneActorCount: (devoteeState.active && mainDevotee.visible ? 1 : 0) + queue.length + departingDevotees.length,
      backgroundNpcCount: 0,
      kneelingQueueActors: queue.filter((actor) => actor.kneelBlend > 0.65).length,
      queue,
      departingCount: departingDevotees.length
    };
  }
  window.__TEMPLE_DEVOTEE_FLOW_DIAGNOSTIC__ = getDevoteeFlowDiagnostics;

  function setDevoteePhase(phase, now, duration) {
    devoteeState.phase = phase;
    devoteeState.phaseStartedAt = now;
    devoteeState.phaseDuration = duration;
    const route = devoteeRoutes[phase];
    devoteeState.curve = route
      ? new THREE.CatmullRomCurve3(route.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal')
      : null;
    if (phase === 'ritual') devoteeState.arrivedAt = now;
  }
  function startNextDevotee(now = performance.now(), requestedEvent = null) {
    if (devoteeState.awaitingGiftHandoff || devoteeState.active || !devoteeQueue.length) {
      if (!devoteeState.active && !devoteeState.awaitingGiftHandoff && !devoteeQueue.length) restoreMainCamera();
      return false;
    }
    // Match the character-state-machine event exactly. A side-lane visitor is
    // already receiving their complete three-bow cycle and must never be
    // pulled into a second altar visit. Only an unstarted seated visitor may
    // be promoted when that exact event becomes active in the FIFO machine.
    const candidateIndex = requestedEvent
      ? devoteeQueue.indexOf(requestedEvent)
      : devoteeQueue.findIndex((event) => {
          const actor = queueActors.get(event);
          return !actor || (
            actor.avatar.queueWaiting
            && !actor.avatar.queuedWorshipLane
            && !actor.avatar.queueWorshipCompleted
          );
        });
    if (candidateIndex < 0) {
      if (!devoteeState.active) restoreMainCamera();
      return false;
    }
    const candidate = devoteeQueue[candidateIndex];
    const candidateActor = queueActors.get(candidate);
    const canPromote = !candidateActor || (
      candidateActor.avatar.queueWaiting
      && !candidateActor.avatar.queuedWorshipLane
      && !candidateActor.avatar.queueWorshipCompleted
    );
    if (!canPromote) return false;
    beginRitualCamera();
    devoteeState.event = devoteeQueue.splice(candidateIndex, 1)[0];
    const queuedActor = releaseQueueActor(devoteeState.event);
    // Promote the exact queued visitor appearance to the altar. Gender and
    // colourway therefore remain stable across the queue-to-main handoff.
    setHumanAppearance(
      mainHuman,
      queuedActor?.appearance || getDevoteeAppearance(devoteeState.event)
    );
    mainHuman.queueWaiting = false;
    mainHuman.prayerPose = false;
    const queueStart = queuedActor?.position || null;
    devoteeState.alreadyWorshippedInQueue = queuedActor?.worshipCompleted === true;
    refreshQueueActors();
    devoteeState.active = true;
    updateMainDevoteeName(devoteeState.event.user, devoteeState.event.avatar,
        devoteeState.event.wish || devoteeState.event.prayer || devoteeState.event.comment);
    mainDevotee.visible = true;
    mainDevotee.position.copy(queueStart || new THREE.Vector3(-4.55, 0.05, 15.3));
    mainDevotee.rotation.set(0, 0, 0);
    mainDevotee.scale.setScalar(1);
    devoteeState.ejectionStart = null;
    devoteeState.ejectionAction = null;
    devoteeState.ejectionMotionDuration = 0;
    devoteeState.awaitingGiftHandoff = false;
    devoteeState.pausedAt = 0;
    mainHuman.kneeling = false;
    mainHuman.kneelBlend = 0;
    mainHuman.bowing = false;
    mainHuman.bowAmount = 0;
    applyHumanBow(mainHuman, 0);
    if (queueStart) {
      const start = queueStart.clone();
      devoteeState.phase = 'approach';
      devoteeState.phaseStartedAt = now;
      devoteeState.phaseDuration = 3000;
      devoteeState.curve = new THREE.CatmullRomCurve3([
        start,
        start.clone().add(new THREE.Vector3(0.05, 0, -1.9)),
        new THREE.Vector3(-3.55, 0.05, 5.3),
        new THREE.Vector3(-2.7, 0.05, 3.1),
        new THREE.Vector3(-1.6, 0.05, 0.15),
        new THREE.Vector3(0, 0.05, -3.55)
      ], false, 'centripetal');
    } else {
      setDevoteePhase('enter', now, 1700);
    }
  }
  function enqueueDevotee(event, { promoteEvent = false } = {}) {
    if (!event || typeof event !== 'object' || renderedDevoteeEvents.has(event)) return;
    const identity = getDevoteeIdentityKey(event);
    if (completedQueueWorship.has(identity)) {
      // The FIFO machine may still hold this viewer's original event after
      // their side-lane animation has finished. Suppress replacement event
      // objects for that same pending visit until character-complete arrives.
      renderedDevoteeEvents.add(event);
      return;
    }
    if (identity && devoteeState.active && getDevoteeIdentityKey(devoteeState.event) === identity) {
      // The same viewer sent another action while their avatar is already active.
      Object.assign(devoteeState.event, event);
      updateMainDevoteeName(devoteeState.event.user, devoteeState.event.avatar,
        devoteeState.event.wish || devoteeState.event.prayer || devoteeState.event.comment);
      renderedDevoteeEvents.add(event);
      return;
    }
    const existingQueuedEvent = identity
      ? devoteeQueue.find((queued) => getDevoteeIdentityKey(queued) === identity)
      : null;
    if (existingQueuedEvent) {
      // Keep the queued visitor and its stable formation slot; only refresh
      // their latest action/details. Never create another avatar for this viewer.
      Object.assign(existingQueuedEvent, event);
      const queuedActor = queueActors.get(existingQueuedEvent);
      if (queuedActor) {
        queuedActor.event = existingQueuedEvent;
        queuedActor.nameTag.userData.setProfile(existingQueuedEvent.user || 'Thí Chủ', existingQueuedEvent.avatar || '');
        queuedActor.prayerTag.userData.setWish(
          existingQueuedEvent.wish || existingQueuedEvent.prayer || existingQueuedEvent.comment || ''
        );
      }
      renderedDevoteeEvents.add(event);
      return;
    }
    if (identity) {
      // If this viewer returns while their previous avatar is still walking
      // out, remove that exit clone before allowing the new visit to begin.
      for (let index = departingDevotees.length - 1; index >= 0; index--) {
        const departing = departingDevotees[index];
        if (getDevoteeIdentityKey(departing.event) !== identity) continue;
        world.remove(departing.group);
        departingDevotees.splice(index, 1);
      }
    }
    // Match the gameplay queue's capacity. The state machine remains the
    // authority; this is only its visible 3D presentation queue.
    if (devoteeQueue.length >= MAX_VISIBLE_QUEUE_ACTORS) return;
    renderedDevoteeEvents.add(event);
    devoteeQueue.push(event);
    // Do not instantiate a waiting duplicate for the first visitor; only
    // visitors behind an active one or a gift handoff need visible queue slots.
    if (devoteeState.active || devoteeState.awaitingGiftHandoff) refreshQueueActors();
    startNextDevotee(performance.now(), promoteEvent ? event : null);
  }

  function finishGiftEjectionHandoff(now = performance.now(), nextEvent = null, { startNext = true } = {}) {
    if (!devoteeState.awaitingGiftHandoff) return false;
    devoteeState.awaitingGiftHandoff = false;
    if (nextEvent && !devoteeQueue.includes(nextEvent)) {
      if (!renderedDevoteeEvents.has(nextEvent)) renderedDevoteeEvents.add(nextEvent);
      devoteeQueue.unshift(nextEvent);
    }
    if (startNext) startNextDevotee(now);
    else restoreMainCamera();
    return true;
  }

  function onTempleCharacterInterruptedForThreeD(event) {
    const detail = event.detail || {};
    if (!devoteeState.active || detail.event !== devoteeState.event) return;
    if (['rocket', 'donut'].includes(detail.action)) return;
    devoteeState.pausedAt = performance.now();
  }

  function onTempleCharacterStartForThreeD(event) {
    const startedEvent = event.detail;
    if (!startedEvent || typeof startedEvent !== 'object') return;
    const now = performance.now();
    const identity = getDevoteeIdentityKey(startedEvent);
    if (completedQueueWorship.has(identity)) {
      // Do not promote a side-lane viewer when the serial 2D/FIFO state
      // machine eventually reaches the same event. It is already worshipped.
      renderedDevoteeEvents.add(startedEvent);
      if (devoteeState.awaitingGiftHandoff) {
        finishGiftEjectionHandoff(now, null, { startNext: false });
      }
      return;
    }

    if (devoteeState.active && devoteeState.event === startedEvent) {
      if (devoteeState.pausedAt) {
        const pausedFor = Math.max(0, now - devoteeState.pausedAt);
        devoteeState.phaseStartedAt += pausedFor;
        devoteeState.arrivedAt += pausedFor;
        devoteeState.pausedAt = 0;
      }
      return;
    }

    if (devoteeState.awaitingGiftHandoff) {
      finishGiftEjectionHandoff(now, startedEvent);
      return;
    }

    // The state machine may announce the first start before temple:ritual is
    // dispatched. In that case start the visual now; the WeakSet prevents the
    // later ritual notification from inserting the same visitor twice.
    if (!devoteeState.active && !devoteeQueue.includes(startedEvent)) {
      enqueueDevotee(startedEvent, { promoteEvent: true });
    } else if (!devoteeState.active) {
      startNextDevotee(now, startedEvent);
    }
  }

  function cloneHumanAvatarForExit(leavingGroup) {
    const cloneNode = (sourceNode) => {
      if (!sourceNode) return null;
      const path = [];
      let node = sourceNode;
      while (node && node !== mainDevotee) {
        const parent = node.parent;
        if (!parent) return null;
        const index = parent.children.indexOf(node);
        if (index < 0) return null;
        path.unshift(index);
        node = parent;
      }
      if (node !== mainDevotee) return null;
      return path.reduce((parent, index) => parent?.children[index] || null, leavingGroup);
    };
    const clone = { ...mainHuman };
    for (const key of [
      'root', 'upperBody', 'torso', 'tunicShell', 'head', 'smile',
      'leftArm', 'rightArm', 'leftHand', 'rightHand',
      'leftLeg', 'rightLeg', 'leftKnee', 'rightKnee', 'leftFoot', 'rightFoot'
    ]) {
      clone[key] = cloneNode(mainHuman[key]);
    }
    clone.eyeWhites = mainHuman.eyeWhites.map(cloneNode);
    clone.eyePupils = mainHuman.eyePupils.map(cloneNode);
    clone.eyebrows = mainHuman.eyebrows.map(({ mesh, side }) => ({ mesh: cloneNode(mesh), side }));
    // The previous visitor is cloned while still kneeling at the altar.
    // Restore an upright pose before the independent exit walk begins.
    clone.kneeling = false;
    clone.kneelBlend = 0;
    clone.bowing = false;
    clone.bowAmount = 0;
    clone.prayerPose = false;
    applyHumanBow(clone, 0);
    return clone;
  }

  function finishActiveDevotee(event, now = performance.now()) {
    if (!devoteeState.active || (event && event !== devoteeState.event)) return false;
    const start = mainDevotee.position.clone();

    // Keep the leaving visitor visible while the next one enters. The normal
    // procedural rig can be safely cloned because its geometry/materials are
    // shared and immutable. Optional skinned GLBs use the safe instant handoff.
    if (!mainHuman.gltfRoot) {
      const leaving = mainDevotee.clone(true);
      const leavingAvatar = cloneHumanAvatarForExit(leaving);
      const floatingTags = [];
      leaving.traverse((node) => {
        if (node.isSprite) floatingTags.push(node);
      });
      floatingTags.forEach((tag) => tag.removeFromParent());
      const exitCurve = new THREE.CatmullRomCurve3([
        start,
        start.clone().add(new THREE.Vector3(0.9, 0, 1.3)),
        new THREE.Vector3(4.8, 0.05, 3.0),
        new THREE.Vector3(5.7, 0.05, 8.5),
        new THREE.Vector3(6.2, 0.05, 13.5)
      ], false, 'centripetal');
      world.add(leaving);
      departingDevotees.push({
        group: leaving, avatar: leavingAvatar, event: devoteeState.event, curve: exitCurve,
        startedAt: now, durationMs: 10500
      });
    }

    mainDevotee.visible = false;
    mainDevotee.rotation.set(0, 0, 0);
    mainDevotee.scale.setScalar(1);
    devoteeState.active = false;
    devoteeState.phase = 'idle';
    devoteeState.event = null;
    devoteeState.curve = null;
    devoteeState.pausedAt = 0;
    devoteeState.ejectionStart = null;
    devoteeState.ejectionAction = null;
    devoteeState.ejectionMotionDuration = 0;
    // Do not pre-emptively take a side-lane worshipper. The next
    // character-start event from the FIFO state machine decides whether the
    // next visual visitor is still seated and eligible for the main altar.
    restoreMainCamera();
    return true;
  }

  function onTempleCharacterCompleteForThreeD(event) {
    const completedEvent = event.detail;
    completedQueueWorship.complete(getDevoteeIdentityKey(completedEvent));
    finishActiveDevotee(completedEvent);
  }

  function onTempleGiftEffectsComplete() {
    finishGiftEjectionHandoff();
  }

  function ejectActiveDevotee(action, now = performance.now()) {
    if (!['rocket', 'donut'].includes(action) || !devoteeState.active || !mainDevotee.visible) return null;
    const start = mainDevotee.position.clone();
    devoteeState.ejectionStart = start.clone();
    devoteeState.ejectionAction = action;
    // A Rocket/Donut can supersede Dragon/Rose while that visitor is paused.
    // Ejection must resume the frame loop or it would remain frozen offstage.
    devoteeState.pausedAt = 0;
    mainHuman.kneeling = false;
    mainHuman.kneelBlend = 0;
    mainHuman.bowing = false;
    mainHuman.bowAmount = 0;
    applyHumanBow(mainHuman, 0);

    if (action === 'rocket') {
      devoteeState.ejectionMotionDuration = 1450;
      setDevoteePhase('rocketEject', now, devoteeState.ejectionMotionDuration);
    } else {
      devoteeState.ejectionMotionDuration = 2850;
      setDevoteePhase('donutChase', now, devoteeState.ejectionMotionDuration);
      devoteeState.curve = new THREE.CatmullRomCurve3([
        start,
        start.clone().add(new THREE.Vector3(1.5, 0, 1.7)),
        new THREE.Vector3(4.1, 0.05, start.z + 4.8),
        new THREE.Vector3(5.6, 0.05, start.z + 8.8),
        new THREE.Vector3(6.2, 0.05, 14.5)
      ], false, 'centripetal');
    }
    return start;
  }

  // Prayer flags, side screens and lotus planters give the hall a lived-in scale.
  for (const x of [-6.2, 6.2]) {
    for (let z = -8; z <= 10; z += 6) {
      box(0.55, 0.22, 1.2, mats.woodLight, x, 0.18, z);
      for (let i = 0; i < 3; i++) {
        const leaf = sphere(0.22, mats.leaf, x + (i - 1) * 0.22, 0.48, z, 0.45, 0.18, 1.2);
        leaf.rotation.z = (i - 1) * 0.35;
      }
      for (let i = 0; i < 3; i++) {
        const petal = sphere(0.2, mats.lotus, x + (i - 1) * 0.22, 0.75, z, 0.65, 0.35, 1.1);
        petal.rotation.z = (i - 1) * 0.25;
      }
    }
  }

  // Gentle ambient incense motes and lamp flames keep the world alive at idle.
  const dustGeometry = new THREE.BufferGeometry();
  const dustCount = 130;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 15;
    dustPositions[i * 3 + 1] = 0.8 + Math.random() * 8;
    dustPositions[i * 3 + 2] = -10 + Math.random() * 26;
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xffd98b, size: 0.045, transparent: true, opacity: 0.72 }));
  world.add(dust);

  // A slow foreground stream of gilded lotus petals rises from the lower edge
  // of the portrait frame. Instancing keeps the effect inexpensive for LIVE.
  const foregroundLotusPetalCount = 34;
  const foregroundLotusPetalGeometry = new THREE.SphereGeometry(0.12, 10, 8);
  const foregroundLotusPetalMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd477,
    roughness: 0.36,
    metalness: 0.62,
    emissive: 0x75430b,
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.88
  });
  const foregroundLotusPetals = new THREE.InstancedMesh(
    foregroundLotusPetalGeometry,
    foregroundLotusPetalMaterial,
    foregroundLotusPetalCount
  );
  foregroundLotusPetals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  foregroundLotusPetals.frustumCulled = false;
  foregroundLotusPetals.castShadow = false;
  foregroundLotusPetals.receiveShadow = false;
  world.add(foregroundLotusPetals);
  const foregroundLotusSeeds = Array.from({ length: foregroundLotusPetalCount }, (_, index) => ({
    x: (Math.random() - 0.5) * 7.2,
    z: 13.2 + Math.random() * 4.6,
    phase: index / foregroundLotusPetalCount,
    speed: 0.58 + Math.random() * 0.62,
    size: 0.72 + Math.random() * 0.65
  }));
  const foregroundLotusTransform = new THREE.Object3D();

  function updateForegroundLotusPetals(time) {
    for (let index = 0; index < foregroundLotusPetalCount; index++) {
      const seed = foregroundLotusSeeds[index];
      const progress = (seed.phase + time * 0.000105 * seed.speed) % 1;
      const drift = Math.sin(time * 0.00072 + seed.phase * Math.PI * 2);
      foregroundLotusTransform.position.set(
        seed.x + drift * 0.42,
        0.12 + progress * 2.45,
        seed.z - progress * 1.45
      );
      foregroundLotusTransform.rotation.set(
        1.05 + Math.sin(time * 0.00055 + seed.phase * 5) * 0.55,
        seed.phase * Math.PI * 2 + time * 0.00035,
        time * 0.00048 * seed.speed + seed.phase * Math.PI * 2
      );
      const scale = seed.size * (0.82 + Math.sin(progress * Math.PI) * 0.18);
      foregroundLotusTransform.scale.set(scale * 1.35, scale * 0.22, scale * 0.72);
      foregroundLotusTransform.updateMatrix();
      foregroundLotusPetals.setMatrixAt(index, foregroundLotusTransform.matrix);
    }
    foregroundLotusPetals.instanceMatrix.needsUpdate = true;
  }

  const effects = [];
  // Keep transient gift/ritual meshes bounded during high-volume live sessions.
  // Evicted effects are detached and disposed by addEffect() before insertion.
  const MAX_EFFECTS = 48;
  let raf = 0, lastFrame = 0, elapsed = 0, disposed = false;
  let ritualUntil = 0;
  const clock = new THREE.Clock();

  // Load the repository's selected Buddha GLB by default in every 3D session.
  // Set ?buddha=0 only when a procedural-only preview is explicitly needed.
  const modelParams = new URLSearchParams(location.search);
  const modelsRequested = modelParams.get('models') === '1';
  const buddhaModelRequested = modelParams.get('buddha') !== '0';
  // Ao Dai male/female are the default live characters. Imported Quaternius
  // devotees are an explicit optional skin pack, never an automatic replacement.

  // Yaw is deliberately applied on a separate pivot so it never overwrites
  // the GLB loader's ground/roll correction quaternion.
  let buddhaYawPivot = null;
  let buddhaYawDegrees = Number(modelParams.get('buddhaYaw') || 0);
  if (!Number.isFinite(buddhaYawDegrees)) buddhaYawDegrees = 0;
  buddhaYawDegrees = THREE.MathUtils.clamp(buddhaYawDegrees, -180, 180);
  function setBuddhaYaw(degrees) {
    const next = Number(degrees);
    if (!Number.isFinite(next)) return false;
    buddhaYawDegrees = THREE.MathUtils.clamp(next, -180, 180);
    if (buddhaYawPivot) {
      buddhaYawPivot.rotation.y = THREE.MathUtils.degToRad(buddhaYawDegrees);
      buddhaYawPivot.updateMatrixWorld(true);
    }
    window.__TEMPLE_BUDDHA_YAW_DEGREES__ = buddhaYawDegrees;
    return true;
  }
  window.__TEMPLE_SET_BUDDHA_YAW__ = setBuddhaYaw;
  setBuddhaYaw(buddhaYawDegrees);
  if (!buddhaModelRequested && !modelsRequested) {
    window.__TEMPLE_BUDDHA_MODEL_SOURCE__ = 'custom-procedural';
  }
  // Diagnostics are opt-in so normal live sessions pay no logging overhead.
  const statsEnabled = modelParams.get('stats') === '1';
  let lastStatsAt = 0;
  let lastRenderedFrameAt = 0;
  let frameWindowStartedAt = 0;
  const frameIntervals = [];
  const MIN_FRAME_SAMPLES_FOR_PERCENTILES = 30;

  // A hidden tab pauses requestAnimationFrame. Start a fresh diagnostic window
  // on visibility changes so the pause is not misreported as frame latency.
  function resetFrameDiagnostics() {
    if (!statsEnabled) return;
    frameIntervals.length = 0;
    lastRenderedFrameAt = 0;
    frameWindowStartedAt = 0;
    lastStatsAt = 0;
  }

  function applyGiltFinish(root) {
    root.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!material) continue;
        // The public MIA scan is a neutral/light scan of a gilt-bronze object.
        // Apply a restrained gold PBR finish while preserving its texture maps.
        if (material.color) material.color.setHex(0xc99a3c);
        // A slightly broader highlight and lower self-glow read closer to aged
        // gilt bronze under the temple's warm key lights, not polished plastic.
        if ('metalness' in material) material.metalness = 0.68;
        if ('roughness' in material) material.roughness = 0.42;
        if ('envMapIntensity' in material) material.envMapIntensity = 1.15;
        if (material.emissive) {
          material.emissive.setHex(0x241304);
          material.emissiveIntensity = 0.035;
        }
        material.needsUpdate = true;
      }
      // Preserve the loader's triangle-budget shadow policy for scanned models.
    });
  }

  async function upgradeBuddhaFromGLB() {
    let asset;
    let assetSource = 'procedural';
    const selectedUrl = '/assets/models/buddha-selected.glb';
    const fallbackUrl = '/assets/models/buddha-cc0-fallback.glb';
    const customUrl = '/assets/models/buddha.glb';
    const diagnostics = {
      state: 'loading',
      preferred: 'kenny-hsieh',
      source: null,
      attempts: [],
      startedAt: new Date().toISOString()
    };
    window.__TEMPLE_BUDDHA_MODEL_DIAGNOSTIC__ = diagnostics;

    try {
      const { loadGLTFAsset } = await import('./three-model-loader.js');
      // The selected Kenny Hsieh model is the default. The smaller CC0 scan is
      // the automatic fallback. A legacy/custom buddha.glb is opt-in only so
      // it can never silently replace the selected statue.
      const candidates = modelParams.get('buddha') === 'custom'
        ? [
            { url: customUrl, source: 'user-custom' },
            { url: selectedUrl, source: 'kenny-hsieh' },
            { url: fallbackUrl, source: 'mia-cc0-gilt-bronze' }
          ]
        : [
            { url: selectedUrl, source: 'kenny-hsieh' },
            { url: fallbackUrl, source: 'mia-cc0-gilt-bronze' }
          ];

      for (const candidate of candidates) {
        try {
          // Load directly instead of probing with HEAD first. This avoids an
          // extra request, preserves the original model-loading error and removes
          // false-positive 404s for optional legacy model paths.
          asset = await loadGLTFAsset(candidate.url, {
            targetHeight: 5.88,
            centerXZ: true,
            alignGroundPlane: true
          });
          assetSource = candidate.source;
          diagnostics.attempts.push({
            source: candidate.source,
            url: candidate.url,
            ok: true,
            triangles: asset.triangleCount,
            groundAlignment: asset.groundAlignment
          });
          break;
        } catch (error) {
          diagnostics.attempts.push({
            source: candidate.source,
            url: candidate.url,
            ok: false,
            error: error?.message || String(error)
          });
          console.warn(`[Temple3D] Buddha model ${candidate.source} failed; trying the next bundled model:`, error);
        }
      }

      if (!asset) {
        diagnostics.state = 'fallback';
        diagnostics.source = 'procedural';
        diagnostics.finishedAt = new Date().toISOString();
        window.__TEMPLE_BUDDHA_MODEL_SOURCE__ = 'procedural';
        console.warn('[Temple3D] No bundled Buddha GLB could be loaded; procedural statue remains visible.', diagnostics);
        return;
      }

      if (disposed) {
        asset.dispose();
        diagnostics.state = 'disposed';
        diagnostics.source = assetSource;
        diagnostics.finishedAt = new Date().toISOString();
        return;
      }
      console.info('[Temple3D] Buddha mesh budget', {
        source: assetSource,
        triangles: asset.triangleCount,
        castsShadow: asset.castsShadow,
        groundAlignment: asset.groundAlignment
      });

      // Use the same aged-bronze material treatment for the preferred Kenny
      // model, the CC0 museum scan and any explicitly supplied custom GLB.
      applyGiltFinish(asset.root);
      if (assetSource === 'mia-cc0-gilt-bronze') {
        // The museum scan reads slightly narrow in the 9:16 altar composition.
        // Widen only the horizontal axis; preserve height, ground contact and center.
        const originalCenter = new THREE.Box3()
          .setFromObject(asset.root)
          .getCenter(new THREE.Vector3());
        asset.root.scale.x *= 1.1;
        asset.root.updateMatrixWorld(true);
        const widenedCenter = new THREE.Box3()
          .setFromObject(asset.root)
          .getCenter(new THREE.Vector3());
        asset.root.position.x += originalCenter.x - widenedCenter.x;
        asset.root.position.z += originalCenter.z - widenedCenter.z;
        asset.root.updateMatrixWorld(true);
      }

      // Preserve a hidden emergency fallback, but never report it as the active
      // statue after a GLB has been attached to the altar.
      for (const child of statue.children) child.visible = false;
      asset.root.visible = true;
      // Keep yaw independent from the model's own tilt/ground-alignment transform.
      buddhaYawPivot = new THREE.Group();
      buddhaYawPivot.name = 'BuddhaYawPivot';
      buddhaYawPivot.rotation.y = THREE.MathUtils.degToRad(buddhaYawDegrees);
      buddhaYawPivot.add(asset.root);
      statue.add(buddhaYawPivot);
      buddhaYawPivot.updateMatrixWorld(true);
      window.__TEMPLE_BUDDHA_MODEL_SOURCE__ = assetSource;
      diagnostics.state = 'loaded';
      diagnostics.source = assetSource;
      diagnostics.finishedAt = new Date().toISOString();
      diagnostics.triangles = asset.triangleCount;
      diagnostics.groundAlignment = asset.groundAlignment;
      diagnostics.surfaceFinish = { name: 'aged-gold bronze', color: '#c99a3c', metalness: 0.68, roughness: 0.42 };
    } catch (error) {
      diagnostics.state = 'error';
      diagnostics.source = 'procedural';
      diagnostics.error = error?.message || String(error);
      diagnostics.finishedAt = new Date().toISOString();
      window.__TEMPLE_BUDDHA_MODEL_SOURCE__ = 'procedural';
      console.warn('[Temple3D] Buddha GLB loading failed; keeping procedural fallback:', error);
    }
  }

  function addEffect(object, update, duration = 1800) {
    if (effects.length >= MAX_EFFECTS) {
      const old = effects.shift(); world.remove(old.object); disposeThreeObjectTree(old.object);
    }
    world.add(object); effects.push({ object, update, elapsed: 0, duration });
  }
  function makeRing(x, y, z, color = 0xffd16b) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    mesh.position.set(x, y, z); mesh.rotation.x = -Math.PI / 2;
    addEffect(mesh, (obj, dt, p) => { const s = 1 + p * 5; obj.scale.setScalar(s); obj.material.opacity = 0.85 * (1 - p); }, 1400);
  }
  function lotusBurst(count = 5) {
    for (let i = 0; i < Math.min(count, 18); i++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mats.lotus.clone());
      petal.position.set((Math.random() - 0.5) * 5, 1.2 + Math.random() * 3, -4 + Math.random() * 9);
      addEffect(petal, (obj, dt, p) => {
        obj.position.y += dt * 0.0015; obj.rotation.z += dt * 0.001;
        obj.material.opacity = 0.9 * (1 - p);
      }, 2600);
    }
  }
  // Three-dimensional gift reactions mirror the existing gift action engine.
  // Every transient effect owns its materials: disposeThreeObjectTree() can then
  // release them without disposing shared sanctuary materials used by the world.
  // They are world-space overlays; they never move the master camera.
  function giftSparkBurst(x, y, z, count = 18, color = 0xffc45a) {
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.055 + Math.random() * 0.045, 8, 6), material);
      spark.position.set(x, y, z);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 4.5,
        (Math.random() - 0.5) * 4
      );
      addEffect(spark, (obj, dt, p) => {
        const step = dt * 0.001;
        obj.position.addScaledVector(velocity, step);
        velocity.y -= step * 2.4;
        obj.scale.setScalar(Math.max(0.01, 1 - p));
        obj.material.opacity = 0.95 * (1 - p);
      }, 1050);
    }
  }

  function giftExplosionBurst(position, vfx, color = 0xffa52e) {
    const center = position.clone();
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff1bd, transparent: true, opacity: 0.96,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 14), flashMaterial);
    flash.position.copy(center);
    addEffect(flash, (obj, dt, p) => {
      obj.scale.setScalar(1 + p * (5.4 + vfx.scale * 1.8));
      obj.material.opacity = 0.96 * (1 - p) * (1 - p);
    }, 620);

    const smokeCount = Math.min(14, 5 + vfx.shockwaves);
    for (let i = 0; i < smokeCount; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 ? 0x6e5140 : 0x9a7657,
        transparent: true, opacity: 0.34, depthWrite: false
      });
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.16, 9, 7), material);
      puff.position.copy(center);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2.8,
        0.8 + Math.random() * 2.5,
        (Math.random() - 0.5) * 2.8
      );
      addEffect(puff, (obj, dt, p) => {
        obj.position.addScaledVector(velocity, dt * 0.001);
        obj.scale.setScalar(1 + p * 2.6);
        obj.material.opacity = 0.34 * (1 - p);
      }, 1450);
    }
    for (let wave = 0; wave < vfx.shockwaves; wave++) {
      makeRing(center.x, center.y + wave * 0.07, center.z, wave % 2 ? 0xffe18a : color);
    }
    // Keep the complete flash/smoke/ring/spark sequence inside the shared
    // transient-effect budget so high-tier blasts do not evict their own flash.
    const sparkCount = Math.max(8, Math.min(
      vfx.particles + 16,
      MAX_EFFECTS - 1 - smokeCount - vfx.shockwaves
    ));
    giftSparkBurst(center.x, center.y + 0.12, center.z, sparkCount, color);
  }

  // Set only while a targeted gift effect is built; null means the altar is empty.
  let giftImpactPosition = null;

  function playWorldGiftAction(action, reactionProfile = null) {
    const vfx = resolveGiftVfxProfile(reactionProfile || {});
    const scale = vfx.scale;
    const durationScale = vfx.durationScale;
    if (action === 'rocket') {
      const impact = giftImpactPosition
        ? giftImpactPosition.clone().add(new THREE.Vector3(0, 1.4, 0))
        : new THREE.Vector3(0, 1.25, 1.0);
      const launch = impact.clone().add(new THREE.Vector3(-8, 2.2, 4.6));
      const rocket = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 12), mats.redBright.clone());
      body.rotation.z = -Math.PI / 2; rocket.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 12), mats.goldBright.clone());
      nose.rotation.z = -Math.PI / 2; nose.position.x = 0.6; rocket.add(nose);
      const finMaterial = mats.gold.clone();
      for (const side of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.34), finMaterial);
        fin.position.set(-0.32, side * 0.14, 0); rocket.add(fin);
      }
      rocket.position.copy(launch); rocket.rotation.y = -0.08;
      rocket.scale.setScalar(scale);
      addEffect(rocket, (obj, dt, p) => {
        obj.position.copy(launch).lerp(impact, p);
        obj.position.y += Math.sin(p * Math.PI) * 0.7;
        obj.rotation.z = -0.08 + p * 0.12;
        if (p >= 0.98 && !obj.userData.detonated) {
          obj.userData.detonated = true;
          world.remove(obj);
          giftExplosionBurst(impact, vfx, 0xffa52e);
        }
      }, Math.round(1250 * durationScale));
      return;
    }
    if (action === 'dragon') {
      const dragon = new THREE.Group();
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2d9a54, roughness: 0.5, metalness: 0.12 });
      const goldMaterial = mats.goldBright.clone();
      const segmentCount = 4 + vfx.shockwaves;
      for (let i = 0; i < segmentCount; i++) {
        const segment = new THREE.Mesh(
          new THREE.SphereGeometry(0.30 - i * 0.018, 12, 8),
          bodyMaterial
        );
        segment.position.set(-i * 0.38, Math.sin(i * 0.8) * 0.12, 0);
        dragon.add(segment);
      }
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), bodyMaterial);
      head.position.set(0.42, 0.05, 0); dragon.add(head);
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 8), goldMaterial);
        horn.position.set(0.3, 0.38, side * 0.18); horn.rotation.z = -0.35; dragon.add(horn);
      }
      const whisker = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 18, Math.PI), goldMaterial);
      whisker.position.set(0.58, -0.1, 0); dragon.add(whisker);
      dragon.position.set(-8, 6.2, -1.5);
      addEffect(dragon, (obj, dt, p) => {
        obj.position.x = -8 + p * 16;
        obj.position.y = 6.2 + Math.sin(p * Math.PI * 4) * 0.55;
        obj.position.z = -1.5 + Math.sin(p * Math.PI * 2) * 0.7;
        obj.rotation.z = Math.sin(p * Math.PI * 4) * 0.08;
        obj.scale.setScalar((0.72 + Math.sin(p * Math.PI) * 0.22) * scale);
        if (p > 0.72 && !obj.userData.gust) {
          obj.userData.gust = true;
          for (let wave = 0; wave < vfx.shockwaves; wave++) {
            makeRing(0, 1.5 + wave * 0.12, -0.2, wave % 2 ? 0xffd978 : 0x65d9a0);
          }
          giftSparkBurst(0, 2.0, -0.2, vfx.particles, 0x65d9a0);
        }
      }, Math.round(2900 * durationScale));
      return;
    }
    if (action === 'donut') {
      const donutMaterial = new THREE.MeshStandardMaterial({ color: 0xf1a0bd, roughness: 0.38, metalness: 0.04 });
      const donut = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.22, 14, 36), donutMaterial);
      const target = giftImpactPosition ? giftImpactPosition.clone() : new THREE.Vector3(0, 0, 0);
      const start = target.clone().add(new THREE.Vector3(-6.4, 2.8, 2.8));
      const destination = target.clone().add(new THREE.Vector3(6.5, 2.4, 11.5));
      donut.position.copy(start);
      const icing = new THREE.Mesh(new THREE.TorusGeometry(0.59, 0.055, 8, 36), mats.ivory.clone());
      icing.position.y = 0.08; donut.add(icing);
      addEffect(donut, (obj, dt, p) => {
        obj.position.copy(start).lerp(destination, p);
        obj.position.y += Math.sin(p * Math.PI * 4) * 0.42;
        obj.rotation.x += dt * 0.002;
        obj.rotation.y += dt * 0.004;
        obj.scale.setScalar((0.65 + Math.sin(p * Math.PI) * 0.3) * scale);
        if (p > 0.42 && !obj.userData.trail) {
          obj.userData.trail = true;
          const trailCount = Math.min(14, 5 + Math.round(vfx.shockwaves * 2));
          for (let i = 0; i < trailCount; i++) {
            makeRing(target.x + (i - (trailCount - 1) / 2) * 0.32, 0.9 + (i % 2) * 0.08, target.z + 2.8, 0xffc2dc);
          }
        }
      }, Math.round(2850 * durationScale));
      return;
    }
    if (action === 'rose') {
      const bloom = new THREE.Group();
      bloom.position.set(0, 3.0, 2.5);
      const petalMaterial = mats.lotus.clone();
      const petalCount = 8 + vfx.shockwaves * 3;
      for (let i = 0; i < petalCount; i++) {
        const angle = i * Math.PI * 2 / petalCount;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), petalMaterial);
        petal.position.set(Math.cos(angle) * 0.35, Math.sin(angle) * 0.35, 0);
        petal.scale.set(1.0, 0.58, 0.48);
        petal.rotation.z = angle;
        bloom.add(petal);
      }
      const heart = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mats.goldBright.clone());
      bloom.add(heart);
      addEffect(bloom, (obj, dt, p) => {
        obj.position.y = 3.0 + p * 1.8;
        obj.rotation.z += dt * 0.0007;
        obj.scale.setScalar((0.35 + Math.sin(Math.min(1, p * 1.5) * Math.PI / 2) * 0.85) * scale);
        obj.children.forEach((petal, i) => { petal.rotation.z += dt * (i % 2 ? 0.0003 : -0.0003); });
        if (p > 0.28 && !obj.userData.petalBurst) {
          obj.userData.petalBurst = true;
          giftSparkBurst(0, 4.0, 2.5, Math.max(10, vfx.particles), 0xf18eae);
        }
      }, Math.round(2100 * durationScale));
    }
  }

  function incenseEffect() {
    for (let i = 0; i < 8; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.16 + Math.random() * 0.1, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xd7c5a6, transparent: true, opacity: 0.22 }));
      puff.position.set((Math.random() - 0.5) * 0.5, 2 + i * 0.12, -5.6);
      addEffect(puff, (obj, dt, p) => {
        obj.position.y += dt * 0.001; obj.position.x += Math.sin(p * 7) * dt * 0.0002;
        obj.scale.multiplyScalar(1 + dt * 0.00012); obj.material.opacity = 0.22 * (1 - p);
      }, 3600);
    }
  }
  function handleRitual(event) {
    if (!event || typeof event.type !== 'string') return;
    const stationKindByAction = {
      ringBell: 'bell',
      strikeWoodenFish: 'woodfish',
      drawFortune: 'fortune'
    };
    if (stationKindByAction[event.type]) triggerRitualStation(stationKindByAction[event.type]);
    ritualUntil = performance.now() + 7800;
    // Mirror the 2D central-worshipper lifecycle for every visitor action that
    // presents a named devotee, not only incense. The name stays attached to
    // this active avatar until its ritual completes.
    const hasNamedDevotee = ['burnIncense', 'sendPrayer', 'offerGift', 'grandCeremony', 'ringBell', 'drawFortune'].includes(event.type);
    const targetedGiftAction = ['offerGift', 'grandCeremony'].includes(event.type) ? resolveGiftAction(event) : null;
    // Promote the same seated viewer into the ritual FIFO instead of cloning a
    // second avatar when their first comment/gift arrives.
    if (hasNamedDevotee) releaseLiveViewerActor(event);
    // Rocket/Donut act on the devotee already at the altar; the gift sender is
    // not incorrectly cloned into a second, ordinary queue visit.
    if (hasNamedDevotee && !targetedGiftAction) enqueueDevotee(event);
    if (event.type === 'burnIncense') {
      incenseEffect(); makeRing(0, 1.2, -5.6);
    }
    else if (event.type === 'ringBell') { makeRing(-2.2, 2.78, -5.85, 0xffe18a); }
    else if (event.type === 'strikeWoodenFish') { makeRing(3.75, 0.9, -1.2); }
    else if (event.type === 'sendPrayer') lotusBurst(8);
    else if (event.type === 'offerGift') lotusBurst(Math.min(18, 5 + Math.ceil((event.coins || 10) / 10)));
    else if (event.type === 'grandCeremony') { lotusBurst(18); for (let i = 0; i < 5; i++) makeRing(0, 0.2 + i * 0.2, -7); }
    else if (event.type === 'drawFortune') { lotusBurst(5); makeRing(3.75, 0.85, -5.4, 0xffdf83); }
    syncLiveViewerSeats();
    start();
  }
  function onTempleRitual(event) { handleRitual(event.detail); }
  // A gift can arrive while the altar is empty; listen to the effect lifecycle,
  // not the character-interruption signal, so every started gift renders once.
  function applyGiftReactionProfile(profile) {
    const resolved = profile || { tier: 'small', intensity: 0.55, bowAmount: 0.08, durationMs: 1800 };
    const now = performance.now();
    for (const avatar of allHumanAvatars) {
      const wasActive = avatar.giftReactionUntil > now;
      if (!wasActive) {
        // Phase-based delay creates a visible congregation wave without random jumps.
        const phase = ((avatar.phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        avatar.giftReactionStartedAt = now + (phase / (Math.PI * 2)) * 420;
        avatar.giftReactionUntil = avatar.giftReactionStartedAt + resolved.durationMs;
        avatar.giftReactionProfile = resolved;
      } else {
        avatar.giftReactionUntil = Math.max(avatar.giftReactionUntil, now + resolved.durationMs);
        if (resolved.intensity >= (avatar.giftReactionProfile?.intensity || 0)) {
          avatar.giftReactionProfile = resolved;
          avatar.giftReactionStartedAt = Math.min(avatar.giftReactionStartedAt, now);
        }
      }
    }
  }
  function onTempleGiftAction(event) {
    const action = event.detail?.action;
    if (!['rocket', 'dragon', 'donut', 'rose'].includes(action)) return;
    // Respect the state machine's target ownership. A Rocket/Donut received
    // while the altar is empty must not eject an unrelated 3D visitor.
    const hasTarget = event.detail?.hasTarget === true;
    const reactionProfile = event.detail?.reactionProfile || { tier: 'small', intensity: 0.62, bowAmount: 0.16, durationMs: 2100 };
    const impact = hasTarget && ['rocket', 'donut'].includes(action)
      ? ejectActiveDevotee(action)
      : null;
    giftImpactPosition = impact;
    try {
      playWorldGiftAction(action, reactionProfile);
    } finally {
      giftImpactPosition = null;
    }
    applyGiftReactionProfile(reactionProfile);
  }
  function onTempleGiftReaction(event) {
    // Combo frames update gratitude intensity without replaying the 3D gift effect.
    applyGiftReactionProfile(event.detail?.reactionProfile);
  }
  window.addEventListener('temple:ritual', onTempleRitual);
  window.addEventListener('temple:viewer-enter', onTempleViewerEnter);
  window.addEventListener('temple:viewer-leave', onTempleViewerLeave);
  // Replay ordered member presence changes buffered while the asynchronous
  // 3D scene booted, then consume the legacy arrivals queue if still present.
  const pendingViewerEvents = Array.isArray(window.__TEMPLE_PENDING_VIEWER_EVENTS__)
    ? window.__TEMPLE_PENDING_VIEWER_EVENTS__.splice(0)
    : [];
  pendingViewerEvents.forEach((item) => {
    if (item?.type === 'leave') onTempleViewerLeave({ detail: item.viewer });
    else if (item?.viewer) onTempleViewerEnter({ detail: item.viewer });
  });
  const pendingViewerEntries = Array.isArray(window.__TEMPLE_PENDING_VIEWER_ENTRIES__)
    ? window.__TEMPLE_PENDING_VIEWER_ENTRIES__.splice(0)
    : [];
  pendingViewerEntries.forEach((viewer) => onTempleViewerEnter({ detail: viewer }));
  window.addEventListener('temple:gift-action', onTempleGiftAction);
  window.addEventListener('temple:gift-reaction', onTempleGiftReaction);
  window.addEventListener('temple:character-interrupted', onTempleCharacterInterruptedForThreeD);
  window.addEventListener('temple:character-start', onTempleCharacterStartForThreeD);
  window.addEventListener('temple:character-complete', onTempleCharacterCompleteForThreeD);
  window.addEventListener('temple:gift-effects-complete', onTempleGiftEffectsComplete);

  // Add the independent roofless architectural detail layer to the same scene.
  // It shares the renderer, camera and animation loop; no extra lights are created.
  const templeEnvironment = createTempleEnvironment({
    THREE,
    scene,
    config: { detailLevel: renderProfile.environmentDetail }
  });

  function frame(now) {
    if (disposed || document.hidden) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
    if (now - lastFrame < 33) return; // cap at 30 fps for the portrait live scene
    if (statsEnabled) {
      if (!frameWindowStartedAt) frameWindowStartedAt = now;
      if (lastRenderedFrameAt > 0) {
        frameIntervals.push(now - lastRenderedFrameAt);
        // Bound diagnostic memory even during unusually long device sessions.
        if (frameIntervals.length > 300) frameIntervals.shift();
      }
      lastRenderedFrameAt = now;
    }
    const dt = Math.min(50, now - (lastFrame || now));
    lastFrame = now; elapsed += dt;
    updateRitualCamera(dt, now);
    const isBuddhaCameraAction = ['buddha-orbit', 'buddha-pov-pan'].includes(activeCameraPreset?.action);
    halo.rotation.z = Math.sin(elapsed * (isBuddhaCameraAction ? 0.00034 : 0.00016))
      * (isBuddhaCameraAction ? 0.045 : 0.025);
    lotusThrone.rotation.y = Math.sin(elapsed * 0.00022) * 0.025;
    springDecorTrees.forEach((tree) => {
      tree.rotation.z = Math.sin(elapsed * 0.00032 + tree.userData.phase) * 0.008;
    });
    const abbotBreath = Math.sin(elapsed * 0.00115) * 0.012;
    const abbotFocusTargets = [];
    if (devoteeState.active && mainDevotee.visible && mainHuman.kneelBlend > 0.04) {
      abbotFocusTargets.push({
        x: mainDevotee.position.x,
        z: mainDevotee.position.z,
        weight: Math.max(0.35, mainHuman.kneelBlend) * (0.7 + (mainHuman.bowAmount || 0)),
        user: devoteeState.event?.user || 'Thí chủ chính'
      });
    }
    for (const actor of queueActors.values()) {
      if (!actor.avatar.queuedWorshipLane || actor.moveCurve || actor.avatar.kneelBlend < 0.04) continue;
      abbotFocusTargets.push({
        x: actor.group.position.x,
        z: actor.group.position.z,
        weight: Math.max(0.35, actor.avatar.kneelBlend) * (0.7 + (actor.avatar.bowAmount || 0)),
        user: actor.event?.user || 'Phật tử'
      });
    }
    const congregationBow = Math.max(
      mainHuman.bowAmount || 0,
      ...[...queueActors.values()]
        .filter((actor) => actor.avatar.queuedWorshipLane && !actor.moveCurve)
        .map((actor) => actor.avatar.bowAmount || 0),
      0
    );
    const isAbbotPortraitAction = activeCameraPreset?.action === 'abbot-bow-portrait';
    const abbotShotBow = isAbbotPortraitAction
      ? 0.22 + Math.sin(activeCameraProgress * Math.PI) * 0.2
      : 0;
    const abbotBowAmount = THREE.MathUtils.clamp(Math.max(congregationBow, abbotShotBow), 0, 1);
    const focusWeight = abbotFocusTargets.reduce((sum, target) => sum + target.weight, 0);
    const abbotFocusX = focusWeight > 0
      ? abbotFocusTargets.reduce((sum, target) => sum + target.x * target.weight, 0) / focusWeight
      : 0;
    const abbotFocusZ = focusWeight > 0
      ? abbotFocusTargets.reduce((sum, target) => sum + target.z * target.weight, 0) / focusWeight
      : -1.35;
    const targetAbbotYaw = isAbbotPortraitAction
      ? Math.atan2(camera.position.x - templeAbbot.position.x, camera.position.z - templeAbbot.position.z)
      : Math.atan2(
          abbotFocusX - templeAbbot.position.x,
          abbotFocusZ - templeAbbot.position.z
        );
    const abbotYawDelta = Math.atan2(
      Math.sin(targetAbbotYaw - templeAbbot.rotation.y),
      Math.cos(targetAbbotYaw - templeAbbot.rotation.y)
    );
    const abbotTurnBlend = 1 - Math.exp(-Math.min(50, dt) / 520);
    templeAbbot.rotation.y += abbotYawDelta * abbotTurnBlend;
    templeAbbot.userData.breathingTorso.scale.y = 0.9 + abbotBreath;
    templeAbbot.userData.breathingTorso.rotation.x = 0.025 + abbotBowAmount * 0.16 + abbotBreath;
    templeAbbot.userData.headPivot.rotation.x = 0.015 + abbotBowAmount * 0.22;
    templeAbbot.userData.pose = abbotBowAmount > 0.08 ? 'standing-bow' : 'standing-prayer';
    window.__TEMPLE_ABBOT_DIAGNOSTIC__.pose = templeAbbot.userData.pose;
    window.__TEMPLE_ABBOT_DIAGNOSTIC__.bowAmount = Number(abbotBowAmount.toFixed(3));
    window.__TEMPLE_ABBOT_DIAGNOSTIC__.focusUser = abbotFocusTargets
      .sort((a, b) => b.weight - a.weight)[0]?.user || null;
    window.__TEMPLE_ABBOT_DIAGNOSTIC__.focus = {
      x: Number(abbotFocusX.toFixed(2)),
      z: Number(abbotFocusZ.toFixed(2)),
      yaw: Number(templeAbbot.rotation.y.toFixed(3))
    };
    updateLiveViewerActors(now);
    let queueFormationChanged = false;
    for (const actor of [...queueActors.values()]) {
      let moving = false;
      if (actor.moveCurve) {
        const progress = Math.min(1, Math.max(
          0,
          (now - actor.moveStartedAt) / Math.max(1, actor.moveDurationMs)
        ));
        const eased = progress * progress * (3 - 2 * progress);
        const point = actor.moveCurve.getPointAt(eased);
        const tangent = actor.moveCurve.getTangentAt(eased);
        actor.group.position.copy(point);
        actor.group.rotation.y = Math.atan2(tangent.x, tangent.z) - Math.PI;
        const gaitPhase = getDistanceBasedGaitPhase(
          eased,
          actor.moveCurve.getLength(),
          1.2,
          actor.avatar.phase
        );
        moving = progress < 1;
        actor.avatar.offeringElapsedMs = 0;
        animateHuman(actor.avatar, now, moving, gaitPhase);
        if (!moving) {
          actor.group.position.copy(actor.target);
          // Once the visitor reaches a worship/m meditation position, face
          // them squarely toward the Buddha instead of keeping the walk tangent.
          actor.group.rotation.set(0, 0, 0);
          actor.moveCurve = null;
          actor.moveStartedAt = 0;
          actor.moveDurationMs = 0;
          actor.offeringStartedAt = now;
        }
      } else {
        moving = actor.group.position.distanceToSquared(actor.target) > 0.018;
        if (actor.avatar.queueWaiting) {
          // Seated meditation is the idle queue pose. animateHuman blends the
          // avatar upright during movement and back to kneeling after arrival.
          actor.avatar.offeringElapsedMs = 0;
          actor.avatar.bowing = false;
          actor.avatar.bowAmount = 0;
          actor.avatar.ritualBowPhase = 'meditating';
          animateHuman(actor.avatar, now, false);
          applyHumanBow(actor.avatar, 0, actor.avatar.kneelBlend);
          continue;
        }
        const offeringElapsed = Number.isFinite(actor.offeringStartedAt)
          ? Math.max(0, now - actor.offeringStartedAt)
          : 0;
        actor.avatar.offeringElapsedMs = offeringElapsed;
        const offeringPose = getRitualPoseState({
          travel: moving ? 0 : 1,
          elapsedAfterArrival: offeringElapsed,
          remainingMs: Number.MAX_SAFE_INTEGER,
          kneelInMs: 520,
          bowDelayMs: 4800,
          bowInMs: 900,
          bowCycles: 3,
          bowCycleMs: 1500,
          bowDownRatio: 0.34,
          bowHoldRatio: 0.20,
          bowUpRatio: 0.34,
          exitFadeMs: 450
        });
        actor.avatar.kneelBlend = offeringPose.kneelBlend;
        actor.avatar.kneeling = offeringPose.kneelBlend > 0.035;
        actor.avatar.ritualBowPhase = offeringPose.bowPhase;
        actor.avatar.ritualBowCycle = offeringPose.bowCycle;
        if (offeringPose.bowPhase === 'complete' && offeringPose.kneelBlend >= 0.9) {
          actor.avatar.queueWorshipCompleted = true;
        }
        if (actor.avatar.queueWorshipCompleted) {
          queueFormationChanged = departCompletedQueueWorship(actor, now) || queueFormationChanged;
          continue;
        }
        animateHuman(actor.avatar, now, moving);
        applyHumanBow(actor.avatar, moving ? 0 : offeringPose.bowAmount, actor.avatar.kneelBlend);
      }
    }
    if (queueFormationChanged) refreshQueueActors(now);
    if (devoteeState.active && devoteeState.pausedAt) {
      // The visitor stays at the same floor position while acknowledging a
      // softer gift instead of freezing with one leg raised mid-stride.
      animateHuman(mainHuman, now, false);
      applyHumanBow(mainHuman, 0.12, mainHuman.kneelBlend);
      // The base ritual bow is composed first; the gift acknowledgement is
      // layered last so Dragon/Rose interruptions do not erase the reaction.
      applyGiftThankYouGesture(mainHuman, now);
    }
    if (devoteeState.active && !devoteeState.pausedAt) {
      const phaseElapsed = now - devoteeState.phaseStartedAt;
      // Ritual is a finite phase too. Previously it was pinned to progress 0
      // and MAX_SAFE_INTEGER duration, so the 3D visitor could remain frozen
      // at the altar forever when no external character-complete event arrived.
      const progress = Math.min(1, phaseElapsed / Math.max(1, devoteeState.phaseDuration));
      const eased = progress * progress * (3 - 2 * progress);
      const walking = ['enter', 'approach', 'exit', 'donutChase'].includes(devoteeState.phase);
      if (walking && devoteeState.curve) {
        const point = devoteeState.curve.getPointAt(eased);
        const tangent = devoteeState.curve.getTangentAt(eased);
        mainDevotee.position.set(point.x, 0.05 + Math.abs(Math.sin(phaseElapsed * 0.012)) * 0.018, point.z);
        // Face the direction of travel; the avatar's local forward axis points toward -Z.
        mainDevotee.rotation.y = Math.atan2(tangent.x, tangent.z) - Math.PI;
      }
      if (devoteeState.phase === 'rocketEject' && devoteeState.ejectionStart) {
        const origin = devoteeState.ejectionStart;
        mainDevotee.position.set(
          origin.x + eased * 2.8,
          origin.y + Math.sin(progress * Math.PI) * 2.6 + eased * 1.7,
          origin.z + eased * 1.8
        );
        mainDevotee.rotation.z = -eased * 0.72;
        mainDevotee.scale.setScalar(Math.max(0.12, 1 - eased * 0.86));
      }
      const walkPhase = walking && devoteeState.curve
        ? getDistanceBasedGaitPhase(eased, devoteeState.curve.getLength(), 1.2)
        : phaseElapsed * 0.0085;
      const ritualElapsed = devoteeState.phase === 'ritual' ? phaseElapsed : 0;
      const ritualPose = devoteeState.alreadyWorshippedInQueue
        ? {
            kneelBlend: 0,
            bowAmount: 0,
            bowPhase: 'already-completed-in-queue',
            bowCycle: 3
          }
        : getRitualPoseState({
            travel: devoteeState.phase === 'ritual' ? 1 : 0,
            elapsedAfterArrival: ritualElapsed,
            remainingMs: devoteeState.phase === 'ritual'
              ? Math.max(0, devoteeState.phaseDuration - ritualElapsed)
              : 0,
            kneelInMs: 520,
            bowDelayMs: 350,
            bowInMs: 900,
            bowCycles: 3,
            bowCycleMs: 1500,
            bowDownRatio: 0.34,
            bowHoldRatio: 0.20,
            bowUpRatio: 0.34,
            exitFadeMs: 450
          });
      mainHuman.kneelBlend = ritualPose.kneelBlend;
      mainHuman.kneeling = ritualPose.kneelBlend > 0.035;
      mainHuman.ritualBowPhase = ritualPose.bowPhase;
      mainHuman.ritualBowCycle = ritualPose.bowCycle;
      animateHuman(mainHuman, now, walking, walkPhase);
      applyHumanBow(mainHuman, ritualPose.bowAmount, ritualPose.kneelBlend);
      applyGiftThankYouGesture(mainHuman, now);

      if (progress >= 1) {
        if (devoteeState.phase === 'enter') {
          mainDevotee.position.set(-3.65, 0.05, 8.0);
          setDevoteePhase('queue', now, 200);
        } else if (devoteeState.phase === 'queue') {
          setDevoteePhase('approach', now, 3000);
        } else if (devoteeState.phase === 'approach') {
          mainDevotee.position.set(0, 0.05, -3.55);
          mainDevotee.rotation.y = 0;
          // Match the 2D three-bow sequence (~5.35s) with a short settle
          // buffer, then release the altar and let the visitor walk out.
          setDevoteePhase('ritual', now, 9500);
        } else if (devoteeState.phase === 'ritual') {
          mainHuman.kneeling = false;
          mainHuman.kneelBlend = 0;
          applyHumanBow(mainHuman, 0);
          setDevoteePhase('exit', now, 3600);
        } else if (['rocketEject', 'donutChase'].includes(devoteeState.phase)) {
          devoteeState.active = false;
          devoteeState.phase = 'idle';
          devoteeState.event = null;
          devoteeState.curve = null;
          devoteeState.ejectionStart = null;
          devoteeState.ejectionAction = null;
          devoteeState.ejectionMotionDuration = 0;
          devoteeState.pausedAt = 0;
          devoteeState.awaitingGiftHandoff = true;
          mainDevotee.visible = false;
          mainDevotee.rotation.set(0, 0, 0);
          mainDevotee.scale.setScalar(1);
        } else if (devoteeState.phase === 'exit') {
          devoteeState.active = false;
          devoteeState.phase = 'idle';
          devoteeState.event = null;
          mainDevotee.visible = false;
          mainDevotee.rotation.set(0, 0, 0);
          // Keep the same shot while queued visitors remain; restore only when the queue drains.
          startNextDevotee(now);
        }
      }
    }
    for (let i = departingDevotees.length - 1; i >= 0; i--) {
      const leaving = departingDevotees[i];
      const progress = Math.min(1, Math.max(0, (now - leaving.startedAt) / leaving.durationMs));
      const eased = progress * progress * (3 - 2 * progress);
      const point = leaving.curve.getPointAt(eased);
      const tangent = leaving.curve.getTangentAt(eased);
      leaving.group.position.copy(point);
      leaving.group.rotation.y = Math.atan2(tangent.x, tangent.z) - Math.PI;
      animateHuman(leaving.avatar, now, true, getDistanceBasedGaitPhase(
        eased, leaving.curve.getLength(), 1.2
      ));
      leaving.group.scale.setScalar(1 - eased * 0.12);
      if (progress >= 1) {
        if (leaving.liveViewerActor) {
          const actor = leaving.liveViewerActor;
          if (liveViewerActors.get(leaving.liveViewerIdentity) === actor) {
            liveViewerActors.delete(leaving.liveViewerIdentity);
          }
          actor.leaving = false;
          actor.group.visible = false;
          actor.group.rotation.set(0, 0, 0);
          actor.group.scale.setScalar(0.86);
          actor.event = null;
          actor.slot = -1;
          actor.moveTarget = null;
          actor.moveCurve = null;
          actor.moveStartedAt = 0;
          actor.moveDurationMs = 0;
          actor.avatar.queueWaiting = false;
          actor.avatar.prayerPose = false;
          actor.seat.visible = false;
          actor.sutraBook.visible = true;
          queueActorPool.push(actor);
        } else {
          world.remove(leaving.group);
        }
        departingDevotees.splice(i, 1);
        syncLiveViewerSeats(now);
      }
    }
    lanterns.forEach((light, i) => {
      light.intensity = 11.5 + Math.sin(elapsed * 0.0032 + i * 1.7) * 1.65 + Math.sin(elapsed * 0.007 + i) * 0.35;
    });
    const congregationGiftGlow = allHumanAvatars.reduce((peak, avatar) => Math.max(
      peak,
      getAvatarGiftReactionBlend(avatar, now) * (avatar.giftReactionProfile?.intensity || 0.55)
    ), 0);
    const specialGiftGlow = allHumanAvatars.reduce((peak, avatar) => Math.max(
      peak,
      avatar.giftReactionProfile?.tier === 'special' ? getAvatarGiftReactionBlend(avatar, now) : 0
    ), 0);
    const tierGiftGlow = allHumanAvatars.reduce((peak, avatar) => {
      const blend = getAvatarGiftReactionBlend(avatar, now);
      const aura = ({ small: 0.18, medium: 0.36, large: 0.68, special: 1.0 })[avatar.giftReactionProfile?.tier] || 0.18;
      return Math.max(peak, blend * aura);
    }, 0);
    const auraPulse = Math.max(specialGiftGlow, tierGiftGlow) * (0.94 + Math.sin(elapsed * 0.008) * 0.06);
    lotusSparkMaterial.opacity = auraPulse * 0.88;
    if (auraPulse > 0.001) {
      for (let i = 0; i < lotusSparkCount; i++) {
        const progress = (lotusSparkPhases[i] + elapsed * 0.00001 * lotusSparkSpeeds[i]) % 1;
        const angle = lotusSparkPhases[i] * Math.PI * 2 + elapsed * 0.0007 * lotusSparkSpeeds[i];
        const radius = lotusSparkRadii[i] * (1 - progress * 0.58);
        const offset = i * 3;
        lotusSparkPositions[offset] = Math.cos(angle) * radius;
        lotusSparkPositions[offset + 1] = 0.32 + progress * 3.55;
        lotusSparkPositions[offset + 2] = Math.sin(angle) * radius;
      }
      lotusSparkGeometry.attributes.position.needsUpdate = true;
    }
    // Parent-group scaling opens both instanced petal tiers without rewriting
    // per-petal matrices or allocating objects in the render loop.
    lotusPetalRings.forEach((ring, index) => {
      const opening = auraPulse * (index === 0 ? 0.13 : 0.09);
      ring.scale.set(1 + opening, 1, 1 + opening);
    });
    haloGiftAuraMaterial.opacity = auraPulse * 0.58;
    haloGiftAura.scale.setScalar(1 + auraPulse * 0.12);
    lotusGiftAuraMaterial.opacity = auraPulse * 0.48;
    lotusGiftAura.scale.setScalar(1 + auraPulse * 0.18);
    haloGlow.intensity = 8 + auraPulse * 13;
    // A warm edge light and restrained material emission make stone reliefs
    // and gilded trim catch the special-gift beat without a full-scene flash.
    statueRimLight.intensity = 0.82 + auraPulse * 1.1;
    mats.goldBright.emissiveIntensity = 0.25 + auraPulse * 0.38;
    mats.statueStone.emissiveIntensity = 0.085 + auraPulse * 0.06;
    buddhaLight.intensity = 19 + Math.sin(elapsed * 0.0018) * 1.0 + congregationGiftGlow * 2.2;
    altarFill.intensity = 21 + Math.sin(elapsed * 0.0045 + 0.8) * 2.2 + congregationGiftGlow * 4.5;
    updateRitualStationAnimations(now);
    offeringFlames.forEach((flame, i) => { const flicker = 1 + Math.sin(elapsed * 0.018 + i * 2.1) * 0.09; flame.scale.set(0.72 * flicker, 1.5 * flicker, 0.72 * flicker); });
    offeringGlow.intensity = 7 + Math.sin(elapsed * 0.009) * 1.1;
    updateIncenseWisps(now);
    dust.rotation.y += dt * 0.000018;
    updateForegroundLotusPetals(elapsed);
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i]; effect.elapsed += dt;
      const p = Math.min(1, effect.elapsed / effect.duration);
      effect.update(effect.object, dt, p);
      if (p >= 1) { world.remove(effect.object); disposeThreeObjectTree(effect.object); effects.splice(i, 1); }
    }
    renderer.render(scene, camera);
    if (statsEnabled && now - lastStatsAt >= 5000) {
      const info = renderer.info;
      const sortedIntervals = [...frameIntervals].sort((a, b) => a - b);
      const sampleWindowMs = frameWindowStartedAt ? Math.max(0, now - frameWindowStartedAt) : 0;
      const sampleCount = sortedIntervals.length;
      const percentilesReliable = sampleCount >= MIN_FRAME_SAMPLES_FOR_PERCENTILES
        && sampleWindowMs >= 4000;
      const percentile = (ratio) => percentilesReliable
        ? sortedIntervals[Math.min(sortedIntervals.length - 1, Math.ceil(sortedIntervals.length * ratio) - 1)]
        : null;
      console.info('[Temple3D] Frame diagnostics', {
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        activeEffects: effects.length,
        pixelRatio: renderer.getPixelRatio(),
        frameSamples: sampleCount,
        sampleWindowMs,
        sampleQuality: percentilesReliable ? 'reliable' : 'insufficient',
        observedFps: sampleWindowMs > 0
          ? Math.round((sampleCount * 1000 / sampleWindowMs) * 10) / 10
          : null,
        frameTimeP50Ms: percentile(0.50),
        frameTimeP95Ms: percentile(0.95)
      });
      // Preserve intervals until percentile metrics meet the reliability threshold.
      // Slow software renderers otherwise reset their sample window before
      // collecting enough frames to report meaningful P50/P95 values.
      if (percentilesReliable) {
        frameIntervals.length = 0;
        frameWindowStartedAt = now;
      }
      lastStatsAt = now;
    }
    if (!effects.length && now > ritualUntil && elapsed > 60000) elapsed = 0;
  }
  function start() { if (!disposed && !document.hidden && !raf) raf = requestAnimationFrame(frame); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  let resourcesDisposed = false;
  function releaseWorldResources() {
    if (resourcesDisposed) return;
    resourcesDisposed = true;
    window.removeEventListener('temple:ritual', onTempleRitual);
    window.removeEventListener('temple:viewer-enter', onTempleViewerEnter);
   window.removeEventListener('temple:viewer-leave', onTempleViewerLeave);
    window.removeEventListener('temple:gift-action', onTempleGiftAction);
    window.removeEventListener('temple:gift-reaction', onTempleGiftReaction);
    window.removeEventListener('temple:character-interrupted', onTempleCharacterInterruptedForThreeD);
    window.removeEventListener('temple:character-start', onTempleCharacterStartForThreeD);
    window.removeEventListener('temple:character-complete', onTempleCharacterCompleteForThreeD);
    window.removeEventListener('temple:gift-effects-complete', onTempleGiftEffectsComplete);
    for (const actor of [...queueActors.values(), ...queueActorPool]) {
      world.remove(actor.group);
    }
    queueActors.clear();
    queueActorPool.length = 0;
    canvas.removeEventListener('pointermove', onWorldPointerMove);
    canvas.removeEventListener('pointerdown', onWorldPointerDown);
    canvas.removeEventListener('pointerup', onWorldPointerUp);
    canvas.removeEventListener('pointercancel', onWorldPointerCancel);
    canvas.removeEventListener('pointerleave', onWorldPointerLeave);
    canvas.style.cursor = '';
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('resize', onWindowResize);
    for (const effect of effects.splice(0)) {
      world.remove(effect.object);
      disposeThreeObjectTree(effect.object);
    }
    templeEnvironment.dispose();
    disposeThreeSceneResources(scene);
    renderer.dispose();
  }
  function onVisibilityChange() {
    if (document.hidden) stop();
    resetFrameDiagnostics();
    if (!document.hidden) start();
  }
  function onWindowResize() {
    if (disposed) return;
    camera.aspect = 1080 / 1920; camera.updateProjectionMatrix();
    renderer.setSize(1080, 1920, false);
  }
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('resize', onWindowResize);
  canvas.addEventListener('webglcontextlost', (event) => {
    // Do not attempt to render into a lost context. Release CPU-side references
    // and fall back to the known-good 2D stage; a page reload can create a fresh
    // WebGL context if the user explicitly enables 3D again.
    event.preventDefault();
    disposed = true;
    stop();
    releaseWorldResources();
    canvas.hidden = true;
    stage.classList.remove('temple-3d-mode');
    window.__TEMPLE_3D_READY__ = false;
    window.dispatchEvent(new Event('temple:3d-unavailable'));
  });
  window.addEventListener('pagehide', () => {
    disposed = true;
    stop();
    releaseWorldResources();
  }, { once: true });

  canvas.hidden = false;
  window.__TEMPLE_3D_READY__ = true;
  window.dispatchEvent(new Event('temple:3d-ready'));
  start();
  if (modelsRequested || buddhaModelRequested) {
    window.__TEMPLE_BUDDHA_MODEL_SOURCE__ = 'loading';
    void upgradeBuddhaFromGLB();
  }
  // Keep the two Ao Dai variants as the default characters. The optional
  // Quaternius GLTF skins are loaded only when explicitly requested with
  // ?devoteeModels=1, so they cannot silently replace the default cast.
  if (devoteeModelsRequested) void upgradeDevoteesFromGLB();
  window.__TEMPLE_DEVOTEE_MODEL_SOURCE__ = devoteeModelsRequested ? 'quaternius-gltf' : 'ao-dai-default';
  console.info('[Temple3D] Full sanctuary world ready (?3d=1), with male/female Ao Dai devotees and stone Buddha.');
}