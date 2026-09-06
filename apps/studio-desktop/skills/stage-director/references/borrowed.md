# Borrowed

> Reference for the `stage-director` skill. Source: *The Motion Decision Core*, sections §12. Read only when the routing table triggers it.

Mechanics borrowed from mojs, motionity, pixel2motion and video-talkcraft, and what was not copied.

## 12. Borrowed mechanics (only what is new to the stage)

### 12.1 mojs

| Take | Source | Rewritten as |
|---|---|---|
| Delta with multiplicative `curve` | src/delta/delta.babel.js:93-176 | `env.shape`: a flourish is `{rest, envelope}` on one channel (pulse, ring, pre-squash); publish-only for anticipation, settle kept in presenter mode |
| `approximate` easing tables | src/easing/approximate.babel.js | validator only: each curve's true maximum (cubic-bezier(.34,1.2,.64,1) peaks ≈ 1.3 %) inflates a unit's bbox before the L8 neighbour and face-zone tests; the runtime keeps the shared Newton solver (quantisation, not the solver, is the seam) |
| Overshoot-aware bbox | src/shape.babel.js:401-415 | as above |
| Compositing hints | src/html.babel.js:345-375 | overlay/underlay roots promoted (`isolation: isolate`, `will-change` on the root only); no filter animates over video |
| Burst "Simple Ripple" | src/burst.babel.js:557-567 | `PulseValue.style: ring` |

### 12.2 motionity

| Take | Source | Rewritten as |
|---|---|---|
| Any layer as clipPath / absolutePositioned mattes | ui.js:56-67, 724-733 | the speaker matte is a unit; **clip-wipe**, **pipMove** (`move` to a slot) and **clip-morph** (circle → rounded rect → full) via the `clip` primitive; not the core `reveal`/`move`/`morph` semantics |
| Non-destructive crop | functions.js:3529-3783 | the inner crop rect in source pixels, tweened like the viewBox (centre linear, scale in log space), a CSS transform on the HTML container; follow-crop per §10.2 |
| Chroma-key control surface | ui.js:2224-2309 | the cut-out panel (segmentation, not colour distance); media-pipeline, never plan |
| Three-slot z-order | functions.js:5936-5951 | the §14 stack, changed only at seams or by reframe |
| Alignment guides / snapping | align.js:164-371 | speaker-frame drag snapping to thirds, safe areas, unit bboxes |

### 12.3 pixel2motion

| Take | Source | Rewritten as |
|---|---|---|
| `?t=`, `?static=1`, ready flag, transparent frame-exact export | scripts/animate_svg_html.py, export_claude_videos.mjs | the frame-exact renderer (`?step=&t=` screenshots + ffmpeg) is the **only** alpha path (MediaRecorder cannot encode alpha): publish = PNG sequence / ProRes 4444 / VP9 yuva444; VP9 yuva420p **preview only** (4:2:0 smears hairlines, outline text, leaders) |
| Ink-delta / risk-window bracketing | scripts/probe_motion_continuity.py | review frames at reframe points ± 0.5 s and exit→enter gaps |
| Mask wipe carrier | references/reveal-patterns.md §4 | the lower-third `clip` wipe |

### 12.4 video-talkcraft

| Take | Source | Rewritten as |
|---|---|---|
| Frame contract, speaker forms, shrink-to-chip, split-60-40, parallel items, quote yield, nameplates, 9:16 rules | references/layout.md, host-footage.md, cards | §8.2 families (geometry re-derived from our tokens), §9.1 slots, §9.3 carriers |
| Face zone with priority over centring | scripts/face_bbox.py; layout.md §4–5 | §8.4 hard/soft zones, rolling window |
| Three-phase handoff, 0.15 s lag, return order, caption re-anchor 0.45 s, review stills ± 0.5 s | cinematography.md §4.5; koubo-units.tsx:141-162 | §10.2 |
| Layout-event budget, 8 s hook | cinematography.md §1 | §8.3 caps |
| Word-addressed beats, beat lint, tail guard, gate-before-word, empty-stage check | scripts/make_timing.py, beat_lint.py | §11 |
| Legibility chain, bed darkening | design-language.md §1.2 | §9.2 |
| fps lock, fractions, edge inset, never scale the person | host-footage.md §1, §4 | §8.1, §14 |

### 12.5 Not copied

- mojs: the DSL, `rand()`, callbacks, repeat/yoyo, singleton tweener, Shape/Html/Burst modules, runtime easing tables, motion-blur, known bugs (`start.x + shift.y`, `atan` quadrant loss).
- motionity: the anime.js keyframe runtime, per-property keyframes as the model, colour-distance chroma key, MediaRecorder real-time export, DOM-as-truth timing.
- pixel2motion: the spring runtime, CSS keyframes/WAAPI, personality presets, idle loops, vectorisation, dramatic pauses, `d: path()` morphs.
- talkcraft: any code (PolyForm Noncommercial), always-on scene push, hold-period floats/glow, the alpha-WebM digital human, platform-skinned follow cards, glass-board material, whole-take union face boxes, demo pixel coordinates, blur as a channel, screen-shake, 1.65× pops, slam/whip transitions, `data-crop-ok`.
- broadcast: default tickers, Twitch density, 3D lower thirds, auto punch-in jump cuts, animated rooms behind text, mandatory segmentation, mirrored output, live trackers in the driver, PiP swapping as rhythm, burned-in captions without placement.

---

