# Optional 3D model assets

The 3D scene keeps its procedural statue and character as reliable local fallbacks.
Do not add a model to this directory until its exact file, creator, license and any
attribution terms have been checked.

## Buddha statue

### Add your own Buddha model

To use a custom GLB, place the file at this exact repository path:

```text
public/assets/models/buddha.glb
```

This is a legacy override and is **not** used by default. The normal 3D scene
loads `buddha-selected.glb` first, then the bundled CC0 fallback. To explicitly
preview this custom file, use `?3d=1&buddha=custom`. The filename is case-sensitive.

After adding the file, commit and deploy the repository, then open the 3D scene:

```text
?3d=1
```

The selected bundled Buddha GLB is loaded by default in 3D mode. Use
`?3d=1&buddha=0` only to force the procedural statue for troubleshooting.
Use `?3d=1&buddha=custom` only to opt into the legacy `buddha.glb` file.

The file must be a self-contained binary glTF (GLB), with textures embedded.
If the selected model still does not appear, inspect
`window.__TEMPLE_BUDDHA_MODEL_DIAGNOSTIC__` in DevTools. Its `attempts` array
records the selected model and CC0 fallback load results, including the exact
GLTFLoader error. In Network, the default request should target
`/assets/models/buddha-selected.glb`; the optional custom path is never probed
unless `buddha=custom` is set.

### Supplied custom model metadata

The uploaded `buddha.glb` file identifies itself in its embedded glTF metadata as:
- Title: **Buddha**
- Creator: **Thunk3D** (Sketchfab account: Lily.Qin1)
- Source: https://sketchfab.com/3d-models/buddha-c6a1ed475b324b9cbb72d9ba85d674b5
- License: **CC BY 4.0**. Preserve creator attribution and link to the source when distributing or publicly displaying the model.
- File size: approximately 54.6 MiB; 21 mesh primitives and approximately 2.08 million triangles.
- Textures: none embedded; the mesh uses a neutral white material, so the runtime applies the temple's aged-gold PBR finish.

The uploaded binary is inspected locally but is not yet committed to this repository. Add it at the path above before expecting the custom model to load in a deployed build.

### Bundled models

Preferred model (user-selected): **Gold Buddha Statue — Kenny Hsieh**
- https://sketchfab.com/3d-models/gold-buddha-statue-641d85153dd849d3b33bb69bd3ff6748
- Model UID: `641d85153dd849d3b33bb69bd3ff6748`
- Published license: **CC BY**; retain attribution to Kenny Hsieh and link to the Sketchfab model wherever the asset is distributed or shown.
- Expected file: `buddha-selected.glb`; this is the default first-choice model.

Bundled public fallback: **Seated Buddha, date unknown — Minneapolis Institute of Art**
- Original record: https://zenodo.org/records/10337923 (DOI: `10.5281/zenodo.10337923`)
- Source model: https://sketchfab.com/3d-models/seated-buddha-date-unknown-c1c3d5a4878c42778eceded83673dea7
- The exact Artheon artwork record lists this individual scan as **CC0 (Public Domain)**: https://www.artheonmuseum.org/artwork/seated-buddha-date-unknown-c1c3d5. The Artheon Buddhist & Hindu catalogue also lists it as CC0. The Zenodo record identifies the object as a gilt-bronze Seated Buddha in the Minneapolis Institute of Art collection and hosts the binary, but its own Rights field does not state the license.
- Downloaded file: `buddha-cc0-fallback.glb` (5.5 MB); MD5 `a00f6c35ae853c830faff61404265c5c`.
- The fallback is used when `buddha.glb` and `buddha-selected.glb` are absent or fail to load. Keep the original collection/source credit with the asset.

The GitHub Actions workflow `.github/workflows/fetch-buddha-cc0-fallback.yml` downloads this public GLB, verifies the published MD5, inspects the glTF structure and commits the binary to the feature branch. Do not use viewer extraction or third-party rippers for the preferred Kenny Hsieh model.

Human devotees now use local male/female Vietnamese Ao Dai rigs from `public/js/ao-dai-avatar.js`. The old `devotee-selected.glb` Girl override is disabled because its provenance, skeleton and clips were never verified. Both Ao Dai rigs expose the same upper-body, arm, hand, leg and foot pivots for walk, queue, prayer, kneel, bow, gift reaction and exit.

The loader normalizes the active Buddha model to approximately 5.88 world units
high, centers it on X/Z and grounds it at local Y=0. The statue wrapper remains at
the existing altar transform. The selected Kenny Hsieh model is loaded by
default in every `?3d=1` scene, followed by the bundled CC0 museum scan if the
selected model cannot load. The procedural statue is retained only as an explicit
troubleshooting fallback (`buddha=0`) or when both GLBs fail. Set
`buddha=custom` to explicitly prioritize the legacy `buddha.glb` file.

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
