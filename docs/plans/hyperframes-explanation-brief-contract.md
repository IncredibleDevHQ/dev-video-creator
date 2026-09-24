# Explanation Brief: design derived from the Hyperframes consumers

24 September 2026 · Proposed contract, not implemented or quality-accepted

Companion to [the explainer pipeline proposal](hyperframes-explainer-pipeline.md). Research inspected upstream commit `99221c50a5e5927ca243454b4e4f02f9adf7cfc6`. This does not change the application's installed Hyperframes version or approve an upgrade. Work stays on `feat/hyperframes-markdown-mvp`; commit validated slices as Karthic `<Kartronics85@gmail.com>`.

## 1. Decision

The Explanation Brief is the video counterpart of the outline that feeds presentation design. It should preserve source meaning and expose the communication needs that creative skills will solve. It need not contain a finished script, fixed scene roster, camera moves, timings or recipe choices.

The reverse engineering reveals two different selections:

1. **Workflow selection:** what whole deliverable is being made, from what material, under what creator constraints?
2. **Capability selection during planning:** what combination of narration, presenter, object performance, text, camera and sound will communicate each moment?

The top-level Hyperframes router handles the first. The owning workflow's local harness handles the second by reading creative guidance, capability indexes and selected recipes. There is no evidence of an upstream deterministic dispatcher that takes an arbitrary custom Explanation Brief and automatically assigns every layer to a skill. Incredible must implement the handoff and coverage checks.

Consequently, keep three progressively enriched artifacts:

- **Explanation Brief:** source meaning, known inputs and communication requirements, with open choices explicitly left open.
- **Scene treatment:** skills propose scenes, moments, overlapping channels and suitable capabilities. The creator can edit these decisions.
- **Executable composition plan and bundle:** resolve assets, rigs, cues, camera, layout, recipe dependencies and controls; construct and review.

These are stages of one authoring record with versioned derivatives, not three unrelated sources of truth. The initial brief must not masquerade as the final scene treatment.

The immediate [M0 milestone](hyperframes-explainer-pipeline.md#12-implementation-order-and-acceptance) starts with the retained wireframe deck, prepares the Explanation Brief after creating a video fork, then exposes a per-scene **Generate creative plan** action. Presentation and video modes both show the original presentation input and the selected video fork's brief/treatment with explicit revision and ownership. M0 stops after scene-treatment review. Subsequent construction has the product's local harness author coded Hyperframes compositions that play on the Studio canvas and render through the same pinned runtime/artifacts; this is not merely a source of animation advice for the old slide renderer.

## 2. What the upstream readers actually consume

All links in this audit pin the inspected revision.

| Consumer | Observed contract | Implication for Incredible |
| --- | --- | --- |
| [Top-level router](https://github.com/heygen-com/hyperframes/blob/99221c50a5e5927ca243454b4e4f02f9adf7cfc6/skills/hyperframes/SKILL.md) | Fresh requests are matched by deliverable; existing `BRIEF.md` resumes its saved `workflow`/`flow`. Domain needs can load several skills. | State “technical explanation” and material constraints clearly. A blog URL must not imply marketing; a presenter must not imply recutting existing footage. Save route decisions separately from source facts. |
| [Brief format](https://github.com/heygen-com/hyperframes/blob/99221c50a5e5927ca243454b4e4f02f9adf7cfc6/skills/hyperframes/references/brief-format.md) | Canonical frontmatter holds routing/run fields and video intent; optional prose sections hold intent, assets, customizations and notes. | Generate the native envelope through an adapter. A product-specific field is not automatically understood merely because it appears in YAML. |
| [General workflow](https://github.com/heygen-com/hyperframes/blob/99221c50a5e5927ca243454b4e4f02f9adf7cfc6/skills/general-video/SKILL.md) | Plans story/rhythm/duration, then names suitable blueprints or rules; multi-scene blocks are written even when sketch review is disabled. | Creative decomposition happens after intake. Record its decisions and preserve one production owner. |
| [Storyboard format](https://github.com/heygen-com/hyperframes/blob/99221c50a5e5927ca243454b4e4f02f9adf7cfc6/skills/hyperframes/references/storyboard-format.md) | Frame blocks carry narration guidance, duration, source composition and free narrative; unknown fields survive as extras. | Extra data can be retained, but needs an explicit reader. Narration guidance is distinct from the locked audio-driving script. |
| [Explainer visual design](https://github.com/heygen-com/hyperframes/blob/99221c50a5e5927ca243454b4e4f02f9adf7cfc6/skills/faceless-explainer/references/visual-design.md) | A frame develops through spoken-cue windows; each window describes visible content, movement and layout. It can compose rules when a blueprint does not fit. | Borrow the within-scene planning method. Do not copy its faceless-only assumption or turn its windows into mandatory cuts. |
| [Animation skill](https://github.com/heygen-com/hyperframes/blob/99221c50a5e5927ca243454b4e4f02f9adf7cfc6/skills/hyperframes-animation/SKILL.md) | Recommends composing atomic rules; blueprints are optional larger structures. Multiple runtimes can share a composition if integrated for seeking. | One scene can combine capabilities across time and layers. Recipe count is not a quality metric. |
| [Presenter composition](https://github.com/heygen-com/hyperframes/blob/99221c50a5e5927ca243454b4e4f02f9adf7cfc6/skills/hyperframes-creative/references/composition-patterns.md) | PiP uses an animated wrapper; text-behind-subject needs cutout footage. | Record actual footage capabilities and recording status; do not promise a treatment before its media prerequisites exist. |
| [Talking-head recut](https://github.com/heygen-com/hyperframes/blob/99221c50a5e5927ca243454b4e4f02f9adf7cfc6/skills/talking-head-recut/SKILL.md) | Reads transcript and media metadata to design timed overlays around an existing clip. Its card storyboard is an authoring aid, not a universal composition compiler input. | Borrow transcript-grounded timing and layout ideas. This workflow does not provide Incredible's full recording/coaching or mixed-delivery model. |
| [Packet builder](https://github.com/heygen-com/hyperframes/blob/99221c50a5e5927ca243454b4e4f02f9adf7cfc6/skills/hyperframes/scripts/lib/frame-packets-core.mjs) | Copies each frame block, one selected blueprint and recognized rule bodies. It does not automatically copy the whole brief or the storyboard preamble. | Add a product packet adapter so evidence, global constraints, presenter decisions and continuity survive into construction. |

The brief matters because it influences workflow choice and downstream creative reasoning. It is not sufficient by itself: capability availability, selected instruction bodies, asset quality, packet completeness and rendered review also determine the result.

## 3. Proposed input structure

Use a versioned product record in PostgreSQL and render a readable Markdown handoff for the harness. Long prose remains prose; identifiers and references are structured. Materialize files/assets from the pinned durable versions. Do not ask creators to fill out a schema.

| Brief section | What it contains before creative planning | What remains open |
| --- | --- | --- |
| **Purpose and delivery context** | Deliverable, audience, central message, language, destination, requested length and style constraints when known | Detailed story structure and scene durations |
| **Source and meaning** | Revision references, claims/evidence, relevant entities/relationships, current narrative, terminology and exact content that must survive | Visual metaphor, demonstration choice when not given, actor appearance |
| **Explanation units** | Stable IDs for related ideas/questions; provisional progression; causal dependencies distinguished from suggested editorial order | Final scenes, shots and one-to-many grouping |
| **Communication needs** | What would help the viewer hear, see or read; why it matters; any creator-mandated treatment or protected fact | Which medium, recipe, camera or composition satisfies each need |
| **Available material and delivery** | Theme, existing assets and their verified properties, scripts/audio/takes and their status, per-scene decisions already made, recording possibilities | Unchosen voice source, presenter visibility/layout and asset requests |
| **Constraints and open decisions** | Required content, wording locks, illustrative vs sourced data, exclusions, unresolved evidence, creator choices vs planner suggestions | Anything not yet decided; absence never means “forbidden” or “faceless” |

Explanation units are semantic groups, not slide types or compulsory production scenes. A unit can generate several moments; several units can share one continuous scene. Existing page IDs appear only as lineage/visual-reference links.

Communication needs are open descriptions, not a replacement enum of video kinds. Examples include understanding a dependency, hearing a personal judgment, reading an exact command, comparing two values, or following the same request. A need can be met by several channels together. A required quote may need text; a definition might be conveyed by objects or speech. Do not require all channels in every unit.

For choices that affect routing or correctness, distinguish creator requirements, source facts, and inferred suggestions. Suggested visual treatments remain revisable. Do not write an inferred treatment into the native brief's user-accepted customizations section. Stable references carry provenance without making every sentence a complex object.

Keep the requested delivery flexibility: voice source is chosen per eventual scene; human voice and presenter visibility are separate. A person can keep narrating while only animation is visible. A pending take is different from no presenter being wanted. Hyperframes `flow: automation` controls the production interaction; it does not mean synthetic narration or no human presenter.

### Candidate brief, before shot planning

The following is an illustrative shape, not an executable schema or evidence from a particular article. References are symbolic placeholders; a real run must resolve them. The communication needs below are proposed by the planner unless confirmed by the creator.

```yaml
schemaVersion: 1
purpose:
  deliverable: Narrated technical explainer
  audience: Developers learning request admission
  message: Available tokens explain why a request passes or is rejected.
source:
  revisionRef: source-revision-id
  narrativeRef: current-authored-narrative-id
  wordingPolicy: preserve-existing-approved-lines
meaningUnits:
  - id: admission-capacity
    question: Why can a burst pass while a later request is rejected?
    explain: Admission consumes available tokens; exhaustion prevents admission until refill.
    evidenceRefs: [admission-passage, refill-passage]
    entities: [request, token-bucket, service]
    communicationNeeds:
      - Make the connection between available capacity and admission perceptible.
      - Let the viewer connect exhaustion to the next request's outcome.
      - Keep the technical term token bucket understandable.
    preserve:
      - Explain rejection only after the illustrated bucket is empty.
      - Mark invented counts as illustrative.
material:
  themeRef: saved-theme-revision-id
  baseNotebookRef: preserved-wireframe-revision-id
  assetRefs: []
  takeRefs: []
delivery:
  existingSceneDecisions: []
  unresolved: Voice source and presenter visibility will be decided per scene.
creativeGuidance:
  - Keep spatial continuity long enough to follow the mechanism.
  - Rich controllable objects are appropriate where they improve the explanation.
openDecisions:
  - Demonstration details, scene boundaries, visual treatment and selected capabilities.
```

No camera name, recipe ID, layout coordinate or exact duration is needed here. If the user already specified any of those, retain the decision. `assetRefs: []` means no assets selected for this brief, not that the asset library is empty. An absent take must not be replaced with fabricated human footage or silently treated as permission to synthesize the voice.

## 4. How the skills turn the brief into a composition

The owning harness reads the brief and creative guidance, proposes an explanation treatment, then discovers matching capabilities. Capability discovery can cause another design pass when a better treatment becomes available. Real assets and measured speech refine that treatment again.

The resulting scene treatment is a **matrix of moments and overlapping channels**. It is not a sequence of mutually exclusive “speaker section, motion section, text section.” Those may be useful emphases, but speech, text and motion can coexist.

An illustrative treatment after choosing a human-narrated mechanism scene:

| Moment | Spoken narrative job | Objects / graphics | Explanatory text | Presenter / camera |
| --- | --- | --- | --- | --- |
| Establish the question | Introduce why requests are treated differently | Establish bucket and route | Name the technical term if useful | Presenter can introduce; camera establishes the system |
| Admit a request | Explain the admission condition | Same request arrives; token is consumed; request proceeds | Capacity readout only if it helps | Presenter may yield space; camera follows or holds |
| Reach exhaustion | Explain what changed | Capacity reaches empty | Make the empty state readable | Frame cause and incoming request together |
| Reject the next request | Connect consequence to condition | Same next request takes rejection route | Short outcome label | Human voice continues over full graphics |
| Explain refill | Explain recovery | Capacity returns; later request can proceed | Optional concise takeaway | Wider context; presenter can return after the result is clear |

The skills choose which of these treatments are useful. In a generated-only scene the presenter channel is absent, with no reserved empty area. In a code walkthrough the exact code may be the dominant channel. In a definition, calm typography may be sufficient. There is no requirement to insert a camera move, animated SVG or speaker appearance in every scene.

The treatment records a primary attention target per moment, stable entity IDs and narration associations. Detailed times wait for audio. Separate explanatory labels, exact source/code text and accessibility captions: narration should not automatically become large on-screen paragraphs.

### Capability selection after the treatment

| Need discovered while directing | Candidate skill family / material | Prerequisites to check |
| --- | --- | --- |
| Preserve or draft spoken explanation | Creative narration/story guidance plus product wording policy | Approved text, language and evidence |
| Person shares the view with a mechanism | Creative composition patterns + core media + keyframe guidance | Actual/pending footage, subject bounds, crop and caption safe space |
| Parts of an object visibly operate | SVG enrichment + keyframes; product Quiver tools | Verified controllable groups, pivots, ports and intended technical behavior |
| Viewer follows action to consequence | Animation path/camera rules or a camera-journey treatment | Shared coordinate system, target bounds and readable travel/holds |
| A term or number must be read | Creative typography/data guidance + appropriate text/counter rule | Exact copy/data, sufficient reading time, no duplicated caption content |
| Recorded speech drives events | Media transcription/alignment + core time placement | Selected take, cue occurrences and causal dependencies |
| Sound reinforces a visible event | Audio/media capabilities compatible with the runtime | Speech clarity, available assets and intentional sound policy |

These are discovery hints, not fixed conversions. The local harness reads the relevant index and actual selected recipe bodies, explains why each serves the moment, then binds it to the real media. Named needs do not guarantee installed support. Maintain a small capability manifest with version, instruction paths, prerequisites, property/clock ownership and verified support. Scope this to the pilot's needs before expanding the catalog.

## 5. Adapter and packet contract

1. **Source reduction:** create the lightweight product brief from retained source/current narrative. Preserve the original notebook and its source revision. Validate references and surface missing evidence; do not require visual implementation fields.
2. **Route once:** use deliverable/material constraints to select a compatible owning workflow, then generate canonical `BRIEF.md`. The mixed technical explainer generally uses the adapted `general-video` route. Presenter presence, a short text animation or a Quiver asset must not each start another whole-video workflow.
3. **Read product meaning explicitly:** the adapted planning instruction must read the materialized `EXPLANATION.md` companion and relevant source records. `BRIEF.md` includes a compact intent/constraints digest and the companion reference. Do not rely on the stock workflow discovering a custom sidecar automatically.
4. **Plan scenes and channels:** produce the treatment and native storyboard/script/design artifacts. Carry explanation-unit IDs, required content, delivery choices and evidence into per-scene records. Final script and actual takes drive audio; storyboard narration remains a guide until that choice is resolved.
5. **Build packets:** copy the scene's meaning/constraints, selected script and cue status, global creative requirements, theme reference, real asset bindings, presenter decisions, continuity entry/exit state and selected instruction bodies. A packet must stand alone without reconstructing hidden chat history.
6. **Construct and verify:** resolve all bindings and timing needed for execution. Check semantic coverage and actual rendered behavior; record which brief requirement each moment satisfies. Unknown required capabilities produce visible errors, never an unexplained plain-box fallback.

The adapted planner can enrich existing records instead of creating a second competing script or explanation. PostgreSQL stores the canonical revisions, route and treatment. MinIO stores source snapshots, materialized run artifacts, assets, proof frames and composition bundles. Saved records pin the relevant source/theme/skill/runtime versions; resume does not silently reroute from stale or inferred intent.

### Specific upstream seams to adapt

- **Multiple recipes:** upstream inlines multiple recognized motion rules per frame. Its `blueprint` field resolves a single ID. For a continuous scene with several techniques, a rules-based composition works within that contract. If several blueprint bodies are needed, represent per-moment uses in a product recipe manifest and explicitly inline those bodies through the adapter; do not put a comma-separated list in the singular field or split into artificial cuts merely to fit it.
- **Global direction:** the generic packet builder slices from `## Frame N`, omitting preceding global prose. Explicitly carry relevant global constraints into each product packet, without copying unrelated source material or the entire library.
- **Unknown rules:** the inspected selector filters IDs against existing rule filenames. Validate requested recipe IDs before packaging, so a missing mandatory rule is not silently discarded. Also verify referenced adapters/components; direct rule bodies do not establish that every dependency was supplied.
- **Canonical headings:** the storyboard format documents several heading aliases, but the inspected packet builder splits only `## Frame ...`. Emit that canonical form and retain product IDs separately.
- **Continuity:** within a scene, recipes share actor state and one clock. Separate camera transforms from object-local transforms and presenter/caption layers. Each property has one writer; recipe transitions cannot reset token counts or swap object identity unnoticed.
- **Product overrides:** adapt generic workflow approval/provider rules to the user's product authorization and selected local harness. Borrow useful direction without inheriting forced pitch pacing, mandatory layout churn, card-count floors, or automatic narration changes. Keep known fields and actual capability prerequisites authoritative.

## 6. Isolated probe evidence

Ran the inspected upstream `splitFrames`, `citedRules` and `blueprintId` helpers against small in-memory inputs. No app files, dependencies or product runs were changed.

| Input / check | Observed result |
| --- | --- |
| Global `## Video direction` before one canonical `## Frame 1` | One frame returned; the global instruction was absent from its block |
| A storyboard using only `## Scene 1` | Zero blocks returned by this packet helper |
| `rules: coordinate-target-zoom, nonexistent-rule` with only the former known | Only `coordinate-target-zoom` returned |
| `blueprint: camera-journey, dataviz-countup` | Returned as one combined string, not two blueprint IDs |

These prove adapter constraints at this upstream revision. They do not prove that the proposed brief improves video quality, nor that these behaviors are present in the application's current installed runtime.

## 7. Implementation and validation

Deliver the brief and scene-treatment review first through M0 in the [pipeline plan](hyperframes-explainer-pipeline.md), then continue the executable packets, assets and rendering through H1–H3:

1. Define a small versioned brief and durable references. Make source meaning/creator requirements distinguishable from creative suggestions. Keep scene boundaries and treatment optional.
2. Implement the native brief adapter and explicit companion reader. Persist chosen workflow, reason and input revision; keep provider selection separate from creative routing.
3. Implement skill-led scene/moment/channel planning and requirement coverage. Record proposed, accepted and unresolved decisions without promoting suggestions to creator mandates.
   **M0 stops here:** persist and display the candidate treatment for review, with retry/revision support. Enforce the planning-only dispatch and tool contract; do not continue into acquisition or rendering because the upstream workflow normally does so.
4. Implement recipe/dependency resolution and self-contained packets. Support several rules or explicitly adapted blueprint segments within one scene. Validate assets and property ownership at construction, not intake.
5. Run the following cases through the product's local harness, using pinned skill/runtime inputs and clean runs. The development assistant must not hand-author the production video.

| Case | What it must establish |
| --- | --- |
| Blog explanation vs marketing from the same URL | Route follows the requested deliverable, not the source domain |
| One mechanism, several moments | Multiple appropriate capabilities coexist without needless scene cuts, state resets or broken narration timing |
| Human voice with presenter hide/return | Voice remains the selected take; layout changes preserve space and readability |
| Generated-only counterpart | No forced speaker decision or empty presenter slot; meaningful graphics remain |
| Exact code/text and a non-mechanism definition | The form supports text-led explanation without forcing an object simulation |
| Missing Quiver rig part, missing recipe or missing take | Actionable visible issue; no false success or silent capability loss |
| Reopen and selective camera/text edit | Requirements, route, accepted decisions, assets and evidence survive; affected outputs are rebuilt |

Compare a minimal prose brief with this structured brief on the same retained source, theme, assets and narration where applicable. Record source correctness, requirement coverage through packets, visual causality, reading/hold time, speech alignment, presenter composition, continuity, and actual export quality. Review with sound; inspect decisive frames and seams. Repeat enough matched cases to distinguish a useful format from one fortunate generation.

Do not freeze a large schema before that experiment. The audited consumers support this proposed structure, but the winning amount of detail and the resulting quality still need product-generated evidence.
