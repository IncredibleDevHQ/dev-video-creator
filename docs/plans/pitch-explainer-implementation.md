# Pitch and explainer motion: implementation backlog

17 September 2026 · proposed implementation, based on `6ba2ae15`  
Read with the [product and architecture specification](./pitch-explainer-motion-studio.md).

This backlog defines reviewable work packages, not changes already made. Each package may need multiple small PRs. Keep independently releasable changes behind capabilities or feature flags until the relevant quality gate passes. No migration should require every existing scene to regenerate.

## 1. Sequence, ownership, and estimates

Suggested roles: **R** = runtime/schema engineer; **E** = editor/server engineer; **D** = motion designer; **Q** = product/quality review, shared with engineering. These are workstreams, not a requirement to hire four full-time people.

Effort below is approximate engineering time unless marked design. Allow integration and review time beyond the estimates. With two engineers and part-time motion design, plan roughly 8–12 calendar weeks for the full scope. The first complete rate-limiter reference is the early quality checkpoint, approximately week 3–4.

| ID | Deliverable | Depends on | Lead | Effort |
| --- | --- | --- | --- | --- |
| P00 | Baseline and regression fixtures | — | R/Q | 1–2 days |
| P01 | Reference visual and motion treatment | P00 | D/Q | 2–3 design days |
| P02 | Versioned story, object, and compiled contracts | P00 | R | 2–3 days |
| P03 | Scene persistence and compatibility migration | P02 | E | 3–4 days |
| P04 | Shared semantic and geometry evaluation | P02 | R | 3–5 days |
| P05 | SVG object ingestion and validation | P02 | E | 3–4 days |
| P06 | First three polished objects | P01, P04, P05 | R/D | 3–5 days + design |
| P07 | Compiler and shared playback integration | P04, P06 | R | 3–4 days |
| P08 | Stable explainer direction | P07 | R/D | 3–4 days |
| P09 | Presenter and caption occupancy over time | P07, P08 | E | 3–4 days |
| P10 | Common timing map | P02, P07 | R | 3–4 days |
| P11 | Recording anchors and alignment lifecycle | P03, P10 | E | 3–4 days |
| P12 | Identity-preserving dialogue edits | P03, P10 | E | 3–4 days |
| P13 | Scene, object, and event inspectors | P03, P07, P08, P12 | E/D | 3–4 days |
| P14 | Source planner and harness integration | P02, P05, P08, P13 | E | 2–3 days |
| P15 | Pitch policy and controlled treatments | P01, P07, P09, P10, P13 | R/D | 2–3 days + design |
| P16 | Versioned asset library and bounded jobs | P03, P05 | E | 3–4 days |
| P17 | Quiver static SVG adapter | P06, P16 | E | 2–4 days |
| P18 | Generated animation compatibility experiment | P07, P10, P17 | R | 2 days, bounded |
| P19 | Second mechanism and reusable object coverage | P08, P09, P11, P13 | R/D/Q | 2–3 days + design |
| P20 | Export reproducibility and performance | P09, P10, P11, P15, P16 | R | 3–4 days |
| P21 | Integrated regression, pilot, and rollout | P12–P17, P19, P20 | E/Q | 2–3 days + pilot |

P18 is optional and cannot block a working native-motion release. P17 may ship after the core two-mode product if provider access is unavailable. P21 then explicitly excludes that capability from the enabled release.

The critical chain is contracts → shared semantics and asset ingestion → real objects → compiler/playback → stable direction and presenter/timing → authoring reliability → finished-video review. Provider artwork is a separate branch from asset ingestion; it must not become a prerequisite for proving the core product.

## 2. Foundation and contracts

### P00 — Capture the baseline before changing the model

**Scope:** preserve a current limiter project, the authored program, assets, camera settings, and any available takes. Add a small nested-object fixture and a two-object legibility fixture. Record the supported browser/runtime and a named performance machine. Capture the current test results and preview/export behavior.

**Targets:** existing tests in `apps/studio-v2/src` and `packages/markdown-composition/src`; a proposed `tests/fixtures/motion-scenes/` fixture directory; a short benchmark receipt.

**Done when:** another developer can load the same scene, render it, and reproduce the selected frame checkpoints. The receipt distinguishes observed output from historical claims. No new failure is waived simply because the old tests pass.

**Required regression cases:** prefixed IDs; parent/child transforms; move then resize; moved camera targets; quantity ownership; `become` and visibility handoff; omitted/page/named camera distinctions; dialogue rewrite, genuine split, rewrite-into-two, three-way split, and merged moments; save/reopen; cropped presenter placement.

### P01 — Agree on a motion treatment that is worth implementing

**Scope:** design the request, bucket, and server; their ports and labels; a stable explainer composition; one presenter position and handoff; and three pitch treatments. Produce a short animated treatment, using any suitable authoring tool, as a visual target. Its purpose is to establish quality, not add another production renderer.

**Done when:** the limiter mechanism is understandable with audio muted, the narrated version has sufficient dwell, and the presenter is integrated rather than added after layout. Record palette, strokes, corner treatment, token appearance, easing, and idle amplitude as reusable design decisions.

**Exclude:** a broad icon catalog, unnecessary camera cuts, and polished artwork for every scene before the first mechanism works.

### P02 — Publish the versioned contracts and compatibility matrix

**Scope:** define the exact `SceneProgramV2`, `ObjectDefinitionV1`, `ObjectInstanceV1`, `TimingMapV1`, `DirectionPolicyV1`, and `CompiledSceneV1` schemas. Audit the existing runtime types, schema validators, sanitizers, driver, and harness for accepted operations. Define the v1 adapter and the ownership of every field.

**Targets:** `apps/studio-v2/src/scene-program.ts`; composition `motion-plan.ts`, `types.ts`, and `schemas/`; proposed shared program/object modules.

**Done when:** fixtures for a legacy page, a merged moment, a new bucket scene, and an invalid conflicting scene validate or fail with precise diagnostics. Unsupported capabilities are explicit. The schema describes story events separately from text windows and rendering tracks.

**Design constraint:** do not invent fields for hypothetical simulators. Every initial field should be used by one of the reference cases or by compatibility.

### P03 — Persist the new records without changing old projects

**Scope:** add scene mode, policy version, program version, object instances, and timing anchors to attributes, saved documents, snapshots, duplication, and undo/redo. Persist immutable object packages in both supported backends. Provide an explicit scene upgrade with a preserved original revision.

**Targets:** `scene-node.ts`, `main.ts` version attributes, `server/persistence.ts`, composition `types.ts`.

**Done when:** old projects reopen with the same effective behavior; a new scene survives edit → save → close → reopen; duplicates receive distinct scene/instance identities while preserving intended shared asset references. Undo restores a previous mode or appearance and its associated canonical references.

**Verification:** migration round trips against both file-backed and database/object-store-backed project storage. Missing assets yield visible diagnostics and a compatible fallback, not malformed saved state.

## 3. Objects, state, and playback

### P04 — Share state semantics and hierarchy math

**Scope:** extract pure operation effects, transform composition, visibility, and quantity semantics. Add arbitrary-time evaluation and maintain the existing beat-boundary API. Define ordering for simultaneous actions, initial state, and property ownership conflicts.

**Targets:** composition `motion-plan.ts`, `motion-driver.ts`; application `scene-program.ts`, `placements.ts`; proposed `scene-state.ts`.

**Done when:** compiler boundary state and player state agree for moves, absolute resize-from-drawing, quantities, phase/state, and morph handoffs. An ancestor carries its descendants once. Repeated seeks cannot accumulate movement. Object state does not depend on the previous DOM frame.

**Verification:** differential tests at starts, midpoints, ends, and random seek orders. Include nested intrinsic SVG transforms and two instances sharing an asset. Keep compiler and time evaluator distinct where appropriate; shared semantics and parity are the acceptance criteria.

### P05 — Load and validate controllable SVG object packages

**Scope:** parse package manifests, map named parts and ports, compute bounds, normalize supported SVG features, prefix references, and reject unsupported autonomous behavior. Preserve intrinsic geometry and application-controlled labels.

**Targets:** composition `slide.ts`; application `slide-atoms.ts`, `page-model.ts`; proposed `object-assets.ts` and package validator.

**Done when:** the same object loads as a standalone preview, a nested page object, and a prefixed composition asset with matching geometry. Missing part IDs or an unsupported clip result in a diagnostic with a static/native fallback. Validation cannot claim a capability merely because a provider included its name in a manifest.

**Verification:** gradients, masks, clip paths, supported style references, duplicate source IDs, inherited transforms, local fonts, and unavailable references. Validate declared animation envelopes against sampled native recipe output.

### P06 — Implement three production-quality technical objects

**Scope:** request, token bucket, and server definitions with deterministic internal motion. Each has a polished static state, valid ports, native recipes, palette bindings, text anchors, and a fallback.

**Done when:** consumption changes count and drawing together; an empty bucket stays empty until refill; a rejected request visibly differs from a passed one; server processing begins after arrival. Burst requests have separate identities. Every object is usable outside the limiter fixture.

**Verification:** state table snapshots and short movies across every supported transition. Review at actual output size and smaller playback size. An idle recipe may indicate running state, but cannot create phantom capacity or imply that a rejected operation succeeded.

### P07 — Compile and play the complete scene through one engine

**Scope:** lower authored semantics and object recipes into `CompiledSceneV1`, reusing `MotionPlanV2`. Integrate object tracks into the shared serialized runtime and Hyperframes composition. Build a source-based runtime bundle rather than copying logic into multiple strings.

**Targets:** application `scene-program.ts`; composition `index.ts`, `motion-driver.ts`; proposed compiler and object runtime modules.

**Done when:** the rich limiter scene can play, pause, seek, and export without free-running animation clocks. The compiler identifies the owner of each animated property. The same timestamp yields the same quantities, visible actors, camera, and placement in preview and export.

**Verification:** run through the real SVG prefixing and export paths, not only a test DOM. Confirm that the legacy path remains available and that unsupported new bundles fail visibly.

### P08 — Add the Explainer directing policy

**Scope:** stable principal-object anchors; meaningful routing; limited explanatory patterns; camera movement driven by detail or explicit intention; continuity penalties and author pins. Mode rules consume actual evaluated geometry.

**Targets:** `director.ts`, `placements.ts`, `video-plan.ts`; proposed `direction-policy.ts`.

**Done when:** the limiter can complete its mechanism in one persistent spatial map. Changes in text wrapping or sentence boundaries do not trigger fresh staging. Crowding from a large object is diagnosed or resolved by recomposition, not concealed by a zoom that makes other labels unreadable.

**Verification:** compare auto decisions after minor wording changes; test hard pins and insufficient-space cases; review the full silent and narrated scene.

### P09 — Compose presenter and captions over the entire motion

**Scope:** add swept object occupancy, caption safe areas, presenter safe areas, and transition paths to placement scoring. Use stable placement preferences, hysteresis, and planned handoffs. Maintain manual framing controls.

**Targets:** `placements.ts`, `director.ts`, stage placement application and composition mapping.

**Done when:** no critical actor, label, or consequence crosses under the presenter during its explanation. A camera crop is respected in every candidate score. No feasible speaker position results in a deliberate handoff or clear conflict, not a random corner jump.

**Verification:** a moving request whose endpoints are clear but whose path intersects the presenter; a growing queue; a resized actor; a camera move; captions spanning two lines; a pinned speaker lane. Include actual presenter footage in the review.

## 4. Timing, edits, and authoring

### P10 — Resolve one timing map for all tracks

**Scope:** support event start/arrival/consequence anchors, minimum readable durations, causal constraints, and estimated/marked/aligned confidence. Retiming resolves motion, camera, presenter, and captions together.

**Targets:** composition `index.ts` existing retiming helpers; application program compilation; proposed `timing-map.ts`.

**Done when:** pace changes preserve order and meaningful action duration, or report an explicit infeasible interval. Captions and presenter transitions consume the same map as object behavior. Repeated retiming from canonical inputs does not compound previous rounding or warping.

**Verification:** short and long narration, simultaneous independent events, pause insertion, merged beats, an arrival aligned to a word, and an interval too short to show the required sequence. Test each supported project frame rate rather than assuming every timestamp is a 30fps integer.

### P11 — Attach recording timing to stable identities

**Scope:** new recordings store beat/event identities with marks, selected audio revision, and alignment provenance. Existing takes retain the index-based compatibility reader. Connect available word-timestamp output or an alignment adapter; manual anchors remain a complete supported workflow.

**Targets:** recording paths in `main.ts`; composition recording types and retiming; new timing anchor serialization.

**Done when:** changing artwork reuses the same take, while rewriting spoken text makes alignment stale without deleting the take. Audio, camera, and visual durations remain consistent. Selecting a different take selects its own timing data.

**Verification:** guide voice, microphone recording, camera plus audio, narration-only, paused recording, and a legacy take. Low-confidence word alignment is shown as needing correction rather than silently asserted to be exact.

### P12 — Preserve story identity through dialogue edits

**Scope:** give dialogue segments explicit identity and lineage. Move events only through an intentional story edit or an accepted redistribution. Preserve current v1 matching as a migration/import fallback, not the canonical long-term model.

**Targets:** `scene-program.ts` edit mapping; new segment records; focused editor integration.

**Done when:** a complete rewrite keeps events with its segment; a true split retains provenance; a merge keeps both semantic moments and their order; a three-way split remains recoverable; deleting a story element makes the affected events visible for removal or reassignment.

**Verification:** keep the previously troublesome “takes a token” → “consumes one credit” case; repeated common words later in the script; undo/redo; recut then replan; pace change then reopen; nested `then` migration. Assert stable IDs and event ownership, not only matching event counts.

### P13 — Build focused inspectors and behavior preview

**Scope:** scene mode and intensity; object appearance and capability controls; behavior selection; timing anchor correction; visible diagnostics. Separate “change appearance,” “change behavior,” and “recompose.” Add an advanced event strip without building a full video editing timeline.

**Targets:** new inspector modules, wired through `main.ts` and scene transactions.

**Done when:** an author can create the limiter behavior, replace the bucket appearance, pin the presenter, adjust an arrival anchor, switch mode, undo, save, and reopen without editing program JSON. Every change shows what scope it affects.

**Verification:** end-to-end authoring path with an existing wireframe. Incompatible artwork cannot expose unsupported behavior controls. Mode switching preserves semantic events and explicit pins. Diagnostics link to the affected object or interval.

### P14 — Teach source planning and the harness the same contracts

**Scope:** extend outline output with objective, mechanism, assumptions, and mode suggestion. Generate typed programs and object mappings. Add optional asset package manifests to harness imports and expose shared validation/compile tools.

**Targets:** `server/source.ts`; `apps/studio-desktop/src/harness/ipc.ts`; relevant page-master, stage-director, motion-master, and video-producer workflows.

**Done when:** a blog can produce a built-in rich explainer without Quiver. The harness and editor validate and compile through the same implementation. Source-based facts and invented demonstration parameters are distinguishable. Old SVG/program sidecars still load.

**Verification:** import a declared page and a sparse legacy page; validate missing references; refuse partial package replacement; regenerate direction without rewriting accepted semantics. Use at least two source topics.

### P15 — Ship Pitch as a second policy on the same engine

**Scope:** presenter-to-hero, type-led proposition, and object-led reveal/match move. Expose mode switching and outline suggestions. Keep readable durations, semantic constraints, and presenter safety.

**Done when:** the limiter project has a compelling pitch opening and a calm explanatory body using the same visual family. Switching a body scene to Pitch alters direction but preserves the mechanism. It is possible to keep a stable pitch composition when that treatment suits the idea.

**Verification:** mode round trip, pinned framing, narration-only, long text, constrained presenter space, and a reduced-intensity setting. Review the complete sequence for stylistic coherence, not merely the presence of kinetic type.

## 5. Asset providers and reuse

### P16 — Add versioned asset packages and bounded generation jobs

**Scope:** accepted/candidate asset versions, scene references, immutable content hashes, job lifecycle, retries, cancellation, stale revision handling, usage records, and spending controls. Reuse existing file/object storage.

**Targets:** server persistence and asset routes; composition asset types; existing library UI; proposed `asset-jobs.ts`.

**Done when:** two scenes reuse one accepted drawing but retain independent state. Replacing a selected version affects only the chosen references. A stale job returns a candidate. Repeated client requests with the same application job key do not create duplicate accepted assets.

**Verification:** process restart, timeout after provider response, cancellation during generation, missing object storage, both persistence backends, and deletion while a project still references an asset. Retain referenced versions or require a replacement; never leave dangling render dependencies.

### P17 — Integrate Quiver static SVG generation

**Scope:** discover account/model capabilities; generate palette-matched object candidates; normalize and validate SVG; map parts; record provenance/usage; enforce bounds and cost limits. Keep deterministic motion application-owned.

**Targets:** proposed `server/providers/quiver.ts`, provider gateway integration, object package validator, generation UI.

**Done when:** at least a bucket and a server generated through the actual API can be accepted, animated with native recipes, reused, reopened, and rendered. They meet the same contract as built-in assets. Measure latency, rejection rate, repair frequency, and cost per accepted asset.

**Verification:** unsupported operation, unavailable key, malformed SVG, unsupported animation, missing named parts, excessive path complexity, and provider timeout. An unavailable provider must not block the rest of the editor or an export using saved assets.

**Decision gate:** enable for users only if it improves appearance at acceptable observed cost and correction effort. A failed experiment does not require weakening the object contract.

### P18 — Time-box generated animation compatibility

**Scope:** obtain a small sample of actual animated SVG responses and test normalized sampling, part identity, start/loop timing, parameter changes, prefixing, and headless export. Document supported constructs and failure reasons.

**Done when:** a short decision note recommends one of: supported clip subset; static artwork plus native motion only; or deferred integration. If compatible, add a single working adapter example and parity tests.

**Stop condition:** two engineering days without a credible deterministic path. Do not build a general SVG animation interpreter or fall back to uncontrolled autoplay to make the demo appear successful.

### P19 — Demonstrate a second technical mechanism

**Scope:** implement queue accumulation/dequeue or cache hit/miss with the same contracts and editor controls. Add the corresponding object family and reuse request/server where appropriate. Check that styles and behavior remain coherent across scenes.

**Done when:** the second scene needs data and recipes, not a new scene-specific renderer or planner. An author can modify its quantities and timing through the inspector. Cross-scene entity naming can be shared, while state resets by default unless a handoff is explicit.

**Verification:** independent repeated instances, branching outcomes, imported appearance, narration timing, and presenter/caption layout.

## 6. Release engineering

### P20 — Make export reproducible and performance measurable

**Scope:** snapshot asset/font/runtime/policy versions and timing maps in render jobs. Stage all dependencies locally. Profile evaluation, layout, SVG painting, seeking, and export separately. Add bounded diagnostics for oversized assets and cache derived geometry safely.

**Targets:** composition `index.ts`, shared driver, render asset staging, server jobs, asset preparation.

**Done when:** a saved render job can be reproduced without contacting an artwork provider. Preview and export agree through real prefixing and font loading. The agreed scene meets the calibrated performance envelope, or the supported complexity limit is explicit and enforced.

**Verification:** cold and warm seek; repeated scene instances; provider offline; changed latest asset version; absent local font; rendering after editor restart; long compositions. Avoid optimizing only the tiny two-box fixture.

### P21 — Gate release on the finished authoring workflow

**Scope:** run the regression matrix, collect narrated reference videos, conduct the pilot, and prepare feature flags, fallback, migration receipts, and release notes. Inspect both a newly generated project and an upgraded legacy project.

**Done when:** all critical behavior and persistence gates pass; the intended audience understands the two mechanisms; motion/presenter craft reaches the agreed standard; and fallback preserves editable canonical data.

**Rollout:** internal fixtures → selected existing projects → default for new projects. Enable provider generation separately from native objects. Disabling a provider prevents new jobs but retains accepted local assets. Disabling experimental direction should not delete programs or overwrite legacy versions.

**Review artifacts:** final narrated MP4s, project snapshots, asset packages, known limitations, performance receipt, test output, migration sample, and an issue list with an explicit release decision for each unresolved item.

## 7. Proposed interfaces and storage details

These names are illustrative until P02/P16 finalize the contract. Prefer existing route conventions where equivalent functionality already exists.

### Asset package boundary

```ts
// Illustrative ownership, not a copy-ready production schema.
type ObjectAssetRef = { assetId: string; version: string; contentHash: string };
type ObjectInstance = {
  instanceId: string;
  entityId?: string;
  asset: ObjectAssetRef;
  initialState: Record<string, number | string | boolean>;
  placement: { parentId?: string; x: number; y: number; scale: number };
  portBindings: Record<string, string>;
};
type StoryEvent = {
  eventId: string;
  beatId: string;
  actorId: string;
  operation: string; // Runtime-validated discriminated operation schema.
  targetId?: string;
  parameters: Record<string, number | string | boolean>;
  after: string[];
  anchor?: {
    segmentId: string;
    cueId?: string;
    edge: 'start' | 'arrival' | 'consequence';
  };
};
```

The actual schema should use typed operation unions for quantities, travel, outcomes, and states. Local placements and bound ports must refer to one documented coordinate system. Asset references are immutable; changes create a new version.

### Service boundaries

| Operation | Input | Output / behavior |
| --- | --- | --- |
| Validate object package | SVG, manifest, requested capabilities | Normalized candidate or actionable validation errors |
| Start asset job | Project/scene revision, object brief, style reference, provider capability, bounded budget, job key | Job ID; existing accepted asset remains active |
| Read/cancel job | Job ID | Status, usage, candidates, failure reason; cancellation is idempotent |
| Accept candidate | Candidate ID, expected project revision, selected scene references | New pinned asset reference or revision conflict |
| Compile scene | Canonical program, exact assets, direction policy, chosen audio/timing | Compiled bundle plus diagnostics; no provider calls |
| Evaluate frame | Compiled bundle and time | Deterministic frame state; no project mutation or network calls |
| Export | Immutable project/take/asset snapshot | Reproducible render job and diagnostic receipt |

Pure validation/compilation should be callable in-process by the editor, harness, and worker where practical. Do not introduce a server round trip for every preview frame.

### Persistence records

- **Project/scene:** canonical program, direction choice, selected asset references, pins, timing anchors, revision.
- **Object definition/version:** manifest, normalized SVG and supporting files, content hash, provider provenance, validation result.
- **Generation job:** input revision/hash, state, provider operation, candidates, usage, timestamps, failure, cancellation state.
- **Recording/alignment:** take ID, audio revision, stable marks, aligned word references, confidence, manual corrections.
- **Compile cache:** dependency key and disposable compiled bundle.
- **Render receipt:** immutable dependency snapshot, renderer environment, result, diagnostics.

Update project references atomically after assets are durable. Use optimistic revision checks when accepting a candidate. Treat cached compiled output as invalid whenever its semantic, policy, timing, font, or asset dependency changes.

## 8. Test and review matrix

| Journey | Required observable result |
| --- | --- |
| Import legacy SVG + program | Existing behavior preserved; no mandatory rich-object conversion |
| Upgrade a node to bucket | Named parts bind correctly; geometry, labels, ports remain coherent |
| Consume → empty → reject → refill | Values and outcomes remain consistent in both playback and random seek |
| Move/resize parent with nested object | Parent carries descendants exactly once; camera and speaker use resulting bounds |
| Reword → split → merge → replan | Stable event ownership; intentional order preserved; uncertainty surfaced |
| Change pace or select take | All visual/caption/presenter tracks follow one chosen timing map |
| Change script after recording | Old take preserved; alignment visibly stale |
| Switch Explainer → Pitch → Explainer | Semantics and pins preserved; only unpinned direction recomputed |
| Swap shared appearance | Chosen references update; independent instance state remains independent |
| Cancel/retry generation | No duplicate accepted assets or unexpected replacement |
| Save → close → reopen → export | Same canonical program, selected assets, mode, pins, and timing |
| Prefix SVG in composition | References and part ownership remain valid; appearance matches preview |
| Presenter and caption transitions | Critical action remains visible throughout the interval |
| Disable provider | Saved assets still play and export; native path remains usable |

Use existing commands for implementation changes:

```sh
yarn workspace studio-v2 test
yarn workspace studio-v2 typecheck
yarn workspace markdown-composition test
yarn workspace markdown-composition typecheck
yarn workspace studio-v2 build
```

Run `yarn workspace node-identifier test` when scene/segment identity work touches the shared node-identifier behavior. Add browser and render checks for affected paths; unit tests cannot certify SVG layout or presenter composition.

The root `studio:test` script does not currently run all the commands above. Update the CI coverage deliberately rather than assuming that one command verifies every new layer. Do not rerun unrelated full-repository checks without a reason.

## 9. First implementation sprint

1. Finish P00 and P01: preserve the current baseline and agree on the actual limiter treatment.
2. Land P02 with fixtures and an exact compatibility contract.
3. Build P03/P05 alongside P04 once the schema is stable.
4. Implement P06 and P07; put the first real narration and presenter over the result immediately.
5. Review whether the mechanism is visibly clearer before expanding the object catalog or commissioning provider integration.

Do not start with broad Quiver generation, a large preset gallery, or a second renderer. The first shippable proof is the narrated limiter scene authored through the product, with deterministic objects and deliberate presenter composition.
