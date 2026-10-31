# AI Worklog — TikTok Live Temple RPC

## Repository
- Repository: https://github.com/aigrouphobinh/tiktok-live-temple-rpc
- Upstream: https://github.com/zane-tv/tiktok-live-temple-rpc
- Product: TikTok Live temple interaction game with ritual visuals and RPC-driven events.

## Goal
Add an optional free stylized 3D visual layer that stays close to the existing temple game's visual identity. Preserve the current 2D/Canvas implementation as the default and fallback.

## Non-regression requirements
- Preserve the 9:16 stage and 1080×1920 logical game stage target.
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
- Test the 1080×1920 game stage in desktop and mobile browsers.
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
- Not yet browser tested; CDN availability and actual rendering/performance remain to be verified.
- Next: run syntax checks and browser tests; refine gift effects only against confirmed payload fields.

- Confirmed the user fork: `aigrouphobinh/tiktok-live-temple-rpc`.
- Reviewed README, package manifest, frontend HTML/CSS/JS and server entry points.
- No source files changed during the initial review.
- GitHub write operation was previously rejected with HTTP 403; user has now updated GitHub app permissions. Re-test write access before proceeding.
- Next task: verify script order, exact ritual/gift event payloads and current branch state, then implement Phase 1 only.

### Camera direction requirements — user confirmed
- Added `docs/CAMERA_DIRECTION_SPEC.md` based on the upstream 9:16 demo reference.
- Camera identity must remain one continuous elevated view looking down into the main temple hall. No cuts, no switching to individual viewer/character cameras, and no gift-driven reframing.
- At the start of an incense ritual, select at most one subtle composition-safe variation at random and lock it for that ritual. Multiple viewers/gifts must not reroll or switch the camera.
- Keep the altar/incense zone visible and preserve the 1080x1920 / 9:16 9:16 composition. Ease back to the master view after ritual completion/interruption.
- Gift effects animate characters/props in the same scene; camera is not the gameplay target.
- Implementation is a specification only; camera movement has not yet been coded or runtime-tested.

### Single-camera ritual director — implementation checkpoint
- Added `public/js/camera-controller.js` and loaded it after the optional Three.js module.
- The controller creates one shared `.temple-camera-rig` around the existing 9:16 stage content; the outer 1080x1920 stage and stage bounds remain fixed.
- It activates only with `?3d=1` and only after Three.js signals WebGL readiness. If Three.js import/boot fails or the WebGL context is lost, the rig returns to the original static transform.
- On the first `burnIncense` event, it randomly selects one of three very small pan/tilt framing presets and locks that same preset. Further incense events extend the shot duration without selecting another angle. No gift event changes the camera and no per-viewer camera is created.
- Added `temple:3d-ready` / `temple:3d-unavailable` signals in `temple-3d.js`; added fixed-size camera rig styling and perspective to `live.css`.
- Camera implementation is an intentionally restrained framing/orientation variation of the same scene, not a cut to another camera. Visual judgement and stage bounds/FPS testing remain outstanding.
- Verified source changes were committed to the existing feature branch through GitHub; no merge was performed.

### Gift interruption prototype — implementation checkpoint
- Added `public/js/gift-action-engine.js` for Rocket and Donut/Doughnut display-name aliases. It only interrupts while an incense animation is active, targets the existing central devotee, and leaves the camera untouched.
- Rocket: same-scene projectile + impact cue + short knockback animation. Donut: same-scene moving prop + devotee chase animation.
- Updated `live.js` so these two actions cancel the current prostration pose timers and do not immediately restart the default gift walk animation.
- Updated `server.js` to preserve the TikTok connector's original `giftId` in the `temple.event` payload. The ID is not guessed or mapped yet; actual live payloads must verify names and IDs.
- Added `docs/GIFT_GAMEPLAY_DESIGN.md` with tier priorities, timing targets, target identity rules, queue/state-machine plan and acceptance checks.
- Important limitation: current Rocket/Donut handling is **visual-only**. Server merit, incense totals, leaderboard accounting and real cooldown/requeue logic are unchanged. Do not represent this prototype as cancelling server rewards.
- No browser, TikTok LIVE or runtime test has been performed. Syntax/integration checks and real gift-name verification remain required.

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
- Remaining validation: confirm real gift display names/IDs from a live TikTok room; run Bun CI; test visual alignment, 9:16 crop and FPS in browser.

### Gift payload integrity correction
- Removed the synthetic `'rose'` fallback from TikTok `giftId` extraction. The connector's top-level `giftId` or nested `gift.id` is preserved when present; when neither exists, the payload now carries an empty string instead of a fabricated identifier.
- This is a data-integrity correction only; it does not change gift-name matching, coin/merit calculation, or visual priority behavior.
- Real TikTok LIVE payload verification is still required before assigning production gift IDs or broadening display-name aliases.
- Added a structured `[TikTok Gift Payload]` server log with the received gift ID (or `null` when absent), raw display name, diamond count, combo delta and calculated total coins. Use these observed LIVE values to verify Rocket/Dragon/Donut aliases before any production mapping; do not share session cookies or credentials when providing logs.

### TikTok gift payload compatibility + streak accounting
- Added `lib/tiktok-gift-payload.cjs` to normalize both documented `giftDetails.giftName/giftType` payloads and newer `gift.name/type` plus `extendedGiftInfo` metadata. Missing gift IDs remain empty; no synthetic ID/name is assigned.
- Added a stable fallback combo key using sender + gift ID or gift name when TikTok omits `groupId`, preventing unrelated gifts from the same sender from sharing one empty-ID tracker key.
- Combo delta handling now distinguishes streakable gifts (`giftType/type === 1`) from non-streakable gifts. Cumulative streak updates are converted to deltas, and final `repeatEnd` frames clear tracker state so the next combo starts from zero.
- Added Bun tests for both payload shapes, missing IDs, fallback combo keys, cumulative streak deltas, final-frame cleanup and non-streakable gifts.
- Validation still pending on the actual LIVE room; do not map numeric IDs until observed payloads confirm them.
- GitHub Actions run `41252880599` on commit `4e5e37f` completed successfully: all 12 Bun tests passed (7 character-state-machine + 5 gift payload/streak tests). Added server/helper `node --check` to CI so the next run also validates CommonJS syntax.


### Main integration checkpoint — 2026-11-01
- PR #1 was changed from draft to ready and squash-merged into `main` at merge commit `f74f9e0284df19a0bc27d2373c809e6f5681d8ab`.
- Feature head merged: `386acf6913c9f44f151ec7a429ccbc2a0f0c2f91`.
- The feature-head GitHub Actions run `41252916384` completed with conclusion `success`; the workflow ran Bun tests and server/helper syntax checks. This is the 12-test CI validation before merge.
- No Actions run was returned for the squash merge commit at the time of this update; do not claim post-merge CI passed until a run is observed.
- Remaining release blockers: run the app in a browser with 3D off/on; verify camera/character/gift visuals and 1080x1920 stage bounds; measure FPS/memory and WebGL fallback; connect to an actual TikTok LIVE room and inspect sanitized gift payload logs for Rocket/Dragon/Donut names/IDs and combo frames.
- Do not invent gift IDs or expand aliases before live payload evidence. Gift interruptions remain visual-only and must not be described as rolling back server merit/donation/leaderboard accounting.
- Project status: **MERGED, VALIDATION INCOMPLETE — NOT DONE**. Continue from `main`; record each manual test result here before marking the project done.


### Game-only scope clarification — 2026-11-01
- External broadcast/capture software is outside this repository's acceptance criteria. Do not create, run, or block game tasks on OBS setup or validation.
- Acceptance scope is the game itself: browser rendering, character/ritual logic, gift interactions, camera behavior inside the game, audio, VFX, TikTok payload handling, queue correctness, performance, and 2D/3D fallback.

### Gift audio + rocket impact VFX — implementation checkpoint
- Updated `public/js/audio.js` with synthesized Web Audio effects: rocket launch/flight, low-frequency explosion impact, dragon whoosh, and a three-note playful donut cue. No external sound files or paid assets were added.
- Updated `public/js/gift-action-engine.js` to emit a dedicated `temple:gift-sfx` event, trigger rocket launch and impact sounds at their animation beats, and add an expanding shockwave ring plus 18 outward sparks to the rocket impact. Existing character knockback remains in place.
- Updated `public/js/live.js` to route gift sound events through the shared audio engine, preserving the browser audio-unlock path and `sfxEnabled` guard.
- These are synthesized prototype SFX, not recorded cinematic sound assets. They have not yet been listened to in a browser; balance, clipping, overlap, and mobile autoplay behavior remain unverified.
- No syntax/unit/browser runtime validation has yet been run for these three latest commits.

### Remaining game implementation backlog
- [x] Add a persisted SFX master toggle and independent SFX volume control routed through a shared Web Audio gain node.
- [x] Improve Rocket VFX with a procedural exhaust trail, impact flash, shockwave, smoke puffs and debris; align impact origin to the projectile's final stage position.
- [ ] Replace emoji placeholders for Rocket, Dragon and Donut with consistent free/licensed or procedural game-style assets.
- [ ] Add Dragon impact/roar layer and Donut movement/chase polish; verify no effects overlap the altar, Buddha, HUD, or central devotee incorrectly.
- [x] Add display-name based Rose/hoa hồng action with petal VFX and a soft chime; numeric gift ID remains unassigned pending real LIVE evidence.
- [ ] Add Heart/Butterfly and other lower-tier behaviors only after exact display names are observed.
- [x] Forward TikTok combo metadata into game events and coalesce repeated streak frames into one cinematic with lightweight combo pulses.
- [ ] Validate streak coalescing against real TikTok LIVE combo frames and verify a new streak can trigger a fresh effect.
- [ ] Add tests for gift action selection, priority replacement, effect cleanup, SFX dispatch, and queue recovery after supersession.
- [ ] Validate audio unlock, SFX/music/TTS mixing, clipping, sound overlap, and browser autoplay behavior.
- [ ] Validate 2D fallback, optional 3D overlay, stage layering, resize behavior, FPS, memory, and long-running stability in an actual browser.
- [ ] Validate real TikTok LIVE Rocket/Dragon/Donut IDs, names, diamond values, repeatCount/repeatEnd, and reconnect behavior using sanitized logs.
- [ ] Audit all remaining game flows: comments, likes, follows, shares, fortune, bell, wooden fish, prayer, grand ceremony, admin controls, TTS queue, and reconnect recovery.
- Project remains **IN PROGRESS — NOT DONE** until code checks and game runtime checks above are completed.


### Gameplay controls, rocket polish, Rose and combo handling — 2026-11-01
- Added persistent SFX enable/disable and independent SFX volume (default 80%) in the quick dock. All synthesized ritual and gift SFX now route through a shared Web Audio gain node; music and TTS remain independently controlled.
- Rocket exhaust now emits lightweight procedural flame particles; impact uses a flash, expanding shockwave, smoke puffs, debris and sparks. Impact coordinates now match the projectile's final position in the 1080×1920 stage.
- Added Rose/hoa hồng gameplay action with a soft three-note chime, rose bloom and floating petals. It uses the existing lowest gift priority; no numeric gift ID is invented.
- TikTok combo group, delta, repeat count/end and streakable metadata now pass through the game event. Incremental streak frames for the same streakable gift group are coalesced into one cinematic and represented by a small combo pulse, avoiding repeated full explosions.
- Added a priority test for Rose < Donut < Dragon < Rocket.
- Parsed the updated server, audio, live, gift-action, character-state-machine and test JavaScript sources with V8 syntax compilation successfully. This is a syntax check only, not an execution of Bun tests or a browser runtime test.
- Validation still required: execute CI, inspect audio mix and visuals in a browser, and validate actual connector combo payloads.


### Dragon roar and impact cue — 2026-11-01
- Added a synthesized low-register Dragon roar layered after the fly-through begins, routed through the independent SFX gain control.
- Added a same-scene expanding impact ring at the Dragon gust/knockback beat. A stale delayed callback is ignored if a higher-priority gift supersedes the Dragon before impact.
- Sound is procedural and still requires listening/mix verification in a real browser.


### Latest source verification — 2026-11-01
- V8 syntax compilation passed for `server.js`, `public/js/audio.js`, `public/js/live.js`, `public/js/gift-action-engine.js`, and the character state machine/test source.
- Executed focused in-memory assertions for gift priority (Rose < Donut < Dragon < Rocket) and TikTok combo delta normalization; assertions passed.
- Added Dragon roar/impact and avoided stacking the generic bell/chime on top of special gift-action SFX.
- GitHub combined status currently reports no check runs for the latest direct-to-main commits. Do not describe CI as passed; the Bun test workflow has not been confirmed on this commit.
- Browser gameplay, actual audio listening/mix, WebGL performance and real TikTok LIVE payload validation remain outstanding.


### Combo final-frame deduplication fix — 2026-11-01
- Fixed the browser gift-action coalescer to clear a streak key when the connector marks its final frame with `giftRepeatEnd`.
- The final frame still contributes its incremental gift/reward on the server (the server already ignores zero-delta duplicate final frames); only its repeated cinematic is coalesced.
- Clearing the key on the final frame prevents a new streak that reuses the same group identity within five seconds from being incorrectly swallowed as a duplicate of the previous streak.
- Added a payload-helper regression test for a final frame that adds one last gift, clears tracker state, and then starts a fresh streak from count 1.
- Code and test are committed directly to `main`. CI/browser runtime validation is still pending; project remains **IN PROGRESS — NOT DONE**.
