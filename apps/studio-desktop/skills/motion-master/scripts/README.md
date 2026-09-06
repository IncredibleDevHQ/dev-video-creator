# Helpers (MCP tools) — contracts

Served by the studio MCP server (or the worker's HTTP routes in development). Skills call them by name; they never reimplement them. All paths are absolute; all outputs are files plus a compact JSON summary.

| Tool | Input | Output | Notes |
|---|---|---|---|
| `atomize` | `{svgPath | blockId}` | `motion/geometry.json` (units, edges, contains, rows, readingMode); ids written back into the SVG | page-agnostic; never changes a visible pixel |
| `measure` | `{geometryPath, renderScale}` | root-space bbox + member CTM per unit, smallest text px per unit | after `document.fonts.ready` |
| `plan_beats` | `{narration, geometry, contract, currentSteps?, instruction?}` | brief blocks (strict JSON, meaning only) | the only model call in the loop; rejects timing/ease/coordinates |
| `resolve` | `{brief, lock, geometry, beat?, take?}` | `motion/resolved.json` (per action: startMs, durationMs, ease, pivot, ports, path, persistence; motionWindowMs, holdMs; stage snapshot) | pure rules; deterministic |
| `validate` | `{resolved, stage: early|final, quick?}` | report {errors[], warnings[], gateSignal} | classes from Core §1.1 L10, §16, §25.5, §26.5, §28.9 |
| `receipt` | `{brief, resolved}` | `motion/receipt.json` (per beat: hero, ops fired, primitives, slots, family, dwell, budget, clock; absences) | absence needs a reason |
| `frames` | `{resolved, at: [step,t][]}` | PNGs via `?step=&t=&static=1` | review sheet; alpha for overlays |
| `rate_layout` | `{beat, family, geometry, roster}` | score + sub-scores + better | Core §28.7 |
| `take_tracks` | `{takeId}` | onsets, face/hand tracks, turns, feed offsets, matte confidence | offline; local unless the project enables a server pass |
| `layout_track` | `{resolved, roster, weights}` | `motion/track.json` (primary, alternates, switchCost, cueMs per beat) | Core §28.4 |

Development mapping today: `plan_beats` ≈ `POST /api/slides/plan`; `atomize` ≈ `apps/studio-v2/src/slide-atoms.ts`; the rest are phase 0–1 deliverables of the build plan.
