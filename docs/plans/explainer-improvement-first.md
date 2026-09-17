# Improve the current explainer

Focused product and implementation plan · updated 17 September 2026  
Baseline inspected: `feat/hyperframes-markdown-mvp` at `6ba2ae15`  
Status: proposed work; this document does not implement application changes.

## 1. The objective and scope

Produce a beautiful technical explainer from 

The first deliverable is a **30–45 second rate-limiter explanation with Quiver-generated artwork, controlled object animation, narration, and a real presenter**. It lives in a separately saved video notebook derived from the original wireframe notebook. The base remains intact and editable.

This is the near-term execution plan. It supersedes the earlier explainer draft that deferred Quiver. Quiver integration is a core work item. The scope remains explainers only: no Pitch mode, mode selector, promotional treatment gallery, or new whole-video composition engine.

The user’s intended workflow is:

```text
Source material
      |
      v
Base notebook: narrative + facts + wireframes + object identities
      |
      +-- Create video --> separate video notebook
      |                     rich SVG objects + motion + presenter + narration
      |
      +-- Future: presentation / illustrated blog / newsletter
```

Only the video derivative is implemented in this pass. The other outputs explain why the base must remain reusable; they are not additional deliverables.

## 2. Keep the wireframe as a separate base

### Product behavior

The initial notebook continues to establish the narrative, facts, source references, objects, and relationships. Its wireframes remain useful for reviewing structure before investing in artwork and motion.

**Create explainer video** creates a new notebook and opens it. The notebook list shows its relationship to the base, with an **Open base** link. Video generation, appearance replacement, restaging, narration edits, and presenter changes save into this child notebook only.

The derived video can enlarge a bucket, remove repeated prose, change spacing, split a source scene into two moments, or use a different composition. The base drawing supplies structure; its exact geometry is not a permanent constraint on the video. Every rich object keeps a traceable connection to the source entity it represents.

The base stays editable. Changing it creates a newer base revision; it does not silently change an already authored video. Likewise, deleting a video does not delete its base or shared source assets.

### Ownership

| Base notebook owns | Video notebook owns |
| --- | --- |
| Source passages and factual references | Video narration and its relationship to source passages |
| Core narrative, terminology, and approved claims | Beat order, timing, and video-specific illustrative parameters |
| Original wireframe SVGs and structural relationships | Rich appearances, motion bindings, composition, and camera |
| Stable source scene/entity identities | Video scene/actor identities and references back to their sources |
| Reusable source assets and theme inputs | Selected asset versions, presenter takes, captions, and render settings |

A reusable generated SVG can be stored once and referenced by several artifacts. It does not become part of the base merely because the video used it. Promoting an accepted asset for broader reuse should be an explicit later action or library selection.

### Minimal implementation

The branch already has `ProjectDocumentV1.derivedFrom`, a derived video sample, and notebook hierarchy/navigation in `main.ts`. Reuse those foundations. They do not yet establish a complete revision-pinned derivation contract.

Add only the data needed for a safe fork:

- A new project ID and independent saved notebook document.
- Existing `derivedFrom.notebook` and `kind: 'video'`, extended with a stable base revision/hash and a retained snapshot reference.
- Origin references for each copied scene and entity. Video nodes get their own IDs; source IDs remain explicit references, not accidental shared primary keys.
- A scene-origin mapping that permits one source scene to produce several video scenes. Preserve source references when scenes are split or merged.
- Immutable or content-addressed asset references, so editing the video’s SVG cannot overwrite the base SVG file.
- A small derivation receipt recording which base revision and source objects were used.

Create the base snapshot and the child durably before switching the editor to the child. Retry with an application-level fork key so an interrupted request cannot create multiple unexpected copies. Support both current persistence backends.

For this pass, show **Base has changed** and a comparison with the pinned source when relevant. Applying selected source changes is an explicit action with a new video version and timing/artwork marked for review where affected. Do not attempt automatic three-way merging or live synchronization. A retained snapshot lets the video remain intelligible and renderable even if the base is later unavailable.

## 3. What improves in the video

The branch already has programs, quantities, movement, state/phase animation, staged geometry, camera direction, presenter scoring, and separate camera takes. The recent fixes remain regression requirements. This is not a proposal to rebuild those systems.

| Improvement target | Change | Visible result |
| --- | --- | --- |
| Rectangles containing text and icons | Quiver creates rich object artwork with a concrete silhouette and meaningful parts | A server looks like an illustrated server; a bucket reads as a container |
| Objects mostly enter, move, and highlight | Animate consumption, processing, rejection, refill, and recovery inside the objects | The object demonstrates its role |
| The page retains presentation density | Adapt composition and labels inside the video fork | Readable mechanisms and space for the presenter |
| Motion does not always show causality | Connect events to consequences and narration | Arrival precedes processing; consumption precedes depletion |
| Per-beat layout decisions weaken continuity | Hold the mechanism and presenter position through related beats | The viewer retains a stable spatial map |

A filled version of an icon is a useful start. The larger gain comes when that object has an identifiable structure and state: a server tray responds to an incoming request, tokens leave a container, or a queue physically grows. A richer static icon alone will still behave like a slide illustration.

## 4. Quiver is the artwork stage

Quiver’s current documentation describes SVG generation and related operations, with availability determined by model/account capability. Its animation API returns SVG animation, not a documented Lottie JSON output. Confirm capabilities against the actual account when implementation begins. [Model documentation](https://docs.quiver.ai/developers/models), [animation API](https://docs.quiver.ai/api-reference/animate-svg/animatesvg).

### Credentials and environment

The local Quiver credential is stored as `QUIVER_API_KEY` in the repository-root `.env` at `/Users/think/Documents/code/dev-video-creator-main/.env`. This file is git-ignored; the plan records only its location and variable name.

As part of E3, load the repository-root `.env` on the server before initializing provider configuration, resolving its location independently of the workspace command’s current directory. Preserve any environment value already supplied by the deployment. The Quiver adapter reads `process.env.QUIVER_API_KEY`; keep it out of browser/Vite variables, prompts, logs, saved notebooks, and render artifacts. Report an unconfigured provider when the variable is absent. Storing the key does not itself implement or verify the provider integration.

### Input brief

For each important source entity, build an artwork brief from the wireframe and its role:

- What the object represents, its source entity ID, and the state changes needed.
- Filled visual treatment, silhouette, restrained depth, palette, and consistent viewing angle.
- Transparent background and the desired dimensions/viewBox.
- Parts that must be independently controlled: shell, tokens, indicator, gate, or similar meaningful pieces.
- Entrance/exit locations and a label anchor.
- A visual reference shared by the scene’s object family.
- Critical text and changing numbers kept outside generated artwork where practical.

Generate the focal bucket and server first; establish a shared style before generating the remaining actors. Avoid sending the whole slide for a single flattened redraw, because that loses the object-level control the explanation needs.

### Output and acceptance

Save the original returned SVG and a normalized accepted version. Inspect groups, paths, inherited styles, transforms, clips, gradients, and masks. Resolve semantic part mappings through validation and, where necessary, a bounded repair or author correction. A prompt asking for named parts does not guarantee a usable rig.

The first accepted appearance record can remain small:

```text
source entity -> appearance version
                  original SVG + normalized SVG
                  named parts + local ports + bounds
                  style/provenance + static preview
                  optional Lottie clip + event/slot bindings
```

Use the existing server-side provider gateway, asset storage, and library as the starting point. Add a Quiver adapter, capability check, visible job status, cancellation, bounded retry/repair, and a per-project generation budget. Cache by entity brief, style, and relevant asset version; a wording edit should not regenerate artwork.

A failed candidate leaves the accepted asset intact. Retain a wireframe/native fallback for continuity, but do not count that fallback as completion of the rich-artwork milestone. This iteration must demonstrate accepted artwork from the actual Quiver API. Provider quality, latency, and cost are not yet measured.

## 5. What the Lottie repository contributes

Reviewed `diffusionstudio/lottie` at `3c72912fad543897f90045ed4d355813837927fc`. Its skill is an authoring and verification workflow, not a drop-in conversion service. These files were inspected as reference material; their instructions have not been installed or executed in this repository.

| Useful finding | Application here |
| --- | --- |
| Animate meaningful SVG groups; preserve the source composition and compare the settled frame | Animate the Quiver object’s real parts instead of arbitrary path fragments. [SVG recipe](https://github.com/diffusionstudio/lottie/blob/3c72912fad543897f90045ed4d355813837927fc/skills/text-to-lottie/references/recipe-svg-animation.md) |
| Explicit SVG compatibility checks for styling, holes, masks, transforms, and renderer differences | Make conversion fidelity a gate before accepting an animated object. [Compatibility reference](https://github.com/diffusionstudio/lottie/blob/3c72912fad543897f90045ed4d355813837927fc/skills/text-to-lottie/references/svg-compatibility.md) |
| Behavior-specific easing and distinct action/settle/hold phases | Give consumption and processing their own readable motion; keep supporting objects quiet. [Motion reference](https://github.com/diffusionstudio/lottie/blob/3c72912fad543897f90045ed4d355813837927fc/skills/text-to-lottie/references/motion-taste.md) |
| Technical animation preserves topology and separates nodes, paths, labels, and highlights | Keep the explanation’s stable map while the rich objects operate. [Technical recipe](https://github.com/diffusionstudio/lottie/blob/3c72912fad543897f90045ed4d355813837927fc/skills/text-to-lottie/references/recipe-diagram-technical.md) |
| Editable slots, local assets/fonts, and exact-frame checks in Skottie | Expose useful appearance controls and validate known frames. [Player contract](https://github.com/diffusionstudio/lottie/blob/3c72912fad543897f90045ed4d355813837927fc/skills/text-to-lottie/references/player-contract.md) |

The current branch already references this repository in motion tokens and motion-master guidance. Importing more easing advice is therefore unlikely to be the main improvement. The new work is the rich artwork, controllable parts, and actual object playback integration.

### Integration decision

Support a small animated-object path within the existing composition:

1. Use Quiver SVG as the artwork source.
2. Author short, named behaviors using a constrained adaptation of the Lottie workflow: processing, consume, reject, refill, and a settled state where relevant.
3. Keep simple quantity/visibility effects in the existing SVG motion path where that is clearer. Lottie supplies richer local choreography; it does not own the factual state of the scene.
4. Prototype a **Skottie object adapter** first, matching the repository’s verification renderer. The inspected player uses CanvasKit, explicit frame seeking, and property slots. Extract a small clock-controlled adapter rather than embedding its entire editor/player. [Player implementation](https://github.com/diffusionstudio/lottie/blob/3c72912fad543897f90045ed4d355813837927fc/src/context/canvas.tsx).
5. Verify the object in both the reference authoring environment and Incredible’s real preview/export path. A result working in one renderer is not proof it works in another.

Time-box the initial adapter proof to one animated bucket or server. It must pass transparent composition, exact seek, style/state controls, and headless export before expanding the library. If a particular Lottie effect fails, simplify or use a native SVG behavior while retaining the rich Quiver artwork. Record the limitation; do not silently replace the object with its original rectangle.

The repo’s MIT license permits reuse subject to retaining the required notice. Record the selected upstream revision and third-party dependencies if code or skill material is brought in. [License](https://github.com/diffusionstudio/lottie/blob/3c72912fad543897f90045ed4d355813837927fc/LICENSE).

## 6. One story state and one playback clock

Continue using `SceneProgram` v1 and `MotionPlanV2`. Add a small appearance/clip binding and only the operation fields exercised by the first objects. A universal scene schema migration is not required.

```text
Base notebook snapshot
        |
        v
Video notebook: source mappings + SVG/program + rich appearances
        |
        v
Existing compiler and director
        |
        +-- SVG placement, labels, quantities, connections
        +-- object clip bindings and local state
        +-- camera, presenter, captions
        |
        v
One composition time -> shared preview and Hyperframes export
```

### Responsibilities

- **Program:** actor identity, quantity, accepted/rejected outcomes, and causal order.
- **Appearance:** drawing, controllable parts, local ports, and visual bounds.
- **Object behavior:** how a declared transition looks and which clip/parts enact it.
- **Placement:** the actor’s outer transform and its ancestors.
- **Director:** camera and presenter choices using the actual occupied bounds.
- **Composition clock:** when each consequence and clip frame is visible.

One quantity drives token count, visible token parts, and any fill indication. A looping clip must never restore tokens or imply a successful operation that did not occur. If a quantity cannot be expressed safely through a clip’s controls, display it in a native semantic layer rather than encoding a fixed fictional count into the animation.

A Lottie body and native labels/tokens may form one logical actor. Their layers share the same parent transform, clipping, visibility, and measured envelope. Outer movement is applied once. Ports are transformed from local coordinates through the same hierarchy as the visible object.

### The object adapter contract

Expose readiness, state/appearance controls, sampling at a requested local time, local bounds, and disposal. The compiler binds each named behavior to a semantic event and interval. Clamp one-shot clips to an intentional final state; loop only behaviors that truthfully continue. Re-entering the same behavior starts a new declared interval.

Sample from the chosen composition time. Do not run the repository’s autonomous playback loop alongside Hyperframes. Apply all instance state needed for a sample so reverse seeking cannot retain stale slot values.

Load fonts, artwork, JSON, and any WASM before the renderer captures a frame. Rendering must wait for explicit object readiness and completion, not an arbitrary timeout. Use the same adapter build and assets in editor and export.

A canvas object does not expose SVG `getBBox()` for its internal ink. Supply a validated local envelope and port coordinates; map those through the shared geometry for camera and speaker scoring. Check animated extents, not merely the rest drawing.

## 7. Presenter layout: what to learn from video-talkcraft

Reviewed `Vincentwei1021/video-talkcraft` at `de2bc7f71d862322b8245e5645cb66f4aa2e467a` as a reference. Its requirements target its own production workflow and are not binding requirements for Incredible.

The useful lessons are concrete:

- Measure the face/head safe region from the actual take and map it through presenter placement. A generic video rectangle is not sufficient. The reference describes sampled face bounds and coordinate mapping. For our first implementation, allow a manual region with optional detection assistance and conservative motion padding. [Host footage reference](https://github.com/Vincentwei1021/video-talkcraft/blob/de2bc7f71d862322b8245e5645cb66f4aa2e467a/references/host-footage.md).
- Keep a settled presenter inset stationary. When changing its shape, coordinate the crop window and the person’s transform using one transition progress value. Keep the actual speaking video playing. [Presenter handoff reference](https://github.com/Vincentwei1021/video-talkcraft/blob/de2bc7f71d862322b8245e5645cb66f4aa2e467a/references/cards/host-shrink-to-chip.md).
- Measure content groups, alignment, labels, and caption space together, with a visible debug overlay. Prefer shorter copy or a changed layout before shrinking essential text. [Layout reference](https://github.com/Vincentwei1021/video-talkcraft/blob/de2bc7f71d862322b8245e5645cb66f4aa2e467a/references/layout.md).
- Plan attention handoffs and inspect their transition windows, not just finished layouts. Its discussion of retained background elements is particularly relevant: visually deemphasized objects still occupy space. [Cinematography reference](https://github.com/Vincentwei1021/video-talkcraft/blob/de2bc7f71d862322b8245e5645cb66f4aa2e467a/references/cinematography.md).

Our implementation should independently apply those general layout principles to the existing director. We should not import requirements for perpetual camera movement, mandatory B-roll, constant presenter visibility, or a fixed lower-corner placement into technical explainers. The best layout depends on this mechanism and the selected take.

For this pass, refine three existing composition choices: presenter beside the mechanism; stable inset while the mechanism occupies most of the frame; and full mechanism with voice continuing when space is insufficient. Preserve author pins. Switch only when the explanation benefits, not on every sentence.

Score moving-object envelopes, captions, face/head safe areas, and the presenter’s transition path. Keep the layout stable when alternatives offer only a marginal improvement. Inspect intermediate crop/scale states so the face remains framed throughout a handoff.

The repository states that commercial toolkit use requires author authorization. Plan an independent implementation of these general principles rather than vendoring its toolkit; direct toolkit reuse would need the stated license authorization. This does not block the layout work. [License](https://github.com/Vincentwei1021/video-talkcraft/blob/de2bc7f71d862322b8245e5645cb66f4aa2e467a/LICENSE).

## 8. The reference explanation

Use the existing token-bucket wireframe and program as starting material in the base. Create the separate video notebook before changing its composition or artwork. Use three tokens as an explicitly illustrative initial quantity.

| Moment | Visible evidence | State |
| --- | --- | --- |
| Establish | Rich bucket with three tokens; request at its entrance; server ahead | Available = 3 |
| Admit | One token is consumed; request reaches service; processing responds | Available = 2 |
| Deplete | Two distinct requests consume the remaining allowance | Available = 0 |
| Reject | A new request stops at the empty bucket and receives 429 | Available = 0 |
| Recover | One token refills; a later request consumes it and passes | Available goes 0 → 1 → 0 |
| Conclude | The same mechanism holds as the speaker lands the takeaway | Final state remains truthful |

Keep the principal objects anchored while their internal states and request actors change. Use concise names and outcome labels; move explanatory prose into narration. Reserve presenter and caption space before increasing artwork detail.

The first objects are a filled request/packet, a bucket with independently controlled tokens, and an illustrated server with a processing indicator. All share palette, viewing angle, detail density, and a consistent visual weight. Replace a few focal objects well before expanding the library.

Review with actual narration and presenter footage early. A silent motion preview remains useful, but cannot prove spoken timing or presenter quality.

## 9. Implementation sequence

### Step 1 — Preserve the base and create the video derivative

Build the generic fork action on the existing lineage model. Snapshot the base, assign child identities, preserve source mappings, and copy/reference assets safely. Make base/video navigation explicit. Add version and stale-base behavior without live merging.

**Gate:** edit artwork, text, and layout in the video; reopen both notebooks; the base is unchanged. A source scene split remains traceable. The video renders from its saved source snapshot and accepted assets.

### Step 2 — Prove Quiver artwork quality on the actual scene

Integrate the provider into the current asset workflow. Generate matching bucket/server artwork from the base’s roles and a shared style brief. Validate and normalize groups, ports, and geometry. Save original and accepted versions with provenance. Recompose the video fork around the richer objects.

**Gate:** an actual Quiver response improves the scene beyond text boxes and icons at the final playback size. Accepted assets reload and export correctly. Parts are suitable for animation, or the required correction is explicit and bounded.

### Step 3 — Animate one object end to end, then the other two

Adapt the Lottie authoring workflow for a short meaningful behavior. Prove the Skottie object adapter inside the existing preview and Hyperframes export. Add controlled consume/refill, request outcome, and processing behavior using the appropriate native/clip path. Bind every semantic change to the current program.

**Gate:** direct seeking and playback agree; the settled animation matches the accepted SVG; state changes are correct; transparency, fonts, bounds, and headless export work. A visual-only looping demo does not pass.

### Step 4 — Finish the causal story and presenter composition

Author the six moments, then refine the current director for a stable speaker lane/inset, safe face framing, caption space, and motion-path occupancy. Keep the bucket and server stationary through the mechanism. Use coordinated transitions only when the speaker needs to yield or regain space.

**Gate:** the narrated scene clearly shows admission, depletion, rejection, and recovery. No meaningful consequence disappears behind the presenter or captions, including during transitions.

### Step 5 — Make normal editing preserve the result

Use current cues, holds, recording marks, and retiming. Add a small event-timing adjustment where needed; if this requires persistent event IDs, wire them through sanitizer, editor, versions, and save/load together. Preserve the existing rewrite/split/merge fixes and `then` semantics.

Expose focused controls: create video from base, generate/change object appearance, preview behavior, keep the composition, and adjust event timing. Keep source changes, appearance regeneration, and behavior changes distinct.

**Gate:** edit → change pace → save → reopen → export preserves intended events, selected art, presenter layout, and source lineage. A script change after recording marks affected timing as needing review while retaining the take.

### Step 6 — Verify reuse with a second explanation

Update existing generation guidance and validators to use the same rich-object and causal-story path. Build a short concurrency-limit example: requests occupy finite slots, excess work waits, completion frees a slot. Reuse request/server artwork where appropriate and the same runtime/controls.

**Gate:** the second mechanism needs new content/bindings rather than scene-name checks or another renderer. Its base remains separate from its video notebook.

## 10. Reviewable implementation packages

Paths are relative to the repository root; new helper names are proposals.

| Package | Scope | Main targets | Acceptance check |
| --- | --- | --- | --- |
| E1 | Base snapshot and generic video fork | composition `types.ts`; studio `main.ts`, `scene-node.ts`; server persistence backends | Independent notebooks, stable source mappings, no shared mutable SVG |
| E2 | Reference story and visual brief | Existing fixtures/program; base/video sample data | Approved causal sequence, palette, object family, presenter space |
| E3 | Quiver provider and accepted SVG assets | server startup/environment loading, `model-gateway.ts`, asset routes, persistence; small `providers/quiver.ts` | Server reads `QUIVER_API_KEY` from root `.env`; actual generated assets, bounded jobs, cached reuse, preserved accepted version |
| E4 | Part/port bindings and object preparation | `slide-atoms.ts`, `page-model.ts`; composition `slide.ts`; focused object helper | Geometry and parts survive import/prefixing; measured animation envelope |
| E5 | Lottie authoring integration and clock-controlled object adapter | Motion harness; new small composition object adapter; `index.ts` and preview wiring | One Quiver-derived object seeks and exports correctly in the selected renderer |
| E6 | Semantic behavior and quantity binding | `scene-program.ts`; composition `motion-plan.ts`, `motion-driver.ts`, relevant schemas | Counts, tokens, outcomes, and local animation agree |
| E7 | Presenter continuity and safe handoffs | `director.ts`, `placements.ts`, presenter geometry | Clear face/labels/captions throughout movement and crop changes |
| E8 | Timing, focused controls, versions | Small editor helper; `main.ts`; current retiming/recording paths | Routine editing preserves behavior, appearance, lineage, and timing |
| E9 | Generation guidance, second example, release proof | Existing page/motion workflows, fixtures, tests/render paths | Reusable authoring path and finished narrated videos |

Dependency order: E1/E2 → E3/E4 → E5/E6 → E7/E8 → E9. Basic presenter framing and narration should be tested during E2 and E5, not postponed until E7. Run regression checks with each package.

Keep `main.ts` and server entry points focused on wiring. Extract small helpers as required. Inventory and update validators alongside runtime types when extending a contract. No whole-project version bump is needed unless a concrete compatibility problem demands it.

## 11. Acceptance criteria

### Source and artifact ownership

- The original base notebook and its SVGs remain independently saved and editable.
- The video records its exact source revision and scene/entity origins.
- Video edits never mutate the base or a sibling derivative.
- Base edits do not silently change an existing video; the user can inspect relevant changes.
- Deleting a child retains the base and assets referenced elsewhere.
- Scene splits/merges preserve traceable source mappings.

### Rich objects and motion

- At least the bucket and server use accepted Quiver-generated artwork in the reference scene.
- Objects have concrete silhouettes and meaningful internal structure, rather than an icon inside the original card.
- The selected animated treatment visibly demonstrates processing or consumption/refill, not just an entrance effect.
- Quantity, token visibility, labels, and outcome remain consistent.
- Direct seek, forward playback, and backward scrub produce the same state.
- SVG-to-Lottie conversion is checked against the accepted source artwork, including masks, holes, gradients, and settled geometry.
- Preview and export use the same adapter and agree within one output frame on event boundaries.

### Story, presenter, and authoring

- A viewer can explain why a request passed, why one failed, and what enabled recovery.
- Principal objects and presenter placement stay stable through connected moments.
- Essential labels are readable at normal playback size, including a 640px-wide review.
- Presenter, captions, and their transitions do not obscure critical action or the face/head safe region.
- Important consequences align with the relevant spoken phrase and remain visible long enough to register.
- Ordinary narration edits, splits/merges, pace changes, undo, save/reopen, and export preserve the intended story.
- Unsupported provider output leaves the accepted scene usable and exposes the specific limitation.
- A second explanation uses the same generation/compiler/editor path.

Use existing studio and composition tests/typechecks plus focused browser/export checks. Cover prior transform, prefix, quantity, camera inheritance, merged-moment, and version regressions. Add explicit fork-isolation and clip-readiness tests. Test both persistence backends for the new fork/asset records.

Review the finished narrated video with the presenter visible, and review a muted version for visual causality. Code passing tests is necessary but does not establish the visual result.

## 12. Checkpoints and estimate

Including Quiver, the object adapter, and a durable video fork increases this pass beyond the earlier native-only draft. Planning range: **20–30 engineering days**, with motion/design review available throughout; roughly **4–6 development weeks for one engineer**, plus provider-access or review delays. Re-estimate after the first real SVG-to-animation export proof.

| Checkpoint | Approximate engineering effort | Decision |
| --- | --- | --- |
| Safe base/video fork and reference treatment | 3–4 days | Does the artifact ownership work without changing the base? |
| Quiver generation, SVG preparation, one animated object in export | 6–9 days | Does the real pipeline deliver the requested visual richness and control? |
| Full mechanism, presenter, timing, and editing | 7–10 days | Does the complete narrated scene work and remain editable? |
| Second example, generation guidance, final verification | 4–7 days | Is the improvement reproducible through the product? |

The first major visual checkpoint should be one Quiver-derived animated object in the real app and exported video. If it fails, resolve artwork structure, conversion, or renderer compatibility before generating a library. The second checkpoint is the complete narrated scene, which tests whether visual richness improves understanding.

## 13. Completion and next decisions

This iteration is complete when a creator can retain a reusable wireframe base, derive a separate video notebook, enrich its focal objects through Quiver and controlled animation, compose a presenter around the mechanism, and revise/export the result reliably.

Future presentation, illustrated-blog, and newsletter outputs can start from the same base and reuse selected assets. Their authoring and rendering systems remain future work. The current investment is the reusable source lineage and one excellent explainer derivative.
