# Core

> Reference for the `motion-master` skill. Source: *The Motion Decision Core*, sections §2. Read only when the routing table triggers it.

Six primitives, the operation recipes, and the templates. A new operation is ≤ 3 primitives with a behaviour class and a persistence class; it never adds a mechanism.

## 2. The extensible core

### 2.1 Primitives

Six primitives, each writing exactly one channel of an inline SVG element. Every operation is a composition of these plus a timing envelope.

| Primitive | Channel written | Arguments | Deterministic realization |
|---|---|---|---|
| `alpha` | opacity of an element | `from, to` | `style.opacity`; effective opacity = entrance × dim × exit (multiplicative across units that share the element) |
| `xform` | translate / scale / rotate about a root-space pivot | `{tx, ty, sx, sy, rot}, pivot` | a `<g data-motion-wrap>` inserted at init as the direct parent of each animated member; the wrapper gets `transform="matrix(…)"` = P⁻¹ · M · P where P is the wrapper's parent CTM and M the root-space motion matrix. Authored transforms on leaves and ancestors are untouched; the driver never writes CSS `style.transform` (today's slide.ts:211 is retired, and `transform-box: fill-box` in index.ts:1299 becomes irrelevant). `rot` is used only to align spawned arrowheads to the path tangent |
| `dash` | stroke draw progress | `from, to, direction` | `stroke-dasharray = L`, `stroke-dashoffset = L·(1−p)` (or `−L·(1−p)` reversed); L from `getTotalLength()` at init, or `pathLength` when the path sets it. Dashed authored strokes are drawn through a `<mask>` holding a wide-stroked copy whose dashoffset animates (clip-path cannot reveal a stroke) |
| `content` | text string, numeric value, path `d`, attribute | `kind, from, to, format` | `textContent` of the numeric `<tspan>` (single-tspan numbers only), `d`, `setAttribute`; number writes the exact final string at t=1; the authored baseline of every content channel is captured at init for Back |
| `view` | root `viewBox` | `rect from, rect to` | `viewBox` attribute; centre linear, scale in log space; toggles `data-camera` on the root for `overflow: hidden` |
| `spawn` | new geometry | `kind: path|marker|token|clone, geometry, placement: sibling|overlay` | swap and FLIP clones are inserted as **siblings** of the source (same inherited style, same CTM); overlay clones (z-lift, tokens, synthesized connectors) go into `<g data-motion-overlay>` with the source CTM applied and inherited `fill`/`stroke`/`font-*` copied from computed style. Spawned ids are `syn-{actionId}[-n]`; hidden when their action is not in the fold |

Combinators (no channel of their own): `env {delay, duration, ease}`; `stagger {ms, origin, cap}`; `chain / parallel`; the state fold (§4.1).

### 2.2 Decomposition of the operations

Persistence is a property of the op and is not authorable. Timing values cite §5.

| Operation | Behaviour class | Primitive composition | Anchor / timing | Persist |
|---|---|---|---|---|
| reveal (enter) | entering + settling | `alpha 0→1` (`orch.opacityRatio` window) ∥ `xform` by kind and preset: text `ty dist.rise→0`, shape `s preset.shapeScale→1`, marker `s .6→1`, image `s 1.03→1`, rounded bar clip-wipe; per-line text staggers `stagger.line` | `ease.enter` (alpha), `ease.settle` (xform); `dur.small/medium/large` | state |
| trace (authored connector) | travelling (technical) | `dash 0→1` in edge direction; `marker-end` removed during the draw and restored at 100 % while a spawned copy of the marker pops (`alpha 0→1` + `xform s 0→1`, `ease.popOver`) | `ease.draw`; `dur.draw` | state |
| dim / undim | exiting / settling | `alpha → dim.shape | dim.text` on "others" (L8) | `ease.exit`; `dur.dim`; publish starts `ant.dimLead` before the hero | state, released on hero change |
| emphasize | focal emphasis | `attr stroke-width × emph.stroke` + accent + `xform s 1→factor` about centre, external label follows centre unscaled; released over `dur.release` when the hero changes | `ease.pop`; `dur.medium`; factor ≤ `emph.scaleHeld`, validated against neighbours | state with auto-release |
| pulse | focal emphasis | `xform s 1→emph.scalePulse→1` ∥ stroke × `emph.stroke` | `ease.pulse`; `dur.pulse`; ≤ `budget.pulses` per beat | flourish |
| move (to an authored slot) | travelling | `xform tx,ty` along path + endpoint tween / redraw on attached connectors + labels lagging `lag.label` + overlay z-lift for the transit | `ease.travel`; `dur.move` | state |
| connect (A→B) | travelling | `spawn path(portA→portB)` in the overlay → `dash 0→1` → spawned arrowhead pop → pulse on B. `mode: highlight` (default) is a flourish that fades at release; `mode: author` persists and is author-only. When an authored connector A→B exists the compiler emits `trace` instead | `ease.draw`; `dur.draw`; marker pop 120 ms | flourish (highlight) / state (author) |
| camera | travelling (calm) | `view page→rect` ∥ dim; hero entrance allowed in the last `1 − camera.revealDuring`; release `view rect→page` or direct `view rect→rect` | `ease.camera`; `dur.cameraIn` / `dur.cameraOut` / `dur.cameraDirect`; dwell ≥ `camera.dwell` | state |
| morph | travelling | tier 1/2: `content d A→B`; tier 3: sibling `spawn clone(B)` FLIP-tweened from A's bbox ∥ `alpha` crossfade | `ease.travel`; `dur.morph` | state |
| swap (text/image) | discrete | sibling `spawn clone` with new content `alpha 0→1` ∥ original `alpha 1→0`; `content` commits at t=1 | out `dur.swapOut` / in `dur.swapIn` / overlap `dur.swapOverlap`; slide variant adds `ty ± dist.rise` | state |
| count | discrete/settling | `content number from→to`, tabular numerals during the count, landing on the spoken figure | `ease.settle`; `dur.count` | state |
| exit | exiting | `alpha 1→0` ∥ `xform s 1→.96`, then hidden; dissolve variant `alpha → dim.shape`, stays; reverse entry order, `stagger.exit` | `ease.exit`; `dur.exitRatio` × enter | state |
| pathFollow (deferred) | travelling | overlay `spawn token` → `xform` along `getPointAtLength` with a trail of `trail.length` decaying `trail.decay`; target pulse at arrival | `ease.travel`; `dur.pathFollow` | flourish |

Hold is not an operation; it is `Step.timing.holdMs` or the L2 rule.

Extension rule: a new operation is a named composition of ≤3 primitives that declares its behaviour class (which selects its anchor) and persistence class (which tells the fold what to keep). Neither adds a runtime mechanism.

### 2.3 Templates: intent → actions

A step with `intent`, `hero`, `supporting` and no `actions` expands through this table. The editor's "click parts / state an intent" flow and the planner both produce this form; the compiler produces actions with `implicit: false` so authors can open and edit them.

| Template (intent) | Expansion (array order = chain order) |
|---|---|
| reveal-group (introduce) | `reveal` containers of hero → `reveal` hero (per-line text if eligible) → `reveal` supporting (`stagger.unit`) → `reveal` connectors whose both ends are now visible → `reveal` labels |
| trace-flow (relate, flow) | `dim others` → `trace` edges from→to in narration order (or `connect` highlight when no authored edge exists) → each target unit `reveal` at arrival if not yet visible, else `pulse` |
| compare-two (contrast) | `dim others` → `emphasize` hero and first supporting with the same factor, parallel → hold |
| zoom-and-explain (locate, emphasize with cue) | `dim others` → `camera` on hero (hero's un-entered children enter during the last part of the push) → `reveal` remaining children |
| emphasize (emphasize without cue) | `dim others` → `emphasize` hero → `pulse` supporting |
| transform (transform) | `dim others` → `morph` or `swap` hero → `pulse` |
| count-up (quantify) | `swap` sibling headline if given → `count` hero numeric → `pulse` container |
| recap (recap) | `undim all` → `camera page` if zoomed → release all emphasis → hold `hold.last` |
| handoff (transition) | `exit` current hero group along reading axis → `reveal` next hero group; or, when the next step is on another page, nothing (the seam carries it) |

---

