# PR #16 review: what was fixed, and how it is proven

Response to [the scene review, user experience and output quality review](./2026-09-25-scene-review-ux-and-output-review.md) of `claude/scene-review-loop` at `f91c0984`. That review is commit `4d36edb1` on `feat/hyperframes-markdown-mvp`. Every finding R1–R11 is fixed on the same branch, one verified commit at a time. G1 and G3 are done to the extent the review asked for "now". G2, and the production halves of G1 and G3, remain the next milestone.

Most checks below are deterministic. They ran against the product's code, its pinned Hyperframes 0.7.106 runtime and player, headless Chrome and the local PostgreSQL + MinIO store, with the harness's own sketch from the live P0–P3 run as the fixture where one was needed. A live check on the real harness then confirmed the new gates, and found one more bug; see [Live check on the real harness](#live-check-on-the-real-harness). No acceptance video, sketch or plan was written by hand in the harness's place.

## Findings

| | Finding | Commit | Proven by |
| --- | --- | --- | --- |
| R1 | r1 showed r2's preview | `6cc64aa0` | `planning-service.test.ts` (each revision's own sketch); `scene-review-check` |
| R2 | preview freshness ignored its other inputs | `6cc64aa0` | `planning-service.test.ts` (late and moved sketches kept as history, with what moved) |
| R3 | "Preview ready" proved static validity only | `b47e0894` | `sketch-runtime.test.ts`: the review's three probes and five further cases; `plan-preview-check` in the desktop app |
| R4 | the recording guide contradicted the approved sequence | `cc43c91f` | `planning.test.ts` (guide from the plan, take fingerprints); `scene-review-check`, `take-workflow-check`, `teleprompter-check` |
| R5 | full screen combined two compositions and two clocks | `6ab8cdbd` | `plan-preview-check` (one composition, first frame, hold at end, full screen) |
| R6 | implementation detail ahead of the creative decision | `8c585d30` | `scene-review-check` |
| R7 | fixed widths clipped the canvas | `1e7100e3` | browser checks at 1440, 1280, 1024 and 860 px; `scene-review-check` in the app's own window |
| R8 | Planning workspace lost the selected scene | `aaa7994c` | `scene-review-check` (open on the reviewed scene and revision, hand back on close) |
| R9 | browser review read as a missing harness | `aaa7994c` | `harness-choice.test.ts`; browser check (nothing queued, each control says why) |
| R10 | the bucket's fill escaped its body | `615f82b0` | `visual-cast.test.ts` (inside at empty, half, full and 1.5×; a spilled page trimmed; a transformed level mapped); `planning-service.test.ts` (the packet carries it) |
| R11 | the motion contradicted the steady refill | `6ccf15f6` | `planning.test.ts` (count, beat, pauses); `sketch-runtime.test.ts` (the live sketch's own timings refused; changes and pauses seen on screen) |

Two further fixes:

- `a7a8f767` gives a side-by-side desktop instance its own browser profile. Checks running beside the creator's app had shared its local storage, and could lose state or fail to start.
- `c0a9980c`, found by the live check, carries a plan's artwork to its sketch even when the plan names it by a key an earlier extraction gave.

## What changed, finding by finding

**R1, R2.** The overview reports each plan revision's newest ready sketch. The review, the stage and moment seeking use the selected revision's own sketch, and never lend it another's. A revision without a sketch shows its page and says which revisions have one. A sketch counts as current only while its plan is the scene's current, fresh plan, and its theme, cast, pinned skills and plan fingerprint are unchanged. Otherwise it names what moved. A sketch whose inputs move while it is made lands as history, with a warning. A late result never replaces a newer one of its plan.

**R3.** After the static contract and the pinned lint, the record reads *verifying*. The exact bundle then plays through the pinned player in headless Chrome, served as the Studio serves it, with nothing else reachable. It is refused, with a reason the harness can act on, when:

- a script throws;
- a file it asks for is missing or outside the sketch;
- the player never becomes ready;
- the timeline is unregistered or has no tweens;
- its length disagrees with the manifest;
- a time sought twice shows two frames;
- a layer shows at no time during a moment it declares;
- a moment whose plan changes objects shows no change in those objects.

A moment the plan does not change may hold still. Layers are bound to what draws them with `data-sketch-layer`, because Hyperframes reads `data-layer` as a track. The proof is stored against the bundle's sha256: frame hashes, re-seeks, where each layer showed, and how much each planned change moved. The review's Preview details say how the sketch was checked. A preview accepted before this change says it was never checked.

The review's probes are the regression cases:

- the throw before the timeline is refused for the throw and the missing registration;
- the absent image is refused by name;
- the empty timeline is refused for animating nothing.

The harness's own token-bucket sketch passes, with every one of its 18 drawn layers seen in its moments. A stub harness in the desktop app has a throwing attempt refused, then repaired. `verifying` holds the active claim (migration 013), and a check cut off by a restart fails with a retry.

**R4.** The recording guide's lines are the approved plan's narration, in its order, with silent moments marked. When the notebook's script is older than the plan, the guide shows both and offers the plan's lines as the scene's script. Recording waits until then, so the teleprompter shows what the plan says. Every take stores a fingerprint of the words it was spoken against, and the plan revision. An earlier take is flagged, never relabelled. Taking the plan's own narration does not make the plan stale.

**R5.** While the stage shows a sketch, the controls that work on the notebook's own composition step back, and that composition pauses. Full screen shows only the sketch and its one transport, with the provisional label on top. The sketch starts at its first frame, paused. At the end it holds the last frame and offers Replay.

**R6, G3 (now).** The review opens on what the scene explains and its moments. The sketch follows as one line, with Play. Its provisional list and the read-only moment map sit in a collapsed "Preview details and moment map", labelled as not the composition's timeline. Titles replace record ids.

**G1 (now).** Production is a collapsed "Production — not connected yet" section. It states that this build stops at approved plans and sketches, and that approving a plan never starts production. In video notebooks, the older Build reads "Build whole notebook" and says it does not use approved plans.

**R7.** There is no page-wide minimum width. The document and canvas columns flex, and in a video notebook the stage takes the larger share: about 410, 512 and 576 px wide at 1024, 1280 and 1440, up from about 330. The scene rail is a measured band at the bottom and never covers the document. The stage has its own Full screen.

**R8.** Planning workspace opens on the scene, revision, moment and tab the review shows. Closing it hands the selection back in the same click.

**R9.** A browser review, a missing harness and an unavailable chosen harness each have their own message. A browser queues nothing: Plan, Preview, Prepare and Regenerate are disabled with the reason. A provider's real failure stays beside its last attempt and recovery.

**R10.** The fill spilled because the page drew the bucket's level wider than its trapezoid's bottom, and the sketch reused that geometry. Where a rig has a shell and a level, the visual-cast extractor first checks the faithful lift against the page. It then clips the level to the shell's closed outline, mapped into the level's own coordinates through any transforms between them.

The extractor draws the level alone at empty, half and full, and at 1.5× size. It counts the level's pixels outside the shell's own painted inside, which is independent of the clip. A full level must cover that inside. The rig records the clip, the extent to animate a level within, what the clip trimmed from the page and each state. `VISUAL_CAST.json` and `parts.json` hand this to the harness, and the sketch contract says to keep the clip. A clip in the level's own coordinates holds through resize and camera transforms, and the exporter renders in the same Chrome. The extractor version is 2, so every base's cast is extracted again, once.

**R11.** A plan's ledger can declare a steady rate (a refill, a leak) and tag the changes it makes. Where a plan counts, its sketch declares a schedule:

- the ledger's changes one for one, each timed inside its moment with the layers that show it;
- a rule for each rate: every *n* seconds, running by the first time there is room;
- any pause that holds the clock, with a note and the layer that tells the viewer.

The product replays the schedule. Counts and refusals are the plan's. A rule changes the count on every beat while there is room, and at no other time. Nothing counted happens in a pause. Once the sketch plays, each change must show in its layers within 0.3 s of its time, and each pause must stay on screen while it holds the clock.

The live sketch's own timings are refused, with the plan's refill declared as a rate. The rule would have to start by 5.05 s. Beats fall due at 17 s and later with nothing landing, and the 22.8 s drop is off its 22.6 s beat. The plan view names its rates, and the review shows the sketch's clock.

## Completion gaps

- **G1.** The boundary is stated (above). Producing from the immutable approved package is the next milestone: consuming the plan, script, assets, voice or take and code hashes, with per-scene delivery.
- **G2.** Not started. It covers pinning and loading the selected recipe bodies, runtime-proving each capability, and a small construction packet.
- **G3.** Labelled and collapsed now. The sketch's layers are now bound to the elements that draw them, and the proof records where each layer actually shows. That is the start of the renderer bindings the production timeline needs. The editable, shared-playhead timeline remains the next milestone.

## What this changes for existing work

- The planner's contracts changed (layer marks, the schedule, rates), so the pinned skill bundle has a new hash. Existing briefs, plans and previews read stale, with "the planning skills changed", and must be prepared again. That is the pinned-input rule of R2 working. It is broader than it needs to be, because the whole skill folder is one input: a sketch-contract change also stales briefs.
- Every base's visual cast is extracted again (version 2). No model is called, and the library keeps the earlier artwork under its old keys.
- New sketches must mark their layers and, where the plan counts, declare a schedule. Previews accepted before this change stay playable and say they were never checked in the player.
- Migration `013_planning_verifying.sql` runs once on start.

## Verification

- Unit: studio-v2, 268 tests in 29 files, all passing. They include `sketch-runtime.test.ts` (8, in headless Chrome) and `visual-cast.test.ts` (9). `planning-service.test.ts` (18) and `visual-cast.test.ts` pass on the file store and on PostgreSQL.
- Desktop checks on the isolated store, each passing: `plan-preview-check` 35/35, `planning-check` 53/53, `scene-review-check` 37/37, `visual-cast-check` 10/10. The earlier slices also passed `take-workflow-check`, `presenter-take-check`, `rehearsal-check` and `teleprompter-check`.
- Release suite (`apps/studio-desktop/scripts/release-check.mjs`, on the isolated store after both builds): 50 of 51 pass. The one failure is `skill-references-check`. It reports the same 132 broken links as before this work, all inside the vendored Hyperframes skills, none in a file this work touched.

## Live check on the real harness

This ran on Claude Code 2.1.280 with Claude Opus 5.5, on the P0–P3 acceptance store, through the product's own controls. The files are in [the evidence folder](./2026-09-25-scene-review-ux-response-evidence/README.md).

**Setup.**

- The brief read stale, "the planning skills changed", as expected after the contract changes. The harness prepared it again.
- The cast was extracted again at version 2. On the real base, the extractor found the R10 defect in the page itself. The level of "The token bucket" crossed its shell by 496 pixels, and the one on "Limit each user" by 186. Both rigs now hold the level inside, at every state.

**The new plan (r5).** The harness planned the token-bucket scene again from the new contracts. Its ledger declares the refill a steady rate, "one token drips into the bucket on each beat while there is room". It lists all ten changes that implies, including a drop that lands mid-burst and is spent at once. That is an honest steady mechanism, where r2 was a narrated one.

**The sketch.** Accepted on the first submission, having passed the static contract, the pinned lint and the play in the pinned player:

- 15 marked layers, each shown in its moments;
- all 7 planned changes visible;
- 3 re-seeks repeatable;
- 98 tweens over 26.5 s.

The schedule keeps the drip's beat, every 4.4 s from 6.8 s: drops at 11.2, 15.6, 20.0 and 24.4 s. All ten counted changes were seen on screen when the schedule says, each moving 5,300–10,700 pixels. The review shows how it was checked and its clock. On the stage, the level follows the bucket's walls at every fill, including after the camera pulls back to Redis.

**The bug it found.** Re-extracting the cast changed the rigged "request rate limiter"'s library key, because its artwork gained the inside clip. The new plan still named the old key, from the plan it was revising, and the library keeps that key, so the plan was valid. But the sketch packet only carried current cast entries by key, so the harness had no artwork and drew a placeholder.

`c0a9980c` fixes it. An earlier key now names the entry of the same base, page and node whose painted bounds on the page match. The bounds come from the page, so they hold across extractor versions and tell the parts of a split node apart. The packet lists the old key among the entry's `formerKeys`.

After the fix, the harness sketched r5 again:

- the pinned lint refused its first attempt, for a font with no `@font-face`, and the harness repaired it;
- the second attempt was accepted, with the cast's artwork for all seven reused objects;
- its notes name the rate limiter's new key, "formerly" the one the plan names;
- the drip keeps a 4.5 s beat from 6 s, and every counted change was seen on screen.

**A caution for testing.** Two earlier attempts were cut off by the tester, not the product. Restart recovery treats every run in flight as orphaned, so a second app started on the same store ended the first app's plan run. That is correct for the product's single app. Side-by-side test instances must not share a store while runs are live.

## Not established

- **No production or export.** A preview is not a produced scene, and there is still no narrated MP4 from this path (G1).
- **One scene, one harness.** The live check covered the token-bucket scene on Claude Code with Opus 5.5. Kimi and Codex have not made a sketch against the new contracts.
