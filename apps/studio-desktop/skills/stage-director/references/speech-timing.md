# Speech Timing

> Reference for the `stage-director` skill. Source: *The Motion Decision Core*, sections §11. Read only when the routing table triggers it.

Lead/lag by overlay kind, clearing, the gesture cue, what the take captures, the four clocks.

## 11. Timing against speech with a live presenter

### 11.1 Lead / lag by overlay kind

| Overlay kind | Alignment to the cue onset | Hold |
|---|---|---|
| a **value** (figure, term, name) | **lands on the onset** (core C2; landing = settled); a counted figure's landing = onset | inherits hold(k); `hold.number` 2 s minimum |
| a **place** (panel, box, band) | leads by `ant.placeLead` 300 (200–400); for a counted figure the strap starts ≥ dur.count + 0.7 × dur.lowerThirdIn before the onset (≈ 810 ms) | until its topic ends |
| identity lower third | +0.5–1.0 s after the person starts speaking; once per scene | `hold.identity` 5–7 s (slot override) |
| chapter slab / cover | onset of the pivot sentence's first word | 1.2–2 s |
| pinned callout | dot on the onset; leader and label serial | until the sentence ends |

Reframe timing is §10.4. Gate before the word: content whose cue has not arrived is invisible (opacity 0), never dimmed. Authoring lint: a beat's word match resolves within ± 100 ms; quantisation error ≤ one frame (41.7 / 40 / 33.3 / 20 / 16.7 ms at 24 / 25 / 30 / 50 / 60). Overlays inherit the core hold(k); there is no second hold formula.

### 11.2 Clearing

An overlay exits ≥ `gap.overlayClear` 300 ms before the next beat's cue and ≤ one sentence after its topic; an anchor within `seam.tailGuard` 500–700 ms of a page seam is swallowed and the validator proposes the next page. Same slot: exit → `gap.exitEnter` → enter (or refresh, §9.3); different slots may crossfade. ≤ `budget.overlays` 2 visible, ≤ 1 new per 3 s; strap + ticker count as one; a takeover clears all. An event-free window > 2 s on a speaker-full frame is advisory (the live speaker carries it; a static content frame does not).

### 11.3 The gesture cue

- **Pointing.** Index tip within `gesture.reach` 0.04 W of an element for ≥ `gesture.dwell` 250 ms drives `emphasize` on it (replacing the planner's hero for the point) in the `gesture` family; elsewhere it pulses a floating card.
- **Trigger.** A deliberate near-hand raise above the shoulder ≥ 400 ms or a nod (per project, off by default), a hotkey, pedal or remote all mean **Next**: overlay steps *are* steps and each costs a Next; on camera the hotkey/pedal is the primary Next.
- **Precedence** (L6 extended): recorded Next / trigger > pointing excursion > head-yaw excursion > word onset > formula. Pointing may advance an entrance by ≤ one sentence; the coach warns live so the presenter re-takes.

### 11.4 What the take captures

`Take.steps[{stepId, atMs}]` stays. Added: `Take.overlays[{actionId, atMs}]`, `Take.tracks {face, eyes, hands, yaw}` at project fps (offline pass, smoothed), `Take.deltas[{stepId, earlyMs}]`, `Take.media {cameraUrl, micUrl, t0}`. **One reference clock**: `t0` is the raw camera recorder's first frame `mediaTime` (`requestVideoFrameCallback`); every `atMs` is measured against it, replacing `Date.now()` (main.ts 1074). Landmarks never leave the take; the plan stores zones and references only.

### 11.5 Studio / Play / Loop / publish

- **Studio:** overlays fire on Next / gesture / hotkey and hold until the next Next; reframes start on Next; Back returns to base(k−1) under the crossfade; legibility devices are canonical; callouts are pinned.
- **Play / Loop:** holds from L2; the loop seam clears transients and returns to the family base; reframes obey `layout.minDwell` (the compiler merges shorter holds).
- **Publish:** cue-led with §11.1, quantised to fps; the camera is the recorded raw track (or its matte) re-composited by `stage(k,t)`; recorded `Take.overlays` take precedence like recorded Next.

---

