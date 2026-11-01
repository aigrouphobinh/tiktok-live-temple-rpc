# 3D Sanctuary Implementation Progress

Updated: 2026-11-01

## Implemented on `main`

- `7a28894` — courtyard tile field now uses two `THREE.InstancedMesh` batches instead of hundreds of individual tile meshes. This is a draw-call reduction only; actual frame-rate impact still needs browser profiling.
- `3a6f2cc` — replaced the flat eave strips with two curved roof surfaces, raised corner profiles, low-count longitudinal tile seams, a ridge cap and end finials. Procedural geometry only; it is not a scanned or authored temple asset.
- `07621a3` — shortened the roof surface to the rear half and moved the ridge cap so the fixed +Z camera has an open sightline into the main hall. This is a camera-occlusion precaution; visual confirmation is still pending.
- `4a69b83` — recorded a 10th-century Thai seated Buddha scan listed as CC0 in the Artheon collection as a candidate only; its individual record, file and visual suitability remain to be checked.
- `7a28894` — added a rear altar screen with red lacquer panels, gold framing, lattice relief and a central medallion to give the Buddha focal plane more depth.
- `4a077fe` — expanded the asset inventory with an East Asian ceremonial hall candidate pack and Buddhist sculpture scan collection. Both remain candidates, not integrated runtime assets.
- `d309611` — added CI source guards for the instanced courtyard and altar screen.
- `3ccaefa` — added CI source guards for the curved roof geometry.
- `8867574` — added CI source guards for the open near-side roof/camera sightline.

## Preserved requirements

- Three.js remains opt-in via `?3d=1`; 2D remains the fallback.
- Existing camera position and fixed elevated main-hall composition are unchanged.
- The separate camera director still selects one subtle preset at ritual start and returns to the master view; gifts do not direct the camera.
- Gift/gameplay event handling and ritual state machine were not changed by this implementation.

## Not yet verified

- No third-party GLB has been downloaded, vendored, or loaded by the runtime.
- No actual browser screenshot or WebGL visual inspection has been performed for these latest changes.
- No mobile GPU/frame-time/draw-call profile has been recorded.
- No real TikTok LIVE payload test has been performed.
- The GitHub workflow wrapper available here only returns PR-triggered runs for a commit; it returned an empty list for the push commit. Check the repository Actions page for the push-triggered CI result.

## Next work

1. Visually inspect the open-roof sightline and curved roof from the fixed elevated camera.
2. Inspect the individual Thai seated Buddha CC0 record and file; integrate only after pose, license, scale and texture checks.
3. Replace the primitive Buddha blockout with a reviewed, correctly licensed seated Buddha GLB or a higher-quality custom model.
4. Replace the placeholder devotees with a rigged, respectful lay-devotee model while preserving the existing ritual timings and animation events.
5. Add asset loading failure handling and performance budgets, then perform actual browser/device validation.
