# Next stage: a visual scene notebook, from creative plan to production

24 September 2026. Proposed development work following the [independent M0 review](../reviews/2026-09-24-independent-m0-review.md). This is the detailed next-stage specification for the [explainer MVP roadmap](m0-to-rendered-explainer-mvp.md), not a claim of implemented behavior.

Build on `feat/hyperframes-markdown-mvp`. Reconcile the submitted M0 implementation in `claude/hyperframes-markdown-handover-674230` with the existing repairs before implementation; the review used `.claude/worktrees/m0-integration`. Preserve uncommitted work. Commit each verified slice with author and committer `Karthic <Kartronics85@gmail.com>`.

## 1. Product outcome

The creator works through a video notebook with the same familiar Markdown scene organization as the base presentation. Each scene has a visual stage and an adjacent creative plan. Initially the stage shows its original wireframe, clearly identified as a reference. The creator can inspect a rough scene preview, give direction, compare revisions and approve that scene's plan. Approved scenes can be produced individually or in a selected batch, whenever the creator chooses.

The base notebook remains a separately saved presentation. The video inherits its source references, theme and reusable visual ingredients. It can rearrange them, add richer artwork and use several compositions or moments where useful. Presentation `kind`, `box/step/note/number`, page coordinates and the eight-part limit do not become video constraints.

The next handoff is **explanation brief + extracted visual cast + actual theme + source-page reference + creator decisions**. The source explains what is true; the extracted visuals supply useful identities and design ideas; Hyperframes skills develop the creative treatment. The initial brief remains open about choreography until the skills make those choices.

The production output is code: a versioned Hyperframes HTML/CSS/JavaScript composition bundle. Studio's canvas plays that bundle through the engine, and export renders the same pinned bundle and edit configuration. The local product harness writes the production code. The development assistant implements and tests the software; hand-authored demonstration scenes are engineering fixtures only.

## 2. The creator's journey

1. Create and retain the rich presentation base using the repaired `page-master` path. Template drafts are explicitly identified. Fork it into a video notebook.
2. Prepare the explanation brief and extract usable icons and illustrated objects from the pinned base. Show the resulting visual cast while planning runs.
3. Open a scene in the notebook. Read what it should explain beside its original wireframe. Inspect the proposed moments, speech, object behavior, text, camera and presenter presence.
4. Choose **Preview plan** to generate a rough animated sketch from the candidate. Existing assets are reused; missing final artwork and media have visible placeholders. Revise and compare until the direction is convincing.
5. Choose **Approve plan** for this scene. Continue reviewing other scenes, or choose **Produce scene** / **Produce selected approved scenes**. Approval alone starts no production or recording job.
6. For human delivery, follow the scene's recording guide and record a whole scene or manageable sections. For generated delivery, produce the selected voice. These choices are made per scene.
7. Review the produced scene on the same stage. Inspect its layer timeline, nudge supported controls, and replay the affected interval. Choose the scene version to include in the video.
8. Assemble selected scene versions, inspect their transitions and export the same composition that was previewed. Missing media or stale scenes have specific, local recovery actions.

A creator can plan all scenes before producing any, produce scene 2 while scenes 3–5 remain in planning, or prepare graphics while a presenter take is outstanding. The UI shows what each scene is waiting for; an incomplete scene does not erase or block unrelated reviewed work.

## 3. Rich context: extract a visual cast, not a collection of screenshots

### 3.1 What to carry forward

Extract standalone SVG ingredients, including small icons and larger explanatory objects. For the reviewed Stripe pages this means user symbols, a rate gauge, server artwork, retry arrows and the twenty-slot concurrency pool. Keep the pool's slots together as an object with parts; reducing it to a generic icon loses its explanatory value.

Do not include every enclosing card, arrow, heading and footer in each asset. Classify page furniture separately. Keep labels or connectors when they are part of the object's meaning, with that choice recorded. The complete page remains available as a contextual reference.

Each visual-cast entry carries:

| Field group | Required information |
| --- | --- |
| Identity | Stable entity and asset IDs, base notebook/page/revision, original SVG group IDs, content hash |
| Meaning | Technical role, source/evidence references, relevant interactions; distinguish source facts from inferred labels |
| Artwork | Standalone SVG, thumbnail, viewBox/bounds, theme bindings and required fonts/dependencies |
| Parts | Actual named subgroups, inspected bounds, candidate animation affordances, rig verification status |
| Reuse | Existing library asset revision, provenance/license where known, appearance variants and compatibility constraints |
| Confidence | Whether the entity mapping and grouping are declared, inferred or unresolved; what must be checked |

An affordance says “the needle is a separately addressable part,” not “rotate it at 2.4 seconds.” A scales symbol can identify a load shedder without proving that rocking the scales explains shedding. The technical role and the creative plan decide the performance.

### 3.2 Extraction and validation

Prefer the page's existing semantic groups and stable object IDs. Where markup is incomplete, propose a grouping and entity association with visible uncertainty; offer a correction in the asset inspector. A composite reference can be retained when safe extraction is not possible. Do not fabricate a verified rig from the icon's appearance.

Extraction must preserve inherited transforms/styles, recursively referenced definitions, masks, clip paths and gradients. Normalize the extracted viewBox, namespace IDs and rewrite internal references so repeated instances do not collide. Resolve fonts and safe dependencies, remove executable/external content from SVG assets, and retain the untouched original alongside the normalized revision.

Render each extracted asset alone and alongside the original group for comparison. Verify it is neither cropped nor missing strokes, fills or parts. Validate references and meaningful dimensions. An asset that merely parses is not accepted as visually equivalent or animation-ready.

Store accepted extractions in the existing asset library: metadata, entity associations and immutable revisions in local PostgreSQL; SVGs, previews and rigs in local MinIO. A video edit or recolor creates a variant and never mutates the base page or an asset version used elsewhere.

### 3.3 The planning packet

Materialize a bounded, self-contained packet for the scene. Proposed paths are product contracts, not Hyperframes APIs:

```text
packet/
  CONTEXT.json            pinned inputs, delivery, creator direction, dependency hashes
  EXPLANATION.md          source-grounded units, roles, claims and open decisions
  NARRATIVE.md            current wording, guide/script status and wording policy
  THEME.json             actual colors, typography, spacing and color meanings
  VISUAL_CAST.json        entity-to-asset map, parts, reuse and verification status
  references/
    page.svg             original pinned page, reference only
    page.png             usable page preview
    visual-cast.png      labelled contact sheet
  assets/<asset-id>/      standalone SVG, preview and any verified rig
  NEIGHBORS.json          adjacent approved plans/boundaries, or explicitly unknown
  PREVIOUS_PLAN.json     previous approved revision and retained user edits, if any
```

Include the relevant source passages with revision/locator references and make the retained full source available without forcing every scene to reread it. A fragment-only packet states its coverage. Every declared local path must resolve before dispatch. Actual asset bytes and theme tokens must travel with the packet; IDs and inaccessible URLs alone are insufficient.

Load a compact contact sheet and relevant cast entries first, then full SVGs and skill references as needed. The harness must be able to inspect the rendered images through its available tools, not only read file paths. Record the selected harness's image-inspection capability and any fallback limitation.

### 3.4 Decisions creative planning should make

For each useful object, the planner chooses reuse unchanged, adapt/rig, request a richer Quiver version, build a precise native shape/chart, or omit it. Give a reason tied to what the viewer needs to understand. These asset decisions are separate from the object's technical identity.

Pass an existing icon's silhouette, theme, role and required performance into a Quiver request when enrichment helps. Ask for named controllable parts and validate what returns. Keep countable tokens, exact slots, graphs, code and labels native when that best preserves correctness. If the approved treatment requires rich hero artwork, a provider failure leaves an explicit unmet requirement; a plain box cannot silently satisfy it.

Quiver generation/editing uses the existing server-side provider gateway and project environment credentials. Accepted assets and variants return to the reusable library. Credentials never enter a planning packet, generated composition or client bundle.

## 4. Scene review inside the Markdown notebook

The notebook document owns scene order, headings and narrative. Scene blocks reference durable plan, approval, preview and composition IDs. Plans remain structured records; Markdown/UI is their review surface, not a second independently editable copy of the JSON.

### 4.1 Default workspace

| Area | Behavior |
| --- | --- |
| Notebook / scene rail | Scene title, reference thumbnail and concise states for plan, recording and output; selecting a scene opens its block |
| Visual stage | Starts with **Wireframe reference**; switches to **Plan preview** or **Generated scene** when those artifacts exist |
| Plan beside the stage | Viewer question, takeaway, demonstration, selected visual cast, ordered moments and unresolved decisions |
| Moment detail | What the viewer sees, what is said, primary attention, object changes, presenter, text and camera together |
| Optional timeline | Ordered moments before timing exists; estimated intervals for a rough preview; measured clips for a produced scene |
| Scene actions | Preview plan, approve/revise plan, produce, rehearse/record, inspect output and version history as appropriate |

Keep an original-wireframe thumbnail visible with a one-click full reference view; offer side-by-side reference/preview comparison. While a scene has no generated content, its actual wireframe remains the visual placeholder. Never label that static reference as a preview of the proposed motion.

Use compact Markdown scene cards for scanning and expand only the selected scene. Keep its visual and plan readable together at a normal desktop window size. On narrower widths, stack these panes with persistent scene navigation. Collapse the detailed timeline and technical inspector by default; avoid several competing scroll panes and dense channels of paragraph text.

Show a moment's narration and visible consequence together. Clicking a moment selects its associated visual targets and, when a preview exists, seeks to that interval. If only a reference exists, highlight the corresponding reference object where a mapping is known; state when no mapping exists.

Source evidence, presentation brief, explanation brief, selected skills and raw artifacts remain accessible through secondary tabs or drawers. The default view answers what the scene will explain and how. Users do not need to understand recipe IDs to approve a scene.

### 4.2 Review and approval

Approval pins the scene plan revision and its dependencies. It is distinct from choosing a take and accepting a rendered output. A new candidate never replaces the approved plan until selected; a failed regeneration keeps the previous plan and preview available.

| Action | Result |
| --- | --- |
| Approve plan | Pins this scene's creative direction; no asset, voice, recording or production job starts |
| Produce scene | Explicitly queues the approved plan and its required stages; shows selected provider/model and missing inputs |
| Record / rehearse | Opens that scene's guide; existing takes and generated graphics remain available |
| Accept scene output | Pins the actual composition, media, edit configuration and quality evidence for assembly |
| Revise / regenerate | Makes a new candidate with retained comments and manual edits; explains what will change |

Permit production of a self-contained scene while neighboring plans remain undecided. A seam that needs an agreed outgoing/incoming state remains provisional until both sides exist. Do not make every scene wait for whole-notebook approval.

Compare revisions by changed moments, objects/assets, narration, camera, presenter placement and continuity—not just summary prose. Keep scroll, focus, disclosures and unsaved direction stable during job updates. Use incremental state updates instead of replacing the entire inspector on each poll.

Track plan state, media readiness, production job state and output acceptance separately. A scene can have an approved plan, a previous accepted output, a running replacement and a missing new take at once. One overloaded `ready` flag cannot represent that safely.

## 5. Preview what the plan will feel like

| View | What is real | What remains provisional |
| --- | --- | --- |
| Wireframe reference | Original base artwork and its visual identities | It does not establish video choreography |
| Plan preview / rough animatic | A seekable coded sketch using extracted assets, planned staging and representative actions | Missing Quiver artwork, exact easing/detail, unrecorded presenter, unmeasured speech timing |
| Generated scene | Actual composition bundle, verified assets and selected media | Any outstanding checks or media replacements are named |

**Preview plan is a real, bounded construction step.** Extend the current planning-only boundary with a separate sketch route. It may create preview composition code and frames in its own artifact directory. It cannot silently generate paid hero assets, select takes, mark a plan approved or publish the final scene.

The selected local harness uses the treatment and relevant Hyperframes recipes to author the sketch. Prefer existing extracted assets; visibly mark substitutes. Show the whole scene's progression, a representative object interaction, intended camera framing, major text and presenter transitions. A montage of static wireframes is not sufficient proof of motion.

Use the same Hyperframes player integration and composition contract for sketch and production. Promote useful code and stable entity/moment IDs during production, but do not force final artwork into inaccurate placeholder geometry. If resolving assets materially changes the approved staging, show the changed candidate for review.

Before voice exists, use labelled estimates and optional guide audio. A presenter stand-in indicates its reserved region and framing, not a completed recording. Once a real voice/take is selected, regenerate timing from it. Do not present estimates or synthetic rehearsal audio as the creator's recorded performance.

Show a short **Still to resolve** list: for example, “bucket uses existing icon; rich SVG pending” or “speaker timing estimated.” If preview code fails, keep the plan and reference available with the actual error and a retry. Final output acceptance requires real-time playback with the final assets and sound.

## 6. Hand-hold human delivery scene by scene

Voice source and presenter visibility are different decisions. Human narration can continue while graphics occupy the whole frame. Generated-only delivery reserves no empty camera box. Do not require a notebook-wide human/generated choice.

The scene coach derives from the approved treatment and current script. It provides:

- The scene's purpose and the exact lines to record, with draft versus approved wording clearly identified.
- A simple sequence showing when the speaker is full screen, beside the graphics or off screen while their voice continues.
- Framing guidance tied to the composition: face-safe region, which side the content uses, captions and the planned return shot.
- Natural emphasis, optional pauses and transitions into/out of the scene. Avoid requiring the speaker to hit artificial animation timestamps.
- Microphone/camera preview, rehearsal, record, playback, retake and **Use this take**, with progress across the scene's required sections.

Offer a whole-scene take by default and section recording when useful. Record off-camera spoken passages too: recording only the on-screen appearances would leave narration gaps during graphics. Preserve stable section/cue IDs across takes and retain alternate takes without destroying the selected one.

Graphics/asset work can proceed while recording is outstanding. The creator can preview the intended scene using a labelled stand-in and estimated timing, then see their own recording substituted into the composition. A camera framing that requires cutout footage must identify the dependency and offer a supported framed layout if cutout preparation is unavailable.

After **Use this take**, align spoken cue occurrences and pauses, then resolve action timing and caption timing. The take supplies the real speech clock. If a cue is absent, ambiguous or too tightly spaced for the explanation, show the affected moment and offer cue adjustment, a visual hold where the audio permits it, or a pickup. Do not silently omit an explanatory action, invent speech or stretch an accepted voice track.

Let the creator hear the scene and see camera/graphic handoffs before accepting the output. Speech should remain continuous across graphics takeover and presenter return. A replacement take invalidates alignment and rendered proofs for the affected scene, while preserving reusable artwork and unrelated accepted scenes.

## 7. Code, composition and editing contracts

### 7.1 One workflow coordinates the scene

One owning local workflow uses the relevant creative, camera, SVG, typography, media and motion skills. Moments are overlapping channels of one explanation; they are not separate workflows that independently rewrite the scene. A continuous world may span several moments. Reuse or independently timed sections can use nested compositions when appropriate.

The inherited wireframe is reference material. Adapt upstream wording that treats a confirmed frame as an immutable build target; this product has not approved the slide's arrangement as the video's end state. The approved creative treatment controls the video staging.

Keep the installed runtime and skill bundle pinned. The reviewed installation uses Hyperframes `0.7.106`; verify required camera, nested composition, media, SVG and seek behavior before enabling each feature. New upstream documentation does not prove support in that version.

### 7.2 A bundle with a declared editing surface

Arbitrary HTML/JavaScript cannot be reliably reverse-engineered into an editable timeline. Require the construction route to publish code plus a manifest describing the controls it really implements:

| Bundle / manifest item | Purpose |
| --- | --- |
| Entry HTML, CSS, scripts, local dependencies | The actual rendered composition, stored immutably |
| Dimensions, fps, duration, runtime versions | Reproducible playback and export |
| Stable scene/moment/entity/part/layer IDs | Link explanation, selections, timeline and code across revisions |
| Composition hierarchy and time mappings | Map nested local times and media source ranges to scene and notebook time |
| Assets, fonts, selected take/audio revisions | Resolve the same bytes in preview and export |
| Timeline intervals, cue anchors, transitions | Display genuine rendered spans with their purpose and constraints |
| Exposed controls and bindings | Map supported UI changes to code-consumed parameters and valid ranges |
| Dependency hashes and proof references | Establish what was generated, edited, checked and accepted |

Store manual edits in a versioned configuration that the generated code consumes through declared bindings. The manifest describes those bindings; it is not a competing animation implementation. The bundle hash plus edit-configuration hash plus pinned media identify the result.

Direct edits must affect the code's parameter inputs, not only preview DOM styles. Validate and publish the matching configuration before treating an edit as saved. The player and producer consume the same result. If a control is not exposed, offer **Ask for this change** and create a harness-built candidate rather than displaying a nonfunctional slider.

Regeneration receives approved edits and their stable target IDs. Reapply compatible edits; surface removed targets, incompatible controls or changed meanings as conflicts. Do not discard the user's changes or silently apply an old override to a different object.

### 7.3 A shared clock

Scene playback, nested compositions, presenter video, narration, captions, camera and asset animation resolve from the same engine clock. Store source in/out separately from a clip's timeline interval. Map scene-local time to notebook time explicitly; define frame rounding against the project fps.

Keep world-camera transforms, local object transforms, presenter framing and text overlays under distinct property owners. Animation must reconstruct state for arbitrary seeks, including backward jumps, rather than depend on having played earlier frames. Quantitative mechanisms must preserve their state ledger when timing changes.

The host owns selection, authoring parameters and transport controls. Hyperframes owns rendered playback. The Studio canvas is the embedded composition stage; it need not be an HTML Canvas 2D renderer. Load versioned media through the artifact service, with no dependence on a temporary harness directory or expiring provider URL.

## 8. A composition timeline inspired by Motionity

Borrow editor interaction ideas from [Motionity](https://github.com/alyssaxuu/motionity): inspectable layers, direct selection, trimming and animation-property controls. Its [feature overview](https://github.com/alyssaxuu/motionity#features) includes keyframing/easing, masking, media/audio and text animation. Implement our own UI over Hyperframes compositions and product records; adopting Motionity's rendering model is not required.

Provide two levels: a notebook scene strip for ordering and scene-to-scene transitions; a scene timeline for the selected composition. Expand a composition to reveal groups, objects and supported properties. A layer is not necessarily its own composition file, and a row category is not a video scene taxonomy.

Useful groups include voice/takes, presenter picture, objects, labels/code, camera, captions and sound. Show only those used by the scene. A human voice track spans graphics-only periods while its presenter-picture clips can stop and return in a different layout.

The timeline shows start/end, overlaps, transition spans, cue markers, a shared playhead and the selected moment. Clicking a clip selects its visual and opens the relevant inspector; selecting an object on the canvas identifies its timeline entries. Offer zoom, range playback and collapse/expand. Read-only groups may expose a regeneration action.

Deliver editing progressively:

1. Synchronized read-only tracks and click-to-seek from the real manifest. Before measured timing exists, label the preview timeline estimated.
2. Bound text, placement/scale, presenter position/crop, supported camera targets and audio levels. Mute/solo inspection must be explicitly temporary; exporting a mute requires a saved edit.
3. Start/end nudges, hold lengths and supported transition duration/easing. Provide numeric and keyboard controls alongside dragging, undo/redo and snapping to meaningful cues.
4. Selected keyframe controls only where generated code exposes them. General arbitrary-code keyframe editing is beyond this milestone.

Every timing edit has an explicit scope: adjust within a window, move a grouped action, trim media or ripple a selected range. Start with constrained local nudges; do not implicitly ripple the whole notebook. Cue-bound actions stay anchored by default. Moving beyond the permitted offset offers a deliberate rebind or revision and explains the consequence.

Reject or resolve negative durations, conflicting property writers, overlap that hides the explanation, illegal state order and narration conflicts. Example: moving a request's rejection before the bucket empties must not silently produce a contradictory video. A camera or presenter edit requires updated framing/occlusion checks. A supported nudge must survive save → reopen → export and regeneration, or report a specific conflict.

## 9. Durable records, jobs and invalidation

Extend existing stores and services rather than introducing a parallel project format. The following are logical records; choose migration/table boundaries during implementation:

| Record | Durable data |
| --- | --- |
| Visual-cast revision | Entity mapping, base provenance, asset variants and rig checks; MinIO artwork/previews |
| Planning packet revision | Complete input inventory and hashes; materialized read-only files |
| Scene plan and approval | Candidate content, approved revision, dependency fingerprint, comments and selected skills |
| Plan preview | Plan/input hashes, sketch bundle, approximate timing and declared placeholders |
| Recording guide / take / alignment | Script revision, section IDs, selected media, cue occurrences and unresolved timing |
| Composition revision and edits | Code/manifest/configuration hashes, media and runtime pins, exposed bindings |
| Quality evidence / output acceptance | Checks, frames, playback review and exact accepted inputs |
| Production job | Owned stages, checkpoints, actionable failure, retry/cancel/resume and provider/model provenance |

Keep metadata and atomic revision changes in local PostgreSQL; artwork, takes, bundles, preview frames and exports in local MinIO. Use stable object IDs/hashes and an internal resolver. Publish metadata pointers only after complete artifacts are available, using compare-and-swap on the expected scene revision.

Approval, queueing, landing and export must use the same freshness/dependency rules. A late result can be retained historically but cannot become current against newer inputs. Deduplicate requests and claim run ownership atomically. Restart reconciles durable job and planning states; provider switching retains all accepted artifacts.

| Change | What becomes outdated |
| --- | --- |
| Relevant source claim or explanation changes | Dependent plan, preview and production approval; show the changed evidence |
| New theme or artwork variant | Affected visual decisions, preview and output proof; no mutation of the base |
| Narration meaning/wording changes | Affected plan/script agreement, guide, alignment and produced scene |
| New take with the same approved wording | Timing/alignment and output proof; conceptual plan and artwork remain reusable |
| Supported timing/layout nudge | Edited composition and proof; re-review the plan only if its approved intent is changed |
| Adjacent scene boundary changes | The affected continuity agreement and seam proof, not every scene |

Use dependency scopes fine enough that changing scene 3's delivery does not force new assets and plans for the whole notebook. Global constraints still invalidate their true consumers. Preserve all historical approvals with a visible current/stale distinction.

## 10. Implementation packages and completion evidence

Existing paths below are integration seams, not instructions to add more monolithic logic. New module names are proposals. Planning files currently live in the submitted M0/integration tree and must be reconciled first.

| Order | Package and code seams | Deliverable and acceptance |
| --- | --- | --- |
| P0 | `server/planning-service.ts`, `src/planning/planning-records.ts`, desktop `harness/run-manager.ts`, source creation in `src/main.ts`, persistence | Repair stale ancestry, duplicate ownership, terminal provider errors and restart recovery. Make rich page drawing the normal path. Use one durable model preference. Repeat the review's defect probes as corrected acceptance tests. |
| P1 | `src/slide-atoms.ts`, `server/appearance-library.ts`, proposed `server/visual-cast.ts` and packet materializer | Extract, validate and store standalone cast entries; ship actual theme, SVGs, thumbnails and available rigs in packets. Prove the 20-slot pool, a gauge and an icon survive extraction and reuse. |
| P2 | `src/planning/planning-workspace.ts`, scene blocks/notebook navigation in `src/main.ts`, dedicated scene-review components | Show the reference wireframe beside the plan; moment selection, richer compare, scene approvals, a lightweight recording guide and distinct production actions. Preserve edits/focus under live updates. Reopen an approved scene without changing the base. |
| P3 | Player bridge, proposed composition manifest/bundle service, desktop sketch route/tools and selected pinned skills | Build one product-generated rough preview with real movement, camera and presenter stand-in; play and seek on Studio's canvas. Establish engine compatibility and read-only timeline bindings. Label provisional content; approval starts no production. |
| P4 | Existing Quiver provider/library, bounded production route, composition validation, `packages/markdown-composition` scene variant and server producer/export integration | Produce the approved scene as code with a verified rich asset; preserve stable identities from sketch. Store a complete bundle. Preview and export the same version, with all required assets resolved. |
| P5 | `src/coach.ts`, existing take/recording/alignment services, recording-guide module and scene composition bindings | Guide and record human delivery, review/select a take, align it and substitute it into the scene. Demonstrate full presenter → graphics with continuing voice → shared-frame return. Keep generated-only delivery equally usable. |
| P6 | Timeline components, edit-configuration service, manifest bindings and affected quality checks | Add supported nudges and undo/redo. Prove saved edits alter preview/export identically, preserve causal/cue constraints and survive compatible regeneration. Unsupported edits take the harness revision path. |
| P7 | Notebook assembly, boundary agreements, durable export jobs and acceptance fixtures | Assemble mixed-delivery scenes, review transitions, selectively rebuild and export. Restart/reopen must recover exact selected revisions and media. |

Use the product's chosen local Claude Code, Kimi or Codex harness for planning, sketching and production, with effective model and last provider status visible before each run. Pin the adapted skill bundle and record what was loaded. Do not patch around a broken product path by having the development assistant supply the finished scene.

### First next-stage milestone: P0–P3

Deliver a complete **visual review loop** before expanding full production:

- One rich base page and its extracted cast are visible in a video scene's notebook block.
- A real local harness creates a creative plan from the complete packet and can revise it using creator feedback.
- A rough coded preview shows the intended progression on the Studio stage, with assets/timing limitations made clear.
- The creator compares and approves a scene independently, leaves another unapproved and returns after restart with both states intact.
- A recording guide explains the proposed human contribution; an absent take does not prevent planning or a labelled sketch preview.
- No final Quiver generation, take selection, production or export starts merely because the plan was approved.

### First production milestone: P4–P6 on one scene

Use the same source-backed concurrency or token-bucket explanation for generated narration and real human delivery. Demonstrate a verified rich object performing the mechanism, deliberate camera/attention, readable holds and speaker handoffs. Make a small timeline edit, reopen, export and compare it with the reviewed playback. An encoder success or screenshot alone cannot establish this acceptance.

### Connected-scene proof: P7

Use three scenes with distinct purposes: a presenter-led setup, a graphics-led mechanism and a closing explanation. Produce one while another remains in planning. Selective retake/rebuild must preserve unaffected accepted scenes. Finish the pending OpenAI and Anthropic technical-article tests once provider access is restored; source/theme import alone is not their production acceptance.

## 11. Verification matrix

| Area | Required proof |
| --- | --- |
| Visual context | Standalone extraction matches the source; no missing definitions/fonts; repeated instances have unique IDs; each asset maps to the right entity |
| Meaning | Claims remain grounded; chosen numerical examples balance; a symbol's animation does not imply an unsupported mechanism |
| UX | Plan and wireframe readable together; clear reference/preview/output labels; scene-specific approvals; usable keyboard controls and stable inspector while jobs update |
| Local harness | Clean packet run, real model provenance and bounded repair; unavailable provider produces an actionable persistent error |
| Preview / production | Same runtime contract; placeholders explicit; pause/resume, cold load and out-of-order seek reproduce the correct state |
| Presenter | Guide covers visible and off-camera speech; selected take controls timing; missing cue is actionable; return shot and captions do not obscure the mechanism |
| Editing | Declared controls drive real code; causal ordering survives; undo/redo and regeneration preserve edits or expose conflicts |
| Storage / concurrency | Local PostgreSQL/MinIO, duplicate queue, competing edits, late results, cancel/retry, restart and asset reuse without changing the base |
| Export | Exact bundle, edit configuration, fonts, media and scene versions match preview; watch the entire scene with sound and compare boundary/proof frames |

Keep diagnostics available without turning technical implementation details into the normal creator workflow. The measure of success is that the creator can understand, approve, rehearse and adjust the intended explanation, and then see that approved direction realized in the rendered scene.
