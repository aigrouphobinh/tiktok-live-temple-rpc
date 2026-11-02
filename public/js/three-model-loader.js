import * as THREE from 'three';
import { disposeThreeSceneResources } from './three-resource-utils.js';

/**
 * Load a project-vendored GLB and normalize it to the temple's world units.
 * Files must live under /assets/models so the scene never depends on a remote host.
 */
function estimateGroundPlane(root, minY, height) {
  // Photogrammetry scans often carry a small roll/pitch from the camera rig.
  // Fit a plane to the lowest, densely sampled surface band instead of
  // guessing a fixed Euler angle that would only correct one particular file.
  let totalVertices = 0;
  root.traverse((node) => {
    if (node.isMesh && node.geometry?.getAttribute?.('position')) {
      totalVertices += node.geometry.getAttribute('position').count;
    }
  });
  if (totalVertices < 12) return null;

  const sampleStride = Math.max(1, Math.ceil(totalVertices / 120000));
  const matrix = new THREE.Matrix4();
  const elements = matrix.elements;
  let sampledMinY = Infinity;

  const visitSampledPoints = (visitor) => {
    root.traverse((node) => {
      if (!node.isMesh || !node.geometry?.getAttribute?.('position')) return;
      const position = node.geometry.getAttribute('position');
      matrix.copy(node.matrixWorld);
      const e = elements;
      for (let index = 0; index < position.count; index += sampleStride) {
        const x = position.getX(index);
        const y = position.getY(index);
        const z = position.getZ(index);
        const worldX = e[0] * x + e[4] * y + e[8] * z + e[12];
        const worldY = e[1] * x + e[5] * y + e[9] * z + e[13];
        const worldZ = e[2] * x + e[6] * y + e[10] * z + e[14];
        visitor(worldX, worldY, worldZ);
      }
    });
  };

  // The sampled minimum is more resilient to isolated photogrammetry spikes
  // than trusting one extreme vertex from the full-resolution bounding box.
  visitSampledPoints((_x, y) => { sampledMinY = Math.min(sampledMinY, y); });
  if (!Number.isFinite(sampledMinY)) return null;

  const bandHeight = Math.max(height * 0.035, 0.012);
  const bandTop = sampledMinY + bandHeight;
  let count = 0;
  let sumX = 0, sumY = 0, sumZ = 0;
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;

  visitSampledPoints((x, y, z) => {
    if (y > bandTop) return;
    count++;
    sumX += x; sumY += y; sumZ += z;
    xx += x * x; xy += x * y; xz += x * z;
    yy += y * y; yz += y * z; zz += z * z;
  });
  if (count < 12) return null;

  const inverseCount = 1 / count;
  const meanX = sumX * inverseCount;
  const meanY = sumY * inverseCount;
  const meanZ = sumZ * inverseCount;
  const covariance = [
    [xx * inverseCount - meanX * meanX, xy * inverseCount - meanX * meanY, xz * inverseCount - meanX * meanZ],
    [xy * inverseCount - meanX * meanY, yy * inverseCount - meanY * meanY, yz * inverseCount - meanY * meanZ],
    [xz * inverseCount - meanX * meanZ, yz * inverseCount - meanY * meanZ, zz * inverseCount - meanZ * meanZ]
  ];
  const eigenvectors = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  // Jacobi eigen decomposition for this symmetric 3x3 covariance matrix.
  for (let iteration = 0; iteration < 24; iteration++) {
    let p = 0, q = 1;
    let largest = Math.abs(covariance[p][q]);
    for (const [row, column] of [[0, 2], [1, 2]]) {
      const candidate = Math.abs(covariance[row][column]);
      if (candidate > largest) {
        largest = candidate;
        p = row;
        q = column;
      }
    }
    if (largest < 1e-12) break;

    const offDiagonal = covariance[p][q];
    const tau = (covariance[q][q] - covariance[p][p]) / (2 * offDiagonal);
    const tangent = (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
    const cosine = 1 / Math.sqrt(1 + tangent * tangent);
    const sine = tangent * cosine;
    const app = covariance[p][p];
    const aqq = covariance[q][q];
    covariance[p][p] = app - tangent * offDiagonal;
    covariance[q][q] = aqq + tangent * offDiagonal;
    covariance[p][q] = covariance[q][p] = 0;

    for (let axis = 0; axis < 3; axis++) {
      if (axis !== p && axis !== q) {
        const ap = covariance[axis][p];
        const aq = covariance[axis][q];
        covariance[axis][p] = covariance[p][axis] = cosine * ap - sine * aq;
        covariance[axis][q] = covariance[q][axis] = sine * ap + cosine * aq;
      }
      const vp = eigenvectors[axis][p];
      const vq = eigenvectors[axis][q];
      eigenvectors[axis][p] = cosine * vp - sine * vq;
      eigenvectors[axis][q] = sine * vp + cosine * vq;
    }
  }

  const eigenvalues = [covariance[0][0], covariance[1][1], covariance[2][2]];
  const sorted = [0, 1, 2].sort((a, b) => eigenvalues[a] - eigenvalues[b]);
  const smallest = Math.max(0, eigenvalues[sorted[0]]);
  const next = Math.max(0, eigenvalues[sorted[1]]);
  const largest = Math.max(0, eigenvalues[sorted[2]]);
  if (largest < 1e-10 || next < 1e-10 || smallest / next > 0.22) return null;

  const normal = new THREE.Vector3(
    eigenvectors[0][sorted[0]],
    eigenvectors[1][sorted[0]],
    eigenvectors[2][sorted[0]]
  ).normalize();
  if (normal.y < 0) normal.negate();

  return {
    normal,
    sampleCount: count,
    planarity: Number((smallest / next).toFixed(5))
  };
}

export async function loadGLTFAsset(url, {
  targetHeight = 1.7,
  centerXZ = true,
  maxShadowTriangles = 250000,
  alignGroundPlane = false,
  onProgress
} = {}) {
  if (typeof url !== 'string' || !url.startsWith('/assets/models/') || url.startsWith('//')) {
    throw new TypeError('GLB assets must use a same-origin /assets/models/ path.');
  }
  if (!Number.isFinite(targetHeight) || targetHeight <= 0) {
    throw new RangeError('targetHeight must be a positive finite number.');
  }
  if (!Number.isFinite(maxShadowTriangles) || maxShadowTriangles < 0) {
    throw new RangeError('maxShadowTriangles must be a non-negative finite number.');
  }

  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url, onProgress);
  if (!gltf?.scene) throw new Error(`GLB has no default scene: ${url}`);

  const root = new THREE.Group();
  root.name = 'normalized-gltf-asset';
  root.add(gltf.scene);

  let sourceBounds;
  let sourceSize;
  let scale;
  let triangleCount = 0;
  let groundAlignment = {
    requested: Boolean(alignGroundPlane),
    status: alignGroundPlane ? 'not-detected' : 'not-requested',
    applied: false,
    angleDegrees: null,
    sampleCount: 0,
    planarity: null
  };
  try {
    root.updateMatrixWorld(true);
    sourceBounds = new THREE.Box3().setFromObject(root);
    if (sourceBounds.isEmpty()) throw new Error(`GLB scene is empty: ${url}`);
    sourceSize = sourceBounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(sourceSize.y) || sourceSize.y <= 1e-5) {
      throw new Error(`GLB has invalid vertical bounds: ${url}`);
    }

    if (alignGroundPlane) {
      const plane = estimateGroundPlane(root, sourceBounds.min.y, sourceSize.y);
      if (plane) {
        const up = new THREE.Vector3(0, 1, 0);
        const angleRadians = Math.acos(THREE.MathUtils.clamp(plane.normal.dot(up), -1, 1));
        const angleDegrees = THREE.MathUtils.radToDeg(angleRadians);
        groundAlignment = {
          requested: true,
          status: angleDegrees <= 0.2 ? 'already-level' : 'aligned',
          applied: angleDegrees > 0.2 && angleDegrees <= 35,
          angleDegrees: Number(angleDegrees.toFixed(3)),
          sampleCount: plane.sampleCount,
          planarity: plane.planarity,
          originalNormal: plane.normal.toArray()
        };
        if (groundAlignment.applied) {
          // Apply the shortest tilt-only correction. This does not alter yaw,
          // face direction, camera framing, or the statue's altar position.
          root.quaternion.setFromUnitVectors(plane.normal, up);
          root.updateMatrixWorld(true);
        } else if (angleDegrees > 35) {
          groundAlignment.status = 'tilt-out-of-range';
        }
      }
      // A tilted scan has different bounds after leveling; normalize from the
      // corrected bounds so the feet remain on the altar and the height stays fixed.
      sourceBounds = new THREE.Box3().setFromObject(root);
      sourceSize = sourceBounds.getSize(new THREE.Vector3());
    }

    scale = targetHeight / sourceSize.y;
    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);

    const normalizedBounds = new THREE.Box3().setFromObject(root);
    const center = normalizedBounds.getCenter(new THREE.Vector3());
    root.position.set(
      centerXZ ? -center.x : 0,
      -normalizedBounds.min.y,
      centerXZ ? -center.z : 0
    );
    root.updateMatrixWorld(true);

    root.traverse((node) => {
      if (!node.isMesh) return;
      const position = node.geometry?.getAttribute?.('position');
      const indexCount = node.geometry?.index?.count;
      triangleCount += Math.floor((Number.isFinite(indexCount) ? indexCount : position?.count || 0) / 3);
    });
    // Large scanned statues can contain millions of triangles. Keep them visible
    // and able to receive shadows, but avoid submitting the entire scan to shadow
    // maps, which multiplies vertex work on mobile GPUs.
    const castsShadow = triangleCount <= maxShadowTriangles;
    root.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = castsShadow;
      node.receiveShadow = true;
      // Keep imported tangent/normal and material data intact; no destructive merge.
    });
  } catch (error) {
    // A malformed/empty GLB must not strand decoded GPU resources before fallback.
    disposeThreeSceneResources(root);
    throw error;
  }


  const animations = Array.isArray(gltf.animations) ? gltf.animations : [];
  const mixer = animations.length ? new THREE.AnimationMixer(root) : null;
  let disposed = false;

  return {
    root,
    animations,
    mixer,
    sourceBounds,
    sourceSize,
    scale,
    triangleCount,
    groundAlignment,
    castsShadow: triangleCount <= maxShadowTriangles,
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer?.stopAllAction();
      // GLB materials own their imported maps; dispose textures with the model.
      disposeThreeSceneResources(root);
    }
  };
}
