# Tokens

> Reference for the `motion-master` skill. Source: *The Motion Decision Core*, sections §5. Read only when the routing table triggers it.

The single source of numbers. Cite by name; never restate a value.

## 5. Defaults and taste rules to hard-code (single source of truth)

**Units.** Distances are expressed in page-width units: `pw` = viewBox width, `‰` = pw/1000 (on a 1600-wide page 1 ‰ = 1.6 px). Speeds are in pw/s. Text-size limits are frame pixels at 1080p and use the layout's `frame.renderScale`. Durations are ms before `durationScale`.

| Token | Value | Source |
|---|---|---|
| `ease.enter` | (.20,.75,.34,.94) | lottie entrance-sharp; today's easeEnter |
| `ease.settle` | (0,.65,.51,.99) | lottie settle-soft; today's easeSettle |
| `ease.travel` | (.4,0,.2,1) | Material emphasized; replaces lottie travel-balanced, whose x1=1/x2=0 hesitates mid-move |
| `ease.camera` | (.65,0,.35,1) | principles |
| `ease.exit` | (1,.02,.54,.42) | lottie exit-accelerate |
| `ease.pop` | (.94,.75,.34,.94), no overshoot; hero personality only, one per beat | lottie expressive-pop |
| `ease.popOver` | (.34,1.2,.64,1), ≈3 % overshoot, scale-only, markers/icons | principles |
| `ease.draw` | linear when chained; (.45,0,.55,1) for a single trace; ease-out for traces < 75 ‰ | lottie technical trims; replaces today's (0.25,0.6,0.4,1) |
| `ease.pulse` | (.37,0,.63,1) sine-in-out | principles |
| `dur.small / medium / large` | 220 / 320 / 550 (icon–label / node–card / region–group) | principles; Material ranges, deliberately slower for an explainer |
| `dur.exitRatio` | 0.65 | principles |
| `dur.floor` | 180 ms and ≥ 4 frames after quantization | principles |
| `dur.move` | 300 + 600 × distance(pw), clamp 350–800 | principles |
| `dur.draw` | 0.75 pw/s, clamp 300–1200, one speed per beat | lottie |
| `dur.cameraIn / cameraOut / cameraDirect` | 900 / 900 / 700 | lottie 60–120 f; out ≥ in because the pull-out re-exposes the page |
| `dur.dim`, `dur.release` | 300, 300 | ours / principles |
| `dur.count` | 800 (600 ≤ 2 digits, 1200 ≥ 6 digits or decimals) | lottie data motion |
| `dur.swapOut / swapIn / swapOverlap` | 180 / 250 / 40 | principles |
| `dur.pulse`, `budget.pulses` | 500, 2 per beat | principles |
| `dur.morph` | 600 | lottie |
| `dur.pathFollow` | 0.4 pw/s, clamp 500–1500 | lottie |
| `dist.rise` | 8 ‰ | ours (14 px at 1600 ≈ 9 ‰), lottie |
| `dist.textTransit` | 10 ‰ and ≤ 400 ms | principles |
| `dist.straightTol`, `dist.portOut`, `dist.routeInflate`, `dist.labelAttach` | 5 ‰, 2.5 ‰, 4 ‰, 15 ‰ | ours |
| `path.bulge` | 0.2 (arc presets only) | lottie |
| `stagger.unit` | 70 ms per unit ≤ 6; 500/n above; cap 500 | principles; lottie 3–6 f |
| `stagger.enum / member / line / exit` | 120 / 40 / 60 / 50 | principles |
| `lag.label / connector / badge` | 60 / 40 / 80, settling after the shape | Disney follow-through |
| `chain.at`, `orch.opacityRatio`, `gap.exitEnter` | 0.7, 0.8, 80 ms | lottie choreography; principles |
| `ant.dimLead` | 120 ms publish / 0 presenter | principles |
| `handoff.overlap` | 150 ms | principles |
| `budget.beat / attentional / camera` | 1600 / 600 / 2000 | principles; lottie 75–150 f |
| `budget.newUnits / newRels / motionTypes / concurrentUnits` | 5 / 2 / 3 / 12 units | principles |
| `hold.min / hold.last`, `beatOverlap` | 600 / 1500, 120 ms | lottie reveal grammar |
| `dim.shape / dim.text` | 0.35 / 0.45; chrome and anchors exempt | ours (0.35); WCAG |
| `emph.stroke / scaleHeld / scalePulse` | 1.5× / 1.08 / 1.04 | principles |
| `camera.pad / fill / maxZoom / textMin / textMax / dwell` | 0.12 / 0.65 / 2.5 / 18 px / 96 px / 1000 ms | lottie camera recipe |
| `camera.revealDuring / directMaxZoomRatio / directMaxCentreShift / pullBack` | 0.6 / 2 / 0.4 pw / 2 % over 150 ms (publish only) | principles |
| `trail.length / decay` | 0.15 of path / exponential | lottie |
| `seam.crossfade / matchTol / morph / zoomThrough / loop / varietyWindow` | 350 / 5 % of pw / 600 / 700+700 / 400 / 3 | principles; lottie |
| `presenter.fastForwardMs / backCrossfadeMs` | 120 / 150 | ours |
| Flash | pulses ≤ 1 Hz; ≤ 3 flashes/s; luminance change ≤ 20 % | WCAG |
| Reduced motion | fades ≤ 150 ms, no transforms, no camera, counts jump | HIG/WCAG |
| Performance | opacity + transform + dashoffset only; cached lengths, bboxes and CTMs | lottie render-aware |

**Preset table** (the `preset` enum resolves to this column; everything not listed is the token above):

| Token | technical-trace | premium-settle | data-confirm |
|---|---|---|---|
| text carrier | rise `dist.rise`; per-line for hero body | rise `dist.rise`, block | fade; per-line for hero body |
| shape carrier (`preset.shapeScale`) | scale .96→1 | scale .94→1 | clip-wipe for rounded bars; scale .96 others |
| image carrier | fade | fade + scale 1.03→1 | fade |
| durationScale | 1.0 | 1.2 | 1.0 |
| `stagger.unit` | 70 | 90 | 60 |
| move path | straight / orthogonal | arc allowed | straight |
| overshoot | markers only | off | off |
| enter / settle anchors | `ease.enter` / `ease.settle` | `ease.settle` / `ease.settle` | `ease.enter` / `ease.settle` |
| morph | off unless asked | tiers 1–2 allowed | off |
| anticipation (publish) | dim lead | dim lead + 0.98 pre-squash 80 ms before emphasize | dim lead |

**Rules without a number.** Anchor by behaviour, not element type; one focal personality per beat. No linear except traces, counters and loops. Draw in the direction the viewer should understand. Labels appear after their target. Members of one unit share one carrier. Draw/mask/clip over uniform fade; rounded rects reveal by clip, never scale. Settle = the final 10–20 % of every motion must not drift. One camera idea per page; a camera endpoint must be a clean still. Motion never compensates for layout; fix order: composition → fewer animated properties → stagger origin → easing → settle → effects (pptMaster; lottie motion economy). Per-element motion is off by default; one flourish per beat.

---

