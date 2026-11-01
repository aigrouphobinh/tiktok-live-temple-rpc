# 3D Sanctuary Asset Inventory

Status: research inventory only. No third-party model has been downloaded or integrated by this document.

## Visual direction

Build a Vietnamese / East Asian Buddhist main hall, not a generic fantasy temple. Preserve the existing portrait 9:16 composition and fixed elevated view into the main sanctuary. The Buddha and altar remain the visual focal point; the roof silhouette, timber columns, tiled eaves, red/gold details, incense smoke and lotus offerings establish the setting.

## Candidate assets with a verified public-domain statement

| Role | Candidate | Format / published size | License evidence | Decision |
|---|---|---|---|---|
| Exterior reference / optional distant silhouette | [Buddhist temple pagoda (Innerscene)](https://www.innerscene.com/tools/library/3d-parts/buddhist-temple-pagoda-c5ebacdc) | GLB, 17.9 MB | Page states CC0; five-storey timber pagoda, tiled hip roofs and upturned corners | Candidate only. It is a pagoda tower, not the main hall/interior. Too large to ship unoptimized in the first pass. |
| Incense prop | [Incense holder with sticks (Innerscene)](https://www.innerscene.com/tools/library/3d-parts/incense-holder-with-sticks-8a694048) | GLB, 10.7 MB | Page states CC0 | Candidate only. Inspect topology/materials and reduce size before use; may be too detailed/heavy for a small altar prop. |
| Incense tray fallback | [Ash channel (Innerscene)](https://www.innerscene.com/tools/library/3d-parts/ash-channel-home-accessory-2432c06e) | GLB, 756 KB; ~2k triangles | Page states CC0 | Lightweight generic tray, not a traditional temple censer. Use only as a temporary prop or reference. |
| Surface materials / lighting | [Poly Haven](https://polyhaven.com/) | PBR textures, HDRIs and models; per-asset download options | Official license page says all assets are CC0 and allow commercial use without attribution | Preferred source for wood, stone, roof tile and environment textures. Select individual assets and appropriate resolutions; do not load 8K maps by default. |
| Generic character base (not a monk/devotee as-is) | [Kenney asset library](https://kenney.nl/assets) | Pack-dependent; some animated character packs are FBX/PNG | Kenney support says assets on its asset pages are CC0 | Only a rig/animation reference. A respectful Vietnamese lay devotee in blue/grey clothing still needs a custom skin/model and visual review. |

## Required custom models — no suitable exact model verified yet

1. Main hall interior: raised timber platform, red lacquer columns, bracket/beam structure, curved tiled roof/eaves, altar backdrop and side screens.
2. Amitabha Buddha: seated lotus posture, recognizable robe folds, calm face, urna, hands in meditation/teaching pose. Do not substitute an unrelated generic human statue.
3. Main altar: carved altar table, incense burner, candle/flower/fruit offerings and lotus pedestal.
4. Temple props: bronze bell, wooden fish, lanterns, lotus lamps and offering vessels.
5. Devotee: modest blue/grey lay Buddhist clothing, compatible with the existing ritual animation/state machine.

These should be modeled as low-poly GLB assets or built from reusable geometry and baked textures. No asset is considered approved until its source page, license, file size, visual fit, scale, and mobile rendering have been checked.

## Integration and performance gates

- Prefer GLB/glTF. Use meshopt or Draco only after confirming the deployed Three.js loader has the matching decoder configured.
- Keep the first scene download small: load the core hall and Buddha first; defer optional props and decorative details.
- Target texture sizes around 512–1024 px for small props and 1K–2K for focal surfaces; reuse material maps. Avoid loading source 4K/8K textures indiscriminately.
- Reuse geometry/materials for repeated columns, beams, lanterns and tiles; instance repeated objects where practical.
- Preserve the current camera framing. Gift effects may animate inside the scene but must not steer the camera.
- Keep HUD in HTML/CSS. Keep the current 2D renderer as the fallback and default unless the user explicitly enables 3D.
- Dispose loaded geometries, materials and textures when unloading; do not dispose shared resources while another scene object still uses them.
- Before merge/approval: verify GLB loads in the actual page, check orientation/scale/materials, test 2D fallback, inspect console/network errors, and profile draw calls, texture memory and frame rate on a mid-range device.

## Next implementation order

1. Create a compact custom main-hall blockout that visibly differs from the 2D backdrop.
2. Add the custom Amitabha focal model and altar as separate scene groups.
3. Add reusable temple props and texture pass.
4. Connect existing ritual and gift effects to scene-local anchors without changing game rules or camera policy.
5. Add automated asset manifest/load-failure tests, then do manual browser and TikTok LIVE validation.

## Source and license checks

- [Innerscene Free Parts Library terms](https://www.innerscene.com/tools/library/terms): contributions are dedicated under CC0 1.0; verify the source/status on each individual item page. The library says files may be removed after a retention period, so vendor the approved file into the repository once selected and keep a copy of the license evidence.
- [Poly Haven license](https://polyhaven.com/license): CC0; commercial use and redistribution permitted, attribution not required.
- [Kenney support / license FAQ](https://kenney.nl/support): Kenney asset pages are public-domain CC0; check the individual pack's included license file.

Research links checked 2026-11-01. This inventory is not legal advice and does not replace per-file review.
