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

## Session update — 2026-11-01 (scene texture disposal)
- CI confirmed PASS for shoulder contour regression fix (`c3619ec`).
- Added `disposeThreeSceneResources` for full-scene teardown. It deduplicates textures referenced by material properties, disposes them once, and reuses the existing geometry/material cleanup. Transient effects keep using `disposeThreeObjectTree` so shared scene textures are not accidentally released early.
- Wired full WebGL scene cleanup (pagehide/context loss) to dispose scene textures, including the shared procedural stone bump texture and GLB material maps.
- Added regression coverage for shared texture deduplication and invalid roots.
- Validation: pending CI workflow.

## Session update — 2026-11-01 (GPU diagnostics)
- Added opt-in renderer diagnostics at `?3d=1&stats=1`: every five seconds logs draw calls, triangles, geometry/texture counts, active transient effects and pixel ratio.
- Diagnostics use Three.js `renderer.info` and are completely disabled in normal sessions; no overlay, dependency, timer or per-frame console output is added.
- Added regression coverage for the query flag, reported metrics and sampling interval.
- Validation: pending CI workflow. Browser GPU measurements still require running the scene on the target machine.

## Session update — 2026-11-01 (shared primitive geometry)
- Confirmed all three GPU diagnostics workflow runs passed (`a320630`, `72a0769`, `31bf24d`).
- Cached immutable BoxGeometry, CylinderGeometry, SphereGeometry and PlaneGeometry in the scene's primitive helpers, keyed by exact dimensions/segments. Repeated meshes now share GPU geometry buffers while retaining their own transforms, materials and shadow flags.
- Full scene teardown already deduplicates geometries, so shared resources are disposed once.
- Added regression checks for all four cache keys. No geometry dimensions or visual placement changed.
- Validation: pending CI. Browser draw-call and GPU memory measurements still require target-device logs.

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
- [x] Replace emoji placeholders for Rocket, Dragon and Donut with procedural CSS game-style sprites (source implemented; browser appearance still requires verification).
- [x] Add Dragon impact/roar layer (source implemented; browser listening/visual validation remains open).
- [ ] Polish Donut movement/chase and verify no gift effects overlap the altar, Buddha, HUD, or central devotee incorrectly.
- [x] Add display-name based Rose/hoa hồng action with petal VFX and a soft chime; numeric gift ID remains unassigned pending real LIVE evidence.
- [ ] Add Heart/Butterfly and other lower-tier behaviors only after exact display names are observed.
- [x] Forward TikTok combo metadata into game events and coalesce repeated streak frames into one cinematic with lightweight combo pulses.
- [ ] Validate streak coalescing against real TikTok LIVE combo frames and verify a new streak can trigger a fresh effect.
- [x] Add automated tests for gift action selection, priority replacement and interrupted-character queue recovery; add bounded combo coalescer regression coverage.
- [x] Add unit tests for gift effect lifecycle cleanup and SFX dispatch; browser DOM integration and runtime verification remain open.
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


### Procedural Rocket and Donut sprites — 2026-11-01
- Replaced the Rocket and Donut emoji glyphs in the gift-action engine with CSS-drawn sprites. Rocket now has a shaded body, cockpit and fins; Donut uses a frosted ring, baked edge and sprinkle details.
- Kept both sprites lightweight and self-contained in `public/css/live.css`; no image downloads, external assets, paid resources or new dependencies.
- Existing Web Animations still move/rotate/scale the same sprite elements, so gift timing, priority and server reward accounting are unchanged.
- Dragon remains an emoji placeholder and is still on the asset-polish backlog.
- Committed directly to `main`. Browser visual inspection, mobile crop and performance checks have not yet been run.


### Procedural Dragon sprite — 2026-11-01
- Replaced the Dragon/Rồng emoji placeholder with a lightweight CSS-drawn eastern dragon sprite: curved scaled body, green/gold palette, head and crest details.
- Kept the existing fly-through Web Animation, 3.1-second duration, wind gust, delayed roar/impact cue, character knockback, gift priority and server reward handling unchanged.
- Sprite uses CSS pseudo-elements only; no external image, model, font or dependency was added.
- Source-level checks confirmed the Dragon action no longer injects the emoji, both sprite pseudo-elements exist, Rocket/Donut procedural styles remain, and the existing Dragon impact/timing hooks remain present. JavaScript parsed successfully with V8 syntax compilation.
- Not yet visually/browser verified; confirm silhouette quality, orientation, layering, stage clipping, mobile crop and performance in the actual game before marking the sprite task complete.


### Gift effect queue regression coverage — 2026-11-01
- Added state-machine tests for recovery of the interrupted devotee after multiple gift supersessions (Donut → Dragon → Rocket), bounded gift-effect queue overflow, and rejection of unknown gift actions without changing character ownership.
- These tests cover state-machine behavior only; they do not yet exercise DOM animation cancellation, SFX event dispatch or real TikTok payload delivery.
- The test source is committed directly to `main`. Await/inspect the GitHub Actions run before claiming the expanded suite passes.
- Dragon procedural sprite source is in place, but actual browser appearance, layer overlap and mobile crop remain unverified.


### Gift display-name resolver extraction — 2026-11-01
- Extracted gift-name normalization and visual action mapping into `public/js/gift-action-rules.js`; the browser gift engine now imports the pure resolver instead of keeping matching rules inside its DOM IIFE.
- Added `tests/gift-action-rules.test.js` for English/Vietnamese aliases (Rocket/Tên Lửa, Dragon/Rồng, Donut/Doughnut, Rose/Hoa Hồng), accent/case normalization, unknown/missing values and partial-word false positives.
- This is display-name-only visual routing. It does not assign numeric TikTok gift IDs, alter coin/merit accounting, or change server reward behavior.
- Files committed directly to `main`. Re-run the repository Bun test workflow and inspect the Actions result; no test pass is claimed until the run is observed.
- Runtime validation remains outstanding for actual TikTok LIVE display names, combo frames, animation cancellation, sound mix and browser rendering.


### Gift action resolver source verification — 2026-11-01
- Confirmed the new resolver and browser engine/test files parse with V8 syntax compilation after removing module import/export declarations for the syntax-only check.
- Ran 11 in-memory resolver cases covering all eight intended aliases plus unknown/partial-word rejection; all 11 matched expected routing. This is a focused assertion, not execution of the Bun test runner.
- Confirmed the GitHub Actions workflow is configured for all branch pushes and runs `bun test`; the latest commit combined status returned no status entries yet. Do not claim CI passed until an Actions run/check appears.
- Updated the sprite backlog checkbox to reflect that Rocket, Dragon and Donut source sprites are implemented; visual/browser validation remains open.


### Gift streak coalescer extraction — 2026-11-01
- Extracted cumulative TikTok combo-frame deduplication into `public/js/gift-streak-coalescer.js`; the browser gift engine now delegates streak tracking to this pure bounded helper.
- Added focused Bun tests for first/subsequent frames, independent group IDs, non-streakable/missing IDs, TTL expiry, final-frame cleanup, fresh streak reuse, capacity eviction, explicit clearing and timestamp-zero handling.
- Preserved the existing 5-second TTL and 200-group cap. The helper only controls repeated visual effects; server-side gift/reward accounting is unchanged.
- Validation for this checkpoint: source-level integration and GitHub Actions execution are pending; do not claim Bun tests or browser LIVE behavior passed until observed.


### Optional 3D combo visual deduplication — 2026-11-01
- Moved the optional `temple:ritual` 3D bridge dispatch after the gift-action engine evaluates the event.
- Coalesced TikTok streak frames no longer replay optional Three.js lotus/gift particles for every incremental frame; the first frame still triggers the full 3D effect.
- Incremental server merit/reward display and the lightweight 2D combo pulse remain intact. No RPC or TikTok connector payload changes.
- Source integration reviewed; GitHub Actions validation is pending for this follow-up commit. Browser verification with `?3d=1` remains outstanding.


### Latest CI and backlog reconciliation — 2026-11-01
- GitHub Actions run `41255128195` completed with conclusion `success` on the current `main` commit `a1db6784cca235348833356f95a71b0b349b94de`; the workflow's Bun unit-test step and server-side JavaScript syntax-check step both succeeded.
- GitHub Actions run `41255125379` also completed successfully for the optional 3D combo deduplication code commit.
- Reconciled the backlog: Dragon roar/impact source implementation and automated gift-action/priority/queue/coalescer coverage are now marked implemented; Donut chase polish, DOM cleanup/SFX-dispatch tests and all browser/live runtime checks remain open.
- CI success does not replace manual browser, audio, performance or actual TikTok LIVE acceptance testing.

### Gift SFX routing isolation — implementation checkpoint
- Extracted the six supported gift sound routes into `public/js/gift-sfx-dispatcher.js`; the live controller now delegates to this allowlisted dispatcher instead of maintaining an inline conditional chain.
- Added `tests/gift-sfx-dispatcher.test.js`: verifies all six routes, the explosion intensity argument, unknown event rejection, and safe handling of missing audio methods/engine.
- This is source-level regression coverage only. Browser audio output, autoplay unlock, volume toggle, and mix balance remain unverified.
### Gift VFX lifecycle cleanup — implementation checkpoint
- Extracted transient effect ownership into `public/js/gift-effect-registry.js`; the gift engine delegates animation completion, cancellation, and element removal to this registry.
- Clearing an effect batch cancels tracked Web Animations and removes each owned DOM node immediately; natural completion removes its node and releases the registry entry.
- Added `tests/gift-effect-registry.test.js` for natural completion, batch cancellation/removal, invalid registrations, and repeated empty clears.
- Unit-level lifecycle coverage only; browser DOM integration, interrupted animation visuals, and long-running heap stability still require browser verification.
### Donut chase movement polish — implementation checkpoint
- Reworked the Donut flight into a multi-beat zig-zag arc with staged scale/rotation and a controlled exit path in the upper-middle scene lane.
- Reduced the devotee reaction from a large 300px lateral sweep to a short sidestep/hop sequence to reduce the risk of crossing altar/scene props.
- Source-level choreography only; actual sprite bounds, overlap with Buddha/altar/HUD, camera framing and mobile rendering still require browser validation.
### Gift action character-animation ownership — 2026-11-01
- Fixed an interruption edge case: when a new gift action supersedes an in-flight action, the previous central-character Web Animation is now cancelled immediately before dispatching the new action.
- This also covers incoming actions without their own character motion (notably Rose), preventing a previous Rocket/Dragon/Donut movement from continuing underneath the new effect.
- Source change reviewed; no browser animation assertion or real TikTok LIVE run is claimed. Verify rapid gift supersession and character pose recovery in-browser.
### Gift priority queue ordering regression tests — 2026-11-01
- Added deterministic state-machine tests proving equal-priority gifts do not supersede the active effect and are replayed in arrival order.
- Added coverage that queued effects are ordered by descending priority while preserving FIFO order within each priority tier.
- These tests exercise the pure state machine only; Bun execution/CI and browser timing behavior are not claimed until observed.

### Priority-aware gift queue overflow — 2026-11-01
- Fixed a bounded-queue edge case: when the waiting gift-effect queue is full, a newly arriving stronger gift now replaces the lowest-priority waiting effect instead of being rejected behind weaker queued work.
- Equal-priority arrivals remain FIFO; lower/equal-priority arrivals are still rejected when the queue is full. The currently playing effect is never displaced by this overflow rule.
- Added a regression test proving Donut can replace a queued Rose at capacity while Rocket remains active; existing overflow coverage continues to assert that a lower-priority Rose cannot displace a queued Donut.
- Source and test changes are committed directly to `main`. CI/test execution and browser/TikTok LIVE behavior have not yet been verified for these commits.

### Zero-capacity queue guard — 2026-11-01
- Hardened `CharacterStateMachine` queue configuration: non-negative integer limits are accepted, including zero; invalid negative/fractional values fall back to the default capacity of 40.
- Fixed the full effect-queue branch so a zero-capacity queue rejects waiting effects safely rather than dereferencing a missing lowest-priority entry.
- Added regression tests for zero-capacity devotee/effect queues and invalid negative configuration.
- Changes are committed directly to `main`; CI status and runtime behavior are pending verification.

- Follow-up queue regression: the capacity-one test now also proves an equal-priority Donut cannot evict the earlier queued Donut; the earlier item remains the one played next.

### Delayed gift callback cancellation — 2026-11-01
- Added explicit ownership for delayed Rocket impact and Dragon roar/impact callbacks in the gift action engine.
- When a new gift supersedes the current action, pending delayed callbacks are now cleared immediately instead of merely waking later and returning after an effect-token check.
- Retained the token guard as a second line of defense against stale callbacks.
- Source change is committed directly to `main`. Syntax/unit CI and browser interruption behavior have not yet been run for this change; verify rapid Rocket → Dragon → Rose supersession in the game runtime.

### Optional Three.js teardown cleanup — 2026-11-01
- Added explicit disposal of all active transient 3D effect objects when the WebGL context is lost and when the page is being unloaded.
- The teardown now removes active objects from the scene, disposes their geometries/materials, releases the shared procedural materials, and disposes the renderer on page hide.
- This prevents the optional overlay from retaining its active effect list and GPU resources through teardown; it does not add automatic WebGL context restoration.
- Committed source directly to `main`. Browser context-loss, page navigation, and GPU-memory behavior still require runtime verification.

### Gift interruption pose-timer ownership — 2026-11-01
- Connected `temple:character-interrupted` to the central pose controller in `public/js/live.js`.
- On the first gift interruption, the controller now clears pending prostration/bow pose timers, removes the carpet-walk CSS class, and restores the neutral kneeling sprite pose before the gift choreography takes over.
- This prevents previously scheduled bow frames from changing the devotee's pose underneath the gift animation. Subsequent higher-priority gift supersessions remain covered by the gift engine's animation/timer ownership and do not restart the old ritual sequence.
- Committed source directly to `main`; rapid interruption and visual pose recovery still require browser verification.

### Gift interruption pose ownership follow-up — 2026-11-01
- Removed a second pose write in `triggerRitualVisuals()` that ran immediately after the synchronous `temple:character-interrupted` event.
- The interruption listener already clears prostration timers, removes the carpet-walk class and sets the central sprite to the neutral kneeling pose. The old follow-up write changed it back to `walk1`, contradicting that ownership handoff.
- Gift choreography now retains the central sprite until effect completion/cooldown hands it back to the queued devotee.
- Source change committed directly to `main`. Browser verification of rapid Rocket → Dragon → Donut → Rose interruption and pose recovery remains pending; no visual/runtime pass is claimed.

### Gift arriving during character cooldown — 2026-11-01
- Closed a timing gap in the 650 ms handoff after the final gift effect. Previously, a new gift arriving while the state machine was in `COOLDOWN` had no active character/effect to interrupt and could fall through as an ordinary queued visit, losing its special gift choreography.
- `CharacterStateMachine.interrupt()` now accepts a valid gift effect during `COOLDOWN`, reclaims stage ownership, and leaves the interrupted devotee queue intact for the next handoff.
- Added a regression test for Rocket completion → Dragon arriving during cooldown → original devotee A resuming ahead of B.
- Source and test committed directly to `main`. Bun/CI execution and browser timing validation are still pending; this is not a runtime pass claim.


### Zero-capacity interruption queue guard — 2026-11-01
- Fixed an overflow in `CharacterStateMachine.interrupt()`: when `maxQueue=0`, the previous code still unshifted the interrupted active devotee after attempting to evict from an empty queue.
- Gift interruption still takes stage ownership, but the interrupted visit is retained only when the configured waiting queue has capacity. A zero-capacity queue now remains empty instead of violating its bound.
- The existing zero-capacity regression test asserts this invariant. Source has been committed directly to `main`; Bun/CI execution and browser behavior are not yet verified.


### Interrupted devotee priority at full queue — 2026-11-01
- Added a regression test for a full devotee queue when a gift interrupts the active character.
- The test asserts the active/interrupted devotee is placed at the front, the newest waiting entry is evicted to preserve the configured capacity, and the original FIFO order of the remaining waiting character is retained.
- Test source committed directly to `main`. Bun/CI execution and browser behavior are not claimed as verified.


### Grand ceremony gift SFX isolation — 2026-11-01
- Fixed an audio overlap in `grandCeremony`: mapped special gift actions (Rocket/Dragon/Donut/Rose) no longer also trigger the generic double temple-bell cue.
- Kept the generic double-bell cue for ceremonies that do not resolve to a special gift action; grand-ceremony particles, congregation pulse and banner remain unchanged.
- This prevents the delayed second generic bell from firing 900 ms into a special action's own SFX sequence. Source-level review only; browser audio mix and real TikTok LIVE payloads remain unverified.
- Committed directly to `main`; project remains **IN PROGRESS — NOT DONE**.


### CI confirmation — grand ceremony SFX isolation — 2026-11-01
- GitHub Actions run `41257099609` completed successfully for code commit `311d48f389dd7b02e3ff8c56e5c73ff96ece99d2`.
- Follow-up worklog commit run `41257106219` also completed successfully. The `character-state-machine` job passed both `Run unit tests` and `Check server-side JavaScript syntax`.
- These workflow steps do not exercise browser audio playback, Web Audio mixing, visual timing, or real TikTok LIVE payloads; those acceptance checks remain open.


### Legacy TikTok gift payload compatibility — 2026-11-01
- Expanded `normalizeGiftPayload` to read legacy snake_case variants alongside the current camelCase connector fields: `gift_id`, `gift_type`, `diamond_count`, `repeat_count`, `repeat_end`, and `group_id`.
- Added fallback for legacy top-level `describe` gift labels and string `repeat_end: "true"`; current camelCase field precedence remains unchanged.
- Added regression tests for nested legacy gift metadata and top-level snake_case combo metadata.
- Source and tests committed directly to `main`. Await the GitHub Actions result before claiming the tests pass. Actual LIVE payload capture remains unverified.


### Legacy payload regression follow-up and CI result — 2026-11-01
- First expanded test run exposed a missing top-level `gift_id` fallback (51 passed, 1 failed); the failure was inspected from the Actions job log rather than treated as a successful run.
- Added the missing `data.gift_id` fallback. GitHub Actions run `41257263011` on commit `9d15c3cf063a7753d51ecab487065997839a8cda` completed successfully: all Bun unit tests and the server-side JavaScript syntax check passed.
- Earlier runs `41257236465` and `41257243389` failed on the incomplete intermediate implementation; the corrected follow-up run is green. Actual TikTok LIVE payload capture and browser runtime remain unverified.


### TikTok gift combo reconnect reset — 2026-11-01
- Reset the server-side cumulative combo tracker when a new TikTok connection starts, when the active connection disconnects, and on an explicit manual disconnect. A late `DISCONNECTED` callback from a superseded connection is ignored so it cannot clear the new session's tracker.
- Exposed a narrow `resetStreaks()` hook from the browser gift-action engine; the live UI calls it when the server-reported TikTok connected state changes, preventing a reused `groupId` from suppressing the first visual effect after reconnect.
- Added regression coverage proving both server combo counting and browser streak coalescing accept a fresh first frame after tracker reset.
- Code and tests committed directly to `main`. GitHub Actions validation is pending; real connector reconnect behavior and browser runtime remain unverified.

- Follow-up hardening: all event handlers and async connect completion now verify connection ownership. Late gifts/social events and stale connect/disconnect callbacks from an old connection cannot mutate the new session or consume its combo tracker.


### Duplicate cumulative TikTok gift frame deduplication — 2026-11-01
- Fixed a reward-accounting edge case in `getGiftComboDelta`: repeated non-final frames with the same cumulative `repeatCount` previously returned a minimum delta of 1 and could credit the same gift more than once.
- The tracker now returns only the positive difference from the last cumulative count; exact duplicates and out-of-order lower counts return zero. Final frames always clear the group, including duplicate final frames.
- Added regression coverage for repeated count 1, progression to count 3, duplicate count 3, and a final frame that repeats the existing count.
- Committed code and tests directly to `main`; GitHub Actions validation is pending. This covers connector-frame deduplication logic, not a live connector capture.


### Duplicate final combo frame — browser streak cleanup — 2026-11-01
- Follow-up review found a cross-layer edge case: when a duplicate cumulative frame is also the final `repeatEnd` frame, server reward deduplication correctly drops it (delta 0), but the browser never sees that frame and can retain its visual coalescer key until TTL expiry.
- The server now broadcasts a targeted `temple.gift-streak-end` notification for a dropped duplicate final frame. The browser clears only that `groupId`; it does not create a second ritual, gift effect, or reward.
- Added a public `clearStreak(groupId)` method to the coalescer and regression tests proving targeted cleanup preserves other active group IDs and permits immediate reuse.
- Code, tests and this worklog entry are committed directly to `main`. GitHub Actions run `41257702835` completed successfully on the worklog commit: Bun unit tests and server-side JavaScript syntax checks passed. Real connector and browser runtime behavior remain unverified.


### Timer ownership and stale callback guards — 2026-11-01
- Added a ritual-generation token to `gift-action-engine.js`. Approach/offering/bowing/completion callbacks now verify that they still belong to the current devotee before mutating the state machine.
- Starting a gift effect invalidates the prior ritual generation, so a timer callback already queued by the browser cannot complete a later devotee or advance an interrupted ritual.
- Added the matching effect-token check to the cooldown handoff callback. A superseding gift invalidates an already-queued cooldown callback as well as clearing its timer handle.
- This hardens rapid gift supersession and ritual handoff at the timer-ownership boundary. GitHub Actions run `41257817146` succeeded on the worklog commit; Bun unit tests and server-side JavaScript syntax checks passed. Browser race reproduction and live runtime remain unverified.


### Gift SFX overlap protection — 2026-11-01
- Routed synthesized sound effects through a shared Web Audio `DynamicsCompressorNode` before the audio destination. This reduces peak buildup when layered sounds overlap (for example, explosion noise plus sub-bass or multiple bell partials).
- Compressor settings: threshold -8 dB, knee 12 dB, ratio 10:1, attack 3 ms, release 220 ms. The existing SFX gain/enable controls remain upstream and unchanged.
- Added a safe fallback to direct destination routing if the browser does not expose `createDynamicsCompressor`.
- Scope: this protects the synthesized SFX bus only. HTML media background music and TTS are separate playback paths and are not covered by this compressor. GitHub Actions run `41257909818` succeeded; the `character-state-machine` job passed. No listening test or browser/device clipping measurement has been performed.


### Gift SFX cancellation on effect supersession — 2026-11-01
- Added per-effect Web Audio gain groups for Rocket, Dragon, Donut and Rose sounds. Each delayed/secondary sound is routed through the same effect group ID, so a later gift can fade only the superseded gift's SFX without touching background music, TTS, or unrelated SFX.
- Gift groups automatically release their gain node after the sound tail; explicit cancellation fades the group over 25 ms and disconnects it shortly afterward. Existing standalone audio method calls remain compatible when no group ID is supplied.
- Wired the gift engine's effect-generation token through the SFX dispatcher and cancel the previous group when a new gift takes ownership. Added dispatcher regression coverage for group-ID routing and targeted cancellation.
- Source-level checks confirmed all six gift sound methods use their group output and the effect engine passes IDs for launch/impact/chime events. Await GitHub Actions for unit/syntax validation; browser audio interruption and listening tests remain outstanding.


### Gift SFX cancellation CI and browser syntax coverage — 2026-11-01
- GitHub Actions run `41258156866` completed successfully on workflow commit `51df2d7909dbcd7a9e45d2355aa8e907fa773795`. The Bun unit-test step and expanded JavaScript syntax step both passed.
- Expanded CI syntax coverage to include the browser audio engine, gift SFX dispatcher, gift action engine and live controller in addition to the server entry point and legacy payload parser. This closes the earlier gap where browser audio syntax was not checked by CI.
- The code is committed directly to `main`. This confirms unit/syntax checks only; browser audio output, interruption fade behavior and actual listening/device tests remain outstanding.


### Gift SFX resource lifecycle regression tests — 2026-11-01
- Added deterministic tests against the real `TempleAudioEngine` implementation using a mocked Web Audio gain node and controllable timers. Coverage verifies per-effect output reuse/isolation, targeted fade and disconnect, idempotent cancellation, idle-timeout extension when another sound joins an effect, and safe handling of missing IDs.
- GitHub Actions run `41263192693` passed both `bun test` and the expanded JavaScript syntax check.
- These tests validate gain-group resource ownership and cleanup deterministically; they do not substitute for listening tests or browser/device audio verification.


### Stop active Web Audio sources when a gift effect is superseded — 2026-11-01
- Gift SFX groups now retain references to their active BufferSource/Oscillator nodes. Cancelling a superseded effect stops those sources immediately while the group's gain fades over 25 ms; the existing `onended` cleanup still disconnects each source's local filter/gain nodes and removes its group reference.
- Applied tracking to Rocket launch, both Explosion layers, Dragon whoosh/roar, Rose chime and Donut chime. Background ambience, temple percussion, and TTS sources are deliberately not registered in gift groups.
- Added deterministic regression coverage proving cancellation stops sources only for the targeted effect and that ended sources are removed from the group set.
- GitHub Actions run `41263244511` (source change) and `41263253560` (source plus tests) both passed the Bun unit-test step and JavaScript syntax check.
- Runtime listening and real browser interruption checks remain outstanding.


### Bound gift effect DOM/animation lifecycle — 2026-11-01
- Added a configurable capacity to `GiftEffectRegistry` (default 120 active animation/element pairs). When the cap is exceeded, the oldest effect is cancelled and its DOM node is removed immediately; the newest effects remain active.
- Duplicate animation registrations are rejected so one animation cannot accumulate duplicate completion handlers. Natural completion, explicit clear, capacity eviction and cancellation all use guarded cleanup; stale promise callbacks cannot remove a newer registration.
- Added tests for capacity eviction, cancellation, natural completion, duplicate/invalid registrations, invalid limits, and repeated clearing.
- CI validation is triggered by the direct-to-main commits. This is deterministic lifecycle coverage; browser stress testing and actual TikTok LIVE runtime checks remain outstanding.


### Three.js transient resource disposal deduplication — 2026-11-01
- Review of the optional 3D overlay found that lotus groups share one petal geometry across multiple meshes. The previous traversal could call `dispose()` repeatedly for the same shared geometry/material within one effect tree.
- Extracted `disposeThreeObjectTree`, which deduplicates geometry and material references before disposal, and wired the 3D effect cleanup through it. This keeps the existing 80-effect cap and visual/camera behavior unchanged.
- Added unit tests for shared resources, material arrays, empty/invalid trees and non-disposable values. Expanded CI syntax checks to cover the optional 3D module, camera controller and utility module.
- Browser/WebGL stress testing, context-loss recovery on real devices and TikTok LIVE runtime remain outstanding.

### Fix live controller ES-module loading — 2026-11-01
- Browser Console reported `Uncaught SyntaxError: Cannot use import statement outside a module` for `public/js/live.js`. The file imports `gift-sfx-dispatcher.js`, but `public/index.html` loaded it as a classic script. That prevented the complete live controller from executing, including ritual event handling and the 2D interaction controller.
- Changed only the `live.js` script tag to `type="module"`. Existing classic `audio.js` and `particles.js` remain loaded first; module scripts are deferred until HTML parsing completes, preserving access to their initialized globals.
- Added a CI assertion that the browser entrypoint loads `live.js` as a module and rejects regression to a classic script. CI also parses `live.js` explicitly as an ES module.
- This fixes the reported JavaScript loading error. It does **not** turn the existing background image into a full 3D temple scene; actual Three.js scene construction and browser/WebGL verification remain separate unfinished work.

### Fix missing background-audio and favicon requests — 2026-11-01
- Browser Console showed `GET /assets/bg_chant.m4a 404`. Repository asset inventory confirmed that no chant recording is bundled. The audio engine now selects its existing synthesized ambient fallback from startup and does not instantiate/request a missing media file. The loop still starts only after the user's audio-unlock gesture, respecting browser autoplay policy.
- Added `public/favicon.svg` and linked it from the main page, replacing the browser's implicit missing `/favicon.ico` request.
- CI now asserts the favicon link/file exists and that browser JavaScript no longer references the absent `bg_chant.m4a` asset.
- This removes the two reported 404 causes. The synthesized ambient loop is tonal ambience, not a recorded Buddhist chant; adding a real licensed/owned chant recording remains a separate content task. These fixes do not address the separate requirement for a persistent full 3D temple scene.

### Add persistent procedural Three.js sanctuary — 2026-11-01
- Confirmed the user's observation: the prior `?3d=1` implementation created an empty transparent scene at idle and only rendered transient gift/ritual effects. The original 2D background image and DOM composition remained unchanged, so normal 2D and 3D modes looked identical until an event fired.
- Added persistent Three.js geometry at scene boot: symmetric temple pillars and lintel, layered lotus throne, seated Amitabha silhouette with head/ears/robe, radial halo, sculpted hair curls, and foreground altar rail. These meshes are present before any RPC or gift arrives and render in the existing 9:16 stage coordinate system.
- Kept the existing 2D image/DOM scene intact as the fallback, preserved the fixed elevated frontal sanctuary composition, and retained all existing ritual/gift effects. No camera-controller behavior was changed.
- Updated pagehide cleanup to dispose the complete Three.js scene tree, including persistent geometry/materials.
- Added CI assertions that the persistent scene geometry remains present and the Three.js module parses.
- Scope note: this is the first persistent procedural 3D pass, not yet a production-quality detailed temple asset pack. It overlays stylized 3D geometry on the existing artwork; detailed imported temple/Buddha models, texture matching, responsive device profiling, and visual verification in a real browser remain open.

### Rebuild optional 3D mode as a complete temple world — 2026-11-01
- Replaced the previous screen-space/transparent geometry overlay with a perspective Three.js world using world-space coordinates and a fixed elevated view down the main hall.
- Added a tiled courtyard floor, red-and-gold processional carpet with lotus inlays, raised altar, layered lotus throne, seated Buddha statue and halo, paired wooden pillars, beams/roof eaves, warm hanging lanterns, brass incense burner, side lotus planters, and rows of small kneeling devotees.
- Added a correctly scaled 3D worshipper that walks up the carpet and bows during the incense ritual. Gift/ritual effects now spawn in world space. Ambient lantern flicker and floating light motes keep the scene alive while idle.
- In `?3d=1`, the old 2D background image, sprite crowds, central oversized DOM character, and 2D effect canvas are hidden so they cannot overlap the 3D world. The live status and bottom HUD remain overlaid. Without the query flag, the original 2D view remains unchanged.
- Added scene fog, warm lighting, shadows, tone mapping, responsive renderer sizing, a 30 FPS cap, WebGL-loss fallback, and full resource disposal on pagehide.
- The camera remains an elevated fixed master view; the existing subtle ritual-only camera director is retained.
- Validation still pending in an actual browser/WebGL session and on lower-powered devices. This is a procedural 3D world pass, not yet a detailed scanned/artist-authored asset pack; visual tuning, model fidelity, and device profiling remain open.


### Immersive 3D broadcast HUD redesign — 2026-11-01
- Redesigned the 3D-only top status and bottom broadcast HUD with a dark translucent glass treatment, restrained gold borders, clearer live/merit hierarchy, and more compact gift cards/leaderboard typography.
- Added a visible 3D SANCTUARY mode label so the operator can distinguish the active 3D presentation at a glance.
- All new selectors are scoped under .temple-3d-mode; the original 2D HUD styles and layout remain unchanged. No scene geometry, game event mapping, or camera behavior was changed in this UI-only pass.
- Added CI assertions for the 3D HUD selectors and mode label. Await Actions for the workflow result; no local browser screenshot or OBS/TikTok runtime test is claimed.


### Refine the 3D Buddha focal model — 2026-11-01
- Added modeled facial linework for closed eyes, brows, nose and a gentle smile, plus a small urna detail and meditation hands in the lap. These are Three.js meshes in the persistent statue group, not a 2D overlay.
- Kept the existing fixed elevated main-hall camera and altar composition unchanged. The statue remains the focal point of the 3D sanctuary.
- Added a CI source assertion for the new model-detail block. Await Actions; browser rendering, face proportions and material tuning still require visual review on the user's device.

### 2026-11-01 — Align 3D presentation to uploaded reference
- Used the uploaded 9:16 sanctuary screenshot as the visual target: dark breathing space, thin antique-brass perimeter, warm ivory Buddha/aureole, red-and-gold altar, and two compact footer consoles.
- Added a 3D-only inset brass frame with rounded corners and pointer-events disabled; the underlying world, touch/raycast interactions and 2D mode are not changed by this overlay.
- Warmed the procedural Buddha stone, shadow and highlight materials, plus the aureole disc, to move away from the previous cool-grey appearance.
- Bumped the live stylesheet cache key to `3d-ritual-console-20261101-6`.
- Added visual regression assertions for the frame, palette and stylesheet cache key.
- Browser rendering and device-specific visual inspection remain unverified; automated CI is the next check.

### 2026-11-01 — Add layered altar screen depth
- Added inset cinnabar back panels to both side bays of the rear altar screen.
- Added slim antique-gold inner mouldings and small corner studs to make the lattice bays read as framed architectural niches.
- Geometry is static and uses existing shared sanctuary materials; no new animation loop, external asset or camera adjustment.
- Added a visual regression test covering the niche backing, mouldings and decorative studs.
- Next check: verify the latest GitHub Actions run and continue with the altar/offerings composition.

### 2026-11-01 — Finish the offering table
- Added a red lacquered front apron to the offering table, edged with two narrow gold rails.
- Added a small diamond-shaped central gold seal and four matching studs; retained the original table footprint, burner, vases, fruit and flame positions.
- Added a focused visual regression test for the new tabletop furniture details.
- Camera and ritual hit meshes are unchanged.

### 2026-11-01 — Sculpted lotus throne petals
- Kept the existing lotus pedestal footprint and added two upright petal tiers around it.
- Petals use one custom tapered, curved BufferGeometry with computed normals; red and gold petals are split into instanced meshes and use static instance matrices.
- Outer ring: 16 petals at the original throne perimeter. Inner ring: 12 smaller petals. No camera, statue placement or ritual interaction changes.
- Added visual regression assertions for the custom geometry, two instanced material groups and tier setup.
- Actual browser render still needs visual confirmation; automated checks are running.

- CI follow-up: the first run was blocked by a legacy static guard that treats the identifier `const ridge =` as a removed roof-construction marker. Renamed the petal-local variable to `petalRidge`; latest run `41272003700` passed with 110 tests across 14 files (0 failures).


## 2026-11-01 — Ambient incense atmosphere
- Added six persistent low-poly incense wisps above the bronze burner. Wisps rise, drift sideways, fade in/out, and gently swell on a repeating phase.
- Reuses one sphere geometry with six lightweight materials so each wisp can fade independently; no per-frame mesh/material allocation and no new camera or interaction behavior.
- Added visual regression coverage for the persistent particle setup and frame update.
- Browser render still requires local visual confirmation at `?3d=1`.


## 2026-11-01 — Warm lighting and shadow refinement
- Tuned the existing directional shadow bias/normal bias and soft radius to reduce surface shadow acne without adding another shadow-casting light.
- Added subtle independent breathing to the Buddha focal light, altar fill and lantern point lights to create a warmer living-light atmosphere.
- Kept the fixed camera and limited shadow rendering to the existing key light.
- Added regression assertions for shadow tuning and light animation; browser visual verification remains outstanding.


### 2026-11-01 — Add subtle courtyard tile material variation
- Added deterministic per-instance tint variation to the existing instanced courtyard tiles, separating individual stone slabs and timber inlays so the floor reads less like a repeated checker grid.
- Reuses the existing two InstancedMesh batches and shared tile geometry/materials; this does not add draw calls, per-frame work, textures, or shadow-casting lights.
- Camera, carpet, 2D mode and ritual interactions remain unchanged.
- Added a source regression test for the color-variation path. Browser visual verification and mobile GPU profiling remain outstanding.


### 2026-11-01 — Add brass collars to the timber colonnade
- Added slim antique-gold rings at the foot and crown of all ten timber columns to give the side architecture a more finished, crafted silhouette.
- All 20 rings share one TorusGeometry and one static InstancedMesh batch; no per-frame updates, extra lights, or shadow maps.
- Preserved the open roofless sightline and fixed camera.
- Added a source regression test. Browser visual confirmation and mobile GPU profiling remain outstanding.


### 2026-11-01 — Finish the Buddha pedestal detailing
- Added two restrained brass moulding rings around the carved lower pedestal drum and 32 small gold studs around the red middle tier.
- Both decorations use static InstancedMesh batches with shared geometry/materials; decorative instances do not cast additional shadows and have no per-frame update cost.
- Kept the statue, lotus throne, fixed camera and ritual interactions in place.
- Added regression assertions for instance counts, static usage and shadow settings. Browser appearance and mobile GPU performance still need local visual review.


### 2026-11-01 — Optimize the Buddha hair-curl detail
- Replaced 24 individually-created curl meshes on the Buddha's hair cap with one InstancedMesh using a single shared sphere geometry and the same row layout, positions and scale.
- Kept the curls static and retained shadow casting; the detail is now submitted as one mesh batch instead of 24 separate meshes.
- Added a source regression test for the 24-instance layout, static usage and shadow flags.
- Appearance should remain equivalent; browser render and mobile GPU profiling still need local verification.


### 2026-11-01 — Carve a finished lower hem into the Buddha robe
- Added a softly raised ivory hem following the front curve of the crossed lap, plus a finer recessed shadow groove just beneath it to clarify the layered robe edge.
- Both are static tube meshes within the existing statue group; no camera, silhouette, pose, materials elsewhere or interaction changes.
- Added regression assertions for both curves, materials and shadow behavior.
- Actual visual fit against the lap silhouette still needs browser review.



### 2026-11-01 — Carve shoulder seams into the Buddha robe
- Added a restrained dark incision along each shoulder drape and a fine ivory ridge immediately beside it to clarify the robe's layered fold without changing the statue silhouette.
- The detail uses two short static TubeGeometry paths, reuses existing statue materials, and does not cast additional shadows or add frame-loop work.
- Added a source regression test for both seam/ridge construction and shadow flags.
- Browser render and visual fit still require local confirmation at `?3d=1`; automated CI is the next validation step.



### 2026-11-01 — Add subtle chest folds to the Buddha robe
- Added two short diagonal folds across the chest, tapering toward the lap to clarify the robe's layered direction without crowding the existing shoulder seams.
- Reused the existing robeFold helper and statue shadow material; no new lights, shadow casters, or frame-loop updates.
- Added a source regression test for both fold paths.
- Visual overlap and depth still need local browser review in `?3d=1`.



### 2026-11-01 — Refine the Buddha meditation mudra
- Added six fine finger crease curves across the paired hands and a subtle raised contour at the thumbs to clarify the joined meditation gesture.
- Reused the existing statueLine helper and statue materials; the pose and hand silhouettes remain unchanged.
- Added a source regression test for the finger and thumb details.
- Local browser inspection is still required to confirm the fine lines remain legible at the fixed camera distance.



### 2026-11-01 — Refine the Buddha facial expression
- Added fine lower-eyelid lines, subtle cheek transitions and a restrained lower-lip crease using the existing statueLine helper and stone materials.
- Preserved the existing eye, brow, nose and mouth placement; no camera, lighting or animation changes.
- Added source regression coverage for the new facial contours.
- Browser/render review remains necessary to judge visibility and proportions at the fixed camera distance.



### 2026-11-01 — Sculpt the Buddha ears and temples
- Added paired shallow inner-ear grooves and small raised inner contours to clarify the elongated ear forms.
- Added fine temple arcs to visually connect the curled hair cap with the head silhouette.
- Reused the existing statueLine helper and existing statue materials; no lighting, camera or animation changes.
- Added source regression coverage. Browser render inspection remains necessary for final proportion and visibility review.



### 2026-11-01 — Add subtle mineral grain to the Buddha stone
- Generated a deterministic 64×64 grayscale DataTexture in memory and applied it as a low-strength bump map to the three statue stone materials.
- Tuned roughness to keep the statue matte and reduce the smooth, plastic-like highlight response.
- No external texture asset, extra light, or per-frame allocation was introduced; texture generation happens once during scene setup.
- Added source regression coverage. Browser render inspection is still required to confirm grain scale and visual subtlety at runtime.



### 2026-11-01 — Blend the Buddha neckline into the shoulders
- Added a shallow curved neckline and a fine raised collar ridge across the upper chest to soften the neck/shoulder transition.
- Both curves use existing statue stone materials and do not cast shadows, preserving the current lighting and fixed silhouette.
- Added source regression coverage for the two static curves.
- Browser render review remains necessary to confirm the contour reads as carved stone rather than a separate collar.



### 2026-11-01 — Define the Buddha upper-arm robe silhouette
- Added paired subtle dark contours from each shoulder toward the elbow and fine offset ivory ridges to describe the robe-covered upper arms.
- Kept the lines close to the existing body silhouette and disabled shadow casting on the highlight ridges.
- Added source regression coverage for both sides and their static geometry.
- Browser render inspection remains necessary to confirm the contours sit naturally against the torso at the fixed camera distance.



### 2026-11-01 — Refine the Buddha elbow robe transitions
- Added one short, paired crease at each elbow to visually connect the upper-arm robe contour with the resting forearms.
- Added a finer offset highlight ridge; highlight meshes do not cast or receive shadows.
- Added source regression coverage for the paired elbow detailing.
- Geometry remains procedural and lightweight; final visual placement still requires a browser render check.



### 2026-11-01 — Consolidate the Buddha robe arm contours
- Reviewed the shoulder, upper-arm and elbow detail paths and found overlapping parallel contour lines that risked making the robe look over-etched.
- Removed the duplicate upper-arm contour and extended the existing shoulder seam down toward the resting hand, retaining one paired shadow line and a fine non-shadowing highlight.
- Updated the source regression test to assert the consolidated path and the absence of the redundant arm-edge path.
- This is a source-level geometry review; a browser render is still needed for visual confirmation.
