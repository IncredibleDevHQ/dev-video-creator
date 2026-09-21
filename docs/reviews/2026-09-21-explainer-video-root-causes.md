# Explainer video: code root-cause review and repair plan

21 September 2026 · `feat/hyperframes-markdown-mvp` · HEAD `e52eb6e12765e72142f3b8d4e4129f65343d195b`

**The wireframe layer is a sound base for its format. The largest quality losses happen while turning that base into a timed, performed and exported video.** Rich objects have improved the result substantially, but the product does not yet reliably preserve their appearance, execute their intended interactions, or verify the composed output. More elaborate page templates alone would not fix these failures.

This review traces all **28 findings from the live OpenAI Habitat test** into the current working tree. It adds a controlled reproduction that isolates the previously uncertain SVG breakup. It separates defects still present in the software from earlier candidate problems the local Claude harness repaired. Existing uncommitted changes are part of this baseline; HEAD alone does not reproduce this working tree. No product code was changed for this report, and no new content-generation run was started.

## What the evidence establishes

The earlier live product run produced 14 scenes and a real **422.267-second MP4** using the product’s local Claude Code harness. The wireframes, generated Quiver assets, performances and narration were produced by that product workflow. The export call timed out, retried, and produced a second MP4. After stopping the run and changing notebooks, the stale editor overwrote the applied video derivative with its previous wireframes. Generated files and the MP4 remain retained.

The visual review inspected 43 sampled exported frames covering all 14 scenes; decoded audio established a 6.344-second silent interval. This was not a complete subjective listening review. Human recording/layout quality was not exercised end to end. Current work adds code tracing, a four-case browser renderer diagnostic, three focused compiler/import checks and an audit of the final authored programs. It does not claim a fresh full release-suite pass.

- [Recovered final video](</Users/think/Downloads/Incredible Studio/openai-habitat-live-review.mp4>)
- [Original annotated live-review PDF](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/openai-live-ux-review.pdf>)
- [Retained rich-scene recovery bundle](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/rich-video-recovery-candidate.zip>)
- [New diagnostic measurements and reproducer](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/README.md>)

Screenshots below retain the original captured content, with numbered evidence overlays and a legend. A still demonstrates appearance or UI state; timing, persistence and concurrency claims additionally rely on the cited program, measurements and logs.

## Why the result still feels short of a polished explainer

| Layer | What works | Where the gap appears | Required change |
|---|---|---|---|
| Base notebook | Source passages, branded pages, reusable visual structure and derivation lineage | The upstream outline is primarily a page/relationship description | Preserve the base; add a separate video explanation plan |
| Video planning | Questions, answers, concrete actors and reusable object briefs | Observable outcomes remain mostly prose, not verifiable state transitions | Represent each causal demonstration and its visual evidence explicitly |
| Object generation | Filled editable Quiver artwork with named parts | Acceptance does not establish paint fidelity, transparency or useful behavior in context | Review import and performance variants against the actual scene renderer |
| Choreography | Cue words, local clips, travels and quantities exist | Parts resolve inconsistently; cue-based actions serialize; meaningful states can be replaced by highlights | Compile one typed event graph with explicit timing/dependencies and observable outcomes |
| Composition | Shared motion driver, narration alignment, scene staging | Review and export surround that driver with different SVG/CSS/caption behavior | Review the exact composed frame that export captures |
| Iteration | Durable stages, candidates and receipts | Local repairs are not reusable library versions; a stale UI save can destroy the applied derivative | Immutable asset versions and mandatory project revision checks |

### 1. A page relationship is not yet a causal demonstration

`buildExplanationModel` creates useful source, claim, object and relation records, but assigns `question = scene.idea` and `answer = scene.narration`. Objects carry `id/label/kind/scenes`; relations carry `from/to/verb`. It does not encode an object’s changing state, a condition under which an event occurs, or the observation that proves the claimed consequence. The video program is richer, but `ProgramEvent` still names animation actions rather than a checked causal precondition/postcondition.

Sources: [apps/studio-v2/server/story-model.ts:21](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/server/story-model.ts:21>), [apps/studio-v2/server/story-model.ts:46](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/server/story-model.ts:46>), [apps/studio-v2/src/scene-program.ts:61](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/scene-program.ts:61>).

The explainer skill already says to recompose freely, make objects perform and prove the first mechanism. The problem is not that those instructions are absent. Much of that responsibility remains an open-ended prose request to the local model. The runtime can accept a question, answer and review string without establishing that the requested action actually occurred. Sources: [apps/studio-desktop/skills/explainer-master/SKILL.md:36](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/skills/explainer-master/SKILL.md:36>), [apps/studio-desktop/src/mcp/explainer-tools.ts:318](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/mcp/explainer-tools.ts:318>).

**Fix:** derive a versioned `VideoExplanationPlan` from the accepted base: source claim → viewer question → initial state → triggering event → changed state → visible evidence → narration cue. Bind each observation to actual object/part identities. A queue example should identify which item waits, why service is unavailable, which event releases it, and what the viewer sees change. A spinning ring can support that explanation but cannot stand in for the waiting/release behavior. Keep numerical demonstrations explicitly illustrative where they are not source facts. Do not require every comparison or summary to simulate a queue.

### 2. Richer illustrations do not automatically produce richer explanations

The final 14-scene programs contain 63 beats: **100 appear, 68 travel, 37 perform, 57 leave, 4 refill, 2 highlight, 1 pass and 1 reject events**. Four quantity bindings exist, all in the scale/throughput number scenes. There are no explicit camera or restage fields in these authored programs. These counts exclude the separate cast-test scene.

This is evidence of a repeated reveal/travel/clip vocabulary, not proof that every scene is weak: local clips can change state, and a steady camera often helps an explainer. But the current contract does little to distinguish “an attractive object animates” from “the viewer sees why the result changes.” The program audit supports addressing mechanism-specific behavior before adding arbitrary camera movement or faster cuts.

**Fix:** give reusable objects both a visual rig and a behavioral contract: inputs, outputs, ports, state ownership, named finite performances and required settled states. The local harness chooses those behaviors to demonstrate the claim. Review the critical beat with labels hidden, then with narration. Ask whether the mechanism is inferable from the action, not whether something moved. Keep a stable spatial map and use close-ups only when an important internal state is otherwise too small.

[Final authored-program audit](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/authored-program-audit.json>)

### 3. The review uses the motion driver, but not the same composition

`reviewExplainer` mounts raw SVG in a 1600×900 host and creates its own narration caption. Export calls `prepareSlideSvg`, applies composition-wide CSS and renders different caption markup. Sharing a driver does not make those outputs equivalent. This directly explains VQ-06 and VQ-07.

Sources: [apps/studio-v2/src/explainer-review.ts:49](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/explainer-review.ts:49>), [apps/studio-v2/src/explainer-review.ts:87](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/explainer-review.ts:87>), [packages/markdown-composition/src/index.ts:762](</Users/think/Documents/code/dev-video-creator-main/packages/markdown-composition/src/index.ts:762>), [packages/markdown-composition/src/index.ts:1564](</Users/think/Documents/code/dev-video-creator-main/packages/markdown-composition/src/index.ts:1564>).

**Fix:** a single scene-composition entry point must supply the DOM, fonts, SVG normalization, captions, theme, camera/presenter tracks and seek clock for review and export. Isolated object previews remain useful, but are not the final scene gate. Bind proof to these renderer inputs and the renderer version, not just the SVG/program digest. Existing finish pins for motion, staging and audio should be retained and extended.

### 4. Most automatic gates establish validity and provenance, not meaning

The current checks are valuable: security/self-containment, actor names, event counts, artwork sizes, finite clips, input hashes, embedded-performance bindings and narration cue occurrence. However:

- An event can survive sanitization without producing a move. There is no required arrival assertion (VQ-03).
- A cue can exist in the audio while the corresponding event runs seconds late (VQ-05).
- Path data can survive while inherited paint or transform coordinates change (VQ-02/VQ-07).
- A preview with `errors=[]` becomes the retained “best” candidate. There is no aesthetic/comprehension score establishing that it is better than an earlier passing candidate.
- Export extracts three frames per scene, then records `export: succeeded` with an instruction to inspect them. That is not a separate persisted visual-acceptance decision; in this run the timeout prevented that client-side inspection stage from being reached at all.

Sources: [apps/studio-v2/src/explainer-review.ts:24](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/explainer-review.ts:24>), [apps/studio-desktop/src/mcp/explainer-tools.ts:187](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/mcp/explainer-tools.ts:187>), [apps/studio-desktop/src/mcp/explainer-tools.ts:328](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/mcp/explainer-tools.ts:328>), [apps/studio-desktop/src/mcp/explainer-tools.ts:630](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/mcp/explainer-tools.ts:630>).

**Fix:** distinguish `structurally_valid`, `rendered`, `semantically_checked`, `visually_accepted` and `exported`. Require critical events to resolve, execute and meet their declared visible end state. Sample before/action/settled moments from event boundaries, including measured narration timing. Have the local harness inspect real frames and record concrete failures; deterministic checks should catch missing motion, collisions, illegal state changes and unexpected silence. Persist final output acceptance separately from successful encoding. Keep human viewing/listening as the last quality check.

## Newly isolated cause: the Python object breaking apart

This was uncertain in the earlier report. It is now reproducible with the real `08-asyncio.svg`, its final motion plan, and the current production driver at scene-local **17.242 seconds** (approximately MP4 **03:37.667**).

| Diagnostic variant | Result |
|---|---|
| Raw SVG + actual motion driver | Intact object |
| Add production SVG ID prefixing | Intact; zero measured nodes differ by more than 1 px |
| Add the export leaf-shape `transform-box: fill-box` rule | Same visible breakup as the MP4; 53 measured nodes differ |
| Keep prefixing and rule, then override leaf reference boxes to `view-box` | Intact again; zero measured nodes differ by more than 1 px |

![Four controlled renderer variants](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/svg-transform-isolation-annotated.jpg>)

**Confirmed source:** [packages/markdown-composition/src/index.ts:1564](</Users/think/Documents/code/dev-video-creator-main/packages/markdown-composition/src/index.ts:1564>). The rule applies to every descendant SVG path/rect/etc., including Quiver’s already-transformed artwork. That changes the reference box used by the authored transforms. For example, the ring’s measured position shifts about +74.2 px horizontally and −80.4 px vertically in the 1600×900 diagnostic; some scaled paths shift more than 300 px. The reference-box change alone is sufficient to reproduce the failure. ID prefixing alone is not its cause in this fixture.

**Repair direction:** remove the broad leaf rule or scope it to renderer-owned motion wrappers. Preserve source geometry and its authored coordinate system. Do not globally reset every authored transform as a workaround. The driver already creates wrappers for some transform-bearing targets; make that ownership explicit and exercise all relevant action types. The diagnostic reset proves the cause, but a production patch still needs checks for text, paths, grouped shapes, nested clips, repeated instances and backward seeking.

The new reproduction creates diagnostic stills only; it does not author or replace the user’s generated video.

## Focused checks against current code

The following checks bundle the current TypeScript and execute it in a separate headless browser; they do not invoke a provider or regenerate content:

| Check | Measured result | Implication |
|---|---|---|
| Actual Python scene, travel to `worker` versus `worker.inbox` | Whole-object target emits one move; named-part target emits none. Both return `errors=[]` and retain the event. | The target resolver and review gate disagree (VQ-03). |
| Recompile actual final Envoy beat | Voice: 4,380 ms; move starts: 820/1,880/2,940/4,000/5,060/6,120/7,180/8,240 ms; total beat: 10,700 ms. | The serial cursor reproduces the timing expansion (VQ-05). |
| Pass a static `fill="none"` SVG through product `wearAppearance` | A stroked closed path changes computed fill from `none` to `rgb(0, 0, 0)`. | Root inheritance loss also exists in the product importer, beyond the run-generated helper (VQ-02). |

[Measurements](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/compiler-isolation.json>) · [Reproducer](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/reproduce-compiler-import.cjs>)

## Detailed findings

P1 means broken output, lost accepted work or a blocked/misleading core workflow. P2 means a significant quality, usability or requirement gap. Historical candidate failures are explicitly labeled below; they are not all asserted to persist in the final MP4. Reproduction steps describe the prior live journey unless marked as a new controlled diagnostic.

### VQ-07 · P1 · The Python SVG rig breaks apart in export despite an intact preview

**Current status:** Present in final MP4; specific CSS cause newly isolated in this code review.

![Annotated evidence for VQ-07](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/VQ-07.jpg>)

**Observed effect:** The exported Python artwork separates into displaced parts. The corruption persists across sampled asyncio/LIFO frames and obscures the mechanism the object is meant to demonstrate.

**Reproduce:**

1. Build/review the python-worker performance in scene 08-asyncio.
2. Compare proof c28df809b98b at local 17.242 s with the MP4 at 217.667 s.
3. Inspect LIFO scene 10 as well: it reuses the same visibly broken object.

**Why it happens:** Confirmed by the new four-case isolation: the broad transform-box: fill-box rule in composition CSS changes the coordinate reference for authored SVG leaf transforms. With the actual final SVG/plan/driver, prefixing alone changes no measured geometry; adding this rule reproduces the MP4 breakup (53 measured nodes differ), and restoring the original leaf reference box removes it. The raw review does not load this rule.

**Source:** [packages/markdown-composition/src/index.ts:1564](</Users/think/Documents/code/dev-video-creator-main/packages/markdown-composition/src/index.ts:1564>); [packages/markdown-composition/src/motion-driver.ts:109](</Users/think/Documents/code/dev-video-creator-main/packages/markdown-composition/src/motion-driver.ts:109>); [apps/studio-v2/src/explainer-review.ts:49](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/explainer-review.ts:49>).

**How to fix:** Scope transform styling to motion wrappers owned by the renderer; preserve imported geometry and local animation coordinates. Run the scene-review tool through the same composition DOM/CSS as export. Add the retained Python SVG as a fidelity regression fixture, including rest/action/settle, repeated instances and backward seek.

**Completion check:** The exact retained Python scene has matching part geometry and appearance in isolated review, composed review and export at 17.242 s and throughout its clips. Removing the broad style must not regress reveal, move, resize, count or level behavior.

### VQ-03 · P1 · Requests targeting SVG parts never travel, but the preview passes

**Current status:** Compiler defect remains. The initial audit found 34 missing named-part journeys across seven scenes. The local harness later retargeted those journeys to whole objects, restoring travel but losing part/port precision in the final program.

![Annotated evidence for VQ-03](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/VQ-03.jpg>)

**Observed effect:** Named-part travel silently becomes reveal-only behavior: requests remain at their origin while dependent processing runs. A sweep of current candidate proofs found 34 such journeys across seven scenes, with zero moves for those actors in their respective beats and no proof errors. This is before narration/export; the compiled evidence is in evidence/named-part-travel-audit.json.

**Reproduce:**

1. Use the generated 01-fanout program: travel r1 to db.partition-2 and r2–r6 to db.partition-1…4.
2. Run the product preview and inspect the 22.185 s frame and compiled B02/B03 actions.
3. The proof has errors=[] and warnings=[]; B03 contains reveals for r2–r6 but no move actions for them.

**Why it happens:** idsOf resolves owner.part through appearance.parts, but standingAt calls unitFor with the dotted name and gets no destination. The travel branch silently skips its move. The initial generated review claimed drawer arrivals; a later timed-frame inspection caught the discrepancy. A fresh current-code browser probe reproduces this with worker.inbox: one input event and one retained event, zero move actions, errors=[]. The same actor targeting worker emits a move.

**Source:** [apps/studio-v2/src/scene-program.ts:482](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/scene-program.ts:482>); [apps/studio-v2/src/scene-program.ts:595](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/scene-program.ts:595>); [apps/studio-v2/src/scene-program.ts:758](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/scene-program.ts:758>).

**How to fix:** Create one typed resolver for actors, named parts and declared ports, carrying owning group, local geometry and transformed stage geometry. Use it for validation, staging, travel, camera and quantity binding. A missing travel endpoint must be a compile error, never a skipped move. A part target should use its real bounds or explicit port, not silently fall back to the owner center. Assert arrival and downstream state changes.

**Completion check:** A request travelling to a nested, resized and restaged part reaches that part in forward playback, seeking and export. An unknown part fails compilation; no passing proof can replace a requested journey with a reveal.

### VQ-05 · P1 · A simultaneous traffic burst becomes a slow parade after the narration

**Current status:** Present in final output: the measured silent interval is 311.666–318.011 s (6.344 s). The compiler’s serial behavior is documented legacy behavior, but is unsuitable for the authored burst and is not caught as a quality failure.

![Annotated evidence for VQ-05](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/VQ-05.jpg>)

**Observed effect:** The authored 90 ms stagger becomes a 1060 ms sequence. The last journey starts 7.42 s after the first. This undermines the explanation of a thundering herd and adds 6.32 s of post-narration padding. The exported audio confirms a 6.344 s silent interval at this beat.

**Reproduce:**

1. Build and narrate scene 11-envoy, beat b2, with eight travel events on cue overwhelm and offsets of 0–630 ms.
2. Inspect the actual MP4 at 05:11.739 (scene-local 7.983 s) and compare the compiled move start times.
3. The moves start at 820, 1880, 2940, 4000, 5060, 6120, 7180 and 8240 ms into the beat.

**Why it happens:** playPart preserves implicit serial order for cue-timed events. Only atMs or after resets the scheduling cursor. Therefore cue+nudgeMs is treated as an earliest time, not an independent cue anchor. Narration then pads to the expanded motion duration without a temporal quality warning. In 11-envoy beat b2, eight 900 ms moves sharing the “overwhelm” cue and 90 ms nudges instead start at 820, 1880, 2940, 4000, 5060, 6120, 7180 and 8240 ms. A 4.380 s voice beat expands to 10.700 s. This is both a scheduling-contract usability problem and a missing post-alignment quality check; simply increasing animation speed would conceal the cause.

**Source:** [apps/studio-v2/src/scene-program.ts:720](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/scene-program.ts:720>); [apps/studio-desktop/src/mcp/explainer-tools.ts:306](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/mcp/explainer-tools.ts:306>).

**How to fix:** For an immediate authored workaround, give independent burst events a shared explicit dependency or measured atMs anchors. For the product fix, version the scheduling contract so cue anchors, parallel groups and after dependencies are explicit. Reject conflicting simultaneous writes to one actor, and evaluate dependencies against event completion. Preserve legacy semantics when migrating old programs. Report unplanned audio padding and cue-to-action drift; do not silently stretch measured speech to accommodate a bad schedule.

**Completion check:** Eight independent 90 ms-staggered requests preserve that spacing after speech alignment and export. The overload starts after the last arrival. A 6.32 s unplanned silent tail fails review rather than silently lengthening the video.

### VQ-06 · P1 · The exported video shows internal beat IDs instead of the reviewed captions

![Annotated evidence for VQ-06](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/VQ-06.jpg>)

**Observed effect:** Internal beat identifiers appear throughout the MP4. The explanatory sentence shown during scene preview is absent from this caption layer.

**Reproduce:**

1. Review the narrated scene-01 production preview, then export the notebook.
2. Open the actual MP4 at 00:20; repeat at the sampled frames of other scenes.
3. The video displays b1, b2, b3 and similar internal identifiers.

**Why it happens:** scene-program uses beat.id as the compiled step title. renderSlideScene emits that title as strong and narration as span. Composition CSS hides the span, leaving the identifier visible. The raw scene-review caption renderer differs from the export composition.

**Source:** [apps/studio-v2/src/scene-program.ts:889](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/scene-program.ts:889>); [packages/markdown-composition/src/index.ts:769](</Users/think/Documents/code/dev-video-creator-main/packages/markdown-composition/src/index.ts:769>); [packages/markdown-composition/src/index.ts:1574](</Users/think/Documents/code/dev-video-creator-main/packages/markdown-composition/src/index.ts:1574>).

**How to fix:** Separate internal beat identity, optional display heading and narration caption fields. Render preview and export through the same caption component and selected caption policy. Test the compiled full composition, not only the raw SVG scene.

**Completion check:** All exported frames are free of internal ids. With captions on, synchronized narration text matches the reviewed track; with captions off, this area is empty.

### VQ-04 · P2 · The scene preview passes despite text overflowing its source pill

![Annotated evidence for VQ-04](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/VQ-04.jpg>)

**Observed effect:** The long label does not fit its authored enclosure and conflicts with the request origin. The preview proof nevertheless reports no errors or warnings. This also persists in the actual MP4 at 00:20.

**Reproduce:**

1. Open the generated 01-fanout scene at the source-action reveal.
2. Inspect the starting a new conversation label and its pill boundary.
3. The SVG uses a fixed 330 px pill, text starting 62 px inside it, and 24 px unwrapped type.

**Why it happens:** The harness authors fixed coordinates and unwrapped SVG text without measuring the final font metrics. The review gate checks legibility and broad artwork size, but does not enforce label containment or label/actor exclusion regions.

**Source:** [run/explainer/01-fanout.svg](</Users/think/Library/Application Support/studio-desktop/studio/projects/video-a3a6c726-f579-4ed8-a00b-e4aaf2473ae1/runs/run-muae6b7x-80ba982d/explainer/01-fanout.svg>); [apps/studio-v2/src/explainer-review.ts](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/explainer-review.ts>).

**How to fix:** Provide measured text-fit helpers and named label/port exclusion regions. Prefer shorter wording or a wider layout before reducing type. Check text bounds and actor paths against these regions in the actual rendered geometry.

**Completion check:** Long labels, fallback fonts and translated text remain contained at production size. Request actors enter/leave from reserved ports without covering the label.

### VQ-01 · P1 · Accepted transparent objects contain large background rectangles

**Current status:** Observed in accepted candidates. The local harness later stripped these backplates from run-local assets; the acceptance/library defect remains. Do not claim every final object still has a rectangle behind it.

![Annotated evidence for VQ-01](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/VQ-01.jpg>)

**Observed effect:** Most accepted objects show large translucent white rectangles, which become gray cards over the dark scene. The server asset contains a 240×240 rect with white fill at 0.4 opacity inside its 300×240 viewport.

**Reproduce:**

1. Run the OpenAI rich build and acquire the Quiver cast with the transparent-background brief.
2. Compose the accepted assets over the dark theme using the product preview renderer.
3. Inspect the cast proof at 4.199 s. This is a candidate review frame, not a final exported video.

**Why it happens:** The provider prompt requests transparency, but acceptArtwork checks forbidden markup, external references and part ids only. It does not validate alpha/background coverage before marking and storing the SVG as accepted.

**Source:** [apps/studio-v2/server/providers/quiver.ts:121](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/server/providers/quiver.ts:121>); [apps/studio-v2/server/appearance.ts:311](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/server/appearance.ts:311>).

**How to fix:** Render candidate artwork against contrasting light/dark/checker backgrounds before acceptance. Flag suspicious large backplates and offer a targeted repair that preserves legitimate enclosures and shadows. Keep the rejected candidate and validation evidence.

**Completion check:** A returned translucent viewport rectangle is caught before the asset reaches the cast. The same accepted asset renders cleanly on both light and dark brand themes.

### VQ-02 · P1 · Embedding rich SVGs changes their paint by dropping root attributes

**Current status:** Observed during scene assembly; the local harness repaired root fill inheritance in this run. This is a product tooling/acceptance gap, not an assertion that the final export still has the same black fills.

![Annotated evidence for VQ-02](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/VQ-02.jpg>)

**Observed effect:** Previously unfilled paths inherit SVG’s default black fill after the original root is removed. This visual corruption is present in the candidate preview; its status in a final MP4 remains unassessed.

**Reproduce:**

1. Compare direct asset views (captures 28–29) with the product-rendered cast proof.
2. Inspect the accepted SVG root and the run-generated load_asset/place helper.
3. The accepted root has fill="none"; the helper discards the root and inserts only its children into a g.

**Why it happens:** The local harness-generated helper strips the svg wrapper without carrying root presentation attributes. The product delegates embedding to handwritten harness code; geometric cast verification can still pass when the path data survives but its paint changes. Further code review found the same class of loss in the existing product helper wearAppearance: its animated branch preserves the nested SVG root, but its static branch imports childNodes only. A focused browser check confirms a closed stroked path changes from computed fill none to black after this product import. This second reproduction is a software fixture, not the path used to assemble the observed live candidate.

**Source:** [run/explainer/build/lib.py:36](</Users/think/Library/Application Support/studio-desktop/studio/projects/video-a3a6c726-f579-4ed8-a00b-e4aaf2473ae1/runs/run-muae6b7x-80ba982d/explainer/build/lib.py:36>); [run/explainer/build/lib.py:81](</Users/think/Library/Application Support/studio-desktop/studio/projects/video-a3a6c726-f579-4ed8-a00b-e4aaf2473ae1/runs/run-muae6b7x-80ba982d/explainer/build/lib.py:81>); [apps/studio-desktop/skills/explainer-master/references/scene-contract.md:53](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/skills/explainer-master/references/scene-contract.md:53>); [apps/studio-v2/src/slide-atoms.ts:658](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/slide-atoms.ts:658>); [apps/studio-v2/src/slide-atoms.ts:680](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/slide-atoms.ts:680>).

**How to fix:** Provide a tested product embedding operation that preserves the SVG root or transfers all inherited presentation semantics, fits the viewBox and prefixes ids/references. Validate visual fidelity against the accepted asset after embedding, not only path-token presence. Repair and expose a shared importer rather than adding another string-rewrite helper. Preserve root presentation attributes and styles, viewBox origin, namespace/defs/local references, and per-placement identity for both static and animated artwork. Add the demonstrated fill-inheritance fixture alongside the real accepted Quiver asset.

**Completion check:** Assets relying on root fill="none", opacity, styles, gradients, masks and repeated placements retain their appearance in preview and exported frames.

### UX-19 · P2 · Reviewed repairs and animations do not become reusable library versions

![Annotated evidence for UX-19](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-19.jpg>)

**Observed effect:** The reviewed local variant contains a performance and no backplate. The reusable stored SVG has no performance and still has its backplate. Both are represented by the same asset key and original generate operation.

**Reproduce:**

1. Acquire the product-server asset and let the local harness repair its background and author a SMIL performance.
2. Complete explainer_review_object for that asset key.
3. Compare the run-local asset JSON/SVG with the SVG returned by the same record’s durable library URL. Hashes and contents differ; evidence/asset-library-divergence.json records both.

**Why it happens:** The generated perform.py updates only explainer/assets/<key>.json and .svg. Object review reads those mutable local files. The library tool registers provider-generated revisions, but there is no corresponding registration path used for locally authored performances. Existing review hashes now pin local source bytes and embedded performances, which is useful, but do not publish those bytes as an immutable reusable library child. A matching local receipt does not make the durable library version equal to the local file.

**Source:** [run/explainer/build/perform.py:1](</Users/think/Library/Application Support/studio-desktop/studio/projects/video-a3a6c726-f579-4ed8-a00b-e4aaf2473ae1/runs/run-muae6b7x-80ba982d/explainer/build/perform.py:1>); [run/explainer/build/perform.py:105](</Users/think/Library/Application Support/studio-desktop/studio/projects/video-a3a6c726-f579-4ed8-a00b-e4aaf2473ae1/runs/run-muae6b7x-80ba982d/explainer/build/perform.py:105>); [apps/studio-desktop/src/mcp/explainer-tools.ts:751](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/mcp/explainer-tools.ts:751>).

**How to fix:** Add a product tool to register a validated local performance/repair as a new version with parent key, content hash, role/behavior metadata and review receipt in PostgreSQL/MinIO. Bind scenes to that version; never overwrite the source key’s meaning in a run-local cache.

**Completion check:** A second independent notebook can select the reviewed clean animated variant without regenerating or repairing it, while the original static version remains available.

### UX-21 · P1 · Leaving a stopped build overwrites the applied video with stale wireframes

**Current status:** Confirmed on this run: after reopen the saved derivative had 14 wireframe SVG scenes, zero reviewed explainer attributes and zero narration tracks. Retained generated assets and the MP4 were not lost.

![Annotated evidence for UX-21](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-21.jpg>)

**Observed effect:** The durable video project reverted to 14 unreviewed wireframe scenes and no narration tracks. All 14 generated narration files, scene candidates, the finish receipt and the MP4 remain available, so recovery is possible but not offered as a clear UI action.

**Reproduce:**

1. Let Build explainer apply all 14 rich scenes; the finish receipt confirms application and the rendered MP4 contains those scenes.
2. After the long export times out and retries, stop the build through its visible control.
3. Open the base via the lineage button, then reopen the video derivative. Its rich scenes and narration have been replaced by the editor’s older wireframe snapshot.

**Why it happens:** The build event handler reloads the project only on exitCode 0. A stopped/failed build leaves stale editor data. openNotebook flushes that snapshot when switching away, and persistProjectSnapshot sends an unconditional PUT. The server accepts the write without an expected revision.

**Source:** [apps/studio-v2/src/main.ts:6169](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:6169>); [apps/studio-v2/src/main.ts:6947](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:6947>); [apps/studio-v2/src/main.ts:16022](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:16022>); [apps/studio-v2/server/index.ts:2897](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/server/index.ts:2897>).

**How to fix:** Require a project revision/ETag for every UI write. On a build-stage apply, refresh or reconcile the editor’s base revision; do so on failure/cancel as well as success. A stale save must produce a recoverable conflict, never overwrite newer work. Add Restore applied candidate from the retained receipt.

**Completion check:** Repeat finish → export timeout → Stop → switch away → reopen. All rich scene hashes and narration tracks remain unchanged. An attempted stale PUT is rejected, and user edits can be merged or retained separately.

### UX-20 · P1 · Long exports time out and retries launch duplicate renders

**Current status:** Both backend renders completed; the client timed out and retained no export receipt. The exact nested fetch layer enforcing the observed approximately 300-second timeout remains unisolated; the synchronous endpoint and duplicate side effect are confirmed.

![Annotated evidence for UX-20](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-20.jpg>)

**Observed effect:** A timeout loses the result of a still-running render. Retry starts the same work again. The first 422.267 s MP4 was recovered from Downloads; the user-facing workflow did not deliver it. I stopped the harness retry loop through the UI after verifying the file; the background duplicate was already running.

**Reproduce:**

1. Export the complete 14-scene, 422.235 s OpenAI deck through Build explainer.
2. At 23:48:25 UTC the export tool starts. At 23:53:26 it reports fetch failed; the renderer keeps capturing.
3. The harness retries at 23:53:31 and launches a second render. The first finishes in about 376 s and leaves a valid MP4, without an explainer/export.json receipt.

**Why it happens:** explainer_export waits on a synchronous POST /api/render through nested HTTP calls. handleRender replies only after capture, encoding and storage. There is no idempotency key or resume-by-job contract on this path; the five-minute fetch failure is surfaced without the running job identity.

**Source:** [apps/studio-desktop/src/mcp/explainer-tools.ts:79](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/mcp/explainer-tools.ts:79>); [apps/studio-desktop/src/mcp/explainer-tools.ts:618](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/mcp/explainer-tools.ts:618>); [apps/studio-desktop/src/mcp/stdio-shim.ts:38](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/mcp/stdio-shim.ts:38>); [apps/studio-v2/server/index.ts:2495](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/server/index.ts:2495>).

**How to fix:** Create a durable export job in PostgreSQL and return its id immediately. Deduplicate by reviewed render-manifest hash, poll/stream safe progress, and store the completed MinIO artifact and verification receipt independently of the client connection. Retry resumes; Cancel signals the worker.

**Completion check:** A render longer than five minutes completes once. Disconnect/reconnect and repeated Retry return the same artifact. The UI shows progress and a download action; cancellation stops the worker and preserves accepted scene assets.

### UX-01 · P1 · Provider failures become an unhelpful generic error

![Annotated evidence for UX-01](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-01.jpg>)

**Observed effect:** Both distinct failures end with the same generic message. The underlying Kimi log reports HTTP 403, weekly quota exhausted. Claude reports authentication_failed: Not logged in · Please run /login.

**Reproduce:**

1. Create an automatic explainer from the OpenAI Habitat URL. Read it, choose/save the brand, and click Outline it.
2. With Kimi quota exhausted, wait for the run to finish. After the routing mitigation, repeat with Claude Code signed out.

**Why it happens:** Confirmed: sourceOutlineWithHarness displays event.error transiently, then polls a summary containing status and throws “The story run ended ${status}”. Its catch overwrites the useful message. The durable run row also lacks a normalized error code, safe diagnostic detail and recovery metadata. Kimi’s parser is written around older event shapes; compatibility with current CLI failure events also needs a fixture.

**Source:** [apps/studio-v2/src/main.ts:14920](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:14920>); [apps/studio-desktop/src/harness/run-manager.ts:114](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/harness/run-manager.ts:114>); [apps/studio-desktop/src/harness/adapters/kimi.ts:75](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/harness/adapters/kimi.ts:75>); [apps/studio-desktop/src/harness/adapters/claude-code.ts:140](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/harness/adapters/claude-code.ts:140>).

**How to fix:** Normalize and persist ProviderFailure {category, provider, model, safeMessage, retryable, occurredAt, recoveryAction}. Keep the most recent actionable error on the wizard and provider card. Offer Sign in, Check quota, Switch provider, and Retry as appropriate. Never purchase credits automatically.

**Completion check:** A real quota failure and a signed-out CLI show distinct persistent messages; closing/reopening retains the failure; switching and retrying uses the same source/theme checkpoints.

### UX-02 · P1 · The visible provider choice did not control the primary creation pipeline

**Current status:** Earlier hardcoded routing was mitigated to run the authorized Claude fallback. Remaining gaps are confirmed by current code; do not report all three creation stages as still hardcoded to Kimi.

![Annotated evidence for UX-02](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-02.jpg>)

**Observed effect:** The original source outline and rich-build functions explicitly send adapter:kimi and model:kimi-code/k3. The page-drawing selector originally contains only Kimi. Existing Claude/Codex adapters are advertised but excluded from those stages.

**Reproduce:**

1. Choose Claude Code in the Agent dialog.
2. Create a source outline or click Build explainer on the original reviewed tree. Compare the selected provider with the dispatched run.

**Why it happens:** Partially fixed in the current working tree: CREATION_AGENTS and resolveCreationAgent now route Kimi/Claude story, pages and rich builds. However, Codex is absent from CREATION_AGENTS; sourceOutline still enters the harness path only when Kimi is installed; and sourceFinish invokes a separate API writer. Thus there is still no single provider contract for the whole journey.

**Source:** [apps/studio-v2/src/main.ts:6063](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:6063>); [apps/studio-v2/src/main.ts:14979](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:14979>); [apps/studio-v2/src/main.ts:15612](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15612>).

**How to fix:** Use a shared provider-profile resolver for story, pages, performance, repair and motion assistance. Provide Codex/Kimi/Claude profiles with explicit supported model and effort controls. Show the resolved profile in the run header. Switching must create a new attempt over compatible artifacts, not reuse another provider’s session ID.

**Completion check:** A contract test across all creation entry points records the selected adapter/model; live smoke runs cover all three providers. Unsupported capabilities produce a visible reason rather than silent fallback.

### UX-03 · P2 · “Online” reports installation, not whether a provider can run

![Annotated evidence for UX-03](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-03.jpg>)

**Observed effect:** Both providers are presented as online. Re-detect only probes CLI availability; a successful --version is enough for the green indicator. The latest failed run is not joined to this view.

**Reproduce:**

1. Let Kimi return the quota failure, then open Agent settings.
2. Attempt Claude while its CLI is signed out and inspect provider status.

**Why it happens:** Confirmed: adapters.available uses probeVersion; renderAgentList translates ok directly into “online”, and renderAgentSummary counts those probes. There is no durable per-provider last-result projection.

**Source:** [apps/studio-desktop/src/harness/adapters/util.ts:68](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/harness/adapters/util.ts:68>); [apps/studio-v2/src/main.ts:6082](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:6082>); [apps/studio-v2/src/main.ts:6098](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:6098>).

**How to fix:** Persist provider observations from real runs; use read-only CLI auth-status commands where supported. Label untested account state Unknown. Add last result/time, model, safe error details and Switch/Sign in actions. Do not spend tokens merely to paint a green dot.

**Completion check:** After an actual quota/auth failure, that provider stays visibly blocked across restart until a fresh successful auth/run observation resolves it.

### UX-04 · P1 · Starting a new story changes the notebook already open behind it

![Annotated evidence for UX-04](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-04.jpg>)

**Observed effect:** The original notebook has changed from human to generated delivery, despite no new video/notebook being completed. This happened to the existing Attention sample during the test; its original human choice was restored through the UI.

**Reproduce:**

1. Open an existing human-delivery notebook.
2. Create explainer → Generate automatically → A link or article.
3. Close/cancel the source flow before creating pages. Reopen Create explainer on the original notebook.

**Why it happens:** Confirmed: startCreateExplainer calls recordExplainerDelivery before opening the source dialog. That function mutates project.explainerDelivery and persists the current project immediately; destination selection happens much later.

**Source:** [apps/studio-v2/src/main.ts:15697](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15697>); [apps/studio-v2/src/main.ts:15703](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15703>).

**How to fix:** Create a draft identity before ingestion and keep source/theme/scene-delivery preferences on that draft. Apply them only to the explicit destination. The per-scene delivery design removes the need for this early notebook mutation.

**Completion check:** Run the new-story flow from a populated human notebook, choose generated delivery, cancel at every step, reopen/export the original: its revision and delivery stay unchanged.

### UX-05 · P2 · Delivery is forced before the story and cannot vary by scene

**Current status:** Explicit product requirement change: delivery must be selectable per scene. This is not a claim that the original code violated its previous notebook-wide specification.

![Annotated evidence for UX-05](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-05.jpg>)

**Observed effect:** The UI blocks with “Choose Present it myself or Generate automatically first”. Build inputs carry one project-wide delivery mode, and human take inputs are included for all scenes based on that mode.

**Reproduce:**

1. Open a blank notebook and click Create explainer.
2. Click A link or article without choosing a delivery path.

**Why it happens:** Confirmed product-model mismatch: project.explainerDelivery is both the creation gate and build-wide switch. Preview presenter defaults and the recording dialog also read it. This is a requirement change, not a claim that the original implementation violated its old spec.

**Source:** [apps/studio-v2/src/main.ts:15672](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15672>); [apps/studio-v2/src/main.ts:15706](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15706>); [apps/studio-v2/src/main.ts:15975](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15975>); [packages/markdown-composition/src/types.ts](</Users/think/Documents/code/dev-video-creator-main/packages/markdown-composition/src/types.ts>).

**How to fix:** Move delivery authority to SceneDelivery. Keep an optional notebook bulk default. Separate the audio source from presenter visibility: a human voice can continue over full-screen animation, and the camera can return at chosen beats. Provide a scene-list delivery selector and an Apply to selected scenes action.

**Completion check:** One notebook exports an opening human scene, a generated technical scene, and a closing human scene; each uses its own audio/take and retains independent timing after a mode change.

### UX-06 · P2 · The brand dialog overflows and hides important controls

**Current status:** Overflow observed. Source layout constraints are identified; the exact intrinsic child causing overflow has not been isolated with computed-layout measurements.

![Annotated evidence for UX-06](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-06.jpg>)

**Observed effect:** The third card is clipped. After scrolling to the footer, the left edges of cards, labels and the error message are cut off. The source summary, title and step navigation are no longer visible.

**Reproduce:**

1. At the normal desktop window size, import the OpenAI article.
2. Inspect the three direction cards and saved-theme/custom-palette sections. Scroll toward Outline it.

**Why it happens:** Source layout has a fixed three-column 1fr grid with unconstrained intrinsic child widths, while source-modal supplies width only and uses the document/dialog’s default overflow. There is no dedicated bounded scroll body or sticky step footer. The screenshots confirm overflow; the exact intrinsic-width contributor still needs computed-layout diagnosis.

**Source:** [apps/studio-v2/src/styles.css:2074](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/styles.css:2074>); [apps/studio-v2/src/styles.css:2104](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/styles.css:2104>); [apps/studio-v2/index.html:823](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/index.html:823>).

**How to fix:** Use minmax(0,1fr), min-width:0 on grid descendants and responsive one/two/three-column breakpoints. Put content in a max-height, overflow-y:auto body with overflow-x:hidden only after fixing intrinsic sizing; keep header/footer stable. Wrap long source titles and move optional palette customization into an expander.

**Completion check:** At 1280×800, 1440×900 and 200% zoom, all cards and labels are reachable without horizontal scrolling; active status, Back and Next remain visible. Keyboard focus never moves into clipped controls.

### UX-07 · P2 · Recovering from a provider failure restarts the source journey

![Annotated evidence for UX-07](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-07.jpg>)

**Observed effect:** The wizard returns to Read. The URL remains in memory, but the workflow has no visible resume/retry-at-outline action. Reading again resets the brand binding to a generated direction. The theme itself is safely stored and can be selected again.

**Reproduce:**

1. Import the article, bind a saved theme and attempt Outline it.
2. After the provider fails, close the wizard to inspect/change Agent settings.
3. Reopen Create explainer → A link or article.

**Why it happens:** Confirmed: openSourceDialog always calls showSourceStep(read); sourceRead resets brandChoice, brandThemeId, outline and pages. sourceState is an in-memory object, separate from durable source records and run history. Durable rows do not constitute a resumable wizard.

**Source:** [apps/studio-v2/src/main.ts:14466](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:14466>); [apps/studio-v2/src/main.ts:14538](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:14538>); [apps/studio-v2/src/main.ts:14576](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:14576>).

**How to fix:** Persist CreationDraft with accepted checkpoint references, current step and failed attempt ID. Provide Change provider inside the failure card and resume from the accepted input hash. Keep explicit Start over separate from Retry.

**Completion check:** Fail at outline/pages/performance, change provider, close/reopen the app, resume: no accepted source/theme/page is regenerated or rebound without an explicit choice.

### UX-08 · P2 · Browser exposes a build action that cannot run there

![Annotated evidence for UX-08](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-08.jpg>)

**Observed effect:** The action displays a toast stating that a desktop app/local harness is required. There is no launch action, connection state or transfer of the current creation draft.

**Reproduce:**

1. Open the web UI in the visible in-app browser.
2. Click Build explainer.

**Why it happens:** Confirmed: startExplainerBuild checks window.studioDesktop.isDesktop and returns with showToast. The button remains visible and enabled in browser mode. This capture is from the already running browser server; the same guard remains in the rebuilt desktop source.

**Source:** [apps/studio-v2/src/main.ts:15926](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15926>); [apps/studio-v2/index.html:177](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/index.html:177>).

**How to fix:** Expose a Local harness connection status. Show Open desktop and continue with a safe draft handoff, or route browser requests through a properly scoped local service. Keep unavailable actions visibly explained rather than discovering limitations after click.

**Completion check:** A browser-only creator sees the requirement before generation, opens the desktop shell, and resumes the exact same draft without reimporting or changing notebooks.

### UX-09 · P2 · The wizard can accept template pages while the requested drawing pass is still running

**Current status:** Enabled control observed and unsafe code path traced. The review deliberately did not accept templates mid-draw, so the resulting destructive transition was not live-tested.

![Annotated evidence for UX-09](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-09.jpg>)

**Observed effect:** Opening the notebook is allowed before the requested drawing run finishes. sourceFinish copies the current template SVGs into notebook nodes. Later applyDrawnPages updates only sourceState.pages and the wizard grid, not those already-created nodes.

**Reproduce:**

1. Read a source, accept its outline, and make the template pages.
2. Choose a local harness and click Draw. While the run is active, inspect Open the notebook.
3. The active button is observed; the early-finish consequence below is traced in code. This review waited for the drawing run instead of interrupting it.

**Why it happens:** sourceDrawPages disables only the Draw button. sourceFinish has no sourceDrawRunId guard or accepted-candidate revision, and applyDrawnPages does not reconcile an already-finished destination.

**Source:** [apps/studio-v2/src/main.ts:15215](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15215>); [apps/studio-v2/src/main.ts:15252](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15252>); [apps/studio-v2/src/main.ts:15546](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15546>).

**How to fix:** Model page generation as a draft stage with candidate status and revision. Disable ordinary Finish while the selected candidate is incomplete; offer a clearly separate template choice if desired. Apply the accepted candidate atomically and offer later generated work as an explicit replacement.

**Completion check:** Delay the drawer, try Finish, then complete the run. The notebook receives exactly the accepted revision, never silently keeps templates or replaces user edits.

### UX-10 · P2 · The outline review asks for approval without exposing the spoken story

![Annotated evidence for UX-10](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-10.jpg>)

**Observed effect:** The run produced full narration and source passages, but the review screen displays only title/kind/duration/idea. There is no focal-mechanism or audience input before planning and no script/source disclosure here. Dropping rows is the available way to narrow a broad article summary.

**Reproduce:**

1. Complete the OpenAI story-planning run through the local harness.
2. Inspect the outline screen and its editable controls before Make the pages.

**Why it happens:** The story skill defaults to 6–14 scenes spanning the source. renderSourceOutline constructs only title, kind, seconds, remove and idea controls; readOutlineFromForm preserves hidden narration/source fields. The target input is located on this post-generation screen.

**Source:** [apps/studio-v2/src/main.ts:15018](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15018>); [apps/studio-v2/src/main.ts:15036](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15036>); [apps/studio-v2/index.html:839](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/index.html:839>); [apps/studio-desktop/skills/story-master/workflows/plan-story.md:48](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/skills/story-master/workflows/plan-story.md:48>).

**How to fix:** Collect audience, focus and approximate length before planning. Show expandable spoken beats beside grounded passages and the intended observable change. Support an explicit replan from scope edits, retaining accepted scene identities and artifacts.

**Completion check:** A creator can request a focused 60–90 second mechanism story before inference, review/edit its actual spoken lines, and see that those accepted lines reach the next stage.

### UX-11 · P2 · Long drawing runs hide useful progress and offer no cancellation

![Annotated evidence for UX-11](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-11.jpg>)

**Observed effect:** The first design artifacts arrived about 14 minutes after launch. The CLI continued successfully into page writing, but the UI could not distinguish setup, active generation or a stall. Page previews update only when the whole run ends. Earlier Read calls were mislabeled as file writes.

**Reproduce:**

1. Start the 14-page OpenAI drawing pass with Claude Fable 5.1/high.
2. Observe the setup interval and the screen after the first two page files are written.

**Why it happens:** sourceDrawPages listens to text/file events and calls applyDrawnPages only on done; it exposes no cancel handler. The Claude adapter emits file events for any tool input with file_path, including Read. The first-page call reported about 187k input tokens including cached context: the mandatory reference load is substantial, though this alone does not prove the cause of the delay.

**Source:** [apps/studio-v2/src/main.ts:15247](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15247>); [apps/studio-desktop/src/harness/adapters/claude-code.ts:145](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/harness/adapters/claude-code.ts:145>); [apps/studio-desktop/skills/page-master/workflows/draw-pages.md:65](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/skills/page-master/workflows/draw-pages.md:65>).

**How to fix:** Persist explicit stage/checkpoint events, separate read and write events, stream checked candidate previews and show elapsed/last activity plus Cancel. Trim route-specific prompt context and load only needed reference sections. Measure time to first checked page before changing models or effort.

**Completion check:** A delayed or stalled fake provider shows honest status and can be cancelled. A real multi-page run shows the first checked page before completion, preserves candidates after cancel/reopen and never claims a read modified a file.

### UX-12 · P1 · Accepting Claude pages silently runs a second writing provider

![Annotated evidence for UX-12](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-12.jpg>)

**Observed effect:** Import invoked the scene-dialogue API using saved OpenAI / gpt-5.6-luna settings. Several resulting lines changed after the Claude page review, without a provider disclosure or script diff.

**Reproduce:**

1. Generate the story and all fourteen pages with Claude Code.
2. Click Open the notebook and observe Writing 14 scenes to their briefs.
3. Compare the resulting scripts with the accepted program and inspect the configured writing provider.

**Why it happens:** sourceFinish unconditionally calls writeScenesToBrief unless wording is preserved. The writer calls /api/scene/dialogue, which uses API model settings rather than the selected local harness profile.

**Source:** [apps/studio-v2/src/main.ts:15549](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15549>); [apps/studio-v2/src/main.ts:15616](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15616>).

**How to fix:** Make acceptance an atomic import of the reviewed artifact revision. Offer Rewrite separately with provider, cost and script/program diff; re-align and re-review affected scenes after acceptance.

**Completion check:** Accept Claude pages with a different API writer configured. No additional inference occurs and narration/program hashes remain identical to the accepted candidate.

### UX-13 · P1 · Creating the video fork can leave the desktop window entirely blank

**Current status:** Blank-window symptom observed twice; full-window reload is the trigger, not a proven complete cause. Renderer/load/crash instrumentation is still needed. Do not label the exact failure fixed by merely replacing reload.

![Annotated evidence for UX-13](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-13.jpg>)

**Observed effect:** A durable fourteen-scene video fork existed, but the user faced an empty white window across repeated observations. A process restart recovered it; the base was retained. Reproduced again after the rich deck was applied: opening the base through the lineage button left the desktop white for over 30 seconds.

**Reproduce:**

1. Finish the fourteen-scene OpenAI base and open All notebooks.
2. Choose Create video on that base. The fork is persisted, then the desktop window becomes blank.
3. Reload did not recover this occurrence. Restarting the desktop process and opening the notebook restored the saved fork.

**Why it happens:** The trigger is the full-window reload in openNotebook after fork creation. The exact blank-render cause is unresolved: captured logs show preview loading but no useful failure. Desktop handlers log load/console errors without a visible recovery boundary.

**Source:** [apps/studio-v2/src/main.ts:6179](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:6179>); [apps/studio-v2/src/main.ts:6345](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:6345>); [apps/studio-desktop/src/main.ts:181](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/main.ts:181>).

**How to fix:** Instrument renderer crash, unresponsive and startup milestones with the active project id. Add a native recovery surface with Reopen saved notebook. Prefer in-app project switching with scoped teardown over an unguarded full reload, after reproducing the failure.

**Completion check:** Repeatedly fork and switch the fourteen-scene notebook, including a forced renderer failure. Every attempt opens the persisted project or a usable recovery screen; no blank terminal state.

### UX-14 · P2 · The creation journey ends at wireframes without a clear next production step

![Annotated evidence for UX-14](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-14.jpg>)

**Observed effect:** The wizard stops at a presentation notebook. Rich-object build requires discovering a separate toolbar action; the UI does not explain that the video is still unbuilt. This is a workflow gap, not evidence that the completed rich build failed.

**Reproduce:**

1. Select automatic generation in the source wizard.
2. Complete the outline and drawn pages, then Open the notebook.
3. Inspect the landing screen and the action offered to reach rich objects and video.

**Why it happens:** sourceFinish imports pages, writes scripts and closes the wizard. It does not transition to a video-build checkpoint. The general toolbar renders Create, Build and Publish without stage-specific guidance.

**Source:** [apps/studio-v2/src/main.ts:15549](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15549>); [apps/studio-v2/src/main.ts:15925](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15925>).

**How to fix:** Add a durable stage overview: Source, Theme, Base, Video, Voice/takes, Review, Export. The primary action advances the current stage; exporting the base remains possible but is clearly described.

**Completion check:** A first-time creator can identify which artifact is the base, whether rich assets have been built, and the next action without knowing internal button semantics.

### UX-15 · P2 · Automatic delivery still presents instructions for an absent human speaker

![Annotated evidence for UX-15](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-15.jpg>)

**Observed effect:** The base/fork cards instruct an absent presenter to face the camera and reserve speaker-first story moments. This finding concerns pre-build guidance; the final rich-video composition has not yet been assessed.

**Reproduce:**

1. Create this source with Generate automatically selected.
2. Open the accepted notebook or its video fork and inspect the first scene coach.
3. Compare these instructions with the build delivery status, which explicitly says Generate automatically (capture-20).

**Why it happens:** cuesFor and notesFor derive human-facing language from storyboard family and outro flags, with no delivery input. The current scene cards reuse that direction even for generated delivery.

**Source:** [apps/studio-v2/src/director.ts:706](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/director.ts:706>); [apps/studio-v2/src/director.ts:732](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/director.ts:732>).

**How to fix:** Pass per-scene delivery and actual presenter availability into shot planning and coaching. Use one accepted plan for the card, preview and export. Generated scenes default to the mechanism filling the frame.

**Completion check:** With the same source, generated-only scenes contain no instructions to an absent presenter; human scenes show coaching that matches recorded-take placement.

### UX-16 · P2 · The object panel confuses library browsing with this run’s acquired cast

![Annotated evidence for UX-16](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-16.jpg>)

**Observed effect:** Five earlier library versions appear as the current cast. Their metadata dates are September 19; this run started September 20. New briefs in explainer/briefs are absent from the pending list.

**Reproduce:**

1. Start Build explainer with an existing asset library from another project.
2. Let the harness call explainer_asset(list), as the skill requires.
3. Inspect Objects before the new generate calls complete; compare the displayed entries with their stored creation timestamps.

**Why it happens:** The list tool writes every library asset into explainer/assets. IPC treats every JSON in that directory as acquired cast, while the UI labels original operation as current activity. Pending discovery scans only root brief-*.json, but this valid harness wrote briefs in a subdirectory. makeArtwork also serializes all requests through one module-level promise, including cache lookups. That explains why a queued reuse can wait behind an unrelated provider job; it is a latency contributor, not proof of every minute of the observed delay.

**Source:** [apps/studio-desktop/src/mcp/explainer-tools.ts:114](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/mcp/explainer-tools.ts:114>); [apps/studio-desktop/src/harness/ipc.ts:108](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/harness/ipc.ts:108>); [apps/studio-v2/src/main.ts:15840](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:15840>); [apps/studio-v2/server/appearance-library.ts:84](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/server/appearance-library.ts:84>).

**How to fix:** Persist explicit run asset requests and selection events. Keep catalog cache separate from the cast manifest. Render request status from records rather than filename conventions or historical asset.operation. Resolve compatible cache hits before provider scheduling. Use a bounded provider queue with durable request status and atomic budget reservations, rather than removing serialization without protecting the budget.

**Completion check:** Listing a library adds zero acquired cast rows. Selecting a reused version adds one reused row; submitting any valid brief path creates a pending row and resolves it to the returned version.

### UX-17 · P2 · Internal research output replaces the creator’s production status

![Annotated evidence for UX-17](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-17.jpg>)

**Observed effect:** Internal assistant research became the primary status. The panel exposed renderer implementation details and a long technical answer while actual Quiver requests continued.

**Reproduce:**

1. Run the Claude explainer build on the fourteen-scene notebook.
2. While asset requests are pending, let the harness complete its internal source/schema research.
3. Observe the build summary and expanded progress panel.

**Why it happens:** The build onEvent handler assigns every text/tool message directly to the status and appends it to the visible log. It has no distinction between production milestones, internal research and actionable failure.

**Source:** [apps/studio-v2/src/main.ts:16000](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/main.ts:16000>); [apps/studio-desktop/src/harness/adapters/claude-code.ts:136](</Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/src/harness/adapters/claude-code.ts:136>).

**How to fix:** Render primary progress from durable stage and asset-request records. Keep assistant narrative secondary, filter internal research from creator status, and expose full logs on demand. Show genuine denials as structured recoverable diagnostics.

**Completion check:** A long research response and tool denial do not replace Acquiring objects / N of M. A failed stage shows a safe reason and recovery action, while technical details remain accessible.

### UX-18 · P2 · The director gives a mathematically false reason for its layout choice

![Annotated evidence for UX-18](</Users/think/Downloads/Incredible Studio/reviews/2026-09-21-live-openai/code-diagnosis/annotated/UX-18.jpg>)

**Observed effect:** The card claims that 45.6 px text is under an 18 px threshold. Similar contradictions appear on the service and Rust scenes.

**Reproduce:**

1. Open the accepted What Habitat serves today scene.
2. Read its DIRECTOR paragraph and compare the reported text size with its claimed threshold.

**Why it happens:** notesFor chooses a fixed under the 18 px gate sentence for every takeover result, even though requiredArea can be driven by other scene moments or constraints. The size interpolated from the whole-page beside measure need not violate that threshold.

**Source:** [apps/studio-v2/src/director.ts:732](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/director.ts:732>); [apps/studio-v2/src/director.ts:747](</Users/think/Documents/code/dev-video-creator-main/apps/studio-v2/src/director.ts:747>).

**How to fix:** Carry structured decision reasons and the relevant beat/crop measurement from layout scoring into the card. Render the rationale from the actual winning constraint instead of inferring it from the final area enum.

**Completion check:** A takeover selected for reasons other than small text never claims a false threshold violation; each displayed number matches the cited beat and layout.

## Architecture and implementation order

**Repair-plan update, 21 September:** incorporates the reviewed `diffusionstudio/lottie` practices below. The findings above remain the observed baseline; the packages below are proposed implementation, not completed fixes. Continue on `feat/hyperframes-markdown-mvp`, committing coherent verified slices as **Karthic <Kartronics85@gmail.com>**. PostgreSQL owns durable revisions/jobs/reviews; MinIO owns immutable media and asset bytes.

These changes should strengthen the existing base → video derivative architecture. They do not require abandoning SVG, replacing the wireframe system, or making the developer’s harness author the videos. Kimi, Claude or Codex remains the product-selected local content harness; the software supplies reliable tools, validated contracts and visible checkpoints.

### First: protect accepted work and make exports recoverable

1. **Mandatory project revisions.** Have PostgreSQL assign a revision to every project update. Require that revision for editor, harness and migration writes where applicable; return a conflict when stale. Preserve the user’s local draft for comparison. Subscribe the editor to accepted build-stage changes and reconcile on failure/cancel as well as success. Navigation must not blindly flush a stale snapshot. Test the exact finish → export error → Stop → switch → reopen sequence.
2. **Durable export jobs.** `POST /exports` should return a job ID promptly. Persist queued/running/encoded/stored/failed/cancelled states in PostgreSQL, with the rendered manifest hash and worker identity. Store the completed artifact in MinIO and its receipt independently of the client connection. Poll/subscribe/reconnect by job ID. An identical retry reattaches to the job; an explicit changed manifest creates a new job. Cancellation must reach the render worker. Retain the existing MP4 duration/hash verification.

Gate: accepted scenes, audio and staging survive the reproduced failure path, and one logical export produces one recoverable result.

### Second: repair the deterministic output defects

3. **SVG fidelity and caption policy.** Scope transform CSS to renderer-owned nodes and add the real Python regression fixture. Separate beat identity, visible heading and narration caption; use the same composition in scene review and export. Respect explicit caption on/off policy and avoid duplicate captions over presenter/text overlays. Implement M1 below before accepting new object performances.
4. **Typed target resolution.** Resolve actors, parts and ports once. Carry transformed geometry through the same coordinate model; report unresolved targets and ownership conflicts. Test travel after parent movement/resize, repeated asset instances and composed ID prefixes.
5. **Explicit event scheduling.** Add versioned cue/dependency/concurrency semantics and expose the resolved event schedule in diagnostics. A fan-out/burst must meet its declared arrival spread; a sequential process must preserve its dependencies. Recompile after narration, then reject or flag unexpected cue drift, action truncation and padded silence. Use authored pause intent to distinguish a readable hold from accidental dead airtime. M2–M3 define how reusable choreography enters this same schedule.
6. **Geometry-aware labels and trajectories.** Provide a product tool for text measurement, fitting/wrapping, stage placement and safe SVG import. Validate critical-label containment and collisions across relevant frames, including caption and presenter exclusion regions. The local model should choose layout intent rather than reinventing SVG parsing and font fitting in every run.

Gate: the retained scenes pass actual composed-frame checks, every intended journey is executed, and the Envoy burst no longer expands into the measured silent gap. Then inspect a short actual export with sound before rendering the full story.

### Third: make rich assets reusable and behavior meaningful

7. **Immutable artwork/performance versions.** Add a tool for registering a locally authored or repaired SVG performance. It receives the parent asset key, exact SVG bytes, rig/ports, named clips and review evidence; stores immutable bytes in MinIO and lineage/metadata in PostgreSQL; and returns a new version key. Never overwrite the parent or reuse its identity for different bytes. Separate catalog browsing, run requests and selected cast. Current source/embedded-performance hashes remain part of the proof. Store the M2 behavior definitions and M5 editable controls with that version.
8. **Video explanation plan.** Add the causal demonstration contract described above without changing the wireframe’s job. Present narration, intended mechanism and scope for approval before acquiring a whole cast. Carry object identity and source claims into the derived plan. Keep coverage lineage explicit when compressing, merging or intentionally excluding base material; do not silently drop source coverage.
9. **One-scene quality checkpoint.** The skill already requests a first-mechanism proof; enforce that checkpoint in orchestration. Build one substantive scene with the real object, measured voice, composed frames and a short export before expanding the remaining scenes. Preserve approved assets and scene revisions. This catches render/rig mistakes before paying the cost of a 14-scene batch. M6 specifies the local-harness workflow and its regression examples.
10. **Distinct quality states.** Store structural, semantic and visual review outcomes separately. “Best retained” must mean the selected passing candidate, with its known limitations, rather than automatically the last zero-error preview. A rendered video becomes publish-ready only after its final review; keep the completed file available even when it fails quality acceptance.

Gate: a second run reuses the exact accepted animated asset version; a critical beat shows the intended state change; review rejects an absent arrival even if its program event exists.

### Fourth: make the production journey understandable

11. **Provider profiles and recovery.** Unify Codex/Kimi/Claude selection across all stages. Installation, observed authentication/readiness and last run outcome are separate fields with timestamps. Persist normalized failures and actionable recovery, retain draft/checkpoints across an explicit provider switch, and stop acceptance from secretly invoking a second writer.
12. **Durable creation draft.** Allocate the source/theme/outline/pages journey independently of the notebook open behind it. Persist the selected theme revision and accepted candidate. Gate Finish while drawing, or expose an explicit decision to use templates. Show elapsed time, real completed artifacts, cancellation and the next production step.
13. **Per-scene delivery and director.** Keep human/generated voice choice per scene, with a bulk default only as a convenience. Separate voice source from presenter visibility. Derive the coach card, presenter layout, transitions and final composition from the same shot plan. Generated-only scenes get no absent-human instructions; human scenes support voice continuing over full-screen animation. Show the actual constraint responsible for each layout recommendation.
14. **Responsive shell and navigation recovery.** Fix measured dialog overflow with bounded scrolling and responsive sizing. Instrument blank-window navigation before claiming its root cause. Provide a visible load/recovery boundary with durable draft restoration.

Gate: complete the visible UI journey using the selected local harness, including an induced provider failure/recovery, saved-theme reuse, one human scene plus generated scenes, export reconnect, close/reopen and library reuse. Human recording is an outstanding verification area, not already proven by this voice-only video.

## Motion-quality repair packages from the Lottie review

### Scope and adoption decision

Apply the repository's authoring and verification practices to the existing editable SVG/finite-SMIL route. Keep the base wireframe notebook, video derivative, scene state and single composition clock. This repair does not add a Lottie/Skottie runtime, Pitch mode or an autonomous animation player. A future format experiment would need its own fidelity and export proof.

The product already vendors design, motion, SVG and technical-animation references and already uses related easing anchors. Extend that integration into tools and checks rather than duplicating advice. [Existing provenance](/Users/think/Documents/code/dev-video-creator-main/apps/studio-desktop/skills/explainer-master/references/motion/PROVENANCE.md)

| Upstream lesson | Planned product application |
| --- | --- |
| Choreograph a leading action, supporting movement and readable settling; use easing by behavior | M2–M3: versioned object behaviors compiled into one narration-bound schedule. [Motion guidance](https://github.com/diffusionstudio/lottie/blob/main/skills/text-to-lottie/references/motion-taste.md) |
| Preserve supplied geometry and animate meaningful SVG groups | M1: one importer and explicit ownership of transforms. [SVG recipe](https://github.com/diffusionstudio/lottie/blob/main/skills/text-to-lottie/references/recipe-svg-animation.md) |
| Technical detail should express a role, state or relationship | M2: require ports, visible state changes and consequences in each behavior. [Technical recipe](https://github.com/diffusionstudio/lottie/blob/main/skills/text-to-lottie/references/recipe-diagram-technical.md) |
| Evolve the composition and carry object identity across related beats | M4: planned continuity and boundary checks. [Transition guidance](https://github.com/diffusionstudio/lottie/blob/main/skills/text-to-lottie/references/chapterization-transition-grammar.md) |
| Camera movement directs attention and ends on a readable composition | M4: restrained close-ups and continuity with presenter direction. [Camera recipe](https://github.com/diffusionstudio/lottie/blob/main/skills/text-to-lottie/references/recipe-camera-scene-motion.md) |
| Editable controls and exact-frame inspection belong in the production player | M1/M5/M6: shared composed review, typed controls and separate render/design/motion acceptance. [Player contract](https://github.com/diffusionstudio/lottie/blob/main/skills/text-to-lottie/references/player-contract.md) |

These are adaptations, not claims that upstream supplies our causal compiler, voice alignment or presenter system. Pin the reviewed upstream revision when incorporating reference files, retain its MIT license/provenance, and rewrite renderer-specific instructions for Studio.

### M1 — Preserve the object and review its actual composition

**Addresses:** VQ-01, VQ-02, VQ-06, VQ-07. **Runs in:** repair phase two.

- Consolidate SVG import around a tested product helper used by both editor placement and local-harness tools. Preserve inherited fill/stroke/style, viewBox origin, masks, gradients, clipping, local references and unique per-instance IDs. Fix `wearAppearance` for static and animated assets; neither path may discard root paint semantics.
- Define three transform owners: source geometry retains its authored transforms; the local performance controls declared internal groups; a separate stage wrapper controls placement/travel/resize. Camera and presenter transforms belong outside those layers. Reject conflicting ownership of a quantity or transform.
- Render review through the same scene-composition entry point as export, with the same fonts, SVG normalization, caption policy, theme, stage track and readiness rules. Keep isolated object review as an additional diagnostic.
- Expose a scene/revision/time review request that returns the actual composed frame, resolved event times and visible object/part bounds. Seeking backward must reconstruct state from the program. Wait for fonts/assets/player readiness rather than adding arbitrary capture delays.
- Bind reviews to an immutable render manifest containing asset/performance versions, program, measured audio/alignment, shot plan, captions, theme/fonts and compiler/renderer versions. Reuse an unchanged manifest; invalidate dependent reviews after relevant changes.

**Code ownership:** `slide-atoms.ts`, `explainer-review.ts`, `scene-program.ts`; composition `slide.ts`, `motion-driver.ts`, `index.ts`; desktop `explainer-tools.ts` and hidden renderer.

**Gate:** the real Python rig and the root-fill fixture retain their geometry/paint through import, composed review and actual export. Exercise rest/action/settled frames, repeated instances, parent resize and backward seeking. No internal beat ID appears as a visible caption. Test accepted transparent assets against light and dark scene backgrounds.

### M2 — Give reusable objects named, testable behaviors

**Addresses:** VQ-03, UX-19 and the gap between animation and explanation. **Runs in:** phase three, after typed target resolution and M1.

Add a versioned behavior definition attached to an immutable artwork/performance version. Start with the behaviors needed for the reference mechanism: `receive`, `consume`, `process`, `reject` and `refill`; add `enqueue`, `release` and `recover` for the reuse example. These are authoring recipes that compile to existing operations and finite clips, not new independent playback engines.

Each definition declares:

- Required semantic parts/ports, actor bindings and allowed parameters.
- Preconditions and observable postconditions, such as arrival at a port, one token removed, or a request remaining outside a closed gate.
- The state it reads and writes, and which properties belong exclusively to the scene. Decorative clips cannot independently change factual counts or acceptance outcomes.
- Named visual milestones: preparation, action, outcome, settled state; which milestone binds to the spoken cue.
- The internal channels/clip ranges, their timing relationships, easing and supported duration bounds.
- Rest and final states, including what must remain visible after the clip ends and how replay/seeking restores it.

The local harness binds a compatible behavior to a concrete Quiver rig. If a required part is absent, return a precise repair request; do not substitute a generic glow and call the behavior complete. The product validates the binding, compiles it and supplies evidence. Register accepted local repairs and behaviors through the permanent asset library, with parent key, content hash and review receipt in PostgreSQL/MinIO.

**Code ownership:** proposed behavior schema/compiler helpers beside `scene-program.ts`; `appearance-library.ts`, `appearance.ts`, `explainer-tools.ts`; adapted explainer skill contract.

**Gate:** one accepted request consumes exactly one token and reaches the service; a rejected request never enters processing; refill changes the same authoritative quantity shown by the object. A second notebook reuses the exact accepted behavior version without regenerating artwork. Removing a required port or silently omitting arrival must fail review.

### M3 — Compile choreography around narration and causal order

**Addresses:** VQ-05 and mechanical, uniformly paced motion. **Runs in:** phase two for scheduling correctness, phase three for behavior integration.

Use the selected take/generated narration as the measured clock. Let the author bind a meaningful milestone—often arrival or state change—to a cue occurrence. Calculate its supporting motion around that anchor. For example, the request may start approaching before “uses,” while the token-consumption outcome lands on that word. Keep preparation subtle and optional when the mechanism does not need it.

Make concurrency explicit: independently anchored events or a parallel group may overlap; an `after` dependency waits for its predecessor's declared completion milestone. A group join waits for all required predecessors. Validate cycles, absent dependencies, simultaneous writes to the same state/property, and intervals that do not fit the available speech. Report conflicts instead of silently serializing a burst, skipping an action or stretching the voice track.

Choose duration and easing according to action, travel distance, importance and available narration time. Reuse the existing motion tokens as defaults, with bounded overrides in the behavior definition. Separate arrival, outcome and settled milestones so a dependent event need not wait for an unrelated decorative flourish. Keep labels stable while the primary mechanism acts; animate supporting properties only when they improve comprehension.

Store timing in milliseconds and sample on the project frame clock. Convert upstream frame-based suggestions using their stated FPS; do not copy a 60-fps frame count into a 30-fps scene. Preserve current programs through a versioned scheduling migration. Existing authored timing retains its semantics until explicitly upgraded.

**Code ownership:** `scene-program.ts`, composition `motion-plan.ts`/driver, narration and take-alignment tools, temporal review diagnostics.

**Gate:** recompile the real Envoy burst as concurrent arrivals with its authored spread, without the unintended 6.344-second silence. A sequential process still respects dependencies. Cue drift, extra audio padding, compressed/truncated actions and settling conflicts are visible diagnostics. Use per-behavior tolerances; do not treat an intentional explanatory pause as a universal failure.

### M4 — Keep the mechanism continuous through camera and presenter changes

**Addresses:** repeated slide-like rebuilding and weak visual continuity. **Runs in:** phase three; presenter integration completes in phase four.

Plan related beats around persistent actor identity, state and geography. An actor that remains part of the mechanism should not replay its entrance at each new sentence. Reposition or enlarge it when the next idea needs a closer view, then retain a clear relationship to the system overview.

Extend the shot/transition plan with a reason, outgoing/incoming subject, carried actor IDs, readable interval and boundary state. Favor continuous carry or an intentional settled transition for explainers. Use other transitions only when their meaning is clear; do not introduce an automatic rotation of transition effects. At a scene boundary, transfer an explicit snapshot of position, scale, visibility and relevant semantic state to the incoming instance; do not rely on accidental DOM reuse. If a continuous handoff cannot be represented, choose an honest settled cut.

The director may move closer to an internal change, follow a request, or restore the overview. Validate occupied bounds and label readability throughout the move, including presenter and caption areas. Human voice can continue over full-screen animation; bringing the speaker back must preserve the mechanism's state. The coach and final video read the same shot plan. Generated-only scenes reserve no space for an absent presenter.

**Code ownership:** `shot-plan.ts`, `director.ts`, shared stage state, composition stage transitions, presenter placement and coach projection.

**Gate:** two related beats retain the same actor and quantity state; a selected carry transition has matching boundary position/motion; no empty swap frame or unintended reset occurs. Review the outgoing boundary, incoming boundary and playback around both. The presenter can leave and return without hiding the critical action or restarting the object clip.

### M5 — Expose safe controls for refinement and reuse

**Addresses:** UX-19 and expensive regeneration for small visual edits. **Runs in:** phase three.

Attach typed control metadata to the accepted behavior/appearance version: label, value type, range, default, affected properties and invalidation scope. Useful initial controls include accent palette, object scale, emphasis strength and supported action/settle duration. Numeric counts, queue capacity, admission rules and factual labels remain part of the approved story/program; they are not unrestricted appearance controls.

Share one underlying value when several visual properties represent the same concept. Apply edits as revision-checked commands and invalidate the appropriate geometry/timing/review artifacts. Appearance changes should not rewrite narration or regenerate Quiver art. A timing change must revalidate cue alignment and dependencies. Text changes use measured wrapping/fit rules and trigger layout review when bounds change.

**Code ownership:** asset/behavior schema, scene editor controls, `scene-program.ts`, review manifest invalidation and durable revisions.

**Gate:** changing one accent updates all intended parts and survives reopen; resizing preserves port placement; changing a label cannot silently overflow; speeding a clip reports a causal/timing conflict when applicable. The original accepted version remains recoverable.

### M6 — Give the local harness an executable quality workflow

**Addresses:** weak self-review, long speculative builds and missing reference paths. **Runs across:** phases two–four.

Keep generation inside the product-selected local harness. Provide self-contained instructions and stable tools for rig inspection/import, behavior binding, text measurement, composed frame sampling, library registration and review. Route only the relevant references for the scene's task. Add/adapt the camera and continuity references where required and verify all referenced files exist in a fresh installed bundle. Do not instruct a native-SVG run to launch the upstream Skottie player.

Enforce this checkpoint sequence in the coordinator:

1. Plan one representative mechanism from the base's grounded facts and the creator's narration policy.
2. Acquire/reuse its minimal cast; validate each rig and the composed import.
3. Bind behaviors, produce narration or use the selected take, and resolve the schedule.
4. Inspect composed semantic frames and playback: before the cause, during the critical action, immediately after the outcome, settled state and any transition boundary.
5. Produce a short real export. Run render, design, causal/timing and viewing/listening reviews separately; record actual failures and the accepted candidate.
6. Expand the remaining scenes only after that reference scene passes, reusing its accepted style and behavior versions.

Keep the existing bounded revision budget. Rank/select candidates using explicit review outcomes and known limitations rather than automatically replacing “best” with the latest zero-error preview. Authoring evidence should identify the event, expected visible result, timestamp and observed result; a generic “looks good” note is insufficient. A structurally valid render is not final visual approval.

**Gate:** run the rate-limiter mechanism as a product/local-harness example, then a queue/concurrency example to prove behavior reuse. Include the retained Python, named-part travel and Envoy fixtures as regressions. Watch/listen to the resulting short sequence for comprehension and pacing. A real human take remains required to validate presenter delivery separately.

### Package order and release evidence

| Order | Reviewable implementation slice | Required evidence before advancing |
| --- | --- | --- |
| 1 | Existing revision-safety and durable-export repairs | Applied scenes survive error/Stop/navigation; export reconnects to one job |
| 2 | M1 plus typed target resolution | Retained SVG/import/caption fixtures agree in composed review and export |
| 3 | M3 scheduling foundation | Burst and sequential dependency cases pass without hidden timing expansion |
| 4 | M2 with asset registration and minimal M5 controls | One reusable object performs a verified causal outcome and can be edited safely |
| 5 | M4 continuity and director integration | Related beats and presenter changes preserve identity, state and readability |
| 6 | M6 enforced at each stage; then the full visible workflow | Accepted short export, second-mechanism reuse, failure recovery, per-scene delivery and human viewing evidence |

Documentation/provenance and focused regressions accompany each slice. Record acceptance evidence without marking a feature complete merely because its schema or unit tests pass. Motion polish cannot compensate for unresolved P1 rendering, timing or persistence defects.

## Definition of done for the next explainer iteration

A useful release target is **one excellent representative mechanism scene, then a coherent short sequence**, not a quota of camera moves or object animations.

- The viewer can follow the triggering event, the constraint and the consequence. Objects visibly cause the explanation to advance; narration does not carry an unshown mechanism by itself.
- Rich artwork retains its silhouette, paint, parts and coordinates through review, composition and export.
- The action lands on the measured spoken cue, dependent actions occur in causal order, and simultaneous events stay simultaneous. Pauses are intentional and readable.
- The primary action is easy to follow; supporting motion stays subordinate, and the result reaches a readable settled state. Related beats preserve the mechanism's identity and state across camera/presenter transitions.
- Accepted behaviors expose safe reusable controls, and the local harness reaches the one-scene export checkpoint before expanding the full video.
- Important labels, quantities and moving actors remain legible without clipping, collisions or presenter obstruction. No internal IDs are visible.
- The accepted clip’s objects, behavior, narration and layout survive edits, cancellation, navigation and reopening. Reuse means the same accepted version is used again.
- The final MP4 has a persisted job/result, is reviewed in its actual exported form, and has been watched/listened to for flow and clarity. Test counts and duration/hash checks support that judgment; they do not replace it.

## Limits and unresolved diagnosis

The exact Electron blank-window cause (UX-13), the precise intrinsic child behind dialog overflow (UX-06), and the particular nested HTTP layer enforcing the roughly five-minute timeout (UX-20) remain unresolved. Their symptoms and surrounding contract gaps are established. The SVG export breakup (VQ-07) is no longer merely a transform hypothesis: the controlled CSS toggle reproduced and removed it using the retained production asset and plan.

This report does not claim every final scene is poor or that more camera motion would necessarily improve it. The strongest next step is to make the existing rich scene render faithfully and perform its causal story reliably, then tune the local harness’s visual direction against that dependable output.
