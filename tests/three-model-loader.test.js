import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const loaderSource = readFileSync(new URL('../public/js/three-model-loader.js', import.meta.url), 'utf8');

describe('Three.js GLB resource lifecycle', () => {
  it('disposes imported textures together with model geometry and materials', () => {
    expect(loaderSource).toContain("import { disposeThreeSceneResources } from './three-resource-utils.js';");
    expect(loaderSource).toContain('disposeThreeSceneResources(root);');
    expect(loaderSource).not.toContain('disposeThreeObjectTree(root)');
  });

  it('limits shadow casting for high-triangle scans while preserving shadow reception', () => {
    expect(loaderSource).toContain('maxShadowTriangles = 250000');
    expect(loaderSource).toContain('const castsShadow = triangleCount <= maxShadowTriangles;');
    expect(loaderSource).toContain('node.castShadow = castsShadow;');
    expect(loaderSource).toContain('node.receiveShadow = true;');
    expect(loaderSource).toContain('triangleCount,');
  });

  it('can level a tilted photogrammetry model from its bottom-plane samples without changing its facing direction', () => {
    expect(loaderSource).toContain('function estimateGroundPlane(root, minY, height)');
    expect(loaderSource).toContain('const sampleStride = Math.max(1, Math.ceil(totalVertices / 120000));');
    expect(loaderSource).toContain('smallest / next > 0.22');
    expect(loaderSource).toContain('alignGroundPlane = false');
    expect(loaderSource).toContain('root.quaternion.setFromUnitVectors(plane.normal, up);');
    expect(loaderSource).toContain("status: alignGroundPlane ? 'not-detected' : 'not-requested'");
    expect(loaderSource).toContain('groundAlignment,');
    expect(loaderSource).toContain("groundAlignment.status = 'tilt-out-of-range';");
  });

  it('keeps GLB loading restricted to same-origin project model assets', () => {
    expect(loaderSource).toContain("!url.startsWith('/assets/models/')");
    expect(loaderSource).toContain("url.startsWith('//')");
  });

  it('keeps disposal idempotent and stops model animation actions', () => {
    expect(loaderSource).toContain('if (disposed) return;');
    expect(loaderSource).toContain('mixer?.stopAllAction();');
  });

  it('releases decoded scene resources when bounds validation rejects a GLB', () => {
    expect(loaderSource).toContain('catch (error) {');
    expect(loaderSource).toContain('disposeThreeSceneResources(root);');
    expect(loaderSource).toContain('throw error;');
  });
});
