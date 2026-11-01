/**
 * Dispose Three.js resources owned by one transient object tree.
 * Sets prevent shared geometries/materials inside groups from being disposed repeatedly.
 */
export function disposeThreeObjectTree(root) {
  if (!root || typeof root.traverse !== 'function') return { geometries: 0, materials: 0 };

  const geometries = new Set();
  const materials = new Set();

  root.traverse((node) => {
    if (node?.geometry && typeof node.geometry.dispose === 'function') {
      geometries.add(node.geometry);
    }
    const nodeMaterials = Array.isArray(node?.material)
      ? node.material
      : node?.material ? [node.material] : [];
    for (const material of nodeMaterials) {
      if (material && typeof material.dispose === 'function') materials.add(material);
    }
  });

  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();

  return { geometries: geometries.size, materials: materials.size };
}
