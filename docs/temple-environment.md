# Temple Environment Architecture

Agent 3 delivers an independent architectural-detail layer for the existing roofless Three.js sanctuary.

## Scope

The module enriches the existing colonnade and galleries without replacing the scene, renderer, camera, lighting, or animation loop.

- Layered stone and lacquer column plinths with aged-bronze collars and optional instanced studs.
- Timber capital stacks and restrained corbel brackets aligned to the existing column grid.
- Open carved gallery screens placed in the outer gallery bays.
- Low-profile bronze floor inlays that remain outside the central processional aisle.
- Shared primitive geometry and InstancedMesh batches for repeated details; instance matrices are marked for GPU upload after population.
- Idempotent disposal of all geometry and materials owned by this module.

No roof, ceiling, cross-scene lighting, texture download, or new dependency is introduced.

## Integration API

```js
import { createTempleEnvironment } from './temple-environment.js';

const templeEnvironment = createTempleEnvironment({
  THREE,
  scene,
  config: {
    detailLevel: 'high', // 'low' | 'medium' | 'high'
    // Optional layout overrides:
    // columnXs: [-7.2, 7.2],
    // columnZs: [-10, -4, 2, 8, 13],
    // galleryScreenXs: [-9.55, 9.55],
    // galleryBayZs: [-6.8, -0.8, 5.2, 11.2],
    gallerySurfaceY: 0.0825, // top surface of the existing raised side gallery
    enableColumnBases: true,
    enableCapitalBrackets: true,
    enableGalleryScreens: true,
    enableFloorInlays: true
  }
});

// Optional per-frame hook; currently intentionally a no-op.
templeEnvironment.update(deltaTime);

// On scene teardown, before disposing the shared renderer:
templeEnvironment.dispose();
```

The returned `group` is attached to the supplied scene. The module never owns or disposes the scene, renderer, camera, or externally supplied resources.

## Returned metadata

- `metadata.roofless`: always `true`.
- `metadata.detailLevel`: normalized detail preset.
- `metadata.meshCount()`: created mesh and instance-batch count.
- `metadata.instanceBatchCount()`: number of instanced batches.
- `metadata.columnCount`: number of configured column positions.
- `metadata.galleryScreenCount`: number of gallery screen panels.

## Placement and visual safety

Default coordinates follow the existing main-hall column line at X = ±7.2 and Z = -10, -4, 2, 8, 13. Gallery screens sit near the outer gallery edge (X = ±9.55), outside the central aisle and altar sightline. Floor inlays are restricted to the peripheral gallery zone (X = ±8.15) and sit flush with the existing raised gallery deck (default surface Y = 0.0825).

The module adds no objects in front of the Buddha or altar and does not add a roof or overhead slab. If the Coordinator changes the temple's world scale or column grid, pass matching positions through `config`.

## Resource lifecycle and fallback

- No external textures or models are requested; material fallback is procedural and self-contained.
- If `THREE.InstancedMesh` is unavailable, repeated details fall back to individual meshes.
- Geometry is shared by immutable dimension keys and disposed once.
- `dispose()` is safe to call repeatedly and detaches only this module's group.
- A compatible Three.js namespace and a scene exposing `add()` / `remove()` are required.

## Coordinator integration

The existing `public/js/temple-3d.js` boot flow now imports and creates this layer once, attaching it to the existing `world` group:

```js
const templeEnvironment = createTempleEnvironment({
  THREE,
  scene: world,
  config: {
    detailLevel: environmentDetailLevel,
    gallerySurfaceY: 0.0825
  }
});
```

The detail preset is selected from the device memory/core profile: low for constrained devices, medium for mainstream devices, and high for capable devices. The floor inlay surface is aligned to the existing raised side-gallery deck at Y = 0.0825.

The handle remains owned by the existing scene boot lifecycle. The shared `releaseWorldResources()` path calls `templeEnvironment.dispose()` before the general scene-resource traversal. This path is used by both WebGL context-loss recovery and page teardown.

The integration reuses the existing renderer, scene, camera, lighting rig, visibility handling, resize handler, and animation loop. It does not add another render loop or lighting rig.
