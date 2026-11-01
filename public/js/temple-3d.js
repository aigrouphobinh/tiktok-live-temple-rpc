import { disposeThreeObjectTree } from './three-resource-utils.js';

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
    console.warn('[Temple3D] World unavailable; restoring 2D scene:', error);
    stage.classList.remove('temple-3d-mode');
    canvas.hidden = true;
    window.__TEMPLE_3D_READY__ = false;
    window.dispatchEvent(new Event('temple:3d-unavailable'));
  });
}

async function boot() {
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: false, antialias: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.setSize(1080, 1920, false);
  renderer.setClearColor(0x160904, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a0a05);
  scene.fog = new THREE.FogExp2(0x241006, 0.018);
  const camera = new THREE.PerspectiveCamera(36, 1080 / 1920, 0.1, 120);
  camera.position.set(0, 10.5, 23);
  camera.lookAt(0, 4.4, -5.5);

  const mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x48200e, roughness: 0.55, metalness: 0.18 }),
    woodLight: new THREE.MeshStandardMaterial({ color: 0x79401b, roughness: 0.48, metalness: 0.25 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe6ae45, roughness: 0.3, metalness: 0.78 }),
    goldBright: new THREE.MeshStandardMaterial({ color: 0xffdf83, roughness: 0.24, metalness: 0.62, emissive: 0x70400b, emissiveIntensity: 0.25 }),
    red: new THREE.MeshStandardMaterial({ color: 0x741321, roughness: 0.48, metalness: 0.22 }),
    redBright: new THREE.MeshStandardMaterial({ color: 0x9d2030, roughness: 0.4, metalness: 0.3 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x4d3929, roughness: 0.88 }),
    ivory: new THREE.MeshStandardMaterial({ color: 0xffe0a0, roughness: 0.35, metalness: 0.18 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xe7ad6b, roughness: 0.52 }),
    robe: new THREE.MeshStandardMaterial({ color: 0x71859a, roughness: 0.82 }),
    robeDark: new THREE.MeshStandardMaterial({ color: 0x3e5367, roughness: 0.86 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1d100b, roughness: 0.65 }),
    lotus: new THREE.MeshStandardMaterial({ color: 0xe9829a, roughness: 0.42, side: THREE.DoubleSide }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x315a35, roughness: 0.85 })
  };
  const world = new THREE.Group();
  scene.add(world);

  const box = (w, h, d, material, x, y, z, parent = world) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };
  const cylinder = (rt, rb, h, material, x, y, z, parent = world, radial = 24) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, radial), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };
  const sphere = (r, material, x, y, z, sx = 1, sy = 1, sz = 1, parent = world) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), material);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const plane = (w, h, material, x, y, z, rx = -Math.PI / 2) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z); mesh.rotation.x = rx; mesh.receiveShadow = true; world.add(mesh); return mesh;
  };

  scene.add(new THREE.HemisphereLight(0xffdba2, 0x29130a, 1.8));
  const ambient = new THREE.AmbientLight(0xffc777, 0.55); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffd28a, 3.0);
  key.position.set(-7, 15, 8); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -14; key.shadow.camera.right = 14;
  key.shadow.camera.top = 18; key.shadow.camera.bottom = -18; scene.add(key);
  const buddhaLight = new THREE.PointLight(0xffb94e, 95, 18, 2);
  buddhaLight.position.set(0, 6.8, -7); scene.add(buddhaLight);

  // Courtyard floor, raised processional path and inlaid gold borders.
  plane(22, 36, mats.stone, 0, -0.18, 1);
  for (let z = -14; z < 19; z += 1.15) {
    for (let x = -9; x < 10; x += 1.15) {
      const tile = box(1.08, 0.035, 1.08, (Math.round(x + z) % 2 ? mats.stone : mats.wood), x, -0.13, z);
      tile.castShadow = false;
    }
  }
  box(5.8, 0.12, 27, mats.red, 0, -0.02, 3);
  box(0.12, 0.035, 27, mats.gold, -2.82, 0.06, 3);
  box(0.12, 0.035, 27, mats.gold, 2.82, 0.06, 3);
  for (let z = -9; z < 16; z += 2.2) {
    box(5.4, 0.035, 0.045, mats.goldBright, 0, 0.07, z);
  }
  // Lotus medallions in the carpet.
  for (let z = -7; z < 15; z += 4.4) {
    const emblem = new THREE.Group(); emblem.position.set(0, 0.09, z); world.add(emblem);
    cylinder(0.32, 0.32, 0.035, mats.gold, 0, 0, 0, emblem, 32);
    for (let p = 0; p < 8; p++) {
      const a = p * Math.PI / 4;
      const petal = sphere(0.17, mats.goldBright, Math.cos(a) * 0.28, 0.035, Math.sin(a) * 0.28, 0.65, 0.22, 1, emblem);
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

  // Layered lotus pedestal.
  cylinder(2.05, 1.8, 0.55, mats.wood, 0, 1.0, -8.25, world, 48);
  cylinder(1.82, 2.0, 0.28, mats.redBright, 0, 1.38, -8.25, world, 48);
  cylinder(1.62, 1.82, 0.2, mats.gold, 0, 1.62, -8.25, world, 48);
  const lotusThrone = new THREE.Group(); lotusThrone.position.set(0, 1.7, -8.25); world.add(lotusThrone);
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    const petal = sphere(0.55, i % 2 ? mats.redBright : mats.goldBright,
      Math.cos(a) * 1.4, 0.2 + Math.sin(a) * 0.08, Math.sin(a) * 1.4, 0.52, 0.24, 1, lotusThrone);
    petal.rotation.y = -a;
  }

  // Seated Buddha statue, deliberately kept in the rear focal plane.
  const statue = new THREE.Group(); statue.position.set(0, 1.8, -8.25); world.add(statue);
  sphere(0.95, mats.goldBright, 0, 2.35, 0, 1.35, 1.5, 0.78, statue);
  sphere(1.22, mats.ivory, 0, 1.5, 0.2, 1.25, 0.42, 0.72, statue);
  sphere(0.67, mats.skin, 0, 4.0, 0.03, 0.9, 1.05, 0.78, statue);
  sphere(0.16, mats.skin, -0.65, 4.05, 0, 0.65, 1.15, 0.6, statue);
  sphere(0.16, mats.skin, 0.65, 4.05, 0, 0.65, 1.15, 0.6, statue);
  sphere(0.45, mats.dark, 0, 4.72, 0.02, 1.0, 0.48, 0.9, statue);
  sphere(0.22, mats.goldBright, 0, 4.93, 0.04, 0.9, 0.8, 0.9, statue);
  // Hair curls and a simple urna.
  for (let row = 0; row < 4; row++) {
    const count = 9 - row * 2;
    for (let i = 0; i < count; i++) {
      sphere(0.075, mats.dark, (i - (count - 1) / 2) * 0.13, 4.53 + row * 0.12, 0.45, 1, 1, 0.8, statue);
    }
  }
  sphere(0.055, mats.goldBright, 0, 4.12, 0.72, 1, 1, 0.4, statue);
  // Large halo, behind the statue, with radial rays.
  const halo = new THREE.Group(); halo.position.set(0, 5.95, -8.75); world.add(halo);
  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.09, 12, 96), mats.goldBright);
  halo.add(haloRing);
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.035, 8, 96), mats.ivory);
  halo.add(innerRing);
  for (let i = 0; i < 32; i++) {
    const ray = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.68, 0.04), mats.goldBright);
    const a = i * Math.PI / 16; ray.position.set(Math.cos(a) * 2.0, Math.sin(a) * 2.0, 0);
    ray.rotation.z = a; halo.add(ray);
  }

  // Main hall architecture: paired carved pillars, crossbeams, layered roof.
  for (const x of [-7.2, 7.2]) {
    for (const z of [-10, -4, 2, 8, 13]) {
      cylinder(0.42, 0.5, 8.2, mats.woodLight, x, 4.05, z, world, 24);
      cylinder(0.62, 0.62, 0.42, mats.gold, x, 0.32, z, world, 24);
      cylinder(0.58, 0.68, 0.35, mats.goldBright, x, 7.95, z, world, 24);
      cylinder(0.47, 0.47, 0.18, mats.red, x, 5.4, z, world, 24);
    }
  }
  for (const z of [-10, -4, 2, 8, 13]) box(15.2, 0.38, 0.48, mats.wood, 0, 8.15, z);
  box(16.4, 0.55, 1.1, mats.woodLight, 0, 8.7, -1);
  box(17.2, 0.22, 1.2, mats.gold, 0, 9.0, -1);
  // Deep ceiling and gold rafters.
  box(17, 0.38, 27, mats.wood, 0, 10.2, 1);
  for (let z = -11; z <= 12; z += 2.8) box(16.8, 0.12, 0.16, mats.gold, 0, 9.95, z);
  // Roof ridges and decorative eaves.
  for (const side of [-1, 1]) {
    const eave = box(1.0, 0.32, 28, mats.red, side * 8.0, 9.35, 1);
    eave.rotation.z = side * -0.12;
    box(0.22, 0.14, 28, mats.goldBright, side * 8.5, 9.45, 1);
  }

  // Lanterns with warm emissive cores along the side aisles.
  const lanterns = [];
  for (const x of [-5.8, 5.8]) {
    for (const z of [-7, -1, 5, 11]) {
      const lantern = new THREE.Group(); lantern.position.set(x, 6.6, z); world.add(lantern);
      box(0.72, 0.12, 0.72, mats.gold, 0, 0.6, 0, lantern);
      box(0.55, 1.05, 0.55, mats.ivory, 0, 0, 0, lantern);
      box(0.72, 0.12, 0.72, mats.goldBright, 0, -0.58, 0, lantern);
      const light = new THREE.PointLight(0xffb84d, 13, 5, 2); light.position.set(0, 0, 0); lantern.add(light);
      lanterns.push(light);
    }
  }

  // Brass incense burner in the front of the dais.
  const burner = new THREE.Group(); burner.position.set(0, 0.2, -5.6); world.add(burner);
  cylinder(0.62, 0.8, 0.45, mats.gold, 0, 0.45, 0, burner, 32);
  cylinder(0.72, 0.72, 0.16, mats.goldBright, 0, 0.72, 0, burner, 32);
  cylinder(0.08, 0.08, 0.9, mats.woodLight, 0, 1.28, 0, burner, 12);
  sphere(0.11, mats.redBright, 0, 1.76, 0, 1, 1, 1, burner);

  // Small, kneeling devotees placed in perspective along both sides of the carpet.
  const devotees = [];
  function makeDevotee(x, z, scale = 1) {
    const group = new THREE.Group(); group.position.set(x, 0.02, z); group.scale.setScalar(scale); world.add(group);
    sphere(0.28, mats.robe, 0, 0.78, 0, 1.05, 1.5, 0.72, group);
    sphere(0.22, mats.skin, 0, 1.32, 0.02, 0.82, 0.9, 0.82, group);
    sphere(0.12, mats.robeDark, -0.22, 0.42, 0.16, 1.5, 0.55, 1.1, group);
    sphere(0.12, mats.robeDark, 0.22, 0.42, 0.16, 1.5, 0.55, 1.1, group);
    sphere(0.1, mats.skin, -0.17, 0.9, 0.25, 0.7, 0.6, 0.6, group);
    sphere(0.1, mats.skin, 0.17, 0.9, 0.25, 0.7, 0.6, 0.6, group);
    devotees.push(group); return group;
  }
  for (let row = 0; row < 6; row++) {
    const z = -3.2 + row * 3.1;
    const scale = 1.0 - row * 0.065;
    makeDevotee(-4.3, z, scale); makeDevotee(4.3, z, scale);
    if (row % 2 === 0) { makeDevotee(-5.6, z + 0.8, scale * 0.82); makeDevotee(5.6, z + 0.8, scale * 0.82); }
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

  const effects = [];
  const MAX_EFFECTS = 100;
  let raf = 0, lastFrame = 0, elapsed = 0, disposed = false;
  let ritualUntil = 0;
  const clock = new THREE.Clock();

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
    ritualUntil = performance.now() + 7800;
    if (event.type === 'burnIncense') { incenseEffect(); makeRing(0, 1.2, -5.6); }
    else if (event.type === 'ringBell') { makeRing(-6, 5, -1, 0xffe18a); }
    else if (event.type === 'strikeWoodenFish') { makeRing(5.8, 0.7, 1.5); }
    else if (event.type === 'sendPrayer') lotusBurst(8);
    else if (event.type === 'offerGift') lotusBurst(Math.min(18, 5 + Math.ceil((event.coins || 10) / 10)));
    else if (event.type === 'grandCeremony') { lotusBurst(18); for (let i = 0; i < 5; i++) makeRing(0, 0.2 + i * 0.2, -7); }
    else if (event.type === 'drawFortune') lotusBurst(5);
    start();
  }
  window.addEventListener('temple:ritual', (event) => handleRitual(event.detail));

  function frame(now) {
    if (disposed || document.hidden) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
    if (now - lastFrame < 33) return; // cap at 30 fps for the portrait live scene
    const dt = Math.min(50, now - (lastFrame || now));
    lastFrame = now; elapsed += dt;
    halo.rotation.z = Math.sin(elapsed * 0.00016) * 0.025;
    lotusThrone.rotation.y = Math.sin(elapsed * 0.00022) * 0.025;
    lanterns.forEach((light, i) => { light.intensity = 12 + Math.sin(elapsed * 0.003 + i) * 2; });
    dust.rotation.y += dt * 0.000018;
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i]; effect.elapsed += dt;
      const p = Math.min(1, effect.elapsed / effect.duration);
      effect.update(effect.object, dt, p);
      if (p >= 1) { world.remove(effect.object); disposeThreeObjectTree(effect.object); effects.splice(i, 1); }
    }
    renderer.render(scene, camera);
    if (!effects.length && now > ritualUntil && elapsed > 60000) elapsed = 0;
  }
  function start() { if (!disposed && !document.hidden && !raf) raf = requestAnimationFrame(frame); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  window.addEventListener('resize', () => {
    camera.aspect = 1080 / 1920; camera.updateProjectionMatrix();
    renderer.setSize(1080, 1920, false);
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault(); stop(); canvas.hidden = true;
    stage.classList.remove('temple-3d-mode');
    window.__TEMPLE_3D_READY__ = false;
    window.dispatchEvent(new Event('temple:3d-unavailable'));
  });
  window.addEventListener('pagehide', () => {
    disposed = true; stop();
    for (const effect of effects.splice(0)) { world.remove(effect.object); disposeThreeObjectTree(effect.object); }
    disposeThreeObjectTree(scene); renderer.dispose();
  }, { once: true });

  canvas.hidden = false;
  window.__TEMPLE_3D_READY__ = true;
  window.dispatchEvent(new Event('temple:3d-ready'));
  start();
  console.info('[Temple3D] Full sanctuary world ready (?3d=1).');
}
