import { describe, expect, it } from 'bun:test';
import { createTempleEnvironment } from '../public/js/temple-environment.js';

class FakeDisposable {
  constructor() { this.disposed = false; }
  dispose() { this.disposed = true; }
}
class FakeGeometry extends FakeDisposable {
  constructor(...args) { super(); this.args = args; }
}
class FakeMaterial extends FakeDisposable {
  constructor(options) { super(); Object.assign(this, options); }
}
class FakeObject3D {
  constructor() {
    this.children = [];
    this.position = { set: (...values) => { this.position.values = values; } };
    this.rotation = { set: (...values) => { this.rotation.values = values; } };
    this.scale = { set: (...values) => { this.scale.values = values; } };
    this.userData = {};
    this.parent = null;
    this.matrix = {};
  }
  add(...objects) {
    objects.forEach((object) => {
      if (object.parent && object.parent.remove) object.parent.remove(object);
      object.parent = this;
      this.children.push(object);
    });
  }
  remove(object) {
    this.children = this.children.filter((child) => child !== object);
    object.parent = null;
  }
  traverse(callback) {
    callback(this);
    this.children.forEach((child) => child.traverse ? child.traverse(callback) : callback(child));
  }
  updateMatrix() {}
}
class FakeMesh extends FakeObject3D {
  constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
}
class FakeInstancedMesh extends FakeMesh {
  constructor(geometry, material, count) {
    super(geometry, material);
    this.count = count;
    this.instanceMatrix = { setUsage() {}, needsUpdate: false };
    this.setMatrixAt = () => {};
  }
}
const fakeTHREE = {
  Group: FakeObject3D,
  Object3D: FakeObject3D,
  Mesh: FakeMesh,
  InstancedMesh: FakeInstancedMesh,
  BoxGeometry: FakeGeometry,
  CylinderGeometry: FakeGeometry,
  TorusGeometry: FakeGeometry,
  MeshStandardMaterial: FakeMaterial,
  StaticDrawUsage: 35044
};

function createScene() { return new FakeObject3D(); }

describe('Temple environment architecture module', () => {
  it('exports a factory and creates a roofless environment group with defaults', () => {
    const scene = createScene();
    const result = createTempleEnvironment({ THREE: fakeTHREE, scene });
    expect(typeof createTempleEnvironment).toBe('function');
    expect(result.group.name).toBe('TempleEnvironmentArchitecture');
    expect(result.group.parent).toBe(scene);
    expect(result.metadata.roofless).toBe(true);
    expect(result.metadata.columnCount).toBe(10);
    expect(result.metadata.galleryScreenCount).toBe(8);
    expect(result.metadata.meshCount()).toBeGreaterThan(0);
    result.dispose();
  });

  it('builds the repeated architecture using instanced batches', () => {
    const result = createTempleEnvironment({ THREE: fakeTHREE, scene: createScene() });
    expect(result.metadata.instanceBatchCount()).toBeGreaterThanOrEqual(3);
    const names = [];
    result.group.traverse((object) => { if (object.name) names.push(object.name); });
    expect(names).toContain('TempleColumnBaseRings');
    expect(names).toContain('TempleCapitalCorbels');
    expect(names).toContain('TempleGalleryLattice');
    result.dispose();
  });

  it('marks every populated instance matrix for GPU upload', () => {
    const result = createTempleEnvironment({ THREE: fakeTHREE, scene: createScene() });
    const batches = [];
    result.group.traverse((object) => {
      if (object instanceof FakeInstancedMesh) batches.push(object);
    });
    expect(batches.length).toBeGreaterThan(0);
    expect(batches.every((batch) => batch.instanceMatrix.needsUpdate === true)).toBe(true);
    result.dispose();
  });

  it('accepts detail and layout overrides while clamping unsafe dimensions', () => {
    const result = createTempleEnvironment({
      THREE: fakeTHREE,
      scene: createScene(),
      config: {
        detailLevel: 'low',
        columnXs: [-6, 6],
        columnZs: [-8, 0, 8],
        screenHeight: 99
      }
    });
    expect(result.metadata.detailLevel).toBe('low');
    expect(result.metadata.columnCount).toBe(6);
    expect(result.metadata.galleryScreenCount).toBe(8);
    expect(result.group.userData.roofless).toBe(true);
    result.dispose();
  });

  it('falls back to individual meshes when InstancedMesh is unavailable', () => {
    const fallbackTHREE = { ...fakeTHREE };
    delete fallbackTHREE.InstancedMesh;
    const result = createTempleEnvironment({ THREE: fallbackTHREE, scene: createScene() });
    expect(result.metadata.meshCount()).toBeGreaterThan(20);
    expect(result.metadata.instanceBatchCount()).toBe(0);
    result.dispose();
  });

  it('keeps peripheral floor inlays flush with the raised gallery surface', () => {
    const result = createTempleEnvironment({ THREE: fakeTHREE, scene: createScene() });
    const inlays = [];
    result.group.traverse((object) => {
      const args = object.geometry?.args;
      if (object.material?.name === 'TempleEnvironment_bronze'
        && args?.[1] === 0.035
        && (args?.[0] === 1.28 || args?.[2] === 1.28)) {
        inlays.push(object);
      }
    });
    expect(inlays).toHaveLength(16);
    inlays.forEach((mesh) => expect(mesh.position.values[1]).toBeCloseTo(0.1));
    result.dispose();
  });

  it('throws helpful errors for missing or invalid inputs', () => {
    expect(() => createTempleEnvironment()).toThrow(/THREE namespace/);
    expect(() => createTempleEnvironment({ THREE: fakeTHREE, scene: null })).toThrow(/scene/);
    expect(() => createTempleEnvironment({
      THREE: { ...fakeTHREE, TorusGeometry: undefined },
      scene: createScene()
    })).toThrow(/TorusGeometry/);
  });

  it('disposes owned geometry and materials once and tolerates repeated cleanup', () => {
    const scene = createScene();
    const result = createTempleEnvironment({ THREE: fakeTHREE, scene });
    const geometries = new Set();
    const materials = new Set();
    result.group.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    result.dispose();
    result.dispose();
    expect(result.group.parent).toBe(null);
    expect([...geometries].every((item) => item.disposed)).toBe(true);
    expect([...materials].every((item) => item.disposed)).toBe(true);
    expect(scene.children).toHaveLength(0);
  });

  it('does not introduce roof geometry or an independent renderer/animation loop', async () => {
    const source = await Bun.file(new URL('../public/js/temple-environment.js', import.meta.url)).text();
    expect(source).not.toMatch(/RoofGeometry|createRoof|new THREE\.WebGLRenderer|requestAnimationFrame/);
    expect(source).toContain('roofless: true');
    expect(source).toContain('scene.add(group)');
  });
});
