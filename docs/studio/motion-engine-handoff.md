# Studio Motion Engine — isolated engineering handoff (2026-11-07)

**Status: DRAFT / NOT 100% ACCEPTED.** The branch starts at `integration/studio-20261107-release-candidate` and must not be merged until the complete audiovisual/visual acceptance checklist passes on an isolated Mac/CI checkout. No production episode, channel defaults, sound files, rendering isolation, or Vercel deployment have been changed.

## Code audit and findings

| Subsystem | Existing implementation | Finding / action |
| --- | --- | --- |
| Shot catalog and direction | `src/remotion/illus/shots`, `src/plan/director.ts`, `src/remotion/scenes/AlleyTale.tsx` | Composed camera already caps automatic moves to semantic cues; authored plans have precedence. Opt-in portrait witness changes now use cuts on the word beat, avoiding the partial-speaker pan. |
| Crop and camera | `src/remotion/illus/framing.ts` and `fitFor` in AlleyTale | Existing `fitFrame` provides required/optional spans but cannot guarantee every intermediate moving frame remains clean. New `compositionSafety.ts` exposes geometry-only diagnostics, and contained portrait witness transitions cut between separate subjects. |
| Body and gait | `src/remotion/illus/Figure.tsx`, `gait.ts` | Old locomotion and poses remain the default. Opt-in `Move.durationFrames` and `fitDistanceWithin` compress acceleration/deceleration into the authored speech beat for composed+fit scenes; legacy profiles untouched. Foot planting still requires frame-by-frame visual review. |
| Text | `src/remotion/illus/TopCaption.tsx` | `safeWrap` is opt-in and applies strict max-words grouping, smaller safe text, and breakable long tokens. All legacy scenes use the exact old layout path. |
| Light | `src/plan/lighting.ts` and `src/remotion/illus/light.tsx` | Has per-template feature matrix and validated overrides; no preset is turned on by this PR. |
| Transitions | `src/plan/transitions.ts` and `src/remotion/scenes/transitions.tsx` | Already optional and channel-gated. No changes; verify actual transitions with media in integrated tests. |
| Studio controls | `src/plan/engine.ts`, template fields, channel Engine UI | Camera, framing, gait, poses, lighting and transitions already exposed in their existing editor. This PR adds no new field or default, only safer behavior behind existing `cameraMode=composed` + `framing=fit`. |

## New behavior and backwards compatibility

- `requiresFocusCut` is true only for portrait, `framing=fit`, `stage=witnesses`, and an actual change of camera target. Camera stops panning through half-hidden people and cuts on the authored word/frame. Landscape, legacy, non-witness casts, and the `still` mode retain their previous transitions.
- `witnessPillAt` refuses to slide a title back across the owner’s head or raised hand if the safe viewport cannot contain the title beside the owner. A missing title remains a review finding, **not** license to overlap it.
- `compositionIssues` diagnoses required-object clips, half-clipped optional objects, and beyond-world crops. Its checks are **horizontal only**; they do not certify vertical safe areas, contrast, text shaping, occlusion or naturalness.
- `fitDistanceWithin` and timed `Move` are active only for `composed + fit` illustrated scenes. No audio, Quran, Remotion render pool, or other channel presets are modified.
- `TopCaption.safeWrap` is opt-in and does not alter the legacy caption grouping, sizes or wrapping.
- No episode plan or scene assets have been regenerated. Visual object assets remain reusable once approved word timings arrive.

## Test evidence and limitations

- Local isolated check: `tsc --noEmit --strict --target es2022 --module esnext compositionSafety.ts`: **PASS**.
- Local standalone Node strip-types tests for `compositionSafety.ts`: **4/4 PASS** (focus cuts, geometry, owner clearance, invalid camera).
- Added Vitest cases: `tests/motion-composition-safety.test.ts` (camera, labels, caption wrapping, legacy) and `tests/motion-bounded-walk.test.ts` (four gaits × short/normal beats).
- **NOT RUN:** complete repository TypeScript/Vitest gate, Remotion comparisons, macOS rendering or natural-speed footage inspection. This environment cannot clone the private repository or install its Remotion dependencies. GitHub CI results, if any, must be checked independently.
- **Geometry diagnostic clips only:** two 8-second 12fps standalone synthetic camera illustrations were generated and inspected locally, at 960×540 and 540×960. They are **not** Studio/Remotion outputs and are **not** evidence for the 100% visual gate. Their hashes (SHA-256) are `aaf25a187fc59c10014af94ff6d36e45c9e4ad43bd98bc08b2cdf249d79ca241` and `06138cd57d483d7ee38d7872cc7bd4b5be7a6466d7d848cbca88eb387fb21833` respectively. The artifact links live in the original handoff conversation, not this repository.

## Remaining mandatory review (blocking 100% readiness)

1. Isolated checkout on **this branch SHA**: `npm run gate` (complete TypeScript and all Vitest tests). No `--no-verify`, no silent skips.
2. Render **actual Remotion fixture scenes**, not mock videos, into a fresh temporary output directory outside `channels/` and the production Mac path. Cover 16:9 and 9:16, solo, paired cast, both witnesses, doorway, board, long Arabic words and strong pose changes, with feature OFF and ON comparisons.
3. Watch each fixture at 1× from start to finish, including mid-transition frames. Record frame-level defects: partial people, cropped feet/hands, overlaps, text legibility, clipping, lighting, occlusion, pacing and foot planting. Attach the rendered comparison clips/screenshots and the explicit reviewer decision to the PR.
4. Verify the opt-in short-walk speed/foot phase on all four gaits, stop transitions, carryIn/out and contradictory gestures. Confirm fixed snapshots against old episodes without changing their files.
5. Confirm all controls can be operated in Studio (not just accepted by a JSON file) and keep `production.defaults` unchanged for all channels.
6. Integration point **owned by workflow and audio branches**: motion word-level finalization must require full episode voice approval, the current approved audio bytes/hash and word timestamps. Prior estimated timings remain **draft/preview only**. On a changed voice recording re-time movement/cuts/graphics using existing visual assets; invalidate motion/AV/Master approval. Do not take approval from this PR automatically.
7. Obtain explicit owner visual signoff. Passing code tests or diagnostic previews alone **never constitutes final motion acceptance**.

## Existing Studio controls (balislam only)

Open a scene with template `alley-tale`; set `cameraMode=composed` and `framing=fit`. The `cameraPlan` and `cameraPlanPortrait` fields accept an opening `0 | wide center` and cue-based targets such as `ظلمًا | medium hero` / `عدلًا | medium other`. Configure `gait` and `poseTimeline` in the existing scene editor. Leave the fields empty for historical behavior. `lighting` and `transition` stay fully optional. **Do not set channel engine defaults or modify existing episodes on behalf of this PR.**

## Integration ownership

- UI/editor branch: preview badges differentiating estimated vs actual audio timings; visual comparison and reviewer approval screens.
- Audio branch: provide authoritative word timings, episode approval hash, and invalidation when audio bytes/text change.
- Workflow branch: enforce `final_motion_render` gate at every actual render entrypoint; explicit AV review and Master approval, never inferred.
- Render isolation branch: produce test fixtures only in owned isolated temporary directories; retain protection of episode/other-channel files.
- Central integration: run comprehensive regression, actual Remotion preview comparison, and owner review before accepting 100%.
