# From reviewed creative plans to the explainer MVP

24 September 2026. Working plan, informed by the independent M0 review. Live article acceptance results are still being collected in `docs/reviews/2026-09-24-independent-m0-review.md`.

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
- Library asset previews, technical roles, named animation parts and verified reuse constraints.
- Requested duration, per-scene delivery and creator direction, distinguished from inferred suggestions.
- Previous reviewed treatment and neighboring scene context, with freshness clearly identified.

**Acceptance:** a new empty run directory contains everything needed to explain the chosen source, identify the brand and inspect the base imagery. The provider never has to invent colors from an opaque theme ID or refer to a nonexistent wireframe path.

## 3. Finish M0 with a reviewable multi-article proof

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

A plan can be accepted as a plan while its eventual motion remains unproven. Do not label creative-plan approval as finished-video review.

## 4. Prove one coded Hyperframes scene

Select one reviewed mechanism scene. The product's local harness, using a pinned compatible skill bundle, must build its HTML/CSS/JavaScript composition. The development assistant builds the software and test instrumentation; it does not hand-author the proof video on the product's behalf.

Use one owning workflow that loads the required camera, object animation, typography, timing and runtime recipes. A scene may contain several connected moments and use multiple recipes on one clock. Preserve the open explanation and creative choices; do not reduce the composition back to the legacy list of slide animation verbs.

Before generation, maintain a small engine compatibility fixture for the installed runtime: target-aware camera framing, object/path movement, internal SVG state, seekable playback, audio timing and preview/export parity. Pin the tested versions. Upstream documentation alone is not compatibility evidence.

Quiver generation and editing must use the project's configured environment credentials. Store accepted SVGs and rigs durably in MinIO with PostgreSQL metadata, provenance and reusable asset revisions. Separate an object's technical role, visual appearance and exposed animation controls. Reuse an existing verified asset when it meets the treatment; do not require a new generation on every revision. Make the product's rich-asset direction available to the planner: prefer a riggable hero illustration where object performance benefits, while keeping simple countable markers native. Do not rely on the creator asking for Quiver again in each scene.

**Acceptance:** one scene visibly performs a source-supported mechanism, previews on the Studio canvas, seeks correctly in both directions and exports from the same composition bundle. Watch the complete real-time result with narration, as well as inspecting proof frames. Validate that cause precedes consequence, attention is clear and no important label or actor becomes unreadable.

## 5. Connect narration and presenter delivery to the composition

Start with generated narration plus a scene-level presenter alternative. The director proposes purposeful switches among presenter, shared frame and full-screen graphics, together with recording guidance. The creator can override delivery or framing per scene.

Bind explanatory actions to actual word occurrences or authored silent holds. Retiming must preserve causal ordering and make room for consequential changes to land. Presenter entry, camera movement and object action are coordinated channels of the same scene timeline.

**Acceptance:** one scene works with generated narration and with a recorded take; a longer take retimes it without losing events; switches do not cover the object being explained; captions remain readable; camera and voice are not competing for attention.

## 6. Complete the deck and editing loop

Once the one-scene proof is accepted, extend to a small multi-scene video before an entire long article. Add the Motionity-inspired composition UI over the real composition model: scene and moment navigation, tracks for presenter/graphics/text/audio/camera, preview and seek, duration and timing edits, revision compare and clear regeneration scope. Avoid controls that merely change a drawing while leaving the rendered composition unaffected.

Build and export jobs must pin their inputs and assets, resume or fail clearly after restart, retain the previous reviewed result during regeneration and never modify the base notebook. A successful export must reopen from durable storage and correspond to the previewed revision.

**MVP completion:** a creator can import a technical source, retain a well-designed base notebook and theme, fork video, inspect and revise plans, generate or record scene delivery, review a genuinely explanatory motion scene, assemble the video and export it through a recoverable local workflow. The three article proofs, including their actual MP4s and UI evidence, must support that claim. Test suites alone do not establish that the experience is delightful.
