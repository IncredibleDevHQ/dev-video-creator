# From reviewed creative plans to the explainer MVP

24 September 2026. Working plan, informed by the [independent M0 review](../reviews/2026-09-24-independent-m0-review.md). Stripe planning and revision tests have live evidence; OpenAI and Anthropic generation acceptance remains incomplete after provider credits were exhausted.

The detailed next-stage product, UX and architecture specification is [A visual scene notebook, from creative plan to production](scene-creative-review-and-production.md). Its first milestone is a complete visual review loop: rich context → creative plan beside the wireframe → rough Hyperframes preview → independent scene approval. Production and presenter recording follow through separate actions.

Work on `feat/hyperframes-markdown-mvp`. First reconcile the submitted `claude/hyperframes-markdown-handover-674230` implementation with the existing repairs; do not overwrite either tree's uncommitted work. Commit each coherent, verified slice as author and committer `Karthic <Kartronics85@gmail.com>`. A unit-test count is supporting evidence, not visual acceptance.

## 1. Repair the journey and planning integrity

Ship these before increasing generation scope:

- Make the normal base-notebook path execute `page-master` design, iconography and diagram composition. Keep an explicitly labelled instant schematic option. Drawing failure and partial completion must be visible; a primary import action must explain which result it will import.
- Remove the initial whole-notebook delivery prerequisite. Keep delivery undecided or set it per scene, using one record throughout planning, recording and rendering.
- Use one durable provider/model setting across stages, with optional stage overrides. Show requested and actual model and the last actionable provider status. A new local server port must not reset preferences.
- Atomically deduplicate planning requests and claim run ownership. Model provenance updates must not change that owner.
- Propagate freshness through source/narrative/theme → brief → scene plan. Gate queue, submission, review and later execution on the same dependency calculation.
- Keep provider failures actionable across every stage, not just M0 planning: retain quota/auth/model errors through completion, filter events by run ID, preserve the draft, and offer an explicit provider/model switch.
- Reconcile interrupted runs and their planning records at startup. Stop and Retry must recover orphaned runs without direct database edits.
- Support retained source fragments as a first-class evidence pool; never pretend that partial source is complete.

**Acceptance:** simultaneous requests start one provider session; source edits cannot leave a reviewable current plan; restart during a run yields an actionable interrupted state; provider choices survive restart; a user can create a base without a delivery decision. Test this on local PostgreSQL and MinIO.

## 2. Make every planning packet self-contained

The packet must carry usable inputs, not only IDs that the local harness cannot resolve:

- Pinned source and evidence, creator wording policy and scene scripts.
- The actual saved theme tokens, typography, font assets or explicit fallbacks, and revision metadata.
- Base SVGs and rendered thumbnails, labelled as presentation references. Their coordinates and `kind` values do not constrain the video plan.
- A visual cast extracted from those pages: standalone icons and larger explanatory objects, their entity/source associations, original SVGs, previews, actual parts and verified reuse constraints. Preserve illustrated mechanisms such as the twenty-slot pool rather than reducing everything to an icon.
- Requested duration, per-scene delivery and creator direction, distinguished from inferred suggestions.
- Previous reviewed treatment and neighboring scene context, with freshness clearly identified.

Validate standalone extractions against the original artwork, including transforms, definitions, fonts and repeated-instance IDs. Store immutable asset revisions in the local PostgreSQL/MinIO library. Distinguish verified parts from inferred animation affordances. The planner can reuse, rig, enrich through Quiver or replace artwork according to the explanation; it does not inherit the slide's rectangle layout.

**Acceptance:** a new empty run directory contains everything needed to explain the chosen source, identify the brand and inspect the base imagery and extracted cast. The provider never has to invent colors from an opaque theme ID or refer to a nonexistent wireframe path.

## 3. Deliver scene-by-scene visual review

Use the Markdown notebook's scene organization as the main workspace. Show the selected scene's creative plan beside its actual wireframe, with the presentation brief, explanation brief, source and selected visual cast accessible. Moments explain speech and visible change together. Preserve focus, disclosures and unsaved direction during run updates.

Keep **Wireframe reference**, **Plan preview** and **Generated scene** visibly distinct. A separate **Preview plan** route uses the product's local harness to construct a rough Hyperframes composition from the candidate and extracted artwork. This explicitly extends M0's planning-only boundary; it is not hidden production inside the planning route. Missing final artwork, presenter footage and unmeasured timing remain labelled. Establish compatible player/manifest contracts here, and show read-only timeline intervals linked to playback.

**Approve plan** pins one scene's direction and dependencies. It does not start **Produce scene**, select a take or export. Allow reviewing every scene first or producing selected approved scenes while others remain in planning. Keep plan approval, media readiness, running jobs and actual output acceptance separate. Show a lightweight recording guide for the proposed human contribution before full recording integration.

Use the product's local harness to prepare a brief and creative plans for contrasting technical articles. Include one mechanism, one comparison or quantitative explanation, and one presenter-led passage. Keep the actual provider/model, bundle fingerprint, run IDs, timings and packet hashes with the evidence.

For each tested scene, produce a first candidate, assess it, change a concrete direction, produce a second candidate, compare them and select the preferred revision. Mark a candidate reviewed only after its content is acceptable; do not approve a known incorrect plan merely to exercise the control. Refresh and reopen the app. Verify that history, edits and review decisions persist and that unrelated scenes stay untouched.

Judge the plan itself:

1. What should the viewer understand?
2. What becomes visibly different, and why?
3. What should receive attention at each moment?
4. Does the plan preserve object identity and give an outcome time to register?
5. Are presenter, graphics, text and camera coordinated around the same explanation?
6. Do cited skills support the proposed result, with construction risks identified?
7. Once an illustrative example is chosen, do its values, state changes and consequences agree? Use a small event/state ledger when quantities matter; do not constrain the initial brief to one fixed animation form.
8. Are incoming and outgoing continuity agreements supported by current adjacent plans, or explicitly proposed and unresolved?

A plan can be accepted as a plan while its eventual motion remains unproven. Do not label creative-plan approval as finished-video review. Resume the pending OpenAI and Anthropic generation tests when provider access is restored.

**Next milestone acceptance:** complete P0–P3 in the detailed specification. A creator sees the source wireframe and cast, revises a real harness-generated plan, watches a labelled rough preview, approves one scene independently and reopens the same state after restart. Approval alone starts no final production. The preview must show motion, not merely a sequence of static pages.

## 4. Prove one coded Hyperframes scene

Select one reviewed mechanism scene. The product's local harness, using a pinned compatible skill bundle, must build its HTML/CSS/JavaScript composition. The development assistant builds the software and test instrumentation; it does not hand-author the proof video on the product's behalf.

Use one owning workflow that loads the required camera, object animation, typography, timing and runtime recipes. A scene may contain several connected moments and use multiple recipes on one clock. Preserve the open explanation and creative choices; do not reduce the composition back to the legacy list of slide animation verbs.

Publish a complete code bundle and a versioned composition manifest: stable scene/moment/entity/layer IDs, nested time mappings, pinned assets and media, real intervals/cues/transitions, runtime requirements and exposed editing bindings. Store manual edits as a versioned configuration consumed by the code. The manifest describes the composition; it is not a second animation engine. Preserve useful identities and code from the sketch, while allowing final assets to change the staging through a reviewed revision.

Before generation, maintain a small engine compatibility fixture for the installed runtime: target-aware camera framing, object/path movement, internal SVG state, seekable playback, audio timing and preview/export parity. Pin the tested versions. Upstream documentation alone is not compatibility evidence.

Quiver generation and editing must use the project's configured environment credentials. Store accepted SVGs and rigs durably in MinIO with PostgreSQL metadata, provenance and reusable asset revisions. Separate an object's technical role, visual appearance and exposed animation controls. Reuse an existing verified asset when it meets the treatment; do not require a new generation on every revision. Make the product's rich-asset direction available to the planner: prefer a riggable hero illustration where object performance benefits, while keeping simple countable markers native. Do not rely on the creator asking for Quiver again in each scene.

**Acceptance:** one scene visibly performs a source-supported mechanism, previews on the Studio canvas, seeks correctly in both directions and exports from the same pinned composition bundle, edit configuration and media. Watch the complete real-time result with narration, as well as inspecting proof frames. Validate that cause precedes consequence, attention is clear and no important label or actor becomes unreadable.

## 5. Connect narration and presenter delivery to the composition

Support generated narration and human delivery per scene. Voice source and presenter visibility are separate: a person's narration continues while graphics fill the frame. The director proposes purposeful switches among presenter, shared frame and full-screen graphics. The creator can override delivery or framing per scene.

Turn the approved treatment into a recording guide with exact lines, suggested emphasis/pauses, framing and a simple shot sequence. Offer rehearsal, a whole-scene take or manageable sections, playback, retake and explicit take selection. Include off-camera spoken passages, preserve alternate takes and show completion per required section. Graphics can be prepared while recording is outstanding; stand-ins and guide audio stay labelled.

Bind explanatory actions to actual word occurrences or authored silent holds. Retiming must preserve causal ordering and make room for consequential changes to land. Presenter entry, camera movement and object action are coordinated channels of the same scene timeline.

The selected take supplies actual speech timing. Missing/ambiguous cues and intervals too short for the explanation require a specific adjustment or pickup; never silently omit actions or stretch accepted speech. Replacing a take updates the affected scene's alignment and proof, not unrelated plans or reusable artwork.

**Acceptance:** one scene works with generated narration and with a recorded take; a longer take retimes it without losing events; switches do not cover the object being explained; captions remain readable; camera and voice are not competing for attention.

## 6. Complete the deck and editing loop

Extend the read-only preview timeline into a Motionity-inspired composition editor over the real manifest. Provide a notebook scene strip and an expandable selected-scene timeline: voice, presenter picture, objects, text, camera and sound where used. Show real intervals and transitions. First expose bound text/framing/camera controls, then constrained timing nudges with numeric/keyboard input, snapping and undo/redo. Add keyframe editing only for declared bindings. Unsupported changes invoke a harness revision instead of a nonfunctional control.

Keep cue anchors and causal order intact. A supported edit must change preview and export identically, survive reopen and carry into compatible regeneration; removed targets or conflicting edits need an explicit resolution. Read-only inspection does not silently become an export edit.

Once the one-scene production and editing proof is accepted, extend to a small multi-scene video before an entire long article. Review outgoing/incoming continuity, support per-scene delivery and preserve unaffected accepted scenes during retakes and regeneration.

Build and export jobs must pin their inputs and assets, resume or fail clearly after restart, retain the previous reviewed result during regeneration and never modify the base notebook. A successful export must reopen from durable storage and correspond to the previewed revision.

**MVP completion:** a creator can import a technical source, retain a well-designed base notebook and theme, fork video, inspect and revise plans, generate or record scene delivery, review a genuinely explanatory motion scene, assemble the video and export it through a recoverable local workflow. The three article proofs, including their actual MP4s and UI evidence, must support that claim. Test suites alone do not establish that the experience is delightful.
