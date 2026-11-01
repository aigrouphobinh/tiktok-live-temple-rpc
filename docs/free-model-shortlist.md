# Free 3D asset shortlist — temple sanctuary

This file records researched candidates only. A model is not considered integrated until its exact downloaded file, license/provenance, dimensions, materials, rig and runtime rendering have been checked.

## Buddha statue — first choice

**10th C CE Thai Seated Buddha — Minneapolis Institute of Art**
- Source page: https://sketchfab.com/3d-models/10th-c-ce-thai-seated-buddha-black-background-31857e30bf9249f788aed2dfe5eb6673
- Download mirror: https://zenodo.org/records/10242851
- Exact GLB: https://zenodo.org/records/10242851/files/31857e30bf9249f788aed2dfe5eb6673.glb?download=1
- License: CC0 / public domain.
- Reported size: 4.8 MB; about 64k triangles.
- Why: a real seated Thai Buddha scan, rather than a primitive procedural figure. Rebuild/override the bronze material as matte light-grey stone to match the approved reference; retain a separate custom carved aureole behind it.
- Integration checks: inspect orientation and origin, remove/ignore baked black background if present, normalize height, recalculate normals if needed, verify texture/material transparency, optimize mesh and confirm the GLB works with Three.js GLTFLoader.

## Human devotee — closest visual candidate

**Stylized Cute Girl Character — Asim-ali**
- Source: https://sketchfab.com/3d-models/stylized-cute-girl-character-low-poly-ready-cf4e14b0a6ae434eb143bdd72b742986
- Reported: rigged, expressive large eyes, modern outfit, ~11.6k triangles; FBX and GLB/glTF formats listed.
- License: Creative Commons Attribution (CC BY); attribution must be included in the project credits.
- Why: closest researched match to the supplied cute human-avatar reference. Inspect the downloadable GLB and animation/rig compatibility before replacing the current procedural stand-in.

## Lightweight fallback

**Female-character / Woman / Girl — Quaternius_CC0 on Pixabay**
- Source: https://pixabay.com/3d-models/female-character-woman-girl-human-809/
- Reported: GLB, textured, animated, 2,642 vertices; Pixabay Content License.
- Why: lightweight and animated, but its blockier low-poly style is less close to the supplied avatar reference. Keep as a fallback only.

## UI direction from the 2026-11-01 screenshot

- Keep the 9:16 portrait stage and fixed elevated main-hall camera.
- Shrink the footer HUD so the sanctuary remains the hero; simplify borders, shadows and ornamental pseudo-elements.
- Keep the live status pill compact and the supporter leaderboard readable.
- Do not hide gift actions or change TikTok event wiring.
- Do not alter the default 2D mode when styling the optional 3D mode.
