import { describe, expect, it } from 'bun:test';
import { disposeThreeObjectTree } from '../public/js/three-resource-utils.js';

function resource() {
  return { disposeCount: 0, dispose() { this.disposeCount++; } };
}

function tree(nodes) {
  return { traverse(callback) { nodes.forEach(callback); } };
}

describe('disposeThreeObjectTree', () => {
  it('disposes shared geometries and materials only once per tree', () => {
    const geometry = resource();
    const sharedMaterial = resource();
    const secondMaterial = resource();
    const root = tree([
      { geometry, material: sharedMaterial },
      { geometry, material: [sharedMaterial, secondMaterial] },
      { geometry: null, material: sharedMaterial }
    ]);

    expect(disposeThreeObjectTree(root)).toEqual({ geometries: 1, materials: 2 });
    expect(geometry.disposeCount).toBe(1);
    expect(sharedMaterial.disposeCount).toBe(1);
    expect(secondMaterial.disposeCount).toBe(1);
  });

  it('handles empty and invalid trees', () => {
    expect(disposeThreeObjectTree(null)).toEqual({ geometries: 0, materials: 0 });
    expect(disposeThreeObjectTree({})).toEqual({ geometries: 0, materials: 0 });
    expect(disposeThreeObjectTree(tree([]))).toEqual({ geometries: 0, materials: 0 });
  });

  it('ignores non-disposable material and geometry values', () => {
    const root = tree([{ geometry: {}, material: [{}, null, 'invalid'] }]);
    expect(disposeThreeObjectTree(root)).toEqual({ geometries: 0, materials: 0 });
  });
});
