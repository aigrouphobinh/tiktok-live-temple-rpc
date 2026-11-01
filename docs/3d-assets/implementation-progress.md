# 3D Sanctuary Implementation Progress

Updated: 2026-11-01

## Implemented on `main`

- `7a28894` — courtyard tile field now uses two `THREE.InstancedMesh` batches instead of hundreds of individual tile meshes. This is a draw-call reduction only; actual frame-rate impact still needs browser profiling.
- `3a6f2cc` — replaced the flat eave strips with two curved roof surfaces, raised corner profiles, low-count longitudinal tile seams, a ridge cap and end finials. Procedural geometry only; it is not a scanned or authored temple asset.
- `07621a3` — shortened the roof surface to the rear half and moved the ridge cap so the fixed +Z camera has an open sightline into the main hall. This is a camera-occlusion precaution; visual confirmation is still pending.
- `71bcdb9` — moved roof boundary constants into the outer scope so ridge/finial construction can reference them safely.
- `99b07f3` — added a separate foreground offering table with bronze incense vessel and sticks, paired lotus vases, fruit offerings and butter-lamp flames. Procedural meshes; no external assets.
- `0cb53cb` — added two soft altar spotlights, a warm fill light, and subtle animated candle/altar glow. Spotlights do not cast shadows to avoid extra mobile GPU shadow passes.
- `8381713` — added 3D world-space gift reactions: rocket projectile and explosion sparks, flying green dragon/gust, spinning donut with ring trail, and rising rose bloom/petals. Existing 2D gift effects and audio remain intact; no camera movement is added.
- `f05d61c`–`2bb7c0f` — corrected the idle-altar gift path: a gift now owns the state-machine effect lifecycle even when no devotee is active, and a dedicated `temple:gift-action` event drives the 3D reaction exactly once when each effect starts (including queued effects). The character-interruption event remains reserved for actual devotee interruptions.
- `4a69b83` — recorded a 10th-century Thai seated Buddha scan listed as CC0 in the Artheon collection as a candidate only; its individual record, file and visual suitability remain to be checked.
- `7a28894` — added a rear altar screen with red lacquer panels, gold framing, lattice relief and a central medallion to give the Buddha focal plane more depth.
- `4a077fe` — expanded the asset inventory with an East Asian ceremonial hall candidate pack and Buddhist sculpture scan collection. Both remain candidates, not integrated runtime assets.
- `d309611` — added CI source guards for the instanced courtyard and altar screen.
- `3ccaefa` — added CI source guards for the curved roof geometry.
- `8867574` — added CI source guards for the open near-side roof/camera sightline.
- `5c2153b` — added a CI scope-order guard for roof boundary constants before ridge construction.
- `eafcd62` — added CI source guards for the offering table, incense vessel and lotus vases.
- `606039c` — added CI source guards for altar spotlights and candle flicker.
- `99c7feb` — added CI source guards for all four 3D gift actions and the interruption-event bridge.

## Animated animal devotee integration

- Added a Three.js import map pinned to the same r180.0 build used by the 3D scene, plus the matching GLTFLoader and SkeletonUtils addons.
- The 3D congregation now creates eight animal anchor positions instead of eighteen rough human-shaped placeholders. Corgi is the lead visitor; Duck is used as a secondary variant when its GLB loads.
- The active ritual visitor uses the same rigged Corgi (Duck fallback) and switches between the named `walk` and `idle` clips. Each skinned copy is cloned with SkeletonUtils and normalized to the fixed elevated 9:16 camera scale.
- The primitive figures remain as graceful local fallbacks if either bundled model fails to load. The scene does not wait for the local assets before becoming ready.
- Corgi and Duck GLBs are now vendored under `public/assets/animals/` and served by the game's own static server; the game no longer contacts Gobkit at runtime. Their CC0 1.0 licence and source provenance are included alongside the assets. No browser/WebGL visual inspection has been performed in this environment.

## Character art direction and asset shortlist

- User direction (2026-11-01): character models must look attractive and polished; if a suitable attractive humanoid cannot be found, prefer cute animal characters rather than plain/rough placeholder humans.
- Preferred fallback direction: a cohesive, soft-looking, stylized animal cast with expressive silhouettes and readable colors, sized for the fixed elevated 9:16 temple camera. Keep the Buddha/statue and temple architecture dignified; cute animals are visitor/devotee characters, not replacements for the sacred focal statue.
- First shortlist to preview: Corgi and Duck from Gobkit Animal Pack Vol.1; Koala and Chick from Animal Pack Vol.5. Choose one lead devotee plus a small set of visually consistent variants only after inspecting the actual GLB previews in the game camera.
- Gobkit's free animal packs are advertised as rigged animated GLB under CC0 1.0, with named idle/attack/dead/walk clips; walk is available for the Animal packs. Verify the individual downloaded file and included licence before vendoring. Prefer downloading and bundling the selected GLB locally rather than depending on a runtime third-party URL.
- Corgi and Duck are integrated and bundled locally. The shortlist still contains unreviewed alternates (Koala and Chick); visual approval in the live game camera remains outstanding.

## Preserved requirements

- Three.js remains opt-in via `?3d=1`; 2D remains the fallback.
- Existing camera position and fixed elevated main-hall composition are unchanged.
- The separate camera director still selects one subtle preset at ritual start and returns to the master view; gifts do not direct the camera.
- Gift priority, coalescing, and the bounded effect queue remain intact. The 3D scene listens to the dedicated `temple:gift-action` lifecycle event; camera/character interruption remains separate and is emitted only when a devotee was actually active.

## Not yet verified

- Corgi and Duck are bundled locally; external asset-host availability is no longer a runtime dependency.
- No actual browser screenshot or WebGL visual inspection has been performed for these latest changes.
- No mobile GPU/frame-time/draw-call profile has been recorded.
- No real TikTok LIVE payload test has been performed.
- The GitHub workflow wrapper available here only returns PR-triggered runs for a commit; it returned an empty list for the push commit. Check the repository Actions page for the push-triggered CI result.

## Next work

1. Visually inspect the open-roof sightline, curved roof, offering props and layered altar lighting from the fixed elevated camera.
2. Inspect the individual Thai seated Buddha CC0 record and file; integrate only after pose, license, scale and texture checks.
3. Replace the primitive Buddha blockout with a reviewed, correctly licensed seated Buddha GLB or a higher-quality custom model.
4. Inspect Corgi and Duck in the actual fixed 9:16 browser camera; tune their scale, spacing and animation transitions, verify the local GLBs in the actual fixed 9:16 browser camera and tune their scale, spacing and animation transitions.
5. Add asset loading failure handling and performance budgets, then perform actual browser/device validation.
6. Verify 3D gift reaction timing and composition in-browser alongside the existing CSS effects; tune depth/scale only after visual inspection.
7. Test rocket, dragon, donut and rose payloads both with an active devotee and with an empty altar; confirm one 3D reaction per started effect and no camera movement.
