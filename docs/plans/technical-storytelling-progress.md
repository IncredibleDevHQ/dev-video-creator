# Technical storytelling studio — implementation progress

Companion to [technical-storytelling-product-architecture.md](technical-storytelling-product-architecture.md). Newest first. Branch `feat/hyperframes-markdown-mvp`; commits as Karthic <Kartronics85@gmail.com>.

## 2026-09-19 — Where this stands

Every D-phase (D0–D7) of the plan's software work has shipped — 117 commits today, each slice committed only after its tests passed. The deterministic release suite is green at **22/22** (`yarn studio:check`: unit gates + 19 scripted journey/storage/renderer checks + the file-backend opt-out). The live provider proof passed: one real Kimi + Quiver + whisper build end to end, verified 36.1s MP4 at `~/Downloads/Incredible Studio/retry-storm-live-proof.mp4`. A seam audit after the D-phases found and fixed eight real integration bugs, each with a regression check (camera-dialog takes bypassing the archive; the file backend never archiving; remove-presenter resurrection; kept-plan fields dropped from the archive; PG jsonb key reorder falsely reading as edits; finish discarding aligned takes; finish nulling the director's staging — now re-derived per applied scene; take review upload failures eating the take).

What remains is human-bound by the plan's own release definition (§10): a real presenter recording the benchmark mechanism in the app, and the viewing-gate evaluation with independent viewers. A live rerun of the provider proof on the final tree is in flight (`live-explainer-check.mjs`, asserting zero new Quiver calls on repeat + the director staging live). Two recording-surface decisions also want a product call: whether teleprompter edits in the camera dialog should write back to the authored script (the records are deliberately separate today), and whether a "Change direction" override belongs in the camera dialog when per-beat author layout overrides already exist in the scene studio.

## 2026-09-19 — D6: the director pass is proven through the real renderer

**Commits**

- `514533d0` — `finish-director-check.mjs` drives `explainer_finish` through the smoke app's real `/mcp` endpoint and real hidden window (no stub): the applied scene carries a stage track the director actually chose (`speaker-full` + overlay for the fixture), the shot plan and coach brief persist, and the finish checkpoint lands on the durable run row. In the release suite (22).

## 2026-09-19 — D6: finish stages applied scenes from a fresh director pass

**Commits**

- `176d9f52` — `explainer_finish` wrote `stageTrack: []` + `directorAuto: null` on applied scenes: the pre-build staging was stale by beat index, but nulling it also dropped the coach brief and every emphasis overlay, and the export fell back to a static camera mode. Finish now runs a fresh director pass over the reviewed content (the hidden window's `direct` atomizer, which now passes `shots` + `recordingBrief` through): shots → the saved `stageTrack` (via `stageTrackFromShots`), and `directorAuto` carries storyboard/shots/brief again. Fail-soft: without a renderer the scene applies with no staging claims rather than stale ones. `explainer-persistence-check.mjs` proves both arms (stub absent → clean nulls; stub present → track + brief on the applied scene), 7 groups green.

## 2026-09-19 — §5.5: the paused-build notice names the scenes

**Commits**

- `9babe82b` — The reopen notice said "align-take needs a person" — a stage id. It now names the scenes that need a take ("The last build paused for you: Pickup scene needs a take…"), resolved through the same pickup map the rail marks use (so a scene whose pickup was already recorded drops out). `stage-panel-check.mjs` asserts the scene name.

## 2026-09-19 — §5.5: a failed take upload keeps the review

**Commits**

- `a540426d` — Keep's failure path no longer eats the take: the review stays open with the blob intact and Keep retries ("Upload failed — the take is still here"). The check surfaced that a prior Keep left the button disabled into the next take's review — `enterTakeReview` re-arms it. Audio-mode switch and camera re-enable end a pending review (the capture context it came from is gone). `take-workflow-check.mjs` 22/22 (500 on the upload → review stays → retry archives).

## 2026-09-19 — §3.7: review the take before it counts

**Commits**

- `b7b8dab4` — The camera dialog auto-committed on stop; now stopping shows the take in the preview with its sound, and only **Keep take** uploads and archives it — **Discard** drops it and offers a fresh take. Closing mid-recording stops into the review (never a silent commit, never a silent loss); closing while reviewing discards. The commit path clamps duration to 1h (an int4 overflow the check caught). `__timing.stageReview` stages a stand-in blob into the recorder's own review step for headless coverage. `take-workflow-check.mjs` 20/20 (review shown, discard leaves nothing, keep archives + closes).

## 2026-09-19 — fix: kept-plan takes align against the voice-carrying track

**Commits**

- `acdd5b41` — The human build fed the aligner the take's `videoUrl` — for a kept-plan take that is the composite, which need not carry the voice at all (the camera track does). `takeAudioUrlFor` picks the camera track for kept-plan takes and the take's own file otherwise; vitest 4. Whisper would otherwise have aligned against silence.

## 2026-09-19 — fix: take disposition at finish

**Commits**

- `5273602d` — `explainer_finish` deleted the active take for every applied scene: on the human path that discarded the very take the scene was aligned to (the person's video left the composition), and the durable selection still pointed at it, so hydration resurrected it on reopen. Now the narration record decides: `alignment: 'selected-take'` keeps the take (it is the timing authority); anything else removes it from the document AND clears the durable selection (`/api/takes/clear`), merged-away scenes included. `explainer-persistence-check.mjs` proves both dispositions.

## 2026-09-19 — fix: kept-plan fields survive the archive round-trip

**Commits**

- `95e2de0f` — `keepsPlan`/`beatMarksMs`/`cameraUrl` reached the commit route but were silently dropped before the archive (the dispatcher's input type lacked them; the spread hid the excess-property check). They now ride the take's `detail`, and hydration restores them — a kept-plan take reopened on a fresh client re-renders at the pace it was spoken, as designed. `take-workflow-check.mjs` 17/17 (commit with beat marks → strip the doc → reload → hydrated whole).

## 2026-09-19 — fix: canonical digests across the store boundary

**Commits**

- `44acf8ca` — The jsonb key-reorder finding generalised: `digest()` (narration, proofs, export hashes) and the finish/export "changed?" guards all hashed or compared raw `JSON.stringify`. Across a PG round-trip that falsely reads as a different scene: a re-finish after a reload would have reported "the notebook changed during generation", and export would have refused a faithfully applied scene. One canonical recipe now (stableStringify inside digest; the export guard compares canonical forms). `explainer-persistence-check.mjs` proves both: re-finish and re-export after a key-reordering round-trip pass, and the concurrent-edit guard still fires.

## 2026-09-19 — §3.9: reviewed stamps carry a content hash

**Commits**

- `ee0392e5` — `explainer_finish` stamps each applied scene with `explainer.hash` over the exact reviewed svg+program. Publish and the library badge compare it to the scene on the page: a scene edited after the review reads "Draft export — N of M scenes changed since the rich build's review" (Publish dialog and badge tooltip), instead of wearing the reviewed label forever. **Found by the check:** PG jsonb reorders object keys, so the stamp hashes a canonical key order (stableStringify) on all three sides — finish tool, page, fixture. `create-explainer-check.mjs` 16 assertions incl. reviewed → edited → draft-again.

## 2026-09-19 — fix: take archive on every backend; presenter removal clears the selection

**Commits**

- `ecb3515c` — Two more seam bugs from the camera-archive audit. (1) The archive + selection writes were inlined in the **PostgreSQL** `saveRecordedBlock` only — the file backend's commit path never wrote them, so takes/selections silently didn't exist on the opt-out store. The dispatcher now composes archive + selection for every backend. (2) "Remove presenter track" cleared only the legacy presenterTracks, leaving the archived take active — and hydration resurrected it on reopen. A new `/api/takes/clear` route clears the active take + durable selection on both backends while the archive keeps every take; the remove control is enabled when either system has a take (its legacy `presenterTracks`-only predicate would have left archived takes unremovable). `take-workflow-check.mjs` 16/16 (removal, archive retention, no resurrection); `local-store-check.mjs` proves archive+selection on the file backend and joins the release suite (21).

## 2026-09-19 — fix: camera-dialog takes join the durable archive

**Commits**

- `f8ae5424` — **Integration bug found by audit:** the camera dialog's take (the plan's own recording surface, with the coach card and rehearsal) wrote only the legacy `presenterTracks` — the take archive, the coach's recorded state, and the human build's `takeAudioUrl` (all keyed on `recordedBlocks`) never saw it. The take would have recorded, composed, and then been treated as unrecorded by the build. Now the dialog's save commits through `/api/recordings/commit` like the canvas flow: archived, auto-selected, on the block, pickup notes refreshed; a failed archive commit says so without eating the local take. `take-workflow-check.mjs` +3 assertions (real asset upload → archive → selection → document), 14/14 PASS.

## 2026-09-19 — §3.7: pickup marks in the scene rail

**Commits**

- `87b27c15` — A scene the last build flagged for a pickup carries a "needs pickup" mark in the notebook rail, so the unfinished scene is visible without opening it; a take recorded after the checkpoint answers the note and the mark clears (compared by checkpoint `updatedAt` vs take `recordedAt`). The coach card and the rail now share one pickup map (`refreshPickupNotes`, refreshed at boot, on take commit, on take selection, on camera open). `stage-panel-check.mjs` 11/11.

## 2026-09-19 — §8: diagnostics record skill versions

**Commits**

- `63d8be55` — `/api/diagnostics` now lists every installed skill with its declared frontmatter version and a content fingerprint of the whole skill folder, so a later skill edit visibly invalidates the evidence a proof stands on. The desktop host hands the worker the vendored skills root (`STUDIO_SKILLS_DIR`, in-process); a browser-only server reports none. `diagnostics-check.mjs` +1 assertion (all seven skills present, versioned, hashed; secrets scan unchanged and green).

## 2026-09-19 — §3.7: pickup notes on the coach card

**Commits**

- `4794c111` — When the last build's take alignment flagged beats for a scene, its camera dialog opens with "The last take needs a pickup: beat 2 — The take skips the second sentence." — the targeted-pickup loop lands where the creator records. The needs-input checkpoint names the scene's file stem; `harness:artefacts` now exposes the run's `story.json` so the product maps it back to the notebook scene id. `stage-panel-check.mjs` 9/9 (new coach-card assertion with a real run dir on disk).

## 2026-09-19 — D4: the Assets dialog names parts and behaviors

**Commits**

- `e8d02920` — Reusable-object cards now list the editable part ids and the named behavior clips the artwork carries (scanned from the accepted record's `data-object-clip` markers, which survive id-prefixing), so choosing artwork for a scene no longer guesses from a thumbnail. Pure presentation in `artwork-detail.ts` (vitest 5); the Assets dialog has no scripted seed route — the library read path is provider-gated by design — so coverage is unit + typecheck, stated plainly.

## 2026-09-19 — §5.5: a paused build survives reopening

**Commits**

- `ce062b92` — On notebook open, the last Build Explainer run's durable state surfaces in the build panel: a run with `needs-input` stages opens with "The last build paused for you: align-take needs a person…" and its stage checklist; an interrupted or cancelled run shows its record; a finished build stays quiet. Status honesty comes from the harness's merged history (an interrupted run's durable row still says "running"; the merge reports it as error). `stage-panel-check.mjs` +2 assertions (reopen shows the wait, a done build stays quiet); 8/8 PASS.

## 2026-09-19 — D1: themes carry their site

**Commits**

- `0f4d5d8d` — Site associations (the D1 work-list item left open): a brand read's picked direction can be saved as a durable theme with the site on it (stable id per site + direction, so re-saving revises one theme); reading the same site again names the saved theme and revision in the brand step. **Bug found by the check:** a palette revision that said nothing about the site dropped the association (`site || null` on every revision update) — both backends now keep the site unless it is explicitly changed. The private-network read guard relaxes only under the existing test-hooks flag so checks can run a fixture brand site on loopback. `theme-library-check.mjs` +2 assertions (site round-trip, survives a site-less revision and a restart); `theme-site-check.mjs` PASS (5, UI loop with a fixture brand server); in the release suite (20).

## 2026-09-19 — D4: revision lineage is proven

**Commits**

- `a4d5557c` — `appearance-revisions.test.ts` (provider mocked): an edit records a new content-addressed revision with `parentKey`, the parent record and index entry survive untouched, a palette override lands on the revision brief, repeating the same edit reuses the cached revision with no provider call, and prompt-less/parent-less edits are refused before any call. Suite 19/19 re-verified after the commit.

## 2026-09-19 — §5.5: a missing take is a durable needs-input, never a silent voice

**Commits**

- `c86c5e4d` — `explainer_narrate` refuses a human-delivery run: the refusal records a `needs-input` checkpoint naming the scene, so the build durably waits for its person instead of failing or synthesizing a substitute (§3.7's "never silently generated speech" made deterministic, not just instructed). The skill states the stop rule. `narrate-guard-check.mjs` PASS (5); in the release suite (19).

## 2026-09-19 — §10: the delivery-path switch is proven non-destructive

**Commits**

- `6eb92a69` — `create-explainer-check.mjs` gains the switch criterion: with a recorded take and scene artwork in place, human → generated → human keeps the take archive, the active take, and the scene's SVG byte-identical. 14 assertions PASS; the publish walkthrough now clicks through the junction step when the notebook has 2+ scenes.

## 2026-09-19 — §5.8a: take-picker provenance

**Commits**

- `591d8435` — The take version picker shows each preserved take's recorded time and keeps-the-plan mark, so choosing among takes never guesses which retake is which. `take-workflow-check.mjs` extended (3 new UI assertions on the reopened, hydrated notebook) and PASS.

## 2026-09-19 — §5.5: the build panel shows durable stage checkpoints

**Commits**

- `295aac66` — The build panel lists the run's recorded stage checkpoints in plain language, polled during the build and kept at the end; a `needs-input` stage reads "waiting for you" with its named beats (the intentional human-waiting state, never a failure). Pure presentation in `stage-view.ts` (vitest 4); `stage-panel-check.mjs` PASS (6 assertions) via the `__buildStages` dev hook; in the release suite (18).

## 2026-09-19 — §3.8: rehearsal loop in the camera dialog

**Commits**

- `d45a92da` — Rehearse beside the camera: the scene's proposed graphics play at the plan's estimated pace with its cue lines, beat jump/replay controls, and the director's pencilled shot per beat; the take stays the timing authority (playback stops when recording starts, nothing in the pane is recorded, closing resets). `rehearsal-check.mjs` PASS (10 assertions); in the release suite (17).

## 2026-09-19 — §5.5: bounded review loops + per-scene review status

**Commits**

- `dde89d49` — per-scene review status (◆) in the notebook rail from the rich build's reviewed stamp.
- `ff4bc0b0` — the preview loop is bounded: per-scene review budget (default 8), the retained best passing proof answers over-budget calls with the exact remaining issue. Motivated by the live build's ~30-minute review loop. `review-budget-check.mjs` PASS; in the release suite (16).

## 2026-09-19 — §3.9 staleness tool + human audio path

**Commits**

- `dd2af87a` — `explainer_status`: per-scene freshness across preview proof, narration, and notebook application, so dependent stages are visibly stale before anything re-runs. Lineage check covers fresh-after-finish and stale-after-edit (11/11).
- `73df9dc4` — the human path's export carries the take: take alignment stores the take audio as an asset and writes the narration record the finish applies as `recorded-mic`; a guide never silently substitutes for an unrecorded segment. Take-alignment e2e 8/8 proves the chain end to end on real synthesized speech.

## 2026-09-19 — D5 §5.4a: the isolated object-performance review is required

**Commits**

- `12758188` — `explainer_review_object`: an accepted asset rendered alone at display size, each clip driven rest/action/settle in the real renderer, frames captured, fidelity against the parent enforced (a performance may not redraw the art). Receipt per object; the rich finish refuses a performed object without one. Skill instructs the review before finishing. Real-DOM proof in `object-performance-check.mjs` (captures + fidelity refusal); the lineage check proves the gate refuses then admits.

## 2026-09-19 — D4 slice 3: the Objects panel

**Commits**

- `706999f2` — the build's progress panel shows the cast live: reused / generated / edited / generating (brief written, artwork pending), from run-dir assets via `harness:artefacts`; the asset tool records reuse per asset. Release suite re-verified after the story-master change: 15/15.

## 2026-09-19 — D2 complete: the local harness plans the story

**Commits**

- `0e1b3046` — `story-master` skill (SKILL.md + workflows/plan-story.md): reads the source + wording policy + target, writes `story/outline.json` + receipt. The source dialog's outline step runs it through the local Kimi harness when the desktop is present (the server model route remains the browser-only fallback); the harness events stream into the dialog's status line; the result is validated + modeled through `/api/story/model`, which now returns the sanitized outline. `harness:artefacts` exposes story outputs.

**Live proof:** `story-live-check.mjs` PASS — a real Kimi run planned 6 scenes from a 56-word creator narrative under `preserve`, narration carrying the author's sentences verbatim, with an honest receipt note about the 60s target trade-off; the product validated and persisted the model. ~2 minutes per outline.

**Plan status after this:** every D-phase's software work has shipped and been proven at the deterministic tier; the live tier is proven for story planning and the full explainer build. Human-bound remainders: the paired presenter export and the viewing-gate evaluation.

## 2026-09-19 — the live provider proof completed

**Commits**

- `20a68c4c` — fix: the fork's base snapshot was stored against the child notebook before the child existed (FK violation on PG, latent since the file-backend era). Now an unattached global asset that outlives both notebooks. Adds `live-explainer-check.mjs`.

**The live proof (plan §8 top tier), one real run:** a fresh one-scene base about retry storms, forked, then built by the local Kimi harness with installed skills only: story authored, 4 Quiver objects acquired (`arrow-2`), reused across placements, `preview`/`narrate`/`finish`/`export` stages all `succeeded` in `studio_build_stages`; the finish receipt carries a verified cast; `verifyExplainerExport` passed and the 36.1s MP4 exists (in the 30–45s proof band). The run dir is preserved under KEEP_LIVE_DIR. Eyeballed export frames show the real artwork performing (clients + server with capacity gauge), not cards.

**Cost honestly measured:** one scene took ~95 minutes wall — dominated by the agent's visual review loop and one finish/hash-guard retry. That is the plan's predicted creative-quality bottleneck: the stage checkpoints make it visible; bounding and coaching the review loop is the D7 efficiency follow-up.

## 2026-09-19 — D6 slice 6: emphasis headlines render

**Commits**

- `4967dc60` — camera-led shots with a short headline compile a timed `.scene-emphasis` overlay into the composition: theme-colored, in the frame's safe corner, live only during the shot's beat window (the scene driver toggles it with the stage). Unit: index.test.ts 38 (2 new).

## 2026-09-19 — D6 slice 5: transitions execute in the renderer

**Commits**

- `42b04340` — the shot plan's boundary treatments play: the outgoing shot's transition becomes the incoming segment's `transitionIn` (sanitize keeps known kinds, drops others); the motion driver applies `data-stage-transition` + `--stage-glide` at the boundary — cut lands at once, dissolve crosses on opacity, reframe/object-expand glide at their own durations. Unit: stage 8, shot-plan 13 (parity + boundary carriage).

## 2026-09-19 — D5 proof: take alignment end to end

**Commits**

- `71f6a4c8` — `take-alignment-e2e-check.mjs`: a synthesized system-voice take (labeled stand-in) through the real `explainer_align_take` + whisper — beats re-time to the measured delivery, beat-local anchors, cue occurrences validated, faithful take needs no review, checkpoint lands, preview hash matches the re-timed program. In the release suite (15 checks; SKIP-marks honestly when uv/whisper can't run). Fixed the tool's missing `requests` uv dependency, found by this check.

## 2026-09-19 — D7 diagnostics

**Commits**

- `0d9c3293` — `GET /api/diagnostics`: a secrets-free bundle — store health, counts, provider capability flags (booleans, never values), artwork budget usage, recent runs with stage outcomes. `diagnostics-check.mjs` verifies shape + scans for credential leakage; the release suite covers it (14 checks).

**Release suite:** `yarn studio:check` → unit gates + 12 scripted checks, all green.

## 2026-09-19 — D6 slice 4: the coach card loop

**Commits**

- `2c005128` — `coach.ts`: the recording journey as data — scenes in order, done when it has an accepted take, resumes at the first unfinished one. The camera dialog opens with the scene's coach card (recording brief objective, per-shot framing, what happens next) plus journey position. The take-saved toast names the next scene. The brief is persisted on the scene node with the director's plan. Unit: 121 (4 new).

## 2026-09-19 — D6 slice 3 + D7 suite runner

**Commits**

- `527e6a66` — shots drive the composition: DirectedShots carry their stage-family mapping, `stageTrackFromShots` builds the renderer's track from the applied plan (parity-tested against the storyboard's, lead-outs included), and the editor preview, saved `stageTrack`, and persisted `directorAuto` all read the shot plan.
- release suite — `apps/studio-desktop/scripts/release-check.mjs` runs the unit gates plus all eleven scripted journey/storage checks and reports; `yarn studio:check` builds both apps and runs it. Latest run: **13/13 PASS**.

**What this release proves deterministically** (per plan §8's lower tiers): delivery-path discovery and recording, durable PostgreSQL/MinIO persistence with migration + backup/restore, revisioned themes across restarts/ports, immutable source/narrative/model records, lineage-preserving splits and merges, durable runs/takes with reopen hydration, verified artwork casts, complete vendored instruction graphs, cue occurrence identity, and take-aligned timing.

**Known remaining gaps (need live providers or a human):** the paired end-to-end export proof with a real Quiver generation and a real recorded presenter; the scene-by-scene coach loop UI consuming RecordingBrief with capture controls; full-camera emphasis text rendering and transition execution in the renderer (the plan is applied and validated; the visual execution of the new transition kinds lands with the composition work); the viewing-gate evaluation with independent viewers.

## 2026-09-19 — D6 slices 1+2: shot sequences and the recording brief

**Commits**

- `66af24cc` — `shot-plan.ts`: the director's storyboard compiles into DirectedShots (beats, focus, view: camera-full/camera-text/shared/animation-full, emphasis on camera-led shots only, explicit transition out — object-expand/cut/reframe/hold with restrained durations — and per-shot reasons). `validateShots` enforces full ordered coverage; `recordingBriefFor` turns the plan into per-scene plain-language guidance. `direct()` returns both. Unit: 115 (9 new).
- `ccff68ad` — the scene editor's staging area shows the shot sequence with transitions, and the recording brief when the notebook is in human delivery.

**D6 remaining:** the composition engine executing shot views directly (today the storyboard drives stageTrack as before; shots are the review/authoring surface), the scene-by-scene coach card loop (ready → recording → analyzing → accepted) consuming `RecordingBrief`, full-camera emphasis text in the renderer, and transition execution in the composition.

## 2026-09-19 — D5 slices 1+2: cue identity and take-aligned timing

**Commits**

- `6dddbd10` — cue occurrence identity: `retry#2` pins the second occurrence — resolved against the measured alignment first, the text estimate second; narration alignment refuses a cue whose occurrence was never said; scene contract documents it. Unit: 106 (3 new).
- `724bbb94` — `explainer_align_take`: a selected human take becomes the timing authority. `align_take.py` transcribes once and maps beats onto the actual transcript in order (near-misses don't consume the take); missing/changed passages return as named review items (rebind or record a pickup — speech is never invented); stage checkpoint reports `needs-input`. Human-mode run inputs carry each scene's take audio; the skill routes generated→`explainer_narrate`, human→`explainer_align_take`. `align-take-check.mjs` 8/8 on canned transcripts (no model needed).

**D5 remaining:** the paired end-to-end export proof (same mechanism, real take + generated narration) needs a live run with provider keys and a real recording; the object-performance required stage (isolated + in-scene review receipts) is partially covered by the clip contract and needs the dedicated §5.4a workflow stage.

## 2026-09-19 — D4 slice 2: role-driven briefs + compatible reuse

**Commits**

- `6f11b69a` — `briefFromRole` turns the explanation model's objects into validated artwork briefs (model id is provenance, excluded from the brief key so notebooks share drawings). `findCompatibleArtwork` reuses an accepted library asset when entity/role/family/palette match and its parts cover the scene's needs — before any provider call. `/api/appearance/library` answers "used in N notebooks" from the durable store; the Assets dialog shows it. Unit: appearance-briefs.test.ts 4/4 (suite 104), including reuse with no provider key configured (a call would throw).

**D4 remaining:** the Objects panel's live acquisition states during a build (reused/generating/checking/accepted — data exists in run stage rows, wiring is D7 UX), behavior revisions, and the live Quiver provider proof (needs QUIVER_API_KEY at run time).

## 2026-09-19 — D4 slice 1: cast receipts + complete motion bundle

**Commits**

- `7313d8a7` — cast verification: `/api/appearance/verify-cast` proves every `data-appearance-key` marker resolves to an accepted library asset with its real geometry (path/points tokens survive the import's id prefixing); rich finish/export refuse forged or mismatched markers; the finish receipt records the cast per scene. The adapted diffusionstudio bundle gains `svg-compatibility.md` (retargeted to native SVG/SMIL, Skottie instructions replaced), transitive upstream references resolved (`player-contract.md` inlined as a rule; chapterization pointer → our scene-contract), and `skill-references-check.mjs` guards the shipped instruction graph (58 refs, vendor trees excluded by design).

**Checks:** appearance-cast.test.ts 5/5 (suite 100); lineage 8/8 incl. forged-marker refusal; persistence check green.

**D4 remaining:** role-record-driven briefs (the D2 model's objects → artwork briefs), visible acquisition states in the Objects panel (exists partially), bounded repair budget surfacing, used-in references in Assets UI, live Quiver provider proof (needs the key at run time).

## 2026-09-19 — D3 slice 3: durable presenter takes

**Commits**

- `c1c8fe2c` — `studio_presenter_takes` + `studio_take_selections` (migration 007): every committed recording is an immutable take row over its media asset; the active take is a separate selection. `/api/takes` list + `/api/takes/select` (unknown takes refused). Notebook deletion removes take records explicitly before the cascade (delete-restrict on media preserved). Reopen hydrates archive + selected take into the document. **Bug found by the check:** the debounced DB sync cloned the project at schedule time and clobbered hydration's fresher write — now clones at fire time. `take-workflow-check.mjs` 8/8 (incl. restart survival + reopen hydration).

**D3 remaining:** recording coach consuming the director's scene cards (D6 territory), rehearsal workspace polish, `needs-input` stage state in the run UI (the run rows already persist; the coach state machine is D6).

## 2026-09-19 — D3 slices 1+2: lineage and durable run state

**Commits**

- `ed033f1f` — video scenes may split/merge base pages: origins carry scenes arrays from the fork; rich finish validates *coverage* instead of one-to-one counts (unknown covers rejected, every input must be covered); two-pass apply (validate all, then mutate); merges fold origin + consume the page; splits clone ordered children; concurrent-edit guards watch every covered page. derive tests 6; `explainer-lineage-check.mjs` 7/7.
- `d30f2d99` — durable run/stage state: `studio_build_runs` + `studio_build_stages` (migration 006) with routes; RunManager records start/gate/finish with inputs hash and resume id; `harness:list` merges live over durable (interrupted runs report as errors with resume ids, never as running); artefacts/pages resolve past runs; explainer tools checkpoint preview/narrate/finish/export per run. `run-history-check.mjs` PASS; stub-CLI harness e2e row verified in PostgreSQL.

**D3 remaining:** the narrative workspace + recording coach wired to director scene plans (stable beat ids, take selection/edit lists, durable needs-input wait), rehearsal playback. The fork idempotency (forkKey) predates; resume without duplicate forks holds.

## 2026-09-19 — D2 slice 1+2: story records; page-master forms and identity

**Commits**

- `11d3e4f1` — narrative revisions + explanation models. `studio_narrative_revisions` / `studio_explanation_models` (migration 005, content-addressed, immutable; KV variant on the file backend). Narrative reads persist the author's text under the chosen wording policy (policy is part of the record's identity). New `/api/story/model` turns an outline into claims/objects/relations with stable positional scene ids, cross-scene object identity, object-id relations, and illustrative flags — persisted and returned. Wording policy threads into the outline prompt. Notebooks pin `project.story = { wordingPolicy, narrativeId, modelId }`. UI: wording segment in the source dialog (narrative → "Keep my wording" default, link → draft, always changeable).
- `71c327c7` — page-master draws forms, not boxes: explanation-form selection (pool/timeline/chart/panels/sequence/definition/code), `data-object-id` in the page contract + checker, model objects + `modelId` in the draw-run inputs, `form` in the receipt, and template pages labeled "template draft" in the UI.

**Checks:** studio-v2 suite 95 (6 new); `story-records-check.mjs` 10/10; checker rejects a malformed `data-object-id` and accepts a real one; `yarn studio:test` green.

**D2 remaining:** outline assistance still runs through the server model gateway; the self-contained local story-workflow skill (harness-owned) is open. Base draft/revision persistence beyond the notebook row lands with D3's coordinator. An end-to-end base-deck journey over a live model belongs to the release suite (D7).

## 2026-09-19 — D1: durable theme library + source capture

**Commits**

- `12a55cc7` — theme library in the durable store: `studio_themes` + `studio_theme_revisions` (migration 003), content-hash idempotence, revision badges, one-time browser-cache import, failed durable saves say so. File backend keeps the same contract over its settings KV.
- theme→wireframes/briefs — `sourceMakePages`/`sourceDrawPages` derive palette + light/dark mode from the chosen direction instead of forcing `mode: 'dark'`; `/api/appearance/*` accepts a validated palette override that lands in the brief (and its cache key); burned captions use theme CSS vars.
- source revisions — `studio_source_revisions` (migration 004), content-addressed immutable snapshots captured in `/api/source/read`, optional **Brand website** for pasted narratives (kept separate from content; fails soft), `project.source.snapshotId`, revision id shown in the brand step; `GET /api/source/revisions/:id`.

**Acceptance checks (D1)**

- Theme survives an app restart on a different port; palette edit creates rev 2 with rev 1 retained — `theme-library-check.mjs` 8/8. ✔
- Light palette reaches wireframe SVG unforced; dark still darkens — `source-capture-check.mjs` 8/8. ✔
- Every read captured immutably; identical re-read is a no-op; creator's words verifiable from the stored revision; unreadable brand URL warns without touching the narrative. ✔
- Quiver palette threading is typechecked and brief-key covered; a live provider run is pending Quiver key availability (none exercised here).

**Not done / notes**

- Saved-theme → brand/site association and the three explicit brand choices (saved / from website / from colors) beyond the current directions UI remain open; the store has `site` for it.
- `pageBrandFrom`'s `auto` mode still always darkens; all product callers now pass an explicit mode.

## 2026-09-19 — D0a: PostgreSQL and MinIO are authoritative

**Commits**

- `4d9ac770` — desktop worker selects postgres unless `STUDIO_PERSISTENCE=local` is explicit; smoke requires the postgres/minio health report; storage warning banner with retry; build copies SQL migrations for the bundled worker.
- `5f0a7a91` — tracked ordered migrations (`studio_schema_migrations` ledger, `002_asset_lifecycle.sql`); asset upload lifecycle pending → byte-verified → ready with startup reconciliation; global library assets (no notebook owner) get first-class rows.
- `d3e995eb` — exported MP4s registered in MinIO with verified asset rows; render response carries the durable reference.
- importer — `inspectLocalStore`/`importLocalStore` in `persistence-pg.ts`, `GET|POST /api/migrate/local`, UI banner driven by *pending* notebooks (idempotent, non-destructive; ids and object keys preserved so takes keep resolving).
- backup/restore — `apps/studio-v2/scripts/studio-backup.mjs` + root `studio:backup`/`studio:restore`; manifest with per-object sha256; restore replays migrations onto fresh volumes.

**Acceptance checks (D0a)**

- Desktop smoke + product test 7/7 with health `postgres`/`minio` (`bash-mqzda2lf`). ✔
- Existing work imports with a report; re-import is idempotent; source files untouched — `migration-check.mjs` 10/10. ✔
- Verified backup restores into a fresh database + bucket: row counts and object checksums match — `backup-restore-check.mjs` PASS. ✔
- No silent file fallback (banner + smoke), global asset rows always written, pending uploads reconciled at startup. ✔
- `local-store-check.mjs` keeps the file backend green as an explicit opt-out. ✔

**Not done / notes**

- Harness run directories are still the working copy; durable per-stage checkpointing of accepted harness artifacts is D3's workflow coordinator (exports and library artwork are durable today).
- Browser `localStorage` custom themes move to PostgreSQL in D1 (the importer covers notebooks/objects/takes/settings, not browser state).
- `docs/DEVELOPMENT_HANDOFF.md` and earlier sections of `TEST-REPORT.md` describe the pre-switch file store; the 2026-09-19 addendum marks them.

## 2026-09-19 — D0: wrong-path trap removed, baseline established

**Commits**

- `9ddab44f` — legacy diagram tool renamed **Basic diagram** (slash menu, block chrome, wizard, shape collection, timeline meta, director note, toasts). Block type ids and `/api/explainer/*` endpoints unchanged.
- `e2ede25e` — **Create explainer** entry (commandbar + empty state) with two equally prominent paths, *Present it myself* and *Generate automatically*, and independent material selection (link, own narrative, this notebook's base). The choice is recorded as `project.explainerDelivery` (`human | generated`), remembered per notebook, never assumed.
- `ffb4b87d` — `harness:artefacts` also reads an explainer run's `receipt.json`/`export.json`; the build panel renders them after a verified run (scenes applied, export duration vs reviewed scene hashes, reviewed-MP4 link). Page-draw receipts surfaced in the source flow.
- `09f3f309` — Publish labels its result: *reviewed explainer export* only when every video scene carries the rich build's `explainer.reviewed` stamp, otherwise a visible *draft export*. Library badges: **Base** on roots, **Draft/Reviewed** on derived videos next to the lineage badge.

**Acceptance checks (D0)**

- Both delivery paths discoverable without a blog or a pre-existing automatic video — Create explainer dialog, two path cards, "My own narrative" material. ✔
- The rectangle-producing action is now visibly a basic diagram; it cannot report a completed rich explainer (no path to `explainer_finish`). ✔
- An MP4 render alone cannot advance rich-build status — Publish labels derive only from the reviewed stamps the rich build applies. ✔
- Rich completion still routes through `reviewExplainer` proofs + `verifyExplainerExport` in `run-manager` (unchanged); its receipts now reach the UI. ✔
- Tests: `yarn studio:test` (94 unit tests + studio-v2 typecheck) green; `studio-desktop` build + smoke + product test 7/7; new `scripts/create-explainer-check.mjs` journey check.

**Not done / notes**

- The human path records the choice and routes into the shared rich build; scene-by-scene recording, takes and coaching are D3/D6.
- Draft/Reviewed badge state is computed per card from saved scene stamps; fine at library scale, revisit if the listing grows.
- Pre-existing: `markdown-composition` `tsc --noEmit` fails on `derive.test.ts` (`BlockRenderConfigV1.blockId`) on the base commit; not part of `studio:test`, left as-is.

