import { disposeThreeObjectTree } from './three-resource-utils.js';
/**
 * Optional Three.js ritual overlay.
 * Enable with ?3d=1. The existing DOM/Canvas scene remains the source of truth.
 * Procedural geometry only; no external models or paid assets.
 */
const ENABLED = new URLSearchParams(location.search).get('3d') === '1';
const canvas = document.getElementById('temple3dCanvas');

if (ENABLED && canvas) {
  boot().catch((error) => {
    console.warn('[Temple3D] Disabled; keeping the original 2D renderer:', error);
    window.__TEMPLE_3D_READY__ = false;
    window.dispatchEvent(new Event('temple:3d-unavailable'));
    canvas.hidden = true;
  });
}

async function boot() {
  // Load Three.js only when the opt-in flag is present.
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
    premultipliedAlpha: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(1080, 1920, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1080, 0, 1920, 0.1, 3000);
  camera.position.z = 1200;

  const gold = new THREE.MeshStandardMaterial({
    color: 0xffd56a, metalness: 0.72, roughness: 0.28,
    transparent: true, opacity: 0.92
  });
  const paleGold = new THREE.MeshStandardMaterial({
    color: 0xffefb0, metalness: 0.45, roughness: 0.3,
    transparent: true, opacity: 0.82
  });
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0xd9cbb8, transparent: true, opacity: 0.17,
    depthWrite: false
  });

  const ambient = new THREE.AmbientLight(0xffdca0, 1.5);
  scene.add(ambient);
  const keyLight = new THREE.PointLight(0xffc45c, 2.2, 900);
  keyLight.position.set(540, 700, 450);
  scene.add(keyLight);

  // Persistent 3D sanctuary: this scene is present before any RPC/gift arrives.
  // Screen-space Y is converted to the orthographic camera's bottom-up coordinates.
  const screenY = (y) => 1920 - y;
  const architecture = new THREE.Group();
  const bronze = new THREE.MeshStandardMaterial({
    color: 0x8b4b18, metalness: 0.82, roughness: 0.32
  });
  const ruby = new THREE.MeshStandardMaterial({
    color: 0x8d1830, metalness: 0.48, roughness: 0.3
  });
  const buddhaGold = new THREE.MeshStandardMaterial({
    color: 0xf5bd4d, metalness: 0.72, roughness: 0.24
  });
  const skin = new THREE.MeshStandardMaterial({
    color: 0xe9a64f, metalness: 0.28, roughness: 0.38
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x24100b, metalness: 0.38, roughness: 0.42
  });

  function addMesh(geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, parent = architecture) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, screenY(y), z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  }
  function addBox(x, y, z, w, h, d, material) {
    return addMesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }
  function addCylinder(x, y, z, radiusTop, radiusBottom, height, material, segments = 20) {
    return addMesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material, x, y, z);
  }

  // Symmetric carved pillars and lintel establish depth around the main altar.
  for (const x of [78, 1002]) {
    addCylinder(x, 930, 90, 42, 54, 1460, bronze, 28);
    addCylinder(x, 260, 96, 72, 72, 66, gold, 28);
    addCylinder(x, 1580, 96, 78, 78, 74, gold, 28);
    addCylinder(x, 930, 98, 60, 60, 34, paleGold, 28);
    for (let y = 390; y < 1510; y += 180) {
      addCylinder(x, y, 102, 49, 49, 12, gold, 24);
    }
  }
  addBox(540, 220, 75, 1000, 70, 90, bronze);
  addBox(540, 270, 88, 1040, 18, 96, gold);
  addBox(540, 1510, 78, 1040, 48, 100, bronze);
  addBox(540, 1545, 92, 1080, 18, 108, gold);

  // Layered lotus throne, visible as actual lit 3D geometry over the 2D fallback.
  addCylinder(650, 1255, 110, 230, 180, 92, bronze, 48);
  addCylinder(650, 1205, 126, 205, 225, 42, ruby, 48);
  addCylinder(650, 1172, 138, 180, 200, 28, gold, 48);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const petal = addMesh(new THREE.SphereGeometry(1, 18, 12), ruby,
      650 + Math.cos(a) * 190, 1155 + Math.sin(a) * 24, 152, 30, 76, 16);
    petal.rotation.z = -a;
  }

  // Seated Amitabha silhouette: torso, shoulders, head, ears, ushnisha and robe.
  addMesh(new THREE.SphereGeometry(1, 40, 28), buddhaGold, 650, 930, 178, 155, 215, 78);
  addMesh(new THREE.SphereGeometry(1, 36, 24), paleGold, 650, 1010, 194, 205, 88, 72);
  addMesh(new THREE.SphereGeometry(1, 36, 28), skin, 650, 690, 188, 98, 126, 76);
  addMesh(new THREE.SphereGeometry(1, 24, 18), skin, 548, 700, 184, 20, 42, 22);
  addMesh(new THREE.SphereGeometry(1, 24, 18), skin, 752, 700, 184, 20, 42, 22);
  addMesh(new THREE.SphereGeometry(1, 28, 20), dark, 650, 570, 184, 72, 42, 62);
  addMesh(new THREE.SphereGeometry(1, 20, 16), buddhaGold, 650, 548, 188, 42, 35, 42);
  // Halo ring and radial spokes sit behind the head.
  const halo = new THREE.Group();
  halo.position.set(650, screenY(690), 142);
  halo.add(new THREE.Mesh(new THREE.TorusGeometry(164, 8, 12, 96), gold));
  halo.add(new THREE.Mesh(new THREE.TorusGeometry(138, 3, 8, 96), paleGold));
  for (let i = 0; i < 24; i++) {
    const ray = new THREE.Mesh(new THREE.BoxGeometry(3, 42, 3), paleGold);
    ray.position.y = 150;
    ray.rotation.z = (i / 24) * Math.PI * 2;
    halo.add(ray);
  }
  architecture.add(halo);

  // Small bead-like curls make the head visibly sculpted rather than a flat sprite.
  for (let row = 0; row < 4; row++) {
    const count = 9 - row * 2;
    for (let i = 0; i < count; i++) {
      const x = 650 + (i - (count - 1) / 2) * 15;
      const y = 552 + row * 13;
      addMesh(new THREE.SphereGeometry(8, 10, 8), dark, x, y, 224, 1, 1, 0.8);
    }
  }

  // Carved altar rail in the foreground gives the 3D mode a clear depth cue.
  addBox(540, 1450, 230, 1080, 30, 72, gold);
  addBox(540, 1488, 238, 1080, 18, 78, bronze);
  for (let x = 80; x <= 1000; x += 92) {
    addCylinder(x, 1468, 244, 13, 13, 48, paleGold, 12);
  }
  scene.add(architecture);

  const active = [];
  const MAX_EFFECTS = 80;
  let raf = 0;
  let lastTime = 0;
  let disposed = false;

  function addEffect(object, update, duration = 1800) {
    if (active.length >= MAX_EFFECTS) {
      const oldest = active.shift();
      scene.remove(oldest.object);
      disposeObject(oldest.object);
    }
    scene.add(object);
    active.push({ object, update, elapsed: 0, duration });
    start();
  }

  function disposeObject(object) {
    disposeThreeObjectTree(object);
  }

  function disposeActiveEffects() {
    for (const effect of active.splice(0)) {
      scene.remove(effect.object);
      disposeObject(effect.object);
    }
  }

  function makeLotus(x, y, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, y, 80);
    const petalGeo = new THREE.SphereGeometry(1, 12, 8);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, (i % 2 ? gold : paleGold).clone());
      petal.position.set(Math.cos(angle) * 17, Math.sin(angle) * 17, 0);
      petal.scale.set(9 * scale, 22 * scale, 3.2 * scale);
      petal.rotation.z = angle - Math.PI / 2;
      group.add(petal);
    }
    const heart = new THREE.Mesh(new THREE.SphereGeometry(8 * scale, 12, 10), gold.clone());
    heart.position.z = 5;
    group.add(heart);
    return group;
  }

  function burstLotus(x, y, count = 1, scale = 1) {
    for (let i = 0; i < Math.min(count, 8); i++) {
      const lotus = makeLotus(x + (i - (Math.min(count, 8) - 1) / 2) * 34, y, scale);
      lotus.rotation.z = (Math.random() - 0.5) * 0.5;
      addEffect(lotus, (obj, t, p) => {
        obj.position.y -= 0.24 * t;
        obj.rotation.z += 0.0007 * t;
        obj.scale.setScalar(Math.max(0.05, 1 - p * 0.55));
        obj.children.forEach((child) => {
          child.material.opacity = Math.max(0, 0.92 * (1 - p));
        });
      }, 2100);
    }
  }

  function bellWave(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(22 + i * 12, 1.8, 6, 48),
        new THREE.MeshBasicMaterial({ color: 0xffdf85, transparent: true, opacity: 0.75 })
      );
      ring.position.set(x, y, 100 + i);
      addEffect(ring, (obj, _t, p) => {
        const s = 1 + p * 7;
        obj.scale.set(s, s, 1);
        obj.material.opacity = 0.75 * (1 - p);
      }, 1300 + i * 180);
    }
  }

  function incenseSmoke(x, y) {
    for (let i = 0; i < 7; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(12 + Math.random() * 8, 8, 7), smokeMat.clone());
      puff.position.set(x + (Math.random() - 0.5) * 36, y - Math.random() * 24, 40 + i);
      puff.scale.set(0.8, 1.25, 0.6);
      addEffect(puff, (obj, t, p) => {
        obj.position.y -= 0.11 * t;
        obj.position.x += Math.sin((p * 7) + i) * 0.025 * t;
        obj.scale.multiplyScalar(1 + 0.00012 * t);
        obj.material.opacity = 0.2 * (1 - p);
      }, 3200);
    }
  }

  function giftRain(count = 12) {
    for (let i = 0; i < Math.min(count, 24); i++) {
      const petal = new THREE.Mesh(
        new THREE.TetrahedronGeometry(7 + Math.random() * 5, 0),
        (i % 3 ? gold : paleGold).clone()
      );
      petal.position.set(130 + Math.random() * 820, -40 - Math.random() * 300, 120);
      addEffect(petal, (obj, t, p) => {
        obj.position.y += 0.32 * t;
        obj.position.x += Math.sin(p * 10 + i) * 0.12 * t;
        obj.rotation.x += 0.001 * t;
        obj.rotation.y += 0.0014 * t;
        obj.material.opacity = 0.9 * (1 - p);
      }, 3600);
    }
  }

  function onRitual(event) {
    if (!event || typeof event.type !== 'string') return;
    switch (event.type) {
      case 'burnIncense':
        incenseSmoke(540, 900);
        burstLotus(540, 850, 1, 0.9);
        break;
      case 'ringBell':
        bellWave(540, 510, 4);
        break;
      case 'strikeWoodenFish':
        bellWave(890, 935, 2);
        break;
      case 'sendPrayer':
        burstLotus(540, 900, 2, 0.75);
        giftRain(5);
        break;
      case 'offerGift':
        burstLotus(540, 860, Math.min(5, Math.ceil((event.coins || 10) / 20)), 1.15);
        giftRain(Math.min(18, 5 + Math.ceil((event.coins || 1) / 10)));
        break;
      case 'grandCeremony':
        burstLotus(540, 820, 8, 1.45);
        bellWave(540, 510, 5);
        giftRain(24);
        break;
      case 'drawFortune':
        burstLotus(540, 880, 3, 0.8);
        break;
    }
  }

  window.addEventListener('temple:ritual', (event) => onRitual(event.detail));
  canvas.hidden = false;
  window.__TEMPLE_3D_READY__ = true;
  window.dispatchEvent(new Event('temple:3d-ready'));

  function animate(now) {
    if (disposed || document.hidden) return;
    const delta = Math.min(40, lastTime ? now - lastTime : 16);
    lastTime = now;
    for (let i = active.length - 1; i >= 0; i--) {
      const effect = active[i];
      effect.elapsed += delta;
      const progress = Math.min(1, effect.elapsed / effect.duration);
      effect.update(effect.object, delta, progress);
      if (progress >= 1) {
        scene.remove(effect.object);
        disposeObject(effect.object);
        active.splice(i, 1);
      }
    }
    renderer.render(scene, camera);
    if (active.length) raf = requestAnimationFrame(animate);
    else raf = 0;
  }

  function start() {
    if (!disposed && !document.hidden && !raf) {
      lastTime = 0;
      raf = requestAnimationFrame(animate);
    }
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stop();
    disposeActiveEffects();
    canvas.hidden = true;
    window.__TEMPLE_3D_READY__ = false;
    window.dispatchEvent(new Event('temple:3d-unavailable'));
    console.warn('[Temple3D] WebGL context lost; 2D mode remains active.');
  });
  window.addEventListener('pagehide', () => {
    disposed = true;
    stop();
    disposeActiveEffects();
    disposeThreeObjectTree(scene);
    renderer.dispose();
  }, { once: true });

  start();
  console.info('[Temple3D] Optional 3D ritual layer ready (?3d=1).');
}
