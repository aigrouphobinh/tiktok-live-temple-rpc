/**
 * Reusable Vietnamese Ao Dai devotee rigs.
 *
 * Both masculine and feminine silhouettes share the same joint contract so
 * the queue, procession, kneel/bow and gift-reaction timelines never depend
 * on a particular imported GLB skeleton or its animation clip names.
 */
const AO_DAI_PALETTES = Object.freeze([
  { female: 0x9d3447, male: 0x183f63, trim: 0xd2aa62, trousers: 0xe8dfc8 },
  { female: 0x2f7268, male: 0x6d2835, trim: 0xd9b66f, trousers: 0xe9e1cf },
  { female: 0x754a80, male: 0x244f45, trim: 0xcaa76a, trousers: 0xe2d8c2 },
  { female: 0xb85b62, male: 0x333f68, trim: 0xe1c27a, trousers: 0xf0e7d4 },
  { female: 0x477b91, male: 0x80502c, trim: 0xd6b77b, trousers: 0xe8dfcc },
  { female: 0x7b6844, male: 0x344d3e, trim: 0xc6a268, trousers: 0xeee4d1 }
]);

const geometryCaches = new WeakMap();
const materialThreeOwners = new WeakMap();

function getGeometry(THREE, key, create) {
  let cache = geometryCaches.get(THREE);
  if (!cache) {
    cache = new Map();
    geometryCaches.set(THREE, cache);
  }
  if (!cache.has(key)) cache.set(key, create());
  return cache.get(key);
}

function makeMaterial(THREE, color, extra = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0.02,
    ...extra
  });
  materialThreeOwners.set(material, THREE);
  return material;
}

function addMesh(parent, geometry, material, position = [0, 0, 0], scale = null) {
  const THREE = materialThreeOwners.get(material);
  if (!THREE) throw new TypeError('Ao Dai material was not created by the provided Three.js runtime.');
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function sphereGeometry(THREE, radius, width = 16, height = 12) {
  return getGeometry(THREE, `sphere:${radius}:${width}:${height}`,
    () => new THREE.SphereGeometry(radius, width, height));
}

function cylinderGeometry(THREE, top, bottom, height, radial = 16) {
  return getGeometry(THREE, `cylinder:${top}:${bottom}:${height}:${radial}`,
    () => new THREE.CylinderGeometry(top, bottom, height, radial));
}

function createPanelGeometry(THREE) {
  return getGeometry(THREE, 'ao-dai-panel-v1', () => {
    const shape = new THREE.Shape();
    // One half of the long front/back flap. The second half mirrors it,
    // leaving a narrow centre split so the trouser legs remain readable.
    shape.moveTo(0.006, 0.46);
    shape.quadraticCurveTo(0.13, 0.47, 0.235, 0.42);
    shape.lineTo(0.255, -0.415);
    shape.quadraticCurveTo(0.14, -0.485, 0.008, -0.455);
    shape.lineTo(0.006, 0.46);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 8);
  });
}

function createAoDaiAvatarRig(THREE, {
  height = 1.55,
  gender = 'female',
  paletteIndex = 0
} = {}) {
  const normalizedGender = gender === 'male' ? 'male' : 'female';
  const palette = AO_DAI_PALETTES[
    ((Math.trunc(paletteIndex) % AO_DAI_PALETTES.length) + AO_DAI_PALETTES.length)
      % AO_DAI_PALETTES.length
  ];
  const group = new THREE.Group();
  group.name = `AoDai-${normalizedGender}-${paletteIndex}`;
  group.scale.setScalar(height / 1.72);

  const cloth = makeMaterial(THREE, palette[normalizedGender], {
    roughness: 0.78,
    metalness: 0.025
  });
  const clothShadow = makeMaterial(THREE, palette[normalizedGender], {
    roughness: 0.9
  });
  clothShadow.color.multiplyScalar(0.76);
  const trim = makeMaterial(THREE, palette.trim, {
    roughness: 0.42,
    metalness: 0.34
  });
  const trousers = makeMaterial(THREE, palette.trousers, {
    roughness: 0.91
  });
  const skin = makeMaterial(THREE, 0xe8bd98, { roughness: 0.86 });
  const hair = makeMaterial(THREE, 0x30231e, { roughness: 0.94 });
  const hairLight = makeMaterial(THREE, 0x4a3026, { roughness: 0.92 });
  const white = makeMaterial(THREE, 0xf4eee5, { roughness: 0.64 });
  const eye = makeMaterial(THREE, 0x211917, { roughness: 0.55 });

  const upperBody = new THREE.Group();
  upperBody.position.y = 0.48;
  group.add(upperBody);

  const torso = addMesh(
    upperBody,
    sphereGeometry(THREE, 0.27, 20, 14),
    cloth,
    [0, 0.40, 0],
    [normalizedGender === 'male' ? 1.12 : 1.02, 1.25, 0.7]
  );
  torso.name = 'AoDaiBreathingTorso';

  // Fitted long tunic from the shoulders to below the hips. The separate
  // split panels layer over this shell instead of using a short T-shirt mesh.
  const tunicShell = addMesh(
    upperBody,
    cylinderGeometry(THREE, 0.235, 0.17, 0.88, 24),
    cloth,
    [0, 0.105, 0],
    [1, 1, 0.72]
  );
  tunicShell.name = 'AoDaiLongTunic';

  const panelGeometry = createPanelGeometry(THREE);
  const panelMaterial = makeMaterial(THREE, palette[normalizedGender], {
    roughness: 0.8,
    side: THREE.DoubleSide
  });
  const backPanelMaterial = makeMaterial(THREE, palette[normalizedGender], {
    roughness: 0.84,
    side: THREE.DoubleSide
  });
  backPanelMaterial.color.multiplyScalar(0.94);
  const panels = [];
  for (const z of [-0.142, 0.142]) {
    const material = z < 0 ? panelMaterial : backPanelMaterial;
    for (const side of [-1, 1]) {
      const panel = addMesh(
        upperBody,
        panelGeometry,
        material,
        [0, 0, z],
        [side, 1, 1]
      );
      panel.name = z < 0
        ? (side < 0 ? 'AoDaiFrontLeft' : 'AoDaiFrontRight')
        : (side < 0 ? 'AoDaiBackLeft' : 'AoDaiBackRight');
      panels.push(panel);
    }
  }

  // High standing collar, centre placket and restrained brass buttons.
  const collar = addMesh(
    upperBody,
    cylinderGeometry(THREE, 0.082, 0.108, 0.105, 20),
    trim,
    [0, 0.565, 0]
  );
  collar.name = 'AoDaiHighCollar';
  const placket = addMesh(
    upperBody,
    cylinderGeometry(THREE, 0.012, 0.012, 0.31, 8),
    trim,
    [0, 0.31, -0.153]
  );
  placket.name = 'AoDaiFrontPlacket';
  const buttonGeometry = sphereGeometry(THREE, 0.014, 8, 6);
  for (const y of [0.42, 0.33, 0.24]) {
    addMesh(upperBody, buttonGeometry, trim, [0, y, -0.165]);
  }

  // Four flared cloth panels carry a fine gold hem without covering the split.
  const hemGeometry = getGeometry(THREE, 'ao-dai-hem-v1', () => {
    const shape = new THREE.Shape();
    shape.moveTo(0.008, -0.423);
    shape.quadraticCurveTo(0.13, -0.45, 0.255, -0.405);
    shape.lineTo(0.255, -0.385);
    shape.quadraticCurveTo(0.13, -0.43, 0.008, -0.403);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 6);
  });
  for (const z of [-0.148, 0.148]) {
    for (const side of [-1, 1]) {
      const hem = addMesh(upperBody, hemGeometry, trim, [0, 0, z], [side, 1, 1]);
      hem.name = 'AoDaiGoldHem';
      panels.push(hem);
    }
  }

  const head = new THREE.Group();
  head.position.set(0, 0.80, 0.02);
  upperBody.add(head);
  addMesh(
    head, sphereGeometry(THREE, 0.27, 20, 16), skin, [0, 0, 0],
    normalizedGender === 'male' ? [0.91, 1.08, 0.8] : [0.88, 1.08, 0.78]
  );

  if (normalizedGender === 'female') {
    // Neat low bun and shoulder-length hair keep the feminine silhouette
    // recognisable without making the devotee look like the previous girl rig.
    addMesh(head, sphereGeometry(THREE, 0.29, 18, 12), hair, [0, 0.12, -0.095], [0.98, 1.16, 0.86]);
    addMesh(head, sphereGeometry(THREE, 0.22, 16, 12), hair, [0, -0.25, -0.105], [0.9, 1.45, 0.76]);
    addMesh(head, sphereGeometry(THREE, 0.105, 14, 10), hairLight, [0, 0.31, -0.12], [1.1, 0.95, 1.0]);
    for (const side of [-1, 1]) {
      addMesh(head, sphereGeometry(THREE, 0.105, 14, 10), hair, [side * 0.215, -0.17, 0.01], [0.62, 1.62, 0.76]);
    }
  } else {
    // Short, tidy hair and sideburns distinguish the male áo dài visitor.
    addMesh(head, sphereGeometry(THREE, 0.29, 18, 12), hair, [0, 0.14, -0.08], [1.0, 1.03, 0.88]);
    addMesh(head, sphereGeometry(THREE, 0.17, 16, 10), hairLight, [0, 0.265, -0.04], [1.0, 0.44, 0.84]);
    for (const side of [-1, 1]) {
      addMesh(head, sphereGeometry(THREE, 0.09, 12, 8), hair, [side * 0.235, -0.12, -0.045], [0.58, 0.95, 0.72]);
    }
  }

  // Front hairline/fringe, eyes and understated facial features.
  for (const [x, y, sx] of [[-0.13, 0.19, 0.58], [0, 0.22, 0.62], [0.13, 0.19, 0.58]]) {
    const fringe = addMesh(
      head,
      sphereGeometry(THREE, 0.105, 12, 8),
      hairLight,
      [x, y, 0.205],
      [sx, normalizedGender === 'male' ? 0.56 : 0.72, 0.42]
    );
    fringe.rotation.z = -x * 0.8;
  }

  const eyeWhites = [];
  const eyePupils = [];
  const eyebrows = [];
  for (const side of [-1, 1]) {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(side * 0.105, 0.045, 0.22);
    head.add(eyeGroup);
    const sclera = addMesh(
      eyeGroup, sphereGeometry(THREE, 0.052, 12, 8), white,
      [0, 0, 0], [1, 1, 0.45]
    );
    const pupil = addMesh(
      eyeGroup, sphereGeometry(THREE, 0.026, 10, 8), eye,
      [0, 0, 0.027], [1, 1, 0.45]
    );
    eyeWhites.push(sclera);
    eyePupils.push(pupil);
    const brow = addMesh(
      head, sphereGeometry(THREE, 0.052, 10, 6), hair,
      [side * 0.105, 0.115, 0.205], [1.25, 0.22, 0.35]
    );
    brow.rotation.z = -side * 0.12;
    eyebrows.push({ mesh: brow, side });
    addMesh(
      head, sphereGeometry(THREE, 0.035, 10, 8), skin,
      [side * 0.265, -0.02, 0.05], [0.7, 0.7, 0.7]
    );
  }
  addMesh(head, sphereGeometry(THREE, 0.035, 10, 8), skin, [0, -0.045, 0.25], [0.7, 0.7, 0.7]);
  const smileGeometry = getGeometry(THREE, 'ao-dai-smile-v1', () =>
    new THREE.TorusGeometry(0.075, 0.012, 6, 18, Math.PI));
  const smile = addMesh(head, smileGeometry, hairLight, [0, -0.105, 0.235]);
  smile.rotation.z = Math.PI;

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.29, 0.57, 0);
  upperBody.add(leftArm);
  const rightArm = new THREE.Group();
  rightArm.position.set(0.29, 0.57, 0);
  upperBody.add(rightArm);
  const leftHand = new THREE.Group();
  leftHand.position.set(0, -0.43, 0.02);
  leftArm.add(leftHand);
  const rightHand = new THREE.Group();
  rightHand.position.set(0, -0.43, 0.02);
  rightArm.add(rightHand);

  for (const [pivot, side, hand] of [
    [leftArm, -1, leftHand],
    [rightArm, 1, rightHand]
  ]) {
    const sleeve = addMesh(
      pivot, cylinderGeometry(THREE, 0.108, 0.072, 0.46, 14), cloth,
      [0, -0.205, 0]
    );
    sleeve.rotation.z = side * 0.16;
    const cuff = addMesh(
      pivot, getGeometry(THREE, 'ao-dai-cuff-v1', () =>
        new THREE.TorusGeometry(0.074, 0.009, 6, 18)),
      trim, [0, -0.425, 0]
    );
    cuff.rotation.x = Math.PI / 2;
    addMesh(
      hand, sphereGeometry(THREE, 0.064, 12, 8), skin,
      [0, -0.025, 0], [0.92, 1.18, 0.48]
    );
    for (let finger = 0; finger < 4; finger++) {
      const x = (finger - 1.5) * 0.027;
      addMesh(
        hand, cylinderGeometry(THREE, 0.011, 0.014, 0.105, 8), skin,
        [x, 0.075, 0]
      );
      addMesh(
        hand, sphereGeometry(THREE, 0.013, 8, 6), skin,
        [x, 0.128, 0], [0.85, 0.9, 0.85]
      );
    }
    addMesh(
      hand, sphereGeometry(THREE, 0.025, 8, 6), skin,
      [side * 0.066, -0.005, 0.008], [0.9, 1.2, 0.9]
    );
  }

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.13, 0.48, 0);
  group.add(leftLeg);
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.13, 0.48, 0);
  group.add(rightLeg);
  const leftKnee = new THREE.Group();
  leftKnee.position.y = -0.24;
  leftLeg.add(leftKnee);
  const rightKnee = new THREE.Group();
  rightKnee.position.y = -0.24;
  rightLeg.add(rightKnee);
  const leftFoot = new THREE.Group();
  leftFoot.position.y = -0.24;
  leftKnee.add(leftFoot);
  const rightFoot = new THREE.Group();
  rightFoot.position.y = -0.24;
  rightKnee.add(rightFoot);

  for (const [upper, lower, foot, side] of [
    [leftLeg, leftKnee, leftFoot, -1],
    [rightLeg, rightKnee, rightFoot, 1]
  ]) {
    addMesh(
      upper, cylinderGeometry(THREE, 0.086, 0.103, 0.25, 12), trousers,
      [0, -0.12, 0]
    );
    addMesh(
      lower, cylinderGeometry(THREE, 0.078, 0.094, 0.25, 12), trousers,
      [0, -0.12, 0]
    );
    const shoe = addMesh(
      foot, sphereGeometry(THREE, 0.13, 12, 8), clothShadow,
      [0, -0.025, 0.09], [1.35, 0.55, 1.9]
    );
    shoe.rotation.y = side * 0.04;
  }

  return {
    group,
    gender: normalizedGender,
    paletteIndex,
    upperBody,
    torso,
    tunicShell,
    head,
    eyeWhites,
    eyePupils,
    eyebrows,
    smile,
    leftArm,
    rightArm,
    leftHand,
    rightHand,
    leftLeg,
    rightLeg,
    leftKnee,
    rightKnee,
    leftFoot,
    rightFoot,
    wardrobeMaterials: { shirt: cloth, trim, trousers }
  };
}

export function getAoDaiAppearance(index = 0) {
  const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  return {
    gender: safeIndex % 2 === 0 ? 'male' : 'female',
    paletteIndex: safeIndex % AO_DAI_PALETTES.length,
    sequence: safeIndex
  };
}

export function createAoDaiAvatarVariants(THREE, {
  height = 1.55,
  appearance = getAoDaiAppearance(0)
} = {}) {
  const variants = {
    male: createAoDaiAvatarRig(THREE, {
      height, gender: 'male', paletteIndex: appearance.paletteIndex
    }),
    female: createAoDaiAvatarRig(THREE, {
      height, gender: 'female', paletteIndex: appearance.paletteIndex
    })
  };
  return variants;
}
