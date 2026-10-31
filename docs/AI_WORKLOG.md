# AI Worklog — TikTok Live Temple RPC

## Repository
- Repository: https://github.com/aigrouphobinh/tiktok-live-temple-rpc
- Upstream: https://github.com/zane-tv/tiktok-live-temple-rpc
- Product: TikTok Live temple interaction game with ritual visuals and RPC-driven events.

## Goal
Add an optional free stylized 3D visual layer that stays close to the existing temple game's visual identity. Preserve the current 2D/Canvas implementation as the default and fallback.

## Non-regression requirements
- Preserve the 9:16 stage and 1080×1920 OBS Browser Source target.
- Retain the warm gold, red, bronze and wood palette, Buddhist temple atmosphere and lotus motifs.
- Do not redesign the game or alter existing RPC contracts.
- Preserve TikTok Live Connector, WebSocket behavior, TTS/audio, Canvas particles and admin panel.
- Use free dependencies and assets only; verify licenses before adding assets.
- Gate 3D behind an opt-in feature flag such as `?3d=1`; keep 2D as default until verified.
- Handle WebGL unavailable/context loss gracefully; pause rendering when hidden and cap pixel ratio.

## Existing architecture (initial source review)
- Runtime: Bun.js, Express, `ws`, `tiktok-live-connector`; Three.js was not present in the reviewed package manifest.
- Frontend entry points reviewed: `public/index.html`, `public/css/live.css`, `public/js/live.js`.
- Stage wrapper: `.stage-wrapper`; 9:16 stage: `.stage-9x16`, scaled through CSS.
- Existing visual layers include sanctuary background, Buddha halo, `#templeCanvas`, bottom HUD, incense burner, ritual hotspots, worshipper sprites, cushions, congregation, walkers, audio and particles.
- WebSocket frontend handles `temple.state`, `temple.event`, and `tts.play`.
- RPC methods observed: `temple.getState`, `temple.burnIncense`, `temple.sendPrayer`, `temple.drawFortune`, `temple.strikeWoodenFish`, `temple.ringBell`, `temple.offerGift`, `temple.grandCeremony`, `temple.updateSettings`, `temple.resetMerit`, `live.connect`, `live.disconnect`.

## Roadmap

### Phase 0 — Verify integration points
- Inspect script loading order and CSS stacking/scaling.
- Trace exact WebSocket event payloads from server to browser.
- Inspect `triggerRitualVisuals` and the server's gift/event normalization.
- Check current branch, commit history and working tree before editing.

### Phase 1 — Optional 3D foundation
- Add Three.js only if appropriate for the existing build/runtime.
- Create an isolated transparent 3D canvas/layer without replacing the current canvas.
- Build a lightweight procedural/stylized temple scene; avoid paid assets.
- Add feature flag and robust WebGL/context-loss fallback.
- Cap pixel ratio, manage resize, and pause when document is hidden.

### Phase 2 — Ritual synchronization
- Add a frontend adapter mapping existing ritual events to 3D effects.
- Keep existing state updates, audio and 2D effects intact.
- Do not change server/RPC payload contracts without a separately reviewed need.

### Phase 3 — TikTok gift effects and camera
- Map verified gift identifiers/diamond values/combo data to bounded visual effects.
- Add restrained camera presets and effects for supported gifts (e.g. Rose, Donut, Rocket) only when payload data confirms them.
- Bound queues and particle counts to protect performance.

### Phase 4 — Assets, performance and release
- Use only free assets with verified compatible licenses; record attribution.
- Test OBS Browser Source at 1080×1920 and mobile/browser fallback.
- Measure FPS, memory, reconnect behavior and WebGL recovery.
- Document enabling/disabling 3D and troubleshooting.

## Definition of done
- Existing 2D mode works unchanged when 3D is disabled or unavailable.
- 3D is opt-in and visually consistent with the original game.
- Existing RPC, TikTok events, TTS and admin behavior remain functional.
- No unlicensed/paid assets or services are introduced.
- Tests and manual checks are recorded accurately; never claim unrun tests passed.

## Instructions for future AI sessions
1. Read this file before making changes.
2. Inspect the current branch, latest commit and diff; preserve user changes.
3. Make small, reversible changes and avoid broad rewrites.
4. Verify event payloads from source before implementing effects.
5. Run relevant tests/checks and record exact outcomes.
6. Update this log with changed files, commit SHA, checks, issues and next task.
7. Do not claim code was pushed or tests passed unless confirmed.

## Session log — 2026-11-01

### Optional Three.js layer — initial implementation
- Created branch `feat/optional-threejs-ritual-layer` from `main`.
- Added `public/js/temple-3d.js`: opt-in Three.js 0.180 procedural overlay loaded from jsDelivr only when `?3d=1`; procedural lotus, incense smoke, bell waves and gift/ceremony particles; bounded effect count; visibility pause; WebGL context-loss fallback.
- Added isolated `#temple3dCanvas` at z-index 16 above the existing 2D canvas (z-index 15), below HUD (z-index 20).
- Added a `temple:ritual` browser event bridge from `triggerRitualVisuals`; no server/RPC contract changes.
- Existing 2D mode remains default. No external models, textures or paid assets added.
- Renderer now stops its animation loop when no effects are active; individual effect materials are cloned before disposal/fading.
- Opened draft PR #1: https://github.com/aigrouphobinh/tiktok-live-temple-rpc/pull/1 (not merged).
- Not yet browser/OBS tested; CDN availability and actual rendering/performance remain to be verified.
- Next: run syntax checks and browser tests; refine gift effects only against confirmed payload fields.

- Confirmed the user fork: `aigrouphobinh/tiktok-live-temple-rpc`.
- Reviewed README, package manifest, frontend HTML/CSS/JS and server entry points.
- No source files changed during the initial review.
- GitHub write operation was previously rejected with HTTP 403; user has now updated GitHub app permissions. Re-test write access before proceeding.
- Next task: verify script order, exact ritual/gift event payloads and current branch state, then implement Phase 1 only.

### Camera direction requirements — user confirmed
- Added `docs/CAMERA_DIRECTION_SPEC.md` based on the upstream OBS 9:16 demo reference.
- Camera identity must remain one continuous elevated view looking down into the main temple hall. No cuts, no switching to individual viewer/character cameras, and no gift-driven reframing.
- At the start of an incense ritual, select at most one subtle composition-safe variation at random and lock it for that ritual. Multiple viewers/gifts must not reroll or switch the camera.
- Keep the altar/incense zone visible and preserve the 1080x1920 / 9:16 OBS composition. Ease back to the master view after ritual completion/interruption.
- Gift effects animate characters/props in the same scene; camera is not the gameplay target.
- Implementation is a specification only; camera movement has not yet been coded or OBS-tested.
