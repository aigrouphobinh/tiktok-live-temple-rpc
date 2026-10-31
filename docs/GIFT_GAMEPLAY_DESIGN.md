# Gift Gameplay Design — Temple Live 9:16

## Current implementation boundary
This document defines the intended interaction rules. The current frontend implementation adds **visual-only** Rocket and Donut interruptions during the active incense animation. Server-side merit, incense totals and leaderboard updates are unchanged. Do not describe the current version as cancelling server rewards or enforcing cooldowns.

## Core rules
- The main temple scene remains one continuous elevated 9:16 camera view.
- Gifts target the active in-scene devotee, never the camera and never a separate viewer shot.
- One active character/action controller owns the central devotee at a time.
- A higher-priority effect may replace a lower-priority visual action. Lower-priority effects must not interrupt a higher-priority one.
- Bound effect queues and discard stale callbacks when a newer effect takes ownership.
- Do not infer gift IDs. TikTok `giftId`, display name and diamond value are now carried into the ritual event; populate an ID mapping only after observing real connector payloads.

## Initial gift action tiers

| Priority | Gift/action | Visual script | Suggested interruption/cooldown |
|---|---|---|---|
| S | Rocket | Rocket crosses the same scene, impact burst; active devotee is knocked to the side and returns | 15–25s |
| A | Dragon / other verified high-tier gift | Large ceremonial creature/wind effect; brief knockback or grand blessing | 10–18s |
| B | Donut / Doughnut | Donut passes through the scene; devotee leaves the incense position to chase it, then returns | 8–12s |
| C | Rose / Heart / Butterfly | Small petals/hearts/butterfly distract the devotee briefly | 4–7s |
| D | Other small gifts | Small prop/bird/flower cue; short pause only | 1–3s |

Durations are design targets, not currently enforced game cooldowns. Do not activate a tier based only on diamond thresholds if the actual gift identity is known.

## Event and identity contract
- Keep the existing WebSocket `temple.event` contract.
- `offerGift` event fields include `giftId`, `giftName`, `giftType`, `coins`, `user`, `uniqueId` and `avatar`.
- `giftId` is forwarded from the TikTok connector without inventing or remapping IDs.
- Initial frontend matching supports the observed display-name aliases `Rocket`, `Tên Lửa`, `Donut`, and `Doughnut`. Confirm actual names/IDs from a real LIVE event before broadening the map.
- Non-matching gifts retain the existing gift visual behavior.

## Character state model (target)
```text
IDLE
  -> APPROACHING_INCENSE
  -> OFFERING_INCENSE
  -> BOWING
  -> RETURNING
  -> IDLE

Any active incense state
  -> INTERRUPTED_BY_GIFT
  -> EFFECT_ANIMATION
  -> COOLDOWN
  -> QUEUED_TO_RETURN
  -> APPROACHING_INCENSE
```

The target state model must be implemented in a dedicated character controller before server-side reward/cooldown semantics are changed. It must distinguish:
- the TikTok gift sender (`event.user`)
- the active devotee being interrupted (current central character)
- the queued devotee waiting to enter the ritual

Never assume the gift sender is the character being interrupted.

## Queue and priority policy
1. Rocket (S) supersedes any lower tier.
2. A higher tier can replace a lower tier; a lower tier cannot replace a higher tier.
3. Equal-tier effects are queued and coalesced for a short window rather than stacked on the same character.
4. Only one effect may animate the central character at a time.
5. Multiple incense events extend the current camera shot without rerolling the camera preset.
6. Gift effects never change camera position, camera identity, stage size or OBS crop.

## Character controller implementation
- A single state machine owns the central character. New incense, prayer, bell, fortune and gift visits queue instead of replacing the active character.
- Current phases: `IDLE` → `APPROACHING` → `OFFERING` → `BOWING`; interruption enters `INTERRUPTED` → `COOLDOWN` before the active devotee is resumed.
- A Rocket interruption puts the interrupted devotee at the front of the character queue. Rocket can supersede a lower-priority Donut; lower-priority effects wait in a priority-sorted queue.
- Character queue is bounded to 40 entries; excess new visits are rejected from the visual queue only. Server-side event, merit and leaderboard accounting remain untouched.
- Ring-bell and fortune actions are serialized through the same character owner. Fortune receives a longer visual slot to allow its narration/modal sequence.
- The camera and fixed HUD are independent: the shared scene rig moves together, while top/bottom HUD, ceremony banner and fortune modal remain pinned to the 9:16 stage.

## Implementation status
- [x] Forward TikTok giftId into `offerGift` event for later verified mapping.
- [x] Add visual-only Rocket and Donut interruptions during active incense.
- [x] Preserve the single-camera composition; gift effects do not change camera.
- [ ] Verify actual Rocket/Donut gift IDs and display names from real connector events.
- [x] Implement a dedicated character state machine with one active devotee, FIFO queue (max 40), and priority-sorted interruption effects.
- [ ] Decide server-side reward/cooldown behavior explicitly before changing merit accounting.
- [x] Add deterministic tests for FIFO ownership, interruption/requeue, Rocket-over-Donut priority, effect queue and bounded capacity.
- [ ] Validate all effects in OBS at 1080x1920 and measure FPS.

## Safety and compatibility
- No paid assets or external models are required; use procedural or emoji/DOM effects until free licensed models are verified.
- Keep the original 2D ritual flow as fallback.
- Do not change existing RPC method names or server reward semantics as part of a visual-only release.
