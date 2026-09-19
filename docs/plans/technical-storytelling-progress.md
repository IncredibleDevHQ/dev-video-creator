# Technical storytelling studio — implementation progress

Companion to [technical-storytelling-product-architecture.md](technical-storytelling-product-architecture.md). Newest first. Branch `feat/hyperframes-markdown-mvp`; commits as Karthic <Kartronics85@gmail.com>.

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

## Next up

- **D0a** — PostgreSQL/MinIO authoritative: `worker-host.ts` still forces the file backend (`persistence: 'local'`; smoke probe reports `database: "files"`). Tracked migrations, global asset rows, upload reconciliation, importer, backup/restore.

## 2026-09-19 — D4 slice 3: the Objects panel

**Commits**

- `706999f2` — the build's progress panel shows the cast live: reused / generated / edited / generating (brief written, artwork pending), from run-dir assets via `harness:artefacts`; the asset tool records reuse per asset. Release suite re-verified after the story-master change: 15/15.

**D4 remaining:** §5.4a's isolated object-performance review stage (render the accepted object alone at display size, inspect action/settle against the original, receipt) — the in-scene half exists via cast verification; the isolated half is next.

## 2026-09-19 — D5 §5.4a: the isolated object-performance review is required

**Commits**

- `12758188` — `explainer_review_object`: an accepted asset rendered alone at display size, each clip driven rest/action/settle in the real renderer, frames captured, fidelity against the parent enforced (a performance may not redraw the art). Receipt per object; the rich finish refuses a performed object without one. Skill instructs the review before finishing. Real-DOM proof in `object-performance-check.mjs` (captures + fidelity refusal); the lineage check proves the gate refuses then admits.

## 2026-09-19 — §3.9: staleness as a tool

**Commits**

- `dd2af87a` — `explainer_status`: per-scene freshness across preview proof, narration, and notebook application, so dependent stages are visibly stale before anything re-runs. Lineage check covers fresh-after-finish and stale-after-edit (11/11).

## 2026-09-19 — §3.9 staleness tool + human audio path

**Commits**

- `dd2af87a` — `explainer_status`: per-scene freshness across preview proof, narration, and notebook application, so dependent stages are visibly stale before anything re-runs. Lineage check covers fresh-after-finish and stale-after-edit (11/11).
- `73df9dc4` — the human path's export carries the take: take alignment stores the take audio as an asset and writes the narration record the finish applies as `recorded-mic`; a guide never silently substitutes for an unrecorded segment. Take-alignment e2e 8/8 proves the chain end to end on real synthesized speech.

## 2026-09-19 — §5.5: bounded review loops + per-scene review status

**Commits**

- `dde89d49` — per-scene review status (◆) in the notebook rail from the rich build's reviewed stamp.
- `ff4bc0b0` — the preview loop is bounded: per-scene review budget (default 8), the retained best passing proof answers over-budget calls with the exact remaining issue. Motivated by the live build's ~30-minute review loop. `review-budget-check.mjs` PASS; in the release suite (16).

## 2026-09-19 — §3.8: rehearsal loop in the camera dialog

**Commits**

- (this run) — Rehearse beside the camera: the scene's proposed graphics play at the plan's estimated pace with its cue lines, beat jump/replay controls, and the director's pencilled shot per beat; the take stays the timing authority (playback stops when recording starts, nothing in the pane is recorded, closing resets). `rehearsal-check.mjs` PASS (10 assertions); in the release suite (17).

## 2026-09-19 — §5.5: the build panel shows durable stage checkpoints

**Commits**

- (this run) — The build panel lists the run's recorded stage checkpoints in plain language, polled during the build and kept at the end; a `needs-input` stage reads "waiting for you" with its named beats (the intentional human-waiting state, never a failure). Pure presentation in `stage-view.ts` (vitest 4); `stage-panel-check.mjs` PASS (6 assertions) via the `__buildStages` dev hook; in the release suite (18).
