# Driver

> Reference for the `motion-master` skill. Source: *The Motion Decision Core*, sections §4. Read only when the routing table triggers it.

How the driver paints deterministically: init, the state fold, per-primitive attributes, connect synthesis, camera as viewBox, morph tiers.

## 4. Driver realization

The driver stays a pure function `paint(stepIndex, progress)` called by the same callers as today (publish's single linear GSAP tween via `__slideDrawScene`, `animateDriverStep`, `playCanvasSteps`, the recording coach at main.ts:883). Nothing below introduces retained tween state.

### 4.1 Init and the state fold

Init (once per scene, after `prepareSlideSvg` and after `document.fonts.ready`; today `apply(0,0)` runs at parse time, slide.ts:238, which measures text before fonts):

1. Resolve units → member elements (group ids expand as today, slide.ts:170-173); V1 element ids resolve to the smallest containing unit; geometry keys carry the `s{N}-` prefix. Read `motion.geometry` for planner/validator facts; measure `getBBox()` + `getCTM()` per member for painting; log a mismatch > 2 % of page width against the persisted `svgHash` geometry.
2. Wrap each animated member in `<g data-motion-wrap>`; record its parent CTM and DOM index.
3. Cache `getTotalLength()` (or `pathLength`) per stroke; build masks for dashed strokes on demand.
4. Parse numeric text units with the strict rule: the number is the dominant token (≥50 % of the visible characters excluding a unit suffix such as M/K/%/x), is a single `<tspan>` or the whole text, and is not a year-like 4-digit token unless authored `data-number`; separators from `geometry.units[].numeric` or the page's dominant locale.
5. Capture the authored baseline of every content channel (`textContent`, `d`, `marker-end`, `stroke-width`).
6. Create `<g data-motion-overlay>` as the last child of the root.
7. Compile each step into resolved actions with absolute `startMs`, `durationMs`, curve, `motionWindowMs`, `holdMs`, plus materialized implicit actions; expose `driver.stepWindow(k)`, `driver.stepHold(k)`, `driver.stepCue(k)`.

**Element-level channel model.** The fold is defined per DOM element, because units overlap by construction (box = rect+texts, slide-atoms.ts:157-177; `pairLabelsAcrossPage` merges cross-tree labels, slide-atoms.ts:250; authored groups contain the same leaves). Channels per element: `visible`, `alphaEnter`, `alphaDim`, `alphaExit`, `motion matrix`, `dashProgress`, `text`, `d`, `strokeWidthMul`, `markerEnd`; plus one page channel `viewBox` and the set of live spawned elements. Resolution when several units write one element in the same step:

- Opacity channels multiply: effective = enter × dim × exit. A dim on a group and an emphasize on a member therefore leave the member at 1.0 only because emphasize sets the member's own `alphaDim` to 1 (most-specific unit wins **within** a channel; channels multiply).
- Motion matrices compose outer-to-inner by containment: group transform first, then the member's own (M = M_group · M_member in root space, then wrapped per §2.1).
- `text`, `d`, `dashProgress`, `strokeWidthMul`, `markerEnd`: last writer in step order wins; within a step the more specific unit wins.

Fold: for `paint(k, p)`,
- base(k) = for each element, the end state (t=1) of every state-class action in steps 0..k−1 applied in step order under the rules above; released emphasis/dim are at their released values; implicit actions are part of the step they were materialized in.
- current(k, p) = base(k) with step k's actions interpolated at local time `p × motionWindowMs`; flourishes contribute only while active; actions not yet started stay at base.
- `visible = false` only for units that have an enter action somewhere in the plan and none in steps ≤ k. Units the plan never enters stay at authored opacity and are never dimmed (`unreferenced: static`).
- Write: `style.opacity`, wrapper `transform`, `stroke-dashoffset`, `textContent` / `d` / `stroke-width` / `marker-end`, root `viewBox` and `data-camera`; spawned elements outside the fold get `display:none`.

Back/Next/scrub: Back = `paint(k−1, 1)` under a `presenter.backCrossfadeMs` crossfade of the whole `.slide-svg` (a camera step's viewBox snaps under the same crossfade); Next during motion = fast-forward to `paint(k, 1)` over `presenter.fastForwardMs`, then start k+1; scrubbing = `paint(stepAt(t), progressAt(t))`. No reverse playback is ever needed.

**Editing invariants.** `Step.id` and `Action.id` are stable; spawned ids are `syn-{actionId}`, implicit actions are keyed by the step that caused them, so insert/reorder/delete never renumbers. Reordering or deleting so that a duty precedes or outlives its unit's enter is a validator **error** on that step (blocks present, not save) with a one-click fix ("insert reveal here"). A `count` reordered before the `swap` it depended on reads the folded value at its new position, which is the defined behaviour, not an error.

### 4.2 Per-primitive attributes

| Primitive | Attribute | Notes |
|---|---|---|
| alpha | `style.opacity` | product of the three alpha channels; never `visibility` mid-motion |
| xform | `transform="matrix(a b c d e f)"` on the member's wrapper | P⁻¹ · M · P with P = wrapper parent CTM; correct under any ancestor transform; no CSS transform anywhere |
| dash | `stroke-dasharray`, `stroke-dashoffset` | in `pathLength` units when set; dashed authored strokes draw through a `<mask>` (wide-stroked copy, animated offset) so the dash pattern is untouched |
| content:number | `textContent` of the numeric tspan | tabular-nums via `style.fontVariantNumeric` during the count, removed at t=1; final frame writes the authored/target string; multi-tspan numbers fall back to `swap` |
| content:text (swap) | sibling clone of the `<text>` | inherits style and CTM by position; commit `textContent` at t=1; fit validated against the unit's box |
| content:d | `d` | only after the compatibility test (§4.5) |
| view | root `viewBox="x y w h"` + `data-camera` | `.slide-svg[data-camera] { overflow: hidden }` (today `overflow: visible`, index.ts:1298, would leak zoomed-out content over the rail and captions); `preserveAspectRatio` stays `xMidYMid meet` (slide.ts:90-103) |
| spawn | sibling or overlay `appendChild` | overlay clones carry the source CTM as their transform and copied inherited style; z-lift clones are removed at t=1 and the original's wrapper receives the final matrix |

### 4.3 Synthesizing a connector between two units (`connect`)

Inputs: root-space bounds A, B; edge table; style donor. Output lives in the overlay above authored content but below spawned labels/tokens.

1. Ports: `d = centre(B) − centre(A)`; if `|dx| ≥ |dy|` use A.right→B.left (or left→right when dx<0), else A.bottom→B.top when dy>0 (B below A) or A.top→B.bottom when dy<0 (B above A). Port point = midpoint of that edge offset `dist.portOut` outward. Explicit `port` overrides.
2. Route: straight when the cross-axis offset ≤ `dist.straightTol`; otherwise orthogonal three-segment with the bend at the midpoint; a single cubic with `path.bulge` only when the preset allows arcs and the page's authored connectors are predominantly curved. The route must not pass through any third unit's bbox, free-standing label bbox or authored connector's inflated bbox (`dist.routeInflate`); if it does, shift the bend toward the free side, then fall back to the arc, then flag.
3. Style: copy `stroke`, `stroke-width`, `stroke-linecap`, `stroke-dasharray` from `strokeLike` or the authored connector nearest A; default `currentColor`, 2 px.
4. Arrowhead: always a spawned polygon (copied from the donor's `<marker>` geometry when present, else length 4× stroke width) placed at the end tangent, hidden until the draw reaches 100 %, then `ease.popOver` over 120 ms. A `marker-end` reference is never used on a synthesized path because markers paint from frame 0 regardless of dash offset.
5. Draw: `dash 0→1` at `dur.draw`, `ease.draw`. `highlight` mode fades with the emphasis release; `author` mode persists as state.

### 4.4 Camera as a viewBox tween

- Target rect: union of the hero units' bboxes plus labels within `dist.labelAttach`, inflated by `camera.pad × max(w, h)`; expanded (never cropped) to the page aspect; translated to stay inside the page; zoom = pageW / rectW clamped to `camera.maxZoom`; using `frame.renderScale`, if the smallest text inside would render < `camera.textMin` frame px the zoom increases toward the cap, and if the largest would exceed `camera.textMax` it decreases (then the planner should have emphasized instead).
- Interpolation: centre `lerp(c0, c1, e(t))`, width `w0 · (w1/w0)^{e(t)}`, height from aspect, `e = ease.camera`; publish may prepend `camera.pullBack`.
- Camera-to-camera: direct rect→rect (`dur.cameraDirect`) when zoom ratio < `camera.directMaxZoomRatio` and centre shift < `camera.directMaxCentreShift`; otherwise via page.
- Release: implicit `camera: "page"` (`dur.cameraOut`) materialized in the next step whose hero is outside the rect unless `camera: "keep"`.
- Concurrency: only dim/undim and the hero's own entrance (last `1 − camera.revealDuring` of the push) run alongside.

### 4.5 Morph constraints

Order of tests, first pass wins:
1. Same absolute command sequence and count after normalization (relative→absolute, `H/V`→`L`, `S/T`→`C/Q`, every arc split into exactly four cubics regardless of sweep so counts are stable): interpolate numbers; fills/strokes lerp in sRGB.
2. Both closed and simple: resample each to 64 points by `getPointAtLength`, rotate B's start to minimize summed distance, match winding, interpolate as a polygon path; at t=1 write B's authored `d`.
3. Otherwise FLIP crossfade with a sibling clone of B tweened from A's bbox while A fades out (300 ms), then commit.
technical-trace pages morph only when asked; `text` units never morph — they swap.

### 4.6 Determinism and frame exactness

- All easings are cubic-bezier solved by Newton iteration (as today, slide.ts:140-157); `ease.popOver` overshoots through a control point y > 1 and is applied to scale only; no springs at runtime.
- No wall clock, no randomness. There is no ambient channel: anything that moves is a function of (step, t) or it does not ship.
- Publish quantizes step offsets and windows to project fps at compile (`slideStepOffsets`); the scene tween calls `paint` per frame; a frame index maps to one state. Presenter and publish read the same `stepWindow(k)`; the 850 ms constant and the `0.5 × step` window disappear.

---

