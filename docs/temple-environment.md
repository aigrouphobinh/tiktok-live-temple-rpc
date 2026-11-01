# Temple Environment Architecture

Agent 3 delivers an independent architectural-detail layer for the existing roofless Three.js sanctuary.

## Scope

The module enriches the existing colonnade and galleries without replacing the scene, renderer, camera, lighting, or animation loop.

- Two complete portrait-framed timber side columns with layered stone/lacquer plinths, aged-bronze collars, capital stacks, corbels, static gilded fluting and small brass rosettes with bright-gold diamond centres on the audience-facing upper column shafts.
- Timber capital stacks and restrained corbel brackets aligned to the existing column grid.
- Paired carved relief screens extending the altar backdrop into the visible left/right margins.
- Low-profile bronze floor inlays set flush on the visible side-deck strips beside the central processional aisle.
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
    // Portrait layout defaults; override these only when changing camera framing:
    // columnXs: [-5.15, 5.15],
    // columnZs: [-10],
    // galleryScreenXs: [-6.25, 6.25],
    // galleryBayZs: [-14],
    galleryScreenBaseY: 2.05,
    galleryScreenWidth: 0.95,
    floorInlayX: 3.82,
    floorInlayZs: [-7, -4, -1, 2],
    gallerySurfaceY: -0.0825, // top surface of the visible side aisle deck in the portrait crop
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

The default coordinates are tailored to the fixed 9:16 camera: two full-height side columns sit at X = ±5.15, Z = -10, just outside the altar screen; matching relief panels sit farther back at X = ±6.25, Z = -14. Low-profile floor inlays sit on the visible side-deck strips at X = ±3.82 and Z = -7, -4, -1, 2 (default surface Y = -0.0825). These placements keep the central Buddha/altar sightline clear while bringing the architecture inside the portrait crop.

The module adds no objects in front of the Buddha or altar and does not add a roof or overhead slab. If the Coordinator changes the temple's world scale or column grid, pass matching positions through `config`.

## Resource lifecycle and fallback

- No external textures or models are requested; material fallback is procedural and self-contained.
- If `THREE.InstancedMesh` is unavailable, repeated details fall back to individual meshes.
- Geometry is shared by immutable dimension keys and disposed once.
- `dispose()` is safe to call repeatedly and detaches only this module's group.
- A compatible Three.js namespace and a scene exposing `add()` / `remove()` are required.

## Coordinator integration notes

1. Import this module from the existing Three.js boot flow after the base sanctuary structure has been created.
2. Call `createTempleEnvironment({ THREE, scene, config })` once per scene instance.
3. Keep the returned handle in the scene lifecycle owner.
4. Call `dispose()` from the existing scene teardown/context-loss cleanup path.
5. Do not create a second renderer, scene, light rig, or animation loop for this module.

Agent 3 intentionally does not edit shared integration files. Coordinator owns the integration change.
