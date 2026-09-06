# Reframes

> Reference for the `stage-director` skill. Source: *The Motion Decision Core*, sections §10. Read only when the routing table triggers it.

Cut or reframe, the reframe, stage seams, timing against speech, what the presenter sees and what is recorded.

## 10. Layout transitions and reframes

### 10.1 Cut or reframe

The same camera continuing into a new family is an **animated reframe**; a change of source (screen recording → camera), a takeover longer than `layout.returnCutAfter` 8 s, or a topic jump across a page seam is a **hard cut**. Comfort rule (not a WCAG citation): ≤ 20 % luminance change per hard cut, else a 150 ms crossfade — checked in publish/review only (the incoming live frame is unknown); the flash limits are the core's tokens. Cuts are ≥ `cut.minSpacing` 1 s apart (reframes are already covered by `layout.minDwell`). The presenter's Back is a cut under `presenter.backCrossfadeMs`; the crossfade is the reduced-motion default.

### 10.2 The reframe

- `clip` inset+radius and the inner crop `xform` are written from **one progress t** (lockstep; two tweens desync and the face leaves the circle). **Full ↔ chip**: the face-box centre stays at a stable screen point. **Full → panel/split**: the eye **row** is held; the column travels with the clip edge for lead room (holding x would put the face at 0.8 of the column). Crops tighten as the frame shrinks (full: waist/chest-up; panel: chest-up; chip: head-and-shoulders, face ≥ 35 % of chip height).
- Durations @1080, **never scaled by `durationScale`**: full → chip `dur.reframeOut` 450; chip → full `dur.reframeIn` 600; full → split/panel `dur.reframeSplit` 500; chip ↔ corner `dur.pipSwap` 500. Ease `ease.camera`, no overshoot. The ring fades in from 55 % of the shrink (ring alpha is a theme value).
- **Make-room.** Speaker-full → panel: the speaker reframes toward the far edge; the panel slides in from the opposite edge by its own width starting `lag.panelAfterSpeaker` 150 ms after the speaker starts; the panel group is overflow-hidden, so content never crosses the person.
- **Three-phase handoff** with a panel already up: old panel out → speaker reframes → new panel in, separated by `gap.exitEnter`. Return to full: graphic out first, person re-expands `lag.returnAfterGraphic` 120 ms later.
- Captions re-anchor `caption.reanchorDelay` 450 ms after the speaker **settles**; every reframe ± 0.5 s is a mandatory review frame.
- **Follow-crop** (sway) is continuous: dead zone `crop.deadZone` 0.03 W, velocity cap `crop.maxVel` 0.02 W/s, `crop.followMs` 400 smoothing; frozen during a reframe and while a face-anchored callout is up; off under reduced motion.

### 10.3 Stage seams

`stage.cut`, `stage.reframe`, `stage.cover` are seam types under L9 with L9's fields. The layout pre-still extends the page pre-still: at an intent change all transient overlays are out and the camera is in its family rect before the new page's chrome appears; across a page seam only persistent chrome carries (bug, captions, the speaker). Momentum carry: a coinciding page seam and reframe move the same way. Occlusion wipes (chapter slab) leave the camera untouched; caret wipes are banned between two on-camera shots.

### 10.4 Timing against speech

Publish: a reframe lands on the cue onset by starting in the pause, start = onset − `ant.reframeLead` 400 (300–500); never mid-word; cut on the breath, the cue onset or a gesture start. Studio: the reframe starts on Next with the 50 ms budget, no lead. Audio never cuts (L-cut): layouts change under continuous speech.

### 10.5 What the presenter sees, and what is recorded

- The coach shows the **program output** (overlays, un-mirrored) at ≤ 5° from the lens for close-ups (≤ 10° waist-up), plus preview-only cues: a ghost of the next overlay/layout 1–2 s ahead with a countdown ring, a lean arrow, a gesture target ring, a two-line script strip with the cue word, and the live warning "you pointed before it was there". Self-view mirroring is **derived per family** (mirrored in 1 and 4, program in 9), not plan state.
- **Capture path (decision).** Today the directed take is a tab capture (`getDisplayMedia` + `cropTo(player)`, main.ts 1002–1019) of a scene into which `attachLiveCameraInsideComposition` (main.ts 616) injects a **mirrored** `<video>` (`scale: -1 1`), so the recording is a mirrored, baked composite. The extension: (1) records the **raw camera track and mic** with their own `MediaRecorder` at capture resolution, with the mirror applied only to the coach's self-view element; (2) keeps the tab capture as the directed reference; (3) the **coach layer lives outside the cropped `player` element** (a sibling overlay in the shell), so nothing preview-only is captured; (4) `getUserMedia` (main.ts 1170) asks `frameRate: {exact: n × projectFps}` and 1920×1080 ideal. Added preview latency ≤ `preview.addedLatencyMs` 70 (segmentation frame + captureStream frame); the coach may show the raw stream when the budget is missed.

---

