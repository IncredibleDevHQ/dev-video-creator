# Compositing

> Reference for the `stage-director` skill. Source: *The Motion Decision Core*, sections §14. Read only when the routing table triggers it.

Layer stack, studio compositing, determinism, publish vs studio.

## 14. Driver and compositing realisation

### 14.1 The layer stack (bottom to top)

1. **Background** — theme canvas.
2. **Underlay root** — `<svg data-stage-underlay>`, frame-sized; `behindSpeaker` slots only (requires `cutout`).
3. **Camera layer** — the `<video>` (live or recorded) in a container owning `clip-path` (the `clip` primitive), the inner crop transform, the treatment and the ring. `bed` is a second `<video>` with a static filter.
4. **Content layer** — the SVG page or block render at `stage.content`.
5. **HTML plate layer** — glass and bed elements; only opacity animates.
6. **Overlay root** — `<svg data-stage-overlay>`, `isolation: isolate`, `will-change` on the root only; slot groups, SVG plates (flat/gradient/solid), callouts, rings.
7. **Captions** — introduced by phase 12 (no caption element exists in index.ts today).
8. **Coach layer** — outside the captured `player` element; never recorded.

### 14.2 Studio compositing

Geometry has **one writer**: crop, clip and ring are DOM (`clip-path`, `transform`) driven by `stage(k,t)`. A hidden capture canvas at the camera's native size does **matte and bed only**: per frame it draws the camera frame delayed by one frame so mask and picture agree, applies the segmentation mask (MediaPipe selfie segmenter at its native 256×256 input; mask eroded 1–2 px, then blurred for the feather, then `destination-in`; spill suppression on light pages) and `captureStream(fps)` feeds the camera `<video>`. Worker + `OffscreenCanvas` + `MediaStreamTrackProcessor` on Chromium; main-thread fallback elsewhere. The frame budget is a **measured gate at rehearsal** with hysteresis (segmentation time, DOM style time, glass count): a failing gate disables the cut-out or glass **before** the take; there is no mid-take family change (it would break `layout.minDwell` and desync the take from publish). A 60 fps project runs the matte at 30 fps and the DOM at 60. Holds cost zero writes (change-tracked cache).

### 14.3 Determinism

`stage(k,t)` is a pure function of the resolved plan like `paint(k,t)`: clip/crop, plate alphas, overlay channels and callout positions (from stored tracks) are computed per frame with no retained tween. The matte is the only per-frame external input and never influences plan state (the gate is evaluated per beat from the take's rolling minimum, at compile). Scrub and Back re-paint the stage; a reframe scrubbed backward is `stage(k−1, 1)` under the crossfade.

### 14.4 Publish vs studio

| | Studio | Publish |
|---|---|---|
| camera | live stream via the matte canvas | recorded raw track, fps an integer multiple of project fps |
| clock | Next / gesture / hotkey | quantised cue times, recorded `Take.overlays` first |
| segmentation | live, gated at rehearsal | offline matte per frame, gated per beat |
| tracks | rolling face box for the coach | `Take.tracks` drive callouts and side |
| legibility device | canonical | measured, persisted in the snapshot |
| overlay render | DOM roots | same roots painted per frame; alpha export via the frame-exact renderer |
| review | `?step=&t=`, `static=1` | contact sheets + burst triples at every reframe ± 0.5 s |

---

