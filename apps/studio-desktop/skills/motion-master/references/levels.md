# Levels

> Reference for the `motion-master` skill. Source: *The Motion Decision Core*, sections §1. Read only when the routing table triggers it.

The static contract and the ten decision levels. The resolver walks L1–L10 per beat; the planner model owns only what the "Decider" column assigns to it.

## 1. The animation decision chain

### 1.0 The static contract animation depends on

These are outputs of page design. Animation reads them; it never changes them.

| Static output | Consumed by | Today | Gap to close |
|---|---|---|---|
| Unit identity: one stable id per semantic unit (box = rect+texts, label, connector, frame, group, image) | every target | atomizer injects `uN`, writes ids back into the SVG on save; group ids accepted and expanded (slide.ts:8-48, slide-atoms.ts:96-232); saved V1 `reveals` hold **element** ids expanded from `unit.ids`, not unit ids | no role tag; no cross-page key; element→unit resolution needed at driver init |
| Bounds per unit | pivot, move distance, ports, camera rect, distance→duration | atomizer bbox is element-local `getBBox()` with no CTM (slide-atoms.ts:42); nothing persisted; driver re-measures stroke length only | persist root-space bbox + per-member CTM in `geometry`; driver re-measures after `fonts.ready` (§4.1) |
| Render scale (frame px per viewBox unit, per layout) | camera zoom limits, text-size rules | `.slide-svg` is `width: min(100%, 700px × aspect)` inside padding and presenter-safe width (index.ts:1298); not exposed | compile input `frame.renderScale`, `frame.slideRectPx` |
| Relationships: connector edges (A→B, directed?), containment, reading rows | trace direction, stagger origin, rebinding, origin-of-appearance, lead/follow | `inferEdges` exists, discarded after `suggestSteps` (slide-atoms.ts:347, 486) | persist `edges` (with endpoints and marker flags), `contains`, `rows` |
| Reading mode + communication move | default reveal order, stagger origin, first/last-beat intent | implicit in `suggestSteps` (arrows → groups → reading order) | `geometry.readingMode` (static, not authored motion) |
| Carrier mix (unit kind: text/shape/line/number/image) | appear carrier, size class | atomizer kinds | detect numeric units with the strict rule in §4.1; `data-number` authored |
| Focal / support / accent / chrome roles | personality budget, keep list, "others" | atomizer marks the page title (`markPageTitle`, slide-atoms.ts:238) and frames | infer (title, frames, units labelled legend/axis, largest box) until ppt-master emits `data-role` |
| Line meaning (data flow / dependency / sequence) | draw direction; arrowheads | arrow markers give direction where present | undirected lines need `data-flow="a→b"` or an LLM decision |
| Camera regions | camera targets | none | derive from group bounds + padding; ppt-master may author `data-camera-region` |
| Cross-page anchor keys + coordinate persistence | match-cut / morph / carry | none; scene ids are prefixed `s{N}-` (slide.ts:87) | ppt-master `data-anchor="<role-key>"`; keep authored id alongside the prefix |
| Morph-safe shape pairs | morph | none | ppt-master emits pairs or the driver falls to tier 2/3 (§4.5) |
| Narration span per step, word onsets, recorded Next times | cue alignment, hold, take precedence | explanation is free text; recording coach steps the driver live (main.ts:883) but Next times are not captured | `Step.narration`, word onsets as compile input, `takes[]` on the block |
| Authoring requirements (clip containers, separated labels, tabular numerals, no baked leaf transforms) | clip reveal, label handling, count | none | §6.4, with fallbacks |

### 1.1 Levels

Ordered from page down to frame. "Decider" is the default owner: **rule** (computed from static inputs and §5 tokens), **author** (editor), **LLM** (planner from narration). Status: **I** inherited from static design, **N** new, **E** exists today but changes.

#### L1 — Page motion policy (per slide block)

| Decision | Options | Default | Decider | Status / depends on |
|---|---|---|---|---|
| Preset | technical-trace, premium-settle, data-confirm — each bound to a column of the preset table in §5 (carriers, durationScale, stagger, path shape, morph, anticipation) | technical-trace for diagram topologies (≥1 connector or ≥4 boxes); data-confirm when ≥2 numeric units by the strict rule; premium-settle for title/hero pages (≤3 units, no connectors) | rule; author override | N / topology, carrier mix |
| Duration scale (feel) | 0.8–1.25 multiplier on motion durations and stagger; never on hold, cue alignment, anticipation lead or the `dur.floor` | preset value | author | N |
| Speed (playback) | 0.5–2.0 | 1.0; scales holds and step length in play/publish, never motion durations (motion is clamped to `dur.floor` after quantization) | author / project | N |
| Reduced motion | flag | off; compiled at build time per project | author / project | N |
| Deck rhythm | seam variety, escalation, first/last page | no more than two consecutive identical seam types other than hold-cut (window `seam.varietyWindow`); first beat of a page is never shorter than the seam that led into it; the last page's final hold is `hold.last × 1.5`; pages in the last third of a deck take `durationScale × 0.92` (brisker toward the payoff) unless overridden | rule | N / page position, anchor keys |
| Presenter policy | anticipation on/off, Next-during-motion, Back crossfade | anticipation off (hero starts ≤50 ms after Next; dim runs in parallel), Next during motion fast-forwards `presenter.fastForwardMs` then starts k+1, Back crossfades `presenter.backCrossfadeMs` | rule; author | N |
| Unreferenced units | static, hidden | static: a unit that no step ever enters is never hidden and never dimmed | rule; author | N |

Mode behaviour (presenter = hold/settle cut and hard stop; play/loop = holds from the plan and loop seam; publish = continuous, cue-led) is a scheduler property described in §3.1 and §4, not an authored decision.

#### L2 — Beat segmentation (steps)

| Decision | Options | Default | Decider | Status |
|---|---|---|---|---|
| Beat boundary | per narration sentence naming ≥1 unit; per clause when a sentence >10 s names several; authored steps | one beat per naming sentence; sentences naming nothing append as hold to the previous beat; 2–8 s of speech per beat | LLM; author | E (steps exist; rule is new) |
| Narration span | `narration.sentences`, `cueWordIndex` | sentences the beat covers; cue word = first content word naming the hero | LLM; author | N |
| Intent | introduce, locate, relate, contrast, transform, quantify, emphasize, flow, recap, transition | first beat = introduce; last beat = recap; otherwise from verb vocabulary (§6.2) | LLM; author | N |
| Hero + supporting | 1 hero unit or structure, ≤2 supporting | hero = units whose label matches the sentence's noun phrase | LLM | N |
| Template | reveal-group, trace-flow, compare-two, zoom-and-explain, transform, count-up, recap, handoff (expansion in §2.3) | chosen from intent when the step has no `actions` | rule; LLM may name it | N |
| New-information budget | `budget.newUnits`, `budget.newRels` | over budget → split, or stagger with total cap | rule (validator, warning) | N |
| Change class | additive, transformational, attentional, subtractive, mixed | inferred from actions; subtractive runs exits before enters | rule | N |
| Order inside beat | narration order > reading mode > hero-outward | | rule; LLM supplies narration order | E (today: array order) |
| Cue alignment | what is aligned: landing (default) or start; to what: cue word onset (publish), Next (presenter), recorded Next (take) | the hero's **landing** (end of its entrance or the count's final value) sits on the cue word onset: start = onset − anticipation − duration. Non-hero actions keep their chain offsets relative to the hero | rule | N / word onsets |
| Narration shorter than motion | compress, spill, merge | if span − `hold.min` < motionWindow: compress stagger, then overlap, never below `dur.floor`; still short → spill into the next non-naming sentence; still short → validator asks to merge beats | rule | N |
| Hold | single definition | hold(k) = max(narration remainder after landing, `hold.min`); last beat of page `hold.last`; `Step.timing.holdMs` overrides. Play/Loop and publish both read this; the presenter holds until Next | rule; author | E (replaces `min(3200, 900 + words×60)` main.ts:7397 and the emergent 0.5× remainder) |

#### L3 — Unit lifecycle per beat

| Decision | Options | Default | Decider | Status |
|---|---|---|---|---|
| Duty | enter, emphasize, move, morph, swap, count, exit, re-enter, continue | a unit enters exactly once while hidden; after an `exit` it may `reveal` again (re-enter, from its exit position); every other duty may recur | LLM / author for which; rule for none | N (breaks the one-appearance invariant enforced in `toggleUnitInStep` main.ts:7707, the server `seen` filter server/index.ts:1077-1084 and the prompt line "a part never appears twice" server/index.ts:1035) |
| Persistence class | state (persists into later beats), flourish (returns) | derived per op (§2.2), not authorable: reveal, trace, move, morph, swap, count, exit, camera, dim = state; emphasize = state with auto-release; pulse, connect(highlight), pathFollow = flourish | rule | N |
| Release | on next hero, explicit, page end | dim and emphasize release when the next step's hero differs, decaying over `dur.release`; kept when the next hero is a child of the current hero; recap releases all | rule; LLM `continue` hint; author `release` | N |
| Exit form and order | fade+shrink, dissolve-to-dim, move-out along reading axis | dissolve when the plan re-enters the unit later; else fade+shrink; order = reverse of entry with `stagger.exit`; move-out only for `intent: transition` | rule (plan lookahead) | N |

#### L4 — Operation and spatial arguments

| Decision | Options | Default | Decider | Status / depends on |
|---|---|---|---|---|
| Appear carrier by kind | text rise+fade; shape scale-in+fade; line stroke-draw; marker pop; region fade; number fade-then-count; clip-wipe for rounded bars; image fade + settle scale | per preset column in §5. Members of one unit share one carrier: a box whose rect scales in has its texts fade only (no rise) | rule | E (today uniform 14 px rise, no scale) |
| Text lines | block, per-line | per-line (`stagger.line`) when the unit is the hero, has ≥2 lines and ≤4 lines; block otherwise; captions and labels fade only | rule | N / `geometry.units[].lines` |
| Entrance direction | up, down, left, right, hero, reading, none | up for in-place entrances; toward the hero when a supporting unit enters in the hero's beat; along the reading axis for list members; none when the unit's parent scales in the same beat | rule | N |
| Draw direction | source→target; from the end nearest the hero; from path start | arrow marker end = target; undirected = from hero end; drawing against the flow is a failure (lottie) | rule from edges; LLM when ambiguous | N / line meaning |
| Origin of appearance | in place, connector arrival, re-entry position | in place; **at arrival** when a connector to the unit draws in the same beat: the connector draws first and the unit enters as the draw reaches 100 % (this is the within-beat form of "both ends visible"; across beats a connector never draws to a unit that will not be visible by the end of the action). Parent-centre origin is removed (it violates the text-transit limit) | rule | N / edges |
| Move target and path | authored slot (`UnitRef`), freeform point | `to` is a unit or authored ghost slot; freeform points are author-only (`value.freeform`). Path: straight when cross-axis offset ≤ `dist.straightTol`, else orthogonal; arc only where the preset allows | rule | N / bounds |
| Pivot | bbox centre, semantic port, parent centre, tip | centre; box-with-external-label scales about the shape centre and the label translates with the centre unscaled (`labelMode: followCenter`); marker pivots at tip | rule | N / bounds |
| Connect ports | auto by dominant axis, explicit side | auto (§4.3) | rule; LLM gives from/to units | N / bounds |
| Camera target | unit(s) → padded rect; explicit rect; page | union bbox + attached labels + `camera.pad`, expanded to page aspect, filling `camera.fill`, zoom ≤ `camera.maxZoom`, text within `camera.textMin`–`camera.textMax` frame px | rule computes; author or narration cue decides whether | N / bounds, render scale |
| Camera-to-camera | direct, via page | direct when zoom ratio < `camera.directMaxZoomRatio` and centres within `camera.directMaxCentreShift`; otherwise via page | rule | N |
| Morph strategy | true path morph, resampled morph, FLIP crossfade | compatibility test picks (§4.5); technical-trace pages never morph unless asked; text swaps | rule | N |
| Count params | from, to, format | from = the **current folded value** when the unit is visible, 0 only when it enters in the same beat; to = authored or LLM value; format from `geometry.units[].numeric` | LLM supplies values; rule parses | N |
| Follow-through lags | per attached class | labels lag the shape by `lag.label`, connectors by `lag.connector`, badges by `lag.badge`, each settling after the shape; on camera the hero's own settle completes before the camera lands | rule | N |
| Connector rebinding on move | tween endpoints, fade+redraw | tween for line/polyline/≤2-segment paths; else fade to 0.3 and redraw after the move | rule | N / edges |
| Z-order in transit | lift | the moving unit is lifted to the overlay for the transit (§4.2) and restored at t=1; resting overlap forbidden | rule | N |

#### L5 — Orchestration

| Decision | Options | Default | Decider | Status |
|---|---|---|---|---|
| Sequencing inside a step | chain, parallel | chain: each action without `timing.sequence` starts when the previous action in array order reaches `chain.at`; `parallel` starts with the previous. The compiler orders template output container → shape → connector → label → annotation | rule; author advanced | E (today frames → connectors → boxes) |
| Per-property orchestration | early-opacity-late-settle, locked, lead-follow | derived per op: entrances use early-opacity (opacity window = `orch.opacityRatio` of the transform window, same start); dims and swaps locked; move/emphasize lead-follow for attached elements | rule | N |
| Stagger spacing | fixed per item, total-capped, narration-timed | `stagger.unit`; enumerations `stagger.enum` or word onsets; members inside one structure `stagger.member` | rule | E (today `min(0.12, 0.5/n)` of the window, slide.ts:200) |
| Stagger origin | reading start, hero outward, centre, path, narration, reverse | narration > topology (chain → path, radial → centre, grid/list → reading) > hero outward; exits reverse | rule | N / topology |
| Overlap of dependent ops | | draw → marker pop sequential; exit → enter sequential + `gap.exitEnter`; everything else `chain.at` | rule | N |
| Anticipation | none, dim-first, source pulse, pre-squash, camera pull-back | publish: dim begins `ant.dimLead` before the hero; source pulses 1.03 for 150 ms before a relate/flow trace; premium-settle adds a 0.98 pre-squash (80 ms) before emphasize; camera pull-back `camera.pullBack` before a push. Presenter: none (dim runs in parallel; latency budget 50 ms) | rule | N |
| Attention handoff | swap, crossfade, along edge | hero A's emphasis decays over `dur.release` while hero B's rise starts `handoff.overlap` into that decay; dim levels tween, never snap; when an edge A→B exists and the intent is relate/flow, a flourish pulse runs along the connector between the two | rule | N |
| Camera concurrency | | during a camera action only dim/undim and the hero's own entrance may run; the hero may enter during the last `1 − camera.revealDuring` of the push so the camera lands on a finished still | rule | N |
| Concurrency caps | | ≤ `budget.motionTypes` at once; ≤ `budget.concurrentUnits` transforming **units** (not members) | rule (validator, warning) | N |

#### L6 — Timing

| Decision | Options | Default | Decider | Status |
|---|---|---|---|---|
| Base duration by size class | small (icon, label), medium (node, card), large (region, group) | `dur.small` / `dur.medium` / `dur.large`; camera has its own tokens | rule | N |
| Distance scaling | | move `dur.move`; draw `dur.draw` (one speed per beat); all distances in page-width units (§5 "Units") | rule | N / bounds |
| Enter/exit asymmetry | | exit = `dur.exitRatio` × enter | rule | N |
| Motion budget per beat | | `budget.beat` standard; `budget.attentional`; `budget.camera` (an implicit camera release counts against the beat it is materialized in); over budget compress stagger, then overlap, never below `dur.floor` | rule | N |
| Step length (publish) | plan, override, take | motionWindowMs + hold; `Step.timing.durationMs` overrides (fit: compress stagger → overlap → floor, then warn) | rule; author | E |
| Scene-length reconciliation | cue, scale-holds, clamp | Σ(window+hold) ≠ scene `durationMs` (config or recorded take, index.ts:1427-1437): with a take or word onsets → `cue` (each step starts at its cue); otherwise `scale-holds` (holds scale, motion does not); `clamp` only by request | rule; author `fit` | N |
| Clock precedence | | recorded Next time > word-onset cue > formula | rule | N |
| Studio Next length | | the step's motionWindowMs (today fixed 850 ms, main.ts:621-625) | rule | E |
| Frame quantization | | step offsets and windows quantized to project fps at compile; actions are not individually quantized. Presenter runs in ms; the two agree within one frame | rule | N |

#### L7 — Easing

| Decision | Options | Default | Decider | Status |
|---|---|---|---|---|
| Anchor by behaviour | entering, settling, travelling, exiting, focal emphasis, discrete, camera | entering → `ease.enter`; settling → `ease.settle`; travelling → `ease.travel`; camera → `ease.camera`; exiting/dim → `ease.exit`; focal emphasis → `ease.pop` (one per beat); trace → `ease.draw`; count → `ease.settle`; pulse → `ease.pulse` | rule | E (three anchors today, slide.ts:155-157) |
| Overshoot | off, subtle | off; markers/icons use `ease.popOver` (scale-only, ≈3 %); never position, opacity, dash, viewBox or text | rule | N |
| Curve authoring | anchors only | an author may pick a different anchor per action; no raw beziers, no derived curves | author | N |

#### L8 — Attention

| Decision | Options | Default | Decider | Status |
|---|---|---|---|---|
| "Others" | | units with an enter action in steps ≤ k, minus hero, supporting, `except`, chrome and persistent anchors; unreferenced units are never included | rule | N |
| Dim level | | `dim.shape` on shapes, `dim.text` on text members; chrome/anchors exempt (never dimmed) | rule; author `value.level` | E (today 0.35 on everything revealed earlier, slide.ts:215-218) |
| Focus scope | element, structure, region, path, pair | structure; flow → path; contrast → pair at 1.0, rest dimmed | LLM intent → rule | N |
| Keep list | | hero ∪ supporting ∪ chrome/anchors ∪ `except` | rule; author | N |
| Emphasis levers | stroke, colour, scale | stroke × `emph.stroke` + accent colour, scale ≤ `emph.scaleHeld` held / `emph.scalePulse` pulse; a non-colour cue is mandatory; a held scale is validated against neighbour bboxes and downgraded to a pulse if it would overlap at rest; no font weight/size change; no filters | rule | N |
| Camera candidacy | | proposed when the hero region < 25 % of frame and contains text < `camera.textMin`; accepted only on a narration cue ("look closer", "zoom in") or by the author; the planner may emit `camera` only for such a sentence | rule proposes; LLM/author confirm | N |

#### L9 — Continuity and seams

| Decision | Options | Default | Decider | Status |
|---|---|---|---|---|
| Page entry state ("pre-still") | empty, chrome, full | a page arrives with chrome and persistent anchors visible (title, frame, legend); beat 1 introduces content from there, so every seam lands on a clean still | rule | N |
| Cross-page transition | hold-cut, crossfade, match-cut, morph, push, zoom-through, occlusion wipe — as `frameTransition.style` (index.ts:314-336, 729, 852) extended, not a second system | crossfade `seam.crossfade`; match-cut when an anchor key exists on both pages within `seam.matchTol`; morph `seam.morph` when same key, different geometry; zoom-through `seam.zoomThrough` when the next page is a detail of a region; presenter always hold/settle cut (scheduler rule, not a field) | rule from anchor matcher; LLM for morph-vs-crossfade semantics | N / anchor keys |
| Anchor key resolution | | `data-anchor` > identical authored id > identical visible label within same role | rule | N |
| State carry-over | reset, carry | reset focus/dim/camera on page entry (camera back to page `dur.cameraOut` before the seam); carry only shared-element positions | rule | N |
| Loop seam | | last beat holds `hold.last` (no second hold), then `seam.loop` crossfade to the pre-still, then beat 1; outgoing = recap still, incoming = pre-still, so the seam obeys the same role/readable-window rules as a page seam | rule | N |
| Publish cross-beat overlap | | step k+1's pre-dim may begin `beatOverlap` before k's hold ends; `hold.min` is measured to that point | rule | N |

The state fold that makes Back/Next/scrub deterministic is a driver mechanism, specified in §4.1.

#### L10 — Constraints and validation

| Decision | Default | Decider | Status |
|---|---|---|---|
| Readability while moving | text translation ≤ `dist.textTransit` and ≤400 ms in transit; text named in the current sentence is static ≥70 % of the beat; font size never animates | validator | N |
| Camera framing | never crops text; `overflow: hidden` on the root while viewBox ≠ page | rule | N |
| Text fit after swap/count | new string measured against the authored box inner width; overflow is an error pushed back to the static layer | validator | N |
| Determinism | state = f(step, t); no wall-clock, randomness or live springs; painting uses init-time measurement taken after `document.fonts.ready` | rule | exists in part |
| Flash limits | pulses ≤1 Hz; ≤3 flashes/s; luminance change ≤20 % | validator | N |
| Reduced motion | transforms removed, fades ≤150 ms, camera off, counts jump, path-follow → connector highlight | rule | N |
| Validator classes | **errors** block present/publish, never save: missing target, duty on a never-entered unit, count on a non-numeric unit, camera rect outside page, text overflow, dim on chrome, `after` cycle. **warnings** never block: budgets, concurrency, seam variety, narration-fit spill | rule | N |
| Review frames | per step: start, first motion, midpoint, settle, hold end; per seam: outgoing last frame and incoming first frame checked against the seam-type conditions and the eight lottie seam fields (role, readable window, outgoing, type, incoming, easing, cut/hold frame, reason) | harness | N |

### 1.2 Ownership in one line per owner

- **Static design (ppt-master) owns**: units, ids, roles, bounds, edges, containment, reading mode, camera regions, anchor keys, morph-safe pairs, clip containers. Animation may push back ("revise the composition first", lottie) but never edits visible content: no permanent synthesized lines, no freeform node moves, no text that does not fit.
- **LLM (planner) owns meaning**: beat boundaries and narration spans, intent, hero/supporting, template or duty, from→to units for relate/flow, count/swap values, continue hints, morph-vs-crossfade semantics. It never names timing, easing, ports, paths, pivots or persistence, and it may propose camera only on a narration cue.
- **Author owns overrides**: everything the LLM owns plus preset, durationScale, speed, per-step hold/duration/fit, dim level, camera on/off, connect in author mode, freeform move, per-action ease anchor.
- **Rules own feel and geometry**: every token in §5 unless overridden.

---

