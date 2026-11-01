# Optional 3D model assets

The 3D scene keeps its procedural statue and character as reliable local fallbacks.
Do not add a model to this directory until its exact file, creator, license and any
attribution terms have been checked.

## Buddha statue

When the user-provided, rights-cleared GLB for the selected Sketchfab model is
available, place it here as:

`buddha-selected.glb`

Selected source (license/download status still needs confirmation):
- https://sketchfab.com/3d-models/tam-the-phat-do-go-thanh-anh-93ccd334332a40218bdc3a2e6e849966
- Model UID: `93ccd334332a40218bdc3a2e6e849966`

The character GLB is expected at `devotee-selected.glb`; the loader normalizes it to 1.72 world units and clones the rig for every devotee. Animation clips are detected by names containing idle/stand/breath, walk/run/approach and bow/pray/worship/kneel. The procedural character remains visible if loading fails or `models=1` is omitted.

The optional loader normalizes the statue to approximately 5.88 world units high,
centers it on X/Z and grounds it at local Y=0. The statue wrapper remains at the
existing altar transform. To preview the optional bundled model, open the 3D
scene with both query parameters: `?3d=1&models=1`. Without the file or without
`models=1`, the current procedural statue remains active.

## Human devotee

Once the selected Sketchfab girl model is downloaded through its official
Download 3D Model action (or supplied by its creator) and have its license and
rig/animation clips inspected before it is added. Do not place it here as a
default model until the bow-from-waist and approach animations have been mapped
to the existing devotee state machine.

Selected source (license, downloadable status and rig still need confirmation):
- https://sketchfab.com/3d-models/girl-82f0a2eff77b47448402f40264b82055
- Model UID: `82f0a2eff77b47448402f40264b82055`

## Inspecting a GLB before integration

Run:

```bash
bun run inspect:glb -- public/assets/models/buddha-selected.glb
```

The inspector reports the GLB version, mesh/primitive counts, triangle estimate,
materials, skins, animations, node names and any external buffer/image references.
For reproducible runtime loading, prefer a self-contained GLB with embedded images.
