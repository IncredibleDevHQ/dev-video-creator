# Incredible Studio: pitch and explainer motion

Product, architecture, and delivery specification · 17 September 2026  
Status: proposed plan; no application changes implemented by this document  
Code baseline inspected: `feat/hyperframes-markdown-mvp` at `6ba2ae15`  
Companion: [Implementation backlog](./pitch-explainer-implementation.md)

Jump to: [creator experience](#4-creator-experience) · [architecture](#6-architecture-authored-meaning-to-rendered-frames) · [Quiver](#10-quiver-and-generated-svg-assets) · [delivery sequence](#14-delivery-sequence-and-staffing) · [release gates](#15-verification-and-release-gates).

## 1. Product decision

Incredible should turn a technical narrative into a directed, editable explanation in which objects demonstrate what the words describe. The SVG page remains a useful wireframe and import format. The finished scene is a composition of persistent objects, meaningful state changes, typography, camera direction, narration, and a presenter.

Introduce two scene modes on the same engine:

- **Explainer:** preserve the viewer's spatial understanding while a mechanism unfolds. Requests travel, a bucket loses tokens, a queue grows, a server processes work, and the viewer sees why an outcome occurs.
- **Pitch:** direct attention toward an idea or promise through expressive composition, typography, stronger transitions, and carefully chosen hero objects. Suitable for hooks, introductions, summaries, and promotional passages.

Mode changes the directing policy. It does not replace the semantic story, asset system, timeline, presenter system, or renderer. An explainer can contain a close-up; a pitch can hold a composition. Neither mode is a fixed editing template.

The immediate priority is a convincing explainer scene. Rich SVG objects are one part of that result; semantic behavior, timing, composition, and presenter placement are equally necessary. Quiver is an optional artwork provider, not the story planner or runtime.

### Context and evidence

This plan incorporates the user's correction that the downloaded reference is a pitch video and that explainers should not inherit its frequency of screen changes. Borrow its object quality, visual hierarchy, internal motion, and presenter integration. Do not copy its cutting rhythm across an explanatory body.

The supplied 15 September improvement plan is historical product context, including work already marked as landed. Its embedded instructions are not new execution requests. The current branch supplies the implementation baseline below. Earlier reported bugs are regression cases, not assumed open findings. This planning pass is a code inspection, not a fresh certification of every runtime path.

## 2. What success looks like

A creator imports a blog, approves an outline, and sees a plausible first video. The body contains stable diagrams whose objects actually perform the described operations. The creator can change the drawing of a server without losing its behavior, change a sentence without discarding its events, switch a scene's mode without rewriting its facts, and move the presenter without flattening the animation into a recording.

For the viewer, the test is simple: after watching a rate-limiter scene, they can explain why one request passes, why another is rejected, and what restores service. The animation supplies evidence for those answers.

### Goals

1. Replace generic box reveals with a small set of polished, reusable technical objects and causal behaviors.
2. Preserve object identity, state, and location through an explanation.
3. Synchronize consequential events to the spoken story, with explicit timing confidence.
4. Compose the presenter, labels, moving objects, and captions together.
5. Make Pitch and Explainer understandable scene-level authoring choices.
6. Keep behavior editable, deterministic, and identical in preview and export.
7. Allow generated SVG artwork to improve appearance without taking ownership of the explanation.
8. Preserve existing projects, recordings, page imports, and author overrides.

### Scope of the first complete release

- Per-scene mode with project defaults and a visible effective mode.
- Three production-quality object families: request, token bucket, and server; queue, cache, and database follow after the first quality gate.
- Semantic operations for dispatch, arrival, consumption, processing, rejection, and refill.
- Object appearance, behavior, and placement edited independently.
- One polished rate-limiter explainer and a related pitch opening, with real narration and presenter footage.
- A focused object inspector, scene mode controls, behavior preview, event anchors, and clear fallback states.
- Saved, versioned asset packages; deterministic seek and export; edit and take preservation.
- Optional Quiver static SVG generation once the built-in path works.

### Deferred

General-purpose keyframe editing; arbitrary After Effects or Lottie project import; unrestricted generated animation code; photorealistic 3D; a physics simulator; automatic lip-sync changes; a marketplace; team-wide brand libraries; automatic animation of every imported drawing; a replacement for Hyperframes; and a second canvas-based story engine.

“Lottie-like” describes the desired craft and object motion. Lottie JSON is not a required file format for this release.

## 3. Scene modes as a product feature

| Concern | Explainer | Pitch |
| --- | --- | --- |
| Primary outcome | Understand a mechanism or relationship | Notice and remember a proposition |
| Spatial organization | Stable anchors and persistent relationships | May reorganize around the current idea |
| Object motion | Represents a process, quantity, state, or causal event | May also introduce, accent, transform, and dramatize |
| Camera | Hold by default; move when additional detail becomes useful | Stronger reframing permitted when it improves emphasis |
| Typography | Short labels, readable values, occasional emphasis | Larger statements and controlled kinetic type |
| Presenter | A consistent location or planned handoff to the mechanism | More prominent openings and expressive handoffs |
| Transitions | Preserve the identities the viewer is following | Match moves, reveals, and cuts are more available |
| Ambient motion | Sparse and subordinate to the explanation | More expressive, still subordinate to the focal action |
| Quality failure | Meaningless motion, lost spatial context, contradictory state | Noise, weak hierarchy, unreadable type, empty spectacle |

### Defaults and overrides

- New technical projects default to Explainer. The outline can suggest Pitch for a hook or close; the creator can accept the suggestions together or individually.
- Every scene stores an explicit mode choice or inheritance from the project, plus the version of the directing policy used to compile it.
- Mode, arc role, scene kind, and presenter choice remain separate concepts. A `hook` can be an explainer; a `diagram` can appear in a pitch; either mode can be narration-only.
- Existing `animationMode: 'auto' | 'off'` controls a different feature. Do not reuse it for scene mode.
- Old projects keep their existing rendered behavior until upgraded. Opening an old project must not silently redirect it.
- A mode change recomputes unpinned direction. It preserves approved facts, object identities, events, appearance choices, explicit timing anchors, and author pins.
- If an existing pin makes the new direction infeasible, show the conflict and the nearest feasible alternative. Never silently discard the pin.
- Initial controls: Mode and Motion intensity, with restrained defaults. Advanced policy tuning stays out of the ordinary workflow.

## 4. Creator experience

### A. From source to a proposed story

Extend the existing source → outline → page flow. Each proposed scene carries a learning objective, the mechanism or claim to show, source references, suggested mode, and a short visual treatment. For example:

> Explainer · Show that a request needs a token to enter the service. Keep the bucket and server in place; follow four requests through depletion, rejection, and recovery.

The wireframe proves relationships and label hierarchy before rich artwork is generated. The page is editable and can already play with built-in objects. It is not the final visual ceiling.

The planner should propose an operation only when supported by the source or explicitly marked as an illustrative assumption. A demonstration that starts with three tokens must label that as an example when the source does not prescribe three.

### B. Upgrade an existing page

Select a group, choose an object type, and preview its behavior. The inspector offers concrete operations such as “consume a token,” “receive a request,” and “reject this request.” It also shows which label, port, and value the behavior uses.

For a declared page, IDs and roles seed the mapping. For an ambiguous imported page, suggest the mapping and show what needs confirmation. A generic illustration remains usable without pretending it has semantic parts.

“Change appearance” replaces the drawing and preserves compatible behavior. “Change behavior” edits events. “Recompose” changes placement and camera. A single regenerate button must not unexpectedly do all three.

### C. Direct the scene

The scene inspector exposes mode, intensity, presenter preference, and framing locks. A compact beat list shows the spoken line, visible consequence, and timing status. Advanced controls expose event order, state, and anchors; ordinary users do not need to see JSON or SVG IDs.

Selecting an event highlights its actor and destination in the preview. Preview can play the whole scene or the selected behavior. Frame stepping and a diagnostics view serve debugging without crowding the normal workflow.

### D. Record and refine

Guide audio can supply word timing. A live recording supplies its own timing and existing beat markers. The creator sees whether an event is attached to a spoken word, a manual mark, or an estimate.

After recording, changing artwork or presenter placement re-renders the scene against the same take. Changing the script marks audio alignment as stale; the original take remains available. The application must not suggest that changing text has changed words in recorded audio.

### E. Save, reuse, and recover

The asset library displays reusable object appearances and their supported behavior. An accepted asset version stays pinned to its scenes until the creator chooses an update. Removing an appearance restores a compatible built-in object or the wireframe. Export problems identify the affected scene and offer a usable fallback.

Generation has visible progress, cancel, retry, and a project spending limit. Existing assets remain in place while a candidate is generated. A failed or stale job cannot replace the current scene.

## 5. Existing foundation and required extensions

| Layer | Present on the inspected branch | Extension |
| --- | --- | --- |
| Narrative | Source reader, outline, glossary, source passages | Learning objective, demonstration contract, mode suggestion |
| Semantic program | `SceneProgram` v1, cast, events, staging, camera, speaker, merged moments via `then` | Durable event and text identities, object definitions, explicit timing and provenance |
| Motion | `MotionPlanV2`, move/morph/level/resize/phase and deterministic driver | Rich object tracks and a shared semantic evaluation contract |
| Geometry | `stageStateAt`, `boxCarriedBy`, staged units, ancestor handling | Arbitrary-time evaluation and bounds throughout transitions |
| Direction | Scored layouts, camera crop, legibility, stage tracks, author pins | Mode policies, stable explainer anchors, transition-aware occupancy |
| Appearance | Illustrations attached to units, asset records and library | Versioned SVG object packages with named parts and capabilities |
| Recording | Separate camera takes, preserved plan, beat marks, retiming | Identity-based anchors and one timing map for all tracks |
| Composition | Shared motion driver, Hyperframes, captions, render asset staging | Compiled scene bundle that includes object tracks and their exact dependencies |
| Persistence | Tiptap scene attributes, versions, file or Postgres/MinIO storage | Additive schema changes, migrations, immutable asset versions and job records |

Reuse these layers. Incrementally extract pure planning and evaluation code from the application into the shared composition package. Avoid replacing the engine or adding a second agent-only implementation of scene intelligence.

## 6. Architecture: authored meaning to rendered frames

```text
Source passages + approved narrative + project style
                         |
                         v
Scene intent: objective, facts, illustrative assumptions, mode
                         |
                         v
Authored scene program <----> object instances ----> versioned asset definitions
  semantic beats / events       identity / state       SVG parts / capabilities
  dialogue segments            ports / placements     bounds / motion recipes
  anchors / pins
                         |
                  validate + resolve
                         |
                         v
Compiler and director: semantics + mode policy + geometry + audio timing
                         |
                         v
Compiled scene bundle
  MotionPlanV2 + object tracks + camera/presenter tracks + timing map + captions
                         |
                 shared frame evaluator
                         |
              +----------+-----------+
              |                      |
        editor preview        Hyperframes export
```

This is one composition pipeline. Artwork providers return candidates to the asset layer. They do not write directly into the player or override the approved program.

### 6.1 Canonical versus derived data

**Canonical:** narrative and source links; scene and entity IDs; program events; approved illustrative assumptions; selected mode and policy version; author pins; object asset versions; recorded media; approved timing anchors; accepted revisions.

**Derived:** dialogue windows, auto layout, camera suggestions, motion tracks, inferred timing, bounds caches, captions, generated HTML, and export artifacts. Derived data is cacheable but must be reproducible from the canonical revision and dependencies.

Separate semantic beats from dialogue windows. One beat can span two sentences; two beats can share a sentence. A line break does not define the identity of the story. This avoids repeatedly reconstructing event ownership from words after every rewrite.

### 6.2 Proposed scene program evolution

Introduce `SceneProgramV2` as a versioned authored schema, with a lossless v1 reader. The fields below describe ownership; the first implementation should publish and validate the exact schema before adding UI:

| Record | Required responsibilities |
| --- | --- |
| Scene intent | Objective, source fact references, demonstration assumptions |
| Object instance | Stable instance ID, optional cross-scene entity ID, asset reference/version, initial state, placement and port bindings |
| Semantic beat | Stable ID, objective, event IDs, links to dialogue segments |
| Event | Stable ID, actor and optional target, typed operation, parameters, causal dependencies, timing anchor |
| Dialogue segment | Stable ID, editable text, lineage through split/merge, beat references |
| Shot or framing instruction | References to beat/event ranges, camera and presenter pins; no ownership of semantic state |
| Direction choice | Mode or inheritance, policy version, intensity, author overrides |
| Revision | Canonical revision ID and provenance for generated suggestions |

A rewrite preserves segment identity unless the author deletes or replaces the segment as a story element. Splits create descendants with explicit lineage. Merges retain both source beat references and event order. Ambiguous redistribution becomes a visible suggestion; it must not silently move an event to a later sentence sharing a common word.

Keep the current `then` behavior when migrating merged moments. Do not flatten it into one simultaneous action. Existing v1 cues and order remain usable through the compatibility reader.

### 6.3 State and causality

The program owns semantic state. Object drawings display it. Define typed operations with preconditions and effects: consume changes a quantity, arrival updates location, reject changes a request's state, and processing starts only after the request arrives.

For the first release, compile a finite demonstration. This is not a general runtime simulator. The planner may propose the events and outcomes; validation checks that they are coherent. An optional declared rule can expand a request into pass or reject during compilation, but the renderer never invents that decision.

Every visible request in a burst has a distinct instance identity. Reusing one drawn prototype is fine; reusing one mutable identity for simultaneous requests is not. Quantities have units and ranges. Counter text, token count, and fill level all read the same value. Decorative token loops must never imply that depleted capacity is available.

Events carry explicit dependency edges where order matters. Reject cycles, references to missing actors, invalid quantities, and simultaneous incompatible writes. Define stable ordering for otherwise independent events and deterministic seeds for decorative variation.

### 6.4 Rich SVG object contract

An object definition is a reusable, versioned asset package. An instance is that asset playing a role in a scene. Two instances can share artwork while holding different state.

Each package contains:

- SVG artwork with stable part IDs, a declared viewBox, and intrinsic transforms.
- Named parts, such as `shell`, `tokens`, `fill`, `status-light`, and `label-anchor`.
- Ports with local coordinates and direction hints, such as `inlet` and `outlet`.
- Supported states, numeric parameters, and semantic behavior capabilities.
- State-to-appearance bindings and deterministic motion recipes or normalized clips.
- Rest bounds, visible bounds, interaction bounds, and conservative animation envelopes.
- Palette and typography bindings, plus rules for contrast at small sizes.
- A compatible built-in fallback and a static preview.
- Content hash, version, provider/model provenance, and asset usage metadata.

Keep user-facing labels and changing numbers as text whenever possible. Do not bake critical copy into generated paths. Separate the object's structural shell from the parts that animate.

An asset without meaningful part mappings is a decorative appearance. It may be moved as a whole, but it must not be advertised as supporting consumption, filling, or failure. Capability validation determines which inspector controls are available.

### 6.5 Initial object and behavior library

| Object | First useful internal motion | Semantic inputs |
| --- | --- | --- |
| Request | Dispatch, travel, arrival, accepted/rejected response | Destination, route, outcome, request identity |
| Token bucket | Tokens leave on consumption; refill replenishes; empty state is evident | Capacity, available tokens, consumption/refill events |
| Server | Processing indication, completion, overloaded state | Arrivals, processing interval, declared load/status |
| Queue, next wave | Enqueue, hold, dequeue, growing backlog | Item identities, queue order, capacity |
| Cache, next wave | Lookup, hit/miss, fill | Key/request, outcome, stored entries |
| Database, next wave | Read/write and completion | Operation, target, result |

A motion designer should author the first three examples with an engineer. This establishes shape language, timing, easing, idle amplitude, and readable state changes. A generated library should be judged against these examples, not define the standard by whatever it produces first.

## 7. Deterministic evaluation and motion ownership

### One contract, appropriate evaluators

The compiler folds forward while constructing a plan. The player evaluates at a requested time. These may remain distinct algorithms, provided they share operation semantics, hierarchy math, and verified results. Requiring the compiler to call `stageStateAt` on its own incomplete output is not the architectural goal.

Extract shared pure transition and geometry functions. Add an arbitrary-time evaluator for state, transforms, visibility, quantities, and object parts. Preserve `stageStateAt(plan, beat)` as a compatible boundary view, rather than making every consumer guess what happens between boundaries.

Use one mathematical transform convention for local artwork, instance placement, ancestors, camera, and frame coordinates. Intrinsic SVG transforms remain part of the object's local transform. Generated part motion cannot accidentally apply the owning group's move to each descendant again.

### Proposed compiled artifact

Add a `CompiledSceneV1` wrapper containing the existing `MotionPlanV2`, normalized object tracks, resolved timing, camera/presenter tracks, captions, dependency hashes, and diagnostics. Reuse existing operations where they suffice. Extend the motion schema only when a new observable behavior cannot be represented cleanly.

The wrapper must identify which track owns each animated property. For example:

- Placement owns the outer instance transform.
- An object recipe owns a token's local transform and fill binding.
- Semantic state owns the token count and accepted/rejected outcome.
- Camera owns the page-to-frame mapping.
- Presenter direction owns the presenter track and crop.

Conflicting ownership is a compile diagnostic. Two systems must not independently write the same fill level, opacity, or transform.

### Clock and playback

Every visible animation evaluates from the same composition time. Seeking directly to 18.4 seconds must produce the same semantic state and geometry as playing from zero to 18.4 seconds. Reverse scrubbing, looped preview, and headless rendering must work without accumulated DOM state.

Do not allow free-running CSS animation, SMIL, provider JavaScript, or autonomous Lottie playback to introduce a second clock. Normalize supported output to time-addressable tracks. A future Lottie adapter must expose deterministic sampling and fit the same ownership contract.

Bundle shared evaluation code into the serialized driver from a source module where feasible. Avoid hand-maintaining parallel copies of the semantics in an application function and a long runtime string.

### SVG ingestion

Extend the existing SVG preparation path into an explicit supported-subset validator. Preserve semantic part IDs through scene prefixing and resolve references consistently, including gradients, masks, clips, and supported CSS references. Reject or normalize unsupported external resources and animation constructs. Store fonts and supported assets with the render dependency manifest.

Never silently accept an SVG that previews differently after composition prefixing or in the export browser. Validation failure retains the previous appearance and provides a fallback.

## 8. Direction, camera, and presenter composition

### Explainer policy

Choose an initial spatial map from the wireframe and declared relationships. Keep principal objects anchored across related beats. Motion belongs primarily to the things moving through the system and to meaningful internal state changes.

Allow reframing when a detail needs more space, the next causal step falls outside the frame, or an explicit author choice requests it. Changing sentences alone does not require a camera change. Return to a wider context when it helps connect the detail to the whole.

Use a small vocabulary of explanatory patterns: flow, accumulate/deplete, compare, fan-out/fan-in, transform, and recover. Each pattern has a causal contract, spatial constraints, and a readable timing envelope. Avoid a catalog of arbitrary entrance effects.

### Pitch policy

Initially support three controlled treatments: presenter-to-hero handoff, type-led proposition, and object-led reveal or match move. All use the same objects and clock. Vary hierarchy and pacing while keeping statements readable and objects identifiable.

Do not make “more cuts” the Pitch implementation. Pitch needs a focal idea and deliberate composition. Stronger movement remains subject to reading time, semantic correctness, and author pins.

### Presenter as part of the layout

Extend current layout scoring with occupancy over time. Measure moving objects, labels, captions, camera crops, presenter body/face safe areas, and their transition paths. A placement that is clear at both endpoints can still obstruct the request halfway through its journey.

Use conservative swept bounds plus samples at event boundaries and motion extrema. Hard constraints protect essential content. Soft costs rank visual balance, continuity, and preferences. If bounds are too uncertain, reserve more space instead of treating uncertainty as empty space.

Explainer mode should prefer a stable speaker lane or stable inset for a related sequence. Add hysteresis and a minimum useful dwell: a marginally better score must not make the presenter jump corners every line. These are policy parameters tuned against examples, not arbitrary global timing guarantees.

When no clear composition exists, offer a larger diagram view, a planned presenter handoff, or more time. Presenter audio continues when their image is temporarily hidden. Caption space is reserved throughout. A pinned layout that conflicts with critical content produces an actionable diagnostic.

## 9. Narration, pacing, and a shared timing map

Use three timing confidence states:

1. **Estimated:** text-based preview timing before audio exists.
2. **Marked:** manual anchors or recorded beat marks.
3. **Aligned:** word/phrase timing from the actual chosen audio, with alignment confidence and manual corrections.

A words-per-minute estimate must never be labeled word alignment. Align only against the selected audio revision. Changing that revision invalidates the alignment cache.

Resolve event anchors and minimum action durations into one timing map. Object motion, camera moves, presenter transitions, caption cues, and scene duration consume it. Keep causal order when stretching a beat. Do not let a fast pace make the request appear at the server before it leaves the bucket.

An event can anchor its start, arrival, or consequence to a phrase. The UI should distinguish these: “arrives on ‘service’” is more useful than a generic delay slider.

For recorded takes, preserve current beat-marker support and add stable-ID anchors for new recordings. Keep the legacy index-based reader for existing recordings. Re-cutting dialogue changes text grouping, not the identity of recorded moments.

If the available audio interval cannot contain the required explanation at a readable pace, report the conflict. Offer shortening the visual sequence, adjusting anchors, or recording/regenerating the relevant audio. Do not silently accelerate recorded speech or claim a rewritten sentence is present in the old take.

## 10. Quiver and generated SVG assets

Quiver's current model documentation lists SVG generation, editing, vectorization, and animation, subject to the selected model and account capabilities. The adapter should query the model catalog rather than assume every operation is available for a key. Its animation endpoint accepts an existing SVG and returns SVG output with animation timing metadata. [Model documentation](https://docs.quiver.ai/developers/models), [animation API](https://docs.quiver.ai/api-reference/animate-svg/animatesvg).

These APIs make Quiver a plausible artwork and animation candidate provider. They do not establish compatibility with Incredible's named parts, semantic quantities, seeking, or export pipeline. That compatibility needs a measured spike using real responses; no provider output has been validated by this plan.

### Integration sequence

1. **Static artwork first.** Send an object brief, palette, style reference, required parts/ports, and fallback constraints. Validate and map the result to the object contract. Preserve application-controlled labels and behavior.
2. **Bounded candidates.** Generate a small capped number of candidates, compare them to the built-in object, and retain accepted versions. Permit at most a configured bounded repair attempt; never enter an open-ended paid regeneration loop.
3. **Animation experiment.** Evaluate generated internal motion for one server or bucket against deterministic seek, naming, state binding, SVG prefixing, and export tests.
4. **Promote only supported output.** Normalize a compatible clip; otherwise keep the static artwork with native motion recipes. A good-looking animation with unaddressable state is not a semantic behavior asset.

### Provider and storage design

Implement Quiver behind the existing server-side model/provider boundary. Credentials stay server-side. Add capability discovery, timeout, cancellation, idempotent application-level jobs, response persistence, bounded retry, usage accounting, and a spending ceiling.

Record the provider/model, input brief, style and schema versions, output content hash, and accepted asset version. Cache by meaningful inputs. Changing only a sentence should not regenerate artwork. A style change offers new candidates without replacing accepted assets automatically.

The built-in library must support the complete product path without Quiver. The release cannot depend on animation availability, an unknown per-asset cost, or every generated SVG obeying a prompt.

## 11. Persistence, migrations, and edit safety

Keep `ProjectDocumentV1` readable and add versioned nested records where possible. Do not bump the whole project format just to add a scene preference. Introduce a top-level version change only if the compatibility contract requires it.

Add canonical fields to scene attributes, saved project serialization, version snapshots, duplicate/paste handling, undo/redo, and export inputs together. Maintain one inventory so a field cannot appear in the editor but disappear on reopen.

Store reusable asset definitions separately from scene instances. Pin immutable versions. A shared appearance can update across scenes by explicit selection; the state of one server instance must not leak into another.

Cross-scene identity means “the same conceptual server,” not automatic state inheritance. Start each scene from declared initial state unless a transition explicitly hands state forward. A later matching label must not be the sole identity key. Full cross-scene handoffs can follow the first release, but the ID model must allow them now.

Generation jobs capture their input revision. Completed work against an older revision appears as a candidate, not an overwrite. Cancellation and retry must not duplicate accepted assets. Support both existing storage backends: local files and Postgres/MinIO.

Make render jobs reproducible: snapshot the authored revision, policy/compiler/runtime versions, exact asset and font hashes, seed, selected take, and timing map. Do not depend on a mutable provider URL during export.

The import harness can evolve from SVG plus `.program.json` to an optional asset manifest with referenced packages. Load it atomically, validate references, and leave existing SVG/program imports working.

## 12. Source map and module boundaries

Paths below are relative to the repository root. New paths are proposals, not existing files.

| Work | Existing files to change | Proposed extraction or addition |
| --- | --- | --- |
| Authored schema and compatibility | `apps/studio-v2/src/scene-program.ts`; `packages/markdown-composition/src/schemas/index.ts` | Shared `scene-program.ts` and versioned scene/object schemas in the composition package |
| Semantic operations and geometry | `packages/markdown-composition/src/motion-plan.ts`; `motion-driver.ts`; `apps/studio-v2/src/placements.ts` | `scene-state.ts`, `object-runtime.ts`, shared frame evaluator |
| Scene compilation | `apps/studio-v2/src/scene-program.ts`; `packages/markdown-composition/src/index.ts` | `scene-compiler.ts`, `compiled-scene.ts`, `timing-map.ts` |
| SVG contract and import | `packages/markdown-composition/src/slide.ts`; `apps/studio-v2/src/slide-atoms.ts`; `page-model.ts` | `object-assets.ts`, SVG package validation/normalization |
| Directing modes | `apps/studio-v2/src/director.ts`; `placements.ts`; `video-plan.ts` | `direction-policy.ts`; shared policy types |
| Source and outline | `apps/studio-v2/server/source.ts`; page and motion harness workflows | Scene intent schema and validated planning output |
| Authoring UI | `apps/studio-v2/src/main.ts`; `scene-node.ts` | Separate `scene-inspector.ts`, `object-inspector.ts`, and `event-timing-editor.ts` |
| Assets and provider jobs | `apps/studio-v2/server/index.ts`; `model-gateway.ts`; `persistence.ts`; composition `types.ts` | `asset-jobs.ts`, `providers/quiver.ts`, versioned asset package store |
| Recording and captions | `apps/studio-v2/src/main.ts`; `packages/markdown-composition/src/index.ts`; `types.ts` | Stable timing anchor records and shared retiming resolver |
| Harness import | `apps/studio-desktop/src/harness/ipc.ts`; existing page/director/motion skills | Asset-manifest sidecar support; skills call shared tools |

Do not expand the already large `main.ts` and server entry point into the homes of all these features. Extract at the boundary needed by each change. Avoid an unrelated full-file rewrite.

Inventory schema/runtime drift before extending operations: the runtime motion types, validation schemas, program sanitizer, driver, and harness must accept the same supported contract. CI should verify this explicitly.

## 13. The reference vertical slice

Build a 30–45 second rate-limiter explanation using request, bucket, and server objects. The durations below are illustrative, adjusted to the actual narration. Keep the bucket and server anchored throughout the mechanism. Use an actual presenter take and audible narration in the review artifact.

| Moment | Spoken idea | Visible evidence | State after event | Composition |
| --- | --- | --- | --- | --- |
| Establish | A request needs a token to reach the service | Three clearly countable tokens; request at inlet | Available = 3 | Presenter beside a stable scene |
| Consume | This request spends one token | Token leaves; request continues to server; server processes | Available = 2 | Same map; optional restrained emphasis |
| Burst | A burst can use the allowance | Two distinct requests each consume one remaining token | Available = 0 | Map holds; enough time to read causality |
| Reject | When it is empty, the next request is rejected | New request stops at the bucket and receives 429 | Available = 0 | Rejection stays clear of presenter/captions |
| Recover | Refill makes room for another request | One token appears; a later request spends it and passes | 0 → 1 → 0 | Return attention to the whole mechanism |
| Conclude | The limit protects the service | Persistent mechanism holds while presenter concludes | Final state remains truthful | Deliberate handoff, not another arbitrary reveal |

Also author an 8–12 second pitch opening using the same object family, palette, and runtime. It can use a larger presenter, a short proposition, and a dramatic object reveal. It need not compress the full mechanism into the opening.

Label the initial three-token capacity as a demonstration parameter. Capture a second example, such as queue buildup or cache hit/miss, before claiming the approach generalizes. Do not make the limiter sample the only code path that works.

Deliver the authored project, exact asset packages, narrated MP4, presenter MP4 or source take, silent visual preview, frame checkpoints, and diagnostics as the reference fixture. The silent preview is useful for motion inspection but does not replace review of the complete video.

## 14. Delivery sequence and staffing

Estimates are planning ranges, not measured delivery commitments. Assume two engineers—one focused on runtime/schema and one on editor/server—plus a motion designer available for the reference objects and reviews. Reduce scope or extend the schedule if that design capacity is absent.

| Phase | Calendar estimate | Deliverable and exit gate |
| --- | --- | --- |
| 0. Baseline and contracts | 3–5 working days | Reproducible current fixture, agreed target scene, schema inventory, reference motion treatment, benchmark machine |
| 1. Rich explainer foundation | 2–3 weeks | Three objects demonstrate the limiter correctly; stable map; deterministic seeking; first narrated presenter integration checked |
| 2. Authoring and real timing | 1.5–2 weeks | Object controls, identity-preserving edits, take alignment, transition-aware presenter/caption placement, save/reopen |
| 3. Two-mode product | 1–1.5 weeks | Mode inspector, controlled pitch treatments, source-flow suggestions, same story survives mode changes |
| 4. Quiver and library expansion | 1–2 weeks | Static provider integration, bounded animation experiment, second technical example; provider can be disabled |
| 5. Release hardening | 1–1.5 weeks | Regression corpus, reproducible export, performance and user review, rollout/fallback controls |

Allow roughly **8–12 calendar weeks** for the full scope, depending on overlap and integration findings. The first quality-gated vertical slice should be assessable in roughly **3–4 weeks**. It is a checkpoint for whether the architecture improves the output, not a claim that the full product is finished.

If time is constrained, ship the built-in Explainer path first and defer provider animation, extra object families, and cross-scene handoffs. Preserve semantic editing, audio timing, and presenter quality; those are central to the product claim.

The [implementation backlog](./pitch-explainer-implementation.md) breaks this sequence into reviewable changes with dependencies and completion criteria.

## 15. Verification and release gates

### Engineering checks

- Schema and migration tests cover v1 scenes, nested merged moments, legacy takes, asset records, and old mode behavior.
- Semantic tests cover quantity limits, event order, independent instances, missing references, dependency cycles, and property ownership conflicts.
- Differential tests compare compiler boundary state, arbitrary-time evaluation, browser geometry, and exported frames.
- Exercise random access, forward/reverse seeking, prefixing, nested transforms, resizing, morph visibility handoff, and intrinsic artwork transforms.
- Sample critical times before, during, and after actions; beat-end screenshots alone are insufficient.
- Verify dialogue rewrite/split/merge, mode switch, pace change, take selection, save/reopen, duplication, undo/redo, and rendering all preserve intended identity and behavior.
- Verify provider cancellation, timeout, invalid output, stale revisions, duplicate retries, disabled capabilities, and offline use of accepted assets.

Run the existing studio and composition test/typecheck commands for touched code, and add focused integration tests for the new contracts. UI and render tests should validate observable behavior, not mirror implementation details.

### Proposed quality thresholds

These are release targets to calibrate in Phase 0, not claims about current performance.

| Dimension | Gate |
| --- | --- |
| Semantic correctness | No contradictions between event outcomes, counts, fills, labels, and narrative in the reference corpus |
| Determinism | Same semantic state at a timestamp regardless of seek history; geometry within 1 output pixel for the same controlled browser/font environment |
| Preview/export timing | Event and track boundaries agree within one output frame; compare geometry with antialiasing tolerance rather than requiring pixel-identical text |
| Spoken anchors | For high-confidence aligned anchors, visible consequence lands within ±200 ms of its approved anchor; uncertain alignment is surfaced for correction |
| Legibility and obstruction | No critical label, actor, or consequence hidden by presenter/captions during its explanatory interval; inspect at 1080p and at a 640px-wide playback size |
| Continuity | Stable explainer anchors do not move without a semantic or authored reason; no presenter/camera oscillation caused by minor score changes |
| Runtime | On the Phase 0 recorded reference machine, target p95 frame evaluation under 16 ms and p95 warm seek under 100 ms for the agreed fixture; separately measure full playback and export throughput |
| Authoring reliability | Required edit/record/save/reopen/export journeys pass without event loss or unannounced fallback |
| Provider quality | Accepted output passes the same object, timing, and export contract as built-in assets; cost per accepted asset is measured before wider enablement |

Profile actual representative scenes before fixing path-count or object-count limits. Distinguish frame evaluator time from total browser rendering time. If a target fails, optimize or narrow the supported scene envelope and disclose it in the product.

### Viewer and craft review

Review the narrated video with the presenter visible, then review it muted. Score hierarchy, semantic clarity, internal object craft, pacing, continuity, and presenter integration on an anchored five-point rubric. A score of four means clear and deliberate with only minor polish issues; three means understandable but distracting or visibly rough. Require at least four in every category for the reference scenes.

Run a small directional pilot with 8–10 intended users. Ask mechanism questions after viewing, such as what depleted the bucket, why the next request failed, and what enabled recovery. Target at least 80% correct responses across the prewritten questions and investigate recurring misconceptions. This is a product learning gate, not a statistically powered efficacy claim.

Collect time to first acceptable scene, manual corrections per scene, generation failures, provider cost per accepted asset, export failures, and presenter override frequency. Establish the current baseline before setting improvement percentages.

## 16. Risks and explicit decisions

| Risk | Decision or mitigation |
| --- | --- |
| Rich art still behaves like a static icon | Require demonstrable internal state/behavior; judge muted mechanism comprehension |
| Frequent edits destroy event mapping | Stable segment/beat/event IDs and lineage; ambiguity becomes an explicit correction |
| State and renderer drift again | Shared primitives, deterministic evaluation, differential tests through real prefix/export paths |
| Too much motion distracts | One dominant explanatory action; meaningful subordinate motion; conservative Explainer policy |
| Presenter looks good only in still frames | Evaluate occupancy through motion and review real narrated takes |
| Generated SVG cannot be controlled | Validate capabilities; use static appearance with native recipes or built-in fallback |
| A universal object schema delays useful output | Implement only fields exercised by the first three objects; grow from a second example |
| New modes change old projects | Compatibility reader and explicit upgrade; pin policy versions |
| Provider spending or latency dominates | Cached assets, bounded jobs, project limits, no provider dependency for preview/export |
| Another renderer or agent workflow diverges | One compiler and clock; harness tools call shared implementation |

Decisions to make during Phase 0: final visual treatment, supported performance baseline, first recording/alignment workflow, and the provider experiment budget. None blocks building the built-in reference scene. Quiver animation support and cost remain empirical questions until tested against the actual account and output.

## 17. Definition of completion

The release is complete when a creator can start with a technical source or an existing SVG page, produce an understandable explainer with internally animated objects and a well-composed presenter, add a coherent pitch opening, edit the story and appearance without losing behavior, and export the same result they previewed.

The proof is the finished narrated video and a repeatable authoring workflow. A populated schema, a generated SVG, passing unit tests, or a more animated slide on its own is not that proof.
