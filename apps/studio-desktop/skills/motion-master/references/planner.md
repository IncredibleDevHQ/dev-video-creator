# Planner

> Reference for the `motion-master` skill. Source: *The Motion Decision Core*, sections §6. Read only when the routing table triggers it.

Authored vs inferred, the verb vocabulary, prompt inputs, authoring requirements with fallbacks, the editor click model.

## 6. Authored vs inferred, and the planner's inputs

### 6.1 Ownership by decision

| Decision | Rule default | LLM from narration | Author |
|---|---|---|---|
| Beat boundaries, narration span, order | reading/topology fallback | yes (sentence → beat, cue word) | yes |
| Intent, hero, supporting, template | first/last beat only | yes | yes |
| Duty per unit | enter for new units; templates | yes (emphasize / exit / continue) | yes; click model below |
| from → to units for trace/connect | edges | yes ("goes from X to Y") | yes |
| Count target, swap text, morph target | to = authored | yes when the narration states it | yes |
| Camera | proposes by region and text size | only on a narration cue | yes (drag rect) |
| `connect` in author mode, freeform `move` | never | never | yes |
| Keep list, release | hero + supporting + anchors; release on hero change | `continue` hint | yes |
| Cross-page transition type | anchor matcher | morph vs crossfade semantics | yes |
| Preset, durationScale, speed | topology/carrier default | never | yes |
| All durations, easings, stagger, overlap, ports, paths, pivots, persistence | yes | never | anchor per action, hold/duration, dim level (advanced) |

### 6.2 Verb vocabulary the planner tags per sentence

is / has / contains → introduce; connects / sends / calls / flows / passes to → relate (trace) or flow; unlike / versus / compared to → contrast; becomes / turns into / replaces → transform (morph or swap); grows / increases / N times / percent / from A to B → quantify (count); notice / here / this → emphasize; look closer / zoom in / look at → emphasize with camera cue; remove / without / drop → exit; in summary / altogether → recap; next / now turn to → transition.

### 6.3 Prompt inputs (POST /api/slides/plan, server/index.ts:1996, extended)

1. Unit inventory (≤ 400): `id · kind · label · bbox · group · role · numeric{value,prefix,suffix}`.
2. Relationships: `edges` as "connector uN: A → B (directed)", `contains` as "frame F encloses A, B", `rows` in reading order, `readingMode` and topology class.
3. Narration ≤ 6000 chars with sentence and word indices.
4. Current steps (≤ 40) in V2 form; instruction ≤ 1500 chars.
5. The verb vocabulary and the budgets (`budget.newUnits`, `budget.newRels`, 3–24 steps).
6. Output contract: strict JSON restricted to `id, title, explanation, narration, intent, template, hero, supporting, actions[{op, targets, from, to, value: {to | text | toUnit | factor}, release.on}]`. `camera` is accepted only for a sentence tagged with a camera cue; `connect` only in highlight mode; `move` only to a `UnitRef`; no `timing`, `ease`, `except`, `freeform`. Two passes: tag sentences → fill steps.
Validation grows from "id exists and unseen" (server/index.ts:1077-1084) to the L10 classes: errors (target missing, duty on a never-entered unit, count on non-numeric, dim on chrome, camera without cue) are rejected with the reason so the planner can retry; warnings (budgets) pass through to the editor.

### 6.4 Authoring requirements on ppt-master, with fallbacks

| Requirement | Fallback when absent |
|---|---|
| Stable semantic ids per structure; a group per structure with the label separated from the shape | atomizer ids; label paired by proximity (`pairLabelsAcrossPage`) |
| Connectors as single paths with markers; `data-flow="a→b"` when undirected | direction from marker end; else from the hero end; else LLM |
| `data-role` focal/support/accent/chrome/anchor | inferred: page title and frames = chrome, legend/axis labels = anchor, largest box = focal |
| `data-anchor` on cross-page shared elements with persisting coordinates | identical authored id, then identical label within the same role |
| Morph candidates with matching command sequences | tier 2 resample, then tier 3 FLIP |
| Clip containers around rounded bars | bars fade instead of clip-wipe |
| Numeric figures as a single `<tspan>` with tabular numerals, `data-number` on ambiguous tokens | multi-tspan numbers use `swap`; ambiguous tokens are not counted |
| No baked transforms on leaf text | handled by the wrapper-matrix transform (§2.1); no fallback needed |
| Boxes sized for the longest swap/count string | fit check errors back to the static layer |
| Optional `data-camera-region` rects | derived from group bounds |

### 6.5 Editor click model (phase 5)

Click an un-entered unit → `reveal` in the current step (as today, `toggleUnitInStep`). Click an entered unit → toggle `emphasize` in the current step. Shift-click → `exit`. A second target while an action row is armed (trace/connect/move) fills `to`. Everything else is an action row with an op picker showing only op-specific fields; the advanced toggle reveals `timing`, `ease`, `except`. Badges on a unit list its duties by step id ("enters at 2, emphasized at 5"). The teleprompter shows the upcoming step's title and intent ("next: zoom into decoder") so the presenter can pace.

---

