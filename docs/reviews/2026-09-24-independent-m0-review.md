# Independent M0 planning review — verified findings and remaining acceptance

24 September 2026. This report records independent verification, not the implementation handover's claims. The Stripe journey reached a rich base and reviewed second video-plan revision. OpenAI and Anthropic source/theme checks ran, but their generated-deck and video-plan acceptance is incomplete: Claude Code exhausted its usage credits during the OpenAI outline run. No final-video quality acceptance is claimed.

## Tree and environment

- Main checkout: `feat/hyperframes-markdown-mvp`, `e2984d85`, with pre-existing uncommitted repairs.
- Submitted changes: `claude/hyperframes-markdown-handover-674230`, `b396f0a2`. These changes are not merged into the main branch.
- Built and tested the existing `.claude/worktrees/m0-integration` checkout, which combines that submission with the pending repairs. The planning workspace, planning service and harness model registry were compared with the submitted branch and matched byte for byte.
- Real manual runs use isolated local PostgreSQL 17 and MinIO, not the JSON file backend. Test data and run evidence: `/Users/think/Downloads/Incredible Studio/reviews/2026-09-24-independent-review/`.
- No application repairs have been made in this review. Do not interpret a passing reproduction of a defect as a passing acceptance test.

[Open annotated visual evidence](2026-09-24-independent-m0-evidence/annotated-evidence.html). Original screenshots and reproduction fixtures are included in the adjacent evidence directory.

## Checks completed

| Check | Result | Limit |
| --- | --- | --- |
| Studio and desktop production builds | Pass | Does not establish output quality |
| Studio unit suite | 205/205 | Integrated tree, includes pending repairs |
| Desktop typecheck | Pass | |
| Desktop tests | 7/7 | Standard suite, separate from the isolated manual review |
| Harness models check | 10/10 | |
| Planning integration check | 31/31 | Stub harness, not model judgment |
| Independent file-store probes | 5/5 reproduce observed behavior | Four defects, plus a valid fixture check |
| Independent PostgreSQL/MinIO probes | 5/5 reproduce the same behavior | See `2026-09-24-independent-m0-evidence/pg-probes.log` |

## Priorities

| Priority | Findings | Repair outcome |
| --- | --- | --- |
| P1 | R1 stale ancestry, R2 duplicate/competing runs, R9 hidden provider failure | Trustworthy current results, one owner per run, actionable recovery |
| P2 | R4 plain default path, R10 missing visual inputs | Preserve presentation quality and actually pass it to video planning |
| P2 | R3 evidence fallback, R5 delivery, R6 preferences, R7 arithmetic, R8 continuity, R11 polling | Reliable editing and technically consistent plans |
| P3 | R12 misleading progress | Honest phase and page progress |

## Confirmed findings

### R1 — P1: A stale explanation brief can still produce a current, reviewable scene plan

**Reproduce.** Prepare a brief and a scene candidate. Change the video's retained source revision without changing its scene script, theme or direction. Load the overview and mark the candidate reviewed.

**Observed.** The brief reports stale, the scene reports candidate, and the review endpoint accepts it. The independent probe returned `{"briefStale":true,"sceneState":"candidate","reviewStatus":"reviewed"}` on both persistence backends.

**Source.** `apps/studio-v2/server/planning-service.ts:240` calculates treatment fingerprints using the last ready brief's old fingerprint. `src/planning/planning-records.ts:157` receives the current brief fingerprint but never uses it to establish scene freshness. `server/planning-service.ts:492`, `:593` and `:629` do not gate queueing, landing or review on the brief's current ancestry.

**Fix.** Make freshness a shared dependency check: retained inputs → brief → treatment. Preserve stale results for reading, but prevent them from becoming current or reviewed. Test source, narrative, model and wording-policy changes both during a run and after candidate creation.

### R2 — P1: Concurrent identical requests create multiple active runs; run ownership can be replaced

**Reproduce.** Queue the same brief four times concurrently. Separately, attach run A to a queued record, then attach run B while that record is running.

**Observed.** Four records with revisions 1–4 were created. The second attachment replaced run A with run B. Both file and PostgreSQL backends reproduced this.

**Source.** `server/planning-service.ts:470` reads existing records and later creates a new record, without an atomic idempotency claim. `:518` allows run attachment in both queued and running states. Revision uniqueness prevents duplicate revision numbers, not duplicate work.

**Fix.** Atomically claim a request by project, kind, subject and fingerprint. Claim queued → running once, retaining a stable owner run ID. Updating the actual model from a session event must be an owner-checked metadata operation, not another unrestricted attachment. Add simultaneous queue, retry-after-response-loss and competing-owner tests.

### R3 — P2: The retained-fragments fallback cannot validate its own evidence

**Reproduce.** Use a base whose full source snapshot is unavailable but whose pages retain source passages. Prepare a brief quoting one of those exact passages as source evidence.

**Observed.** The packet contains the passage and explicitly instructs the harness to use retained fragments. Submission rejects it as absent from the retained source. The PostgreSQL probe returned `passageInPacket:true, accepted:false`.

**Source.** `server/planning-service.ts:292` passes only `planning.source.text` to the validator. Packet construction at `:338` and `:346` advertises a fallback to passages in `PRESENTATION.md`, but those passages never enter the source evidence pool.

**Fix.** Represent full-source and retained-fragment evidence pools explicitly, preserving their source and page lineage. Validate quotes against the pool supplied to the run, with partial-coverage warnings. Do not relabel source passages as creator statements to pass validation.

### R4 — P2: The default page-creation path bypasses the rich drawing skill

**Reproduce.** Read a blog, create its outline, press Make the pages, then follow the primary Open the notebook action without the separate Draw action.

**Observed.** The product produces instant template drafts with plain text and rectangular diagrams. The UI says pages are "fully declared", which measures semantic annotations, not visual quality. The user noticed this during this review. During the separate rich drawing run, completed SVGs had restored icons and meaningful slot-pool artwork, but the grid still showed all the original templates: it only imports results on the run's final `done` event.

**Source.** `src/main.ts:15460` calls `/api/source/pages`. `server/source.ts:675` renders fixed templates; diagram nodes at `:806` are rectangles with labels. `src/main.ts:15291` defines a separate `page-master` redraw step. The base import is available before that step finishes.

**Fix.** Make the skilled presentation drawing pass the normal base-deck action when a local harness is available. Keep a clearly named instant schematic draft option. Label drafting, designing, checking and ready states separately. Show validated page previews incrementally, with a completed/total count. A failed or incomplete drawing run must offer explicit draft import or retry; it must not silently appear equivalent to a completed designed deck.

**Evidence.** `2026-09-24-independent-m0-evidence/02-template-drafts-draw-stage.png`, the HTML overlay in `2026-09-24-independent-m0-evidence/annotated-evidence.html`, intermediate rich-page renders `2026-09-24-independent-m0-evidence/03-rich-drawn-comparison.png`, `2026-09-24-independent-m0-evidence/04-rich-capacity.png` and `2026-09-24-independent-m0-evidence/05-rich-bucket.png`, and completed UI screenshot `2026-09-24-independent-m0-evidence/06-rich-deck-complete-ui.png`. The intermediate renders are direct Cairo renders of the product harness's SVGs, not browser screenshots; they use renderer font fallbacks. The completed drawing run produced and imported 12/12 pages. It took 26m 33s. This finding establishes a workflow problem, not loss of the rich drawing capability.

### R5 — P2: Initial creation still requires a whole-notebook delivery choice

**Reproduce.** Open Create explainer and try to enter the From a link path without first choosing Present it myself or Generate automatically.

**Observed.** The UI blocks progress and asks for one of those choices. This contradicts the agreed per-scene decision model implemented in the planning workspace.

**Source.** Creation flow in `src/main.ts:15854` and `:16080` retains the earlier global prerequisite.

**Fix.** Create the source and base notebook independently of delivery. Keep scene delivery undecided until the author or director sets it. The same scene record should drive planning, recording and generated narration.

**Evidence.** `2026-09-24-independent-m0-evidence/01-forced-delivery.png`.

### R6 — P2: Provider/model selection is fragmented and resets after app restart

**Reproduce.** Choose Claude in the creation flow and inspect the model options for drawing, then compare those with the new planning workspace model picker.

**Observed.** Story and drawing are pinned to the old `CREATION_AGENTS` choices. The first real review runs used `claude-fable-5-1`, even though the requested planning test is Claude Opus 5.5. Opus 5.5 selection in the planning workspace does not configure the earlier stages. The live restart test also reproduced lost preferences: selected Claude Sonnet 5 (without starting a run), restarted the isolated app, reopened the same video, and the picker reset to Claude Opus 5.5. The reviewed r2 and its direction remained intact. Evidence: `2026-09-24-independent-m0-evidence/10-reviewed-and-model-before-restart.png` and `2026-09-24-independent-m0-evidence/11-reviewed-and-model-after-restart.png`.

**Source.** `src/main.ts` defines `SOURCE_DRAWERS = CREATION_AGENTS`. `src/planning/planning-workspace.ts:147` maintains separate planning preferences in origin-local storage. The desktop worker chooses a new local port per launch, so these preferences are not durable application settings.

**Fix.** Use one durable harness/model preference service and capability registry across source, drawing, planning and composition. Allow deliberate stage overrides and show their effective model before starting. Persist requested and reported model separately. Do not infer that an installed CLI's default is the author's preference.

### R7 — P2: An impossible illustrative mechanism passes plan validation without a warning

**Reproduce.** On the retained Stripe article, generate the token-bucket scene with Claude Opus 5.5. Inspect the demonstration and moments 4–5.

**Observed.** The plan starts with five tokens, adds two refill tokens, describes eight requests draining the bucket, and rejects request nine. At most seven requests can be admitted with that supply. The report has no warnings. These values are explicitly illustrative, but the explanation must still obey its own mechanism. The same plan otherwise has a useful continuous world, restrained camera moves and a visible cause/consequence sequence.

**Source.** `src/planning/scene-treatment.ts:214` validates references, recipe IDs, coverage and shape. The proposed example and state changes remain free text; no semantic audit verifies that the invented numbers and transitions agree. This is a generated-content defect that current acceptance checks miss, not a request to make every initial explanation brief an executable simulation.

**Fix.** Once creative planning chooses a concrete example, require a bounded correctness review of its assumptions, event order and consequences. For countable mechanisms, add a small state ledger (initial + additions − consumption = final, failed requests consume nothing). Surface contradictions as plan issues before review. Keep the upstream brief open to creative choices. The explicit-feedback r2 corrected the ledger to seven admitted requests and request eight refused. Its demonstration states the ordering constraints and keeps the refill interval fixed. This proves the revision loop can repair the plan; it does not prove the product detects the contradiction itself.

**Evidence.** `2026-09-24-independent-m0-evidence/stripe-bucket-r1.json` and `2026-09-24-independent-m0-evidence/08-bucket-plan-r1-arithmetic.png`.

### R8 — P2: A scene assumes an unplanned neighbor's outgoing image

**Reproduce.** Generate the token-bucket treatment before scene 9 has a video treatment.

**Observed.** Its entry states that scene 9 leaves four limiter tiles with one marked as most frequent. Scene 9 is still Ready to plan; its base wireframe is a quantitative chart. The packet cannot establish that outgoing video image. The scene uses the assumption to specify a matching morph rather than identifying a conditional continuity proposal. By contrast, scene 3 explicitly records that its opening depends on how scene 2 ends and allows a fresh opening.

**Source.** The treatment has free-text entry/exit fields, and the scene packet does not supply an approved adjacent scene boundary. Validation checks references and recipe compatibility, not whether a neighboring plan actually promises the incoming state.

**Fix.** Supply adjacent treatment revision/status where available. Distinguish agreed boundaries from proposed ones; absent agreement, use a self-contained opening or record a continuity decision. Resolve proposals before composition and invalidate the agreement when either reviewed neighbor changes. This should coordinate creative scenes without prescribing a fixed set of slide categories.

**Revision result.** Bucket r2 uses a self-contained opening and lists any incoming match as an unresolved continuity agreement.

**Evidence.** `2026-09-24-independent-m0-evidence/stripe-bucket-r1.json`; the comparison treatment in `2026-09-24-independent-m0-evidence/stripe-comparison-r1.json` demonstrates the more careful conditional alternative.

### R9 — P1: Provider quota failure is overwritten by a generic story error

**Reproduce.** Use the OpenAI PostgreSQL article with Claude Code in an account whose usage credits are exhausted. Let the source outline run finish.

**Observed.** The CLI's public error says “You're out of usage credits” and offers switching model or managing credits. The final visible product message is only “The story run ended error”, with Outline it available again. The author cannot tell whether the source, network, model or account is the problem. The outline artifact had already been written, but the run failed during checking; this report does not treat the unvalidated partial artifact as a completed base.

**Source.** `src/main.ts:15080` streams transient event text into one status label. At `:15100` the final status is converted to a generic exception, overwriting the actionable message. The event subscription also fails to filter by run ID, so simultaneous planning runs can overwrite its progress. The new planning-record error path does not cover this earlier story path.

**Fix.** Retain a structured terminal error with provider, requested/actual model, category, exact safe provider message and recovery action. Scope events to the active run. Show quota exhaustion with Retry after restoring credits and Switch harness/model, preserve the source/theme draft, and never automatically retry a known quota error. Use the same durable last-status service across source, drawing, planning and composition.

**Evidence.** `2026-09-24-independent-m0-evidence/09-provider-error-hidden.png`, `2026-09-24-independent-m0-evidence/openai-provider-error.json`. Actual run: `run-mufmmj85-2f190b96`, model `claude-fable-5-1`, session `18189cb7-4421-47e6-a2f1-06ca53ad6fa8`, exit 1 at 14:31:23 UTC. The provider's public text was inspected; private reasoning was neither used as evidence nor copied into this report.

### R10 — P2: The planner receives a theme ID and page filename instead of their usable contents

**Reproduce.** Prepare a brief and generate scene 3 from the saved rich Stripe base. Open its packet and the plan's unresolved items.

**Observed.** The brief packet has an opaque theme reference but no palette or typography. The scene packet names `pages/<base-scene-id>.svg` but does not materialize that SVG or a preview. The generated plan itself states that the saved theme's palette is absent and leaves color mapping unresolved. The rich page exists durably; its visual decisions are simply not being passed to the video designer.

**Source.** `server/planning-service.ts` constructs the brief and scene packets from record metadata and Markdown. `themeRef` fingerprints the theme but does not supply its content. `scenePacket` supplies four files (brief, explanation, scene and context), with a wireframe path that is only a reference string.

**Fix.** Materialize the pinned theme tokens, usable fonts or fallbacks, base SVG and thumbnail in the run packet. Include reusable asset previews/rig metadata where relevant. Treat them as reference material: the video remains free to restage the explanation. Validate that every local asset path in the packet resolves before starting a run.

**Evidence.** [stripe-brief-packet.json](</Users/think/Downloads/Incredible Studio/reviews/2026-09-24-independent-review/evidence/stripe-brief-packet.json>), [stripe-s03-packet.json](</Users/think/Downloads/Incredible Studio/reviews/2026-09-24-independent-review/evidence/stripe-s03-packet.json>), and `2026-09-24-independent-m0-evidence/14-theme-packet-gap.png`, where the real model explicitly reports the missing palette.

### R11 — P2: Polling closes the document the author is inspecting

**Reproduce.** During a running creative plan, open Raw files, collapse Stored record, and expand `packet/SCENE.md`. Wait for the next status poll.

**Observed.** Within three seconds the packet collapses and Stored record opens again. This was reproduced in the visible app, not inferred solely from code. The focused control disappears from the accessibility tree during the full replacement.

**Source.** `planning-workspace.ts:305` replaces the entire root on every poll, preserving only selected scroll positions and textarea focus. `renderRaw` unconditionally opens the stored record and recreates packet disclosures closed.

**Fix.** Update progress/status incrementally, or preserve disclosure and focus state across rendering. Verify a packet remains open and keyboard focus remains usable while any scene has an active run. Also cover the custom-model input and horizontal sequence scroll position; those additional symptoms are not yet reproduced.

**Evidence.** `2026-09-24-independent-m0-evidence/07-raw-inspector-reset.png` captures the reset state after the observed interaction.

### R12 — P3: Progress reports reading a manual as writing a page

**Reproduce.** Start Draw through Claude Code and observe progress while it reads the vendored manuals.

**Observed.** The UI reports “wrote executor-structure.md” even though the provider was reading that manual. A long run therefore offers misleading activity instead of actionable page progress.

**Source.** `harness/adapters/claude-code.ts:156` emits the same file event for every tool input with a path, including Read and Write. `main.ts:15400` renders every file event as “wrote”.

**Fix.** Include operation type in tool events. Present drafting/designing/checking stages and completed/total page counts; keep raw tool activity in an expandable log.

**Evidence.** `2026-09-24-independent-m0-evidence/02-template-drafts-draw-stage.png` contains the misleading status.

## Remaining code concerns, not claimed as live-reproduced defects

- **Interrupted plans may remain stuck.** `RunManager.history()` reports orphan runs interrupted only in its returned summary, while planning records are separate. The workspace Stop handler ignores a false cancel result. A restart during a real active planning run remains untested because the provider quota was exhausted. Add startup reconciliation and a recovery acceptance test.
- **Drawing can apply to a different source draft.** `applyDrawnPages` reads current global `sourceState.pages` and matches filenames by numeric index, rather than binding to the source draft that started the run. Closing the modal and starting another source during drawing needs a live race test before asserting it occurred.
- **Presentation drawing still generates legacy motion programs.** `page-master/workflows/draw-pages.md` requires one program per SVG and the checker enforces it. The 12-page pass took 26m33s, but this review cannot attribute that whole latency to programs. Separate the presentation result from video planning and measure each phase.
- Horizontal sequence scroll reset and custom-model-field loss during polling remain code-based concerns, not verified user-visible failures.

## What the real run demonstrates

The 12-page skilled presentation pass restores iconography, stronger hierarchy and purposeful forms, including a concurrency slot pool, a token bucket, a log-scale comparison and a safe-launch sequence. It remains schematic and often uses cards; it is suitable evidence of base presentation capability, not evidence of rich animated video quality.

The Opus 5.5 brief completed. It distinguishes source-backed claims, creator wording, illustrative values and suggested communication needs. It names uncertainty about the article's shedding order, burst implementation and historical counts rather than silently asserting those details. The token-bucket unit asks for before/action/after and visible depletion causing rejection, while leaving the concrete demonstration open to creative planning. These are useful improvements over a video foundation of slide categories.

## Live article matrix

| Source | Source / theme / outline | Rich base drawing | Video brief, actual model | Scene revisions and review |
| --- | --- | --- | --- | --- |
| Stripe, Scaling your API with rate limiters | Completed; 12 scenes | Completed and imported, 12/12 | Completed; session reports `claude-opus-5-5` | Scene 3 r1; bucket r1→r2, compared in UI, r2 reviewed; records/direction survived restart |
| OpenAI, Scaling PostgreSQL to power 800 million ChatGPT users | Source read; OpenAI Paper theme saved; outline failed on provider credits | Blocked | Blocked | Blocked |
| Anthropic, Effective context engineering for AI agents | Read 3,153 words / 9 headings; saved Paper theme; second read rediscovered it and binding succeeded | Not run: known provider-credit block | Blocked | Blocked |

The planning milestone does not yet execute Hyperframes compositions. No new rendered-video smoothness, speaker transition or final-export quality claim follows from these planning checks.

The second bucket treatment plans a rich, filled Quiver SVG with named gates, spout, recesses, rim, floor strip and tag holder, with countable tokens kept native. This happened after explicit revision direction; no Quiver artwork or video was generated in this planning-only milestone. The first two unprompted treatments chose native objects throughout, so the rich-asset policy is not yet a reliable default.

Stripe run ledger:

- Story: `run-mufkqtds-e440ee25`, Fable 5.1, 13:35:16–13:41:10 UTC (5m 54s).
- Drawing: `run-mufl0qng-1cb9f399`, Fable 5.1, 13:42:59–14:09:33 UTC (26m 33s).
- Saved rich base: `2e92abb9-a5f4-4d0a-8cf7-0eaca374171f`.
- Video fork: `video-830fce2a-873d-4511-a6f0-804e9303bf33`, pinned base `6b551bcce331c11a`.
- Brief: `plan-brief-c0d56cfb-58bf-4cf4-ae4e-25e031bf756b`; run `run-mufm1965-339fc1aa`, Opus 5.5. Provider session `dfda16eb-a5cf-4a5a-884b-d441fb8d4c91` independently reports that model.

- Bucket r1: `run-mufm7rtb-5d579380`, Opus 5.5; comparison r1: `run-mufm8icw-51936ca5`, Opus 5.5.
- Bucket r2: `run-mufmk9hf-f3ffc4b9`, Opus 5.5, accepted 14:30:54 UTC (~4m44s); session `cd814d2f-1d13-41d5-9dcf-24933f77e0fc`. Reviewed through UI at 14:33:52 UTC.
- App restart changed origin from `127.0.0.1:55647` to `127.0.0.1:60427`. Both revisions, review status, brief, scene direction and saved themes persisted in PostgreSQL/MinIO. The planning model preference did not.

Anthropic read/theme evidence: `2026-09-24-independent-m0-evidence/12-anthropic-source-theme.png` and `2026-09-24-independent-m0-evidence/13-anthropic-theme-reuse.png`. Source snapshots `src-ef6bd337fcde6b1b` and `src-8faa9dfc28fa1e57` were retained. The same saved theme revision was offered on the second read. No second doomed provider run was started while the quota error remained unresolved.

## Review boundary and next action

No application code was changed by this review. Start with the P1 integrity/recovery fixes and the default rich-page path, then complete the remaining two article runs after provider credits are available. The next architecture milestone is one reviewed creative plan executed by the product's local harness as a real Hyperframes composition with a reusable Quiver hero asset. The detailed sequence is in `docs/plans/m0-to-rendered-explainer-mvp.md`.

The UI findings have annotated screen evidence. The three backend findings R1–R3 are supported by executable probes and exact PostgreSQL/MinIO transcripts rather than a screenshot pretending to prove a race or validation defect. The live interruption test, additional generated decks, presenter acceptance and rendered-video quality remain unproven.
