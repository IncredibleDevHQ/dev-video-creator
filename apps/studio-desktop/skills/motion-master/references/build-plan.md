# Build Plan

> Reference for the `motion-master` skill. Source: *The Motion Decision Core*, sections §7. Read only when the routing table triggers it.

Phases 0–10.

## 7. Phased build plan

All paths are relative to `a699ba77`; line numbers are on that commit.

| Phase | Deliverable | Files | Notes |
|---|---|---|---|
| 0 | Schema V2 + V1 expansion; element-level state fold with the unreferenced-unit rule and content baselines; `Step.id`/`Action.id`; `stepWindow(k)`/`stepHold(k)`; studio Next uses the window; Back = fold + crossfade; init after `fonts.ready`; wrapper-matrix transforms replace CSS transforms; enter-once-while-hidden replaces one-appearance in the editor (`stepIndexOfUnit` 7574, `toggleUnitInStep` 7707), server filter (1077-1084) and prompt (1035) | `packages/markdown-composition/src/slide.ts` (types, `sanitizeSlideSteps`, driver 121-241), `apps/studio-v2/src/main.ts` (`animateDriverStep` 621-643, play hold 7397, Back 7445), `apps/studio-v2/server/index.ts` | Intentional retune of every existing plan per §3.1; no new ops |
| 1 | Geometry persistence (root-space bbox, member CTMs, `svgHash`, numeric parse, lines/fontPx) written at save; attention ops `dim`/`undim`/`emphasize`/`pulse`/`exit` with release; token table and resolver; presets bound | `slide-atoms.ts` (export bbox/edges/contains/rows/CTM), `main.ts` save path, `slide.ts` | Makes `focus` spotlight already-visible units without dimming chrome |
| 2 | `move` (slot targets, path, pivot, lags, z-lift, rebinding); `camera` (viewBox tween, `overflow: hidden`, target-rect rule, reveal-during, direct vs via-page, materialized implicit release); `frame.renderScale` compile input | `slide.ts` (`prepareSlideSvg` keeps authored viewBox as page rect; overlay group), `index.ts` CSS 1298-1299 | Test in studio letterbox and publish |
| 3 | Relate ops: `trace` direction and marker handling from edges, `connect` synthesis in highlight/author mode, masks for dashed strokes | `slide.ts`, `slide-atoms.ts` (edge direction from markers, `data-flow`, endpoints) | Requires phase 1 geometry |
| 4 | Content ops: `swap`, `count` (fromMode current, text fit), `morph` with the three-tier test | `slide-atoms.ts`, `slide.ts` | Morph off by default for technical-trace |
| 5 | Editor: templates (intent → actions), click model, action rows, camera rect drag, live scrub, badges, validator panel (errors vs warnings) | `main.ts` 7525-7935 | Author overrides for hold/duration/dim/preset live here |
| 6 | Planner: intent-tier output schema, narration spans, relationship facts, verb tagging, two-pass prompt, per-op validation with reasons | `server/index.ts` 1006-1118, 1996; `main.ts` `slideUnitInventory` 7790-7813 | Camera gated on cue; connect highlight only |
| 7 | Timing: landing-aligned cues from word onsets, recorded take capture in the recording coach (`takes[]`, main.ts 883) and precedence, scene-length `fit`, frame quantization of step windows, captions (`.ex-caption`, index.ts:588-591) follow the cue | `slide.ts` 50-66, `packages/markdown-composition/src/index.ts` 924-946, 1427-1437, `explainer.ts` 255-277 | Removes the last of the three timing sites |
| 8 | Cross-page continuity: `motion.anchors`, anchor matcher at compile, `frameTransition.style` += match-cut/morph/zoom-through tweened over the existing frame-transition window (index.ts:729, 852-881); pre-still page entry; loop seam; deck-rhythm rules | `index.ts`, `slide.ts` `prepareSlideSvg` (keep authored id alongside `s{N}-`), `types.ts` | Depends on ppt-master emitting `data-anchor` |
| 9 | Validation and review harness: L10 classes, readability, flash, reduced-motion path, review frames per step and seam with the lottie seam fields | new `packages/markdown-composition/src/motion-validate.ts`; studio "check motion" in `main.ts` | Errors block present/publish, never save; warnings never block |
| 10 | Deferred: `pathFollow`, author-mode `connect` UI, image drift if ever wanted (baked as f(t), never CSS) | `slide.ts` | Only with a consumer |

Phases 0–2 give the worked examples their `emphasize`, `dim`, `camera` and `pulse`; (a)'s `trace` marker handling lands in phase 3 and (c)'s `swap`/`count` in phase 4. Phase 0 retunes existing plans exactly as listed in §3.1; later phases change rendering only where they add an op or a token an existing plan already triggers (phase 1 presets, phase 7 timing), and each such change is listed in that phase's notes.

