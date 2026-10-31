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

### Single-camera ritual director — implementation checkpoint
- Added `public/js/camera-controller.js` and loaded it after the optional Three.js module.
- The controller creates one shared `.temple-camera-rig` around the existing 9:16 stage content; the outer 1080x1920 stage and OBS crop remain fixed.
- It activates only with `?3d=1` and only after Three.js signals WebGL readiness. If Three.js import/boot fails or the WebGL context is lost, the rig returns to the original static transform.
- On the first `burnIncense` event, it randomly selects one of three very small pan/tilt framing presets and locks that same preset. Further incense events extend the shot duration without selecting another angle. No gift event changes the camera and no per-viewer camera is created.
- Added `temple:3d-ready` / `temple:3d-unavailable` signals in `temple-3d.js`; added fixed-size camera rig styling and perspective to `live.css`.
- Camera implementation is an intentionally restrained framing/orientation variation of the same scene, not a cut to another camera. Visual judgement and OBS crop/FPS testing remain outstanding.
- Verified source changes were committed to the existing feature branch through GitHub; no merge was performed.

### Gift interruption prototype — implementation checkpoint
- Added `public/js/gift-action-engine.js` for Rocket and Donut/Doughnut display-name aliases. It only interrupts while an incense animation is active, targets the existing central devotee, and leaves the camera untouched.
- Rocket: same-scene projectile + impact cue + short knockback animation. Donut: same-scene moving prop + devotee chase animation.
- Updated `live.js` so these two actions cancel the current prostration pose timers and do not immediately restart the default gift walk animation.
- Updated `server.js` to preserve the TikTok connector's original `giftId` in the `temple.event` payload. The ID is not guessed or mapped yet; actual live payloads must verify names and IDs.
- Added `docs/GIFT_GAMEPLAY_DESIGN.md` with tier priorities, timing targets, target identity rules, queue/state-machine plan and acceptance checks.
- Important limitation: current Rocket/Donut handling is **visual-only**. Server merit, incense totals, leaderboard accounting and real cooldown/requeue logic are unchanged. Do not represent this prototype as cancelling server rewards.
- No browser, TikTok LIVE or OBS runtime test has been performed. Syntax/integration checks and real gift-name verification remain required.

### Character state machine + priority queue — implementation checkpoint
- Added `public/js/character-state-machine.js`: deterministic state transitions, one active central devotee, FIFO queue capped at 40, interrupted devotee reinserted at the front, and priority-sorted gift effect queue.
- Added `tests/character-state-machine.test.js` with coverage for exclusive ownership/FIFO, APPROACHING → OFFERING → BOWING transitions, interruption/requeue, Rocket superseding Donut, lower-priority effect queue and queue capacity.
- Updated `public/js/gift-action-engine.js` to serialize incense, prayer, gift, grand ceremony, bell and fortune visits through one character owner. It schedules the existing 7.6-second bow flow and a longer 18-second fortune slot; Rocket/Donut interruptions cancel current pose timers, run the effect, apply a short cooldown, then resume the interrupted devotee.
- Updated `live.js` so queued events start only when the controller dispatches `temple:character-start`; bell and fortune no longer replace an active devotee's identity.
- Camera rig now excludes the top HUD, bottom HUD, grand-ceremony banner and fortune modal. The shared scene layers transform together beneath those fixed overlays.
- Added `bun test` script. The state-machine logic was also exercised with Node's built-in test runner in this environment: 7 transition/queue/priority scenarios passed; Bun itself is not installed in this runtime, so the repository's exact `bun test` command has not been executed here.
- Scope remains visual-only: server merit, donation totals and leaderboard values are not cancelled or rolled back by gift interruptions. Real TikTok LIVE/OBS/browser tests are still outstanding.

### Dragon tier visual action
- Added a same-scene Dragon/Rồng fly-through with wind gust and a short devotee knockback animation.
- Gift effect priority now follows Rocket (100) > Dragon (80) > Donut (60); a stronger incoming effect supersedes a weaker active effect, while weaker effects wait in the bounded priority queue.
- Display-name matching includes Rocket/Tên Lửa, Dragon/Rồng and Donut/Doughnut. These aliases still require confirmation against actual TikTok LIVE gift payloads; no numeric gift IDs are hardcoded.

### Camera lifecycle integration correction
- Camera variation now begins on `temple:character-start`, not the raw incoming event. A queued incense visitor therefore cannot move the camera before taking ownership of the central character.
- An interrupted incense ritual eases back to the master overview but retains its selected preset; when that same devotee resumes, the same preset is reused. On successful completion, the preset is cleared so the next incense ritual can select a new variation.
- Top/bottom HUD, ceremony banner and fortune modal remain outside the transformed scene rig. The camera rig is below those fixed overlays in the stage stacking order.
- The scene camera hold is aligned with the 7.6-second standard character slot; character completion/interruption events drive the return rather than per-frame rerolls.

### Final integration pass — event ownership and priority VFX
- Immediate and queued character starts now use the same `temple:character-start` event. The engine dispatches it only after acquiring the single-character slot; `live.js` owns the corresponding animation.
- Camera variation now listens to this ownership event, so queued incense events cannot prematurely move the camera. Interrupted incense returns to master and resumes with its original locked preset; completed incense clears the preset.
- Added active-effect cleanup so a stronger gift cancels the weaker gift's running DOM animations before taking over.
- Added Dragon/Rồng fly-through and wind-knockback VFX. Active priority is Rocket > Dragon/Rồng > Donut/Doughnut.
- Serialized bell and fortune character actions through the same queue; fortune uses an 18-second slot for narration/modal playback.
- Added GitHub Actions workflow `.github/workflows/tests.yml` to run `bun test` on branch pushes and pull requests.
- Remaining validation: confirm real gift display names/IDs from a live TikTok room; run Bun CI; test visual alignment, 9:16 crop and FPS in browser/OBS.

### Gift payload integrity correction
- Removed the synthetic `'rose'` fallback from TikTok `giftId` extraction. The connector's top-level `giftId` or nested `gift.id` is preserved when present; when neither exists, the payload now carries an empty string instead of a fabricated identifier.
- This is a data-integrity correction only; it does not change gift-name matching, coin/merit calculation, or visual priority behavior.
- Real TikTok LIVE payload verification is still required before assigning production gift IDs or broadening display-name aliases.
- Added a structured `[TikTok Gift Payload]` server log with the received gift ID (or `null` when absent), raw display name, diamond count, combo delta and calculated total coins. Use these observed LIVE values to verify Rocket/Dragon/Donut aliases before any production mapping; do not share session cookies or credentials when providing logs.
