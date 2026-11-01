/**
 * Independent architectural detail layer for the roofless temple sanctuary.
 *
 * This module only adds geometry to the supplied scene. It never creates a
 * renderer, camera, lighting rig, animation loop, or external asset request.
 */

const DEFAULTS = Object.freeze({
  columnXs: [-7.2, 7.2],
  columnZs: [-10, -4, 2, 8, 13],
  columnBaseY: 0.04,
  galleryScreenXs: [-9.55, 9.55],
  galleryBayZs: [-6.8, -0.8, 5.2, 11.2],
  screenHeight: 1.48,
  enableColumnBases: true,
  enableCapitalBrackets: true,
  enableGalleryScreens: true,
  enableFloorInlays: true,
  detailLevel: 'high'
});

const MATERIAL_OPTIONS = Object.freeze({
  lacquer: { color: 0x681b22, roughness: 0.62, metalness: 0.12 },
  darkWood: { color: 0x382016, roughness: 0.84, metalness: 0.04 },
  agedWood: { color: 0x68402a, roughness: 0.78, metalness: 0.06 },
  bronze: { color: 0x76502d, roughness: 0.68, metalness: 0.58 },
  mutedGold: { color: 0x98713c, roughness: 0.58, metalness: 0.62 },
  stone: { color: 0x77736b, roughness: 0.94, metalness: 0.02 },
  stoneDark: { color: 0x514d47, roughness: 0.96, metalness: 0.01 }
});

function finiteNumber(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function normalizePositions(value, fallback, min, max) {
  if (!Array.isArray(value)) return [...fallback];
  const positions = value
    .filter(Number.isFinite)
    .map((entry) => finiteNumber(entry, 0, min, max));
  return positions.length ? [...new Set(positions)] : [...fallback];
}

function normalizeConfig(input = {}) {
  const config = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const detailLevel = ['low', 'medium', 'high'].includes(config.detailLevel)
    ? config.detailLevel
    : DEFAULTS.detailLevel;
  return {
    ...DEFAULTS,
    ...config,
    columnXs: normalizePositions(config.columnXs, DEFAULTS.columnXs, -12, 12),
    columnZs: normalizePositions(config.columnZs, DEFAULTS.columnZs, -18, 20),
    galleryScreenXs: normalizePositions(config.galleryScreenXs, DEFAULTS.galleryScreenXs, -12, 12),
    galleryBayZs: normalizePositions(config.galleryBayZs, DEFAULTS.galleryBayZs, -18, 20),
    columnBaseY: finiteNumber(config.columnBaseY, DEFAULTS.columnBaseY, -1, 2),
    screenHeight: finiteNumber(config.screenHeight, DEFAULTS.screenHeight, 0.8, 2.2),
    detailLevel
  };
}

function assertThree(THREE, scene) {
  if (!THREE || typeof THREE.Group !== 'function' || typeof THREE.Mesh !== 'function') {
    throw new TypeError('createTempleEnvironment requires a compatible THREE namespace.');
  }
  if (!scene || typeof scene.add !== 'function' || typeof scene.remove !== 'function') {
    throw new TypeError('createTempleEnvironment requires a scene with add() and remove().');
  }
  for (const name of ['BoxGeometry', 'CylinderGeometry', 'TorusGeometry', 'MeshStandardMaterial']) {
    if (typeof THREE[name] !== 'function') {
      throw new TypeError(`The supplied THREE namespace is missing ${name}.`);
    }
  }
}

export function createTempleEnvironment({ THREE, scene, config = {} } = {}) {
  assertThree(THREE, scene);

  const settings = normalizeConfig(config);
  const group = new THREE.Group();
  group.name = 'TempleEnvironmentArchitecture';
  group.userData = {
    ...(group.userData || {}),
    system: 'temple-environment',
    roofless: true,
    detailLevel: settings.detailLevel
  };

  const ownedGeometries = new Set();
  const ownedMaterials = new Set();
  const geometryCache = new Map();
  const materials = {};

  let disposed = false;
  let meshCount = 0;
  let instanceBatchCount = 0;

  const makeMaterial = (name, options) => {
    const material = new THREE.MeshStandardMaterial(options);
    material.name = `TempleEnvironment_${name}`;
    ownedMaterials.add(material);
    materials[name] = material;
    return material;
  };

  Object.entries(MATERIAL_OPTIONS).forEach(([name, options]) => makeMaterial(name, options));

  const geometry = (key, factory) => {
    if (!geometryCache.has(key)) {
      const item = factory();
      geometryCache.set(key, item);
      ownedGeometries.add(item);
    }
    return geometryCache.get(key);
  };

  const addMesh = (key, factory, material, position, parent = group, rotation = null) => {
    const mesh = new THREE.Mesh(geometry(key, factory), material);
    mesh.position.set(position[0], position[1], position[2]);
    if (rotation && mesh.rotation) {
      mesh.rotation.set(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    meshCount += 1;
    return mesh;
  };

  const addBox = (size, material, position, parent = group, rotation = null) => {
    const [w, h, d] = size;
    return addMesh(
      `box:${w}:${h}:${d}`,
      () => new THREE.BoxGeometry(w, h, d),
      material,
      position,
      parent,
      rotation
    );
  };

  const addCylinder = (radiusTop, radiusBottom, height, material, position, segments = 16) => {
    return addMesh(
      `cylinder:${radiusTop}:${radiusBottom}:${height}:${segments}`,
      () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
      material,
      position
    );
  };

  const addTorusBatch = (name, radius, tube, material, transforms, radialSegments = 6, tubularSegments = 20) => {
    if (!transforms.length || typeof THREE.InstancedMesh !== 'function' || typeof THREE.Object3D !== 'function') {
      transforms.forEach((position) => {
        const ring = addMesh(
          `torus:${radius}:${tube}:${radialSegments}:${tubularSegments}`,
          () => new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments),
          material,
          position
        );
        if (ring.rotation) ring.rotation.x = Math.PI / 2;
      });
      return;
    }

    const itemGeometry = geometry(
      `torus:${radius}:${tube}:${radialSegments}:${tubularSegments}`,
      () => new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments)
    );
    const instances = new THREE.InstancedMesh(itemGeometry, material, transforms.length);
    const transform = new THREE.Object3D();
    transforms.forEach((position, index) => {
      transform.position.set(position[0], position[1], position[2]);
      transform.rotation.set(Math.PI / 2, 0, 0);
      transform.updateMatrix();
      instances.setMatrixAt(index, transform.matrix);
    });
    if (instances.instanceMatrix && typeof instances.instanceMatrix.setUsage === 'function'
      && THREE.StaticDrawUsage !== undefined) {
      instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    }
    if (instances.instanceMatrix) instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = false;
    instances.receiveShadow = true;
    instances.name = name;
    group.add(instances);
    meshCount += 1;
    instanceBatchCount += 1;
  };

  const addBoxBatch = (name, size, material, transforms) => {
    if (!transforms.length || typeof THREE.InstancedMesh !== 'function' || typeof THREE.Object3D !== 'function') {
      transforms.forEach((entry) => addBox(size, material, entry.position, group, entry.rotation));
      return;
    }
    const [w, h, d] = size;
    const itemGeometry = geometry(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
    const instances = new THREE.InstancedMesh(itemGeometry, material, transforms.length);
    const transform = new THREE.Object3D();
    transforms.forEach((entry, index) => {
      transform.position.set(entry.position[0], entry.position[1], entry.position[2]);
      transform.rotation.set(...(entry.rotation || [0, 0, 0]));
      transform.updateMatrix();
      instances.setMatrixAt(index, transform.matrix);
    });
    if (instances.instanceMatrix && typeof instances.instanceMatrix.setUsage === 'function'
      && THREE.StaticDrawUsage !== undefined) {
      instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    }
    if (instances.instanceMatrix) instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = false;
    instances.receiveShadow = true;
    instances.name = name;
    group.add(instances);
    meshCount += 1;
    instanceBatchCount += 1;
  };

  const buildColumnBases = () => {
    const ringPositions = [];
    const studTransforms = [];
    for (const x of settings.columnXs) {
      for (const z of settings.columnZs) {
        const y = settings.columnBaseY;
        // Three stepped stone courses visually anchor each timber shaft.
        addBox([1.46, 0.18, 1.46], materials.stoneDark, [x, y + 0.09, z]);
        addBox([1.3, 0.12, 1.3], materials.stone, [x, y + 0.23, z]);
        addBox([1.12, 0.1, 1.12], materials.lacquer, [x, y + 0.34, z]);
        addCylinder(0.59, 0.64, 0.14, materials.mutedGold, [x, y + 0.45, z], 12);
        ringPositions.push([x, y + 0.54, z]);
        if (settings.detailLevel === 'high') {
          for (let side = 0; side < 4; side += 1) {
            const angle = side * Math.PI / 2 + Math.PI / 4;
            studTransforms.push({
              position: [x + Math.cos(angle) * 0.57, y + 0.34, z + Math.sin(angle) * 0.57],
              rotation: [0, angle, Math.PI / 4]
            });
          }
        }
      }
    }
    addTorusBatch('TempleColumnBaseRings', 0.53, 0.018, materials.bronze, ringPositions, 6, 24);
    if (studTransforms.length) addBoxBatch('TempleColumnBaseStuds', [0.075, 0.075, 0.035], materials.mutedGold, studTransforms);
  };

  const buildCapitalBrackets = () => {
    const bracketTransforms = [];
    const collarPositions = [];
    for (const x of settings.columnXs) {
      for (const z of settings.columnZs) {
        // A compact capital stack adds a crafted transition into the open beam line.
        addBox([1.18, 0.18, 1.18], materials.darkWood, [x, 7.55, z]);
        addBox([1.38, 0.12, 1.38], materials.lacquer, [x, 7.69, z]);
        addBox([1.55, 0.16, 0.72], materials.agedWood, [x, 7.82, z]);
        collarPositions.push([x, 7.43, z]);

        if (settings.detailLevel !== 'low') {
          for (const direction of [-1, 1]) {
            bracketTransforms.push({
              position: [x + direction * 0.56, 7.34, z],
              rotation: [0, 0, direction * -0.16]
            });
            bracketTransforms.push({
              position: [x, 7.34, z + direction * 0.56],
              rotation: [direction * 0.16, 0, 0]
            });
          }
        }
      }
    }
    addTorusBatch('TempleCapitalCollars', 0.57, 0.022, materials.mutedGold, collarPositions, 6, 24);
    if (bracketTransforms.length) {
      addBoxBatch('TempleCapitalCorbels', [0.24, 0.58, 0.34], materials.darkWood, bracketTransforms);
    }
  };

  const buildGalleryScreens = () => {
    const latticeTransforms = [];
    for (const x of settings.galleryScreenXs) {
      for (const z of settings.galleryBayZs) {
        const panel = new THREE.Group();
        panel.name = 'TempleGalleryCarvedScreen';
        panel.position.set(x, 0.08, z);
        group.add(panel);

        const width = 1.08;
        const height = settings.screenHeight;
        addBox([width, 0.1, 0.12], materials.darkWood, [0, height, 0], panel);
        addBox([width, 0.1, 0.12], materials.darkWood, [0, 0.08, 0], panel);
        addBox([0.1, height, 0.12], materials.agedWood, [-width / 2, height / 2, 0], panel);
        addBox([0.1, height, 0.12], materials.agedWood, [width / 2, height / 2, 0], panel);
        addBox([0.035, height - 0.22, 0.1], materials.mutedGold, [0, height / 2, 0.025], panel);

        if (settings.detailLevel !== 'low') {
          for (const offset of [-0.28, 0.28]) {
            latticeTransforms.push({
              position: [x + offset, height / 2 + 0.08, z + 0.045],
              rotation: [0, 0, Math.PI / 4]
            });
          }
        }
      }
    }
    if (latticeTransforms.length) {
      addBoxBatch('TempleGalleryLattice', [0.055, settings.screenHeight * 0.72, 0.055], materials.mutedGold, latticeTransforms);
    }
  };

  const buildFloorInlays = () => {
    const medallionTransforms = [];
    for (const side of [-1, 1]) {
      const x = side * 8.15;
      for (const z of [-7, -1, 5, 11]) {
        addBox([1.28, 0.035, 0.08], materials.bronze, [x, 0.13, z]);
        addBox([0.08, 0.035, 1.28], materials.bronze, [x, 0.13, z]);
        medallionTransforms.push({
          position: [x, 0.16, z],
          rotation: [0, 0, 0]
        });
      }
    }
    if (settings.detailLevel === 'high') {
      addBoxBatch('TempleFloorInlayStuds', [0.09, 0.025, 0.09], materials.mutedGold, medallionTransforms.map((entry) => ({
        position: [entry.position[0], 0.18, entry.position[2]],
        rotation: [0, 0, 0]
      })));
    }
  };

  try {
    if (settings.enableColumnBases) buildColumnBases();
    if (settings.enableCapitalBrackets) buildCapitalBrackets();
    if (settings.enableGalleryScreens) buildGalleryScreens();
    if (settings.enableFloorInlays) buildFloorInlays();
    scene.add(group);
  } catch (error) {
    dispose();
    throw error;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (group.parent && typeof group.parent.remove === 'function') group.parent.remove(group);
    else scene.remove(group);

    const geometries = new Set(ownedGeometries);
    const ownedMats = new Set(ownedMaterials);
    if (typeof group.traverse === 'function') {
      group.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) {
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => ownedMats.add(material));
        }
      });
    }
    geometries.forEach((item) => { if (item && typeof item.dispose === 'function') item.dispose(); });
    ownedMats.forEach((item) => {
      if (!item) return;
      for (const value of Object.values(item)) {
        if (value && value.isTexture && typeof value.dispose === 'function') value.dispose();
      }
      if (typeof item.dispose === 'function') item.dispose();
    });
    geometryCache.clear();
    ownedGeometries.clear();
    ownedMaterials.clear();
  }

  return {
    group,
    update() {},
    dispose,
    metadata: {
      system: 'temple-environment',
      roofless: true,
      detailLevel: settings.detailLevel,
      meshCount: () => meshCount,
      instanceBatchCount: () => instanceBatchCount,
      columnCount: settings.columnXs.length * settings.columnZs.length,
      galleryScreenCount: settings.enableGalleryScreens
        ? settings.galleryScreenXs.length * settings.galleryBayZs.length
        : 0
    }
  };
}

export default createTempleEnvironment;
