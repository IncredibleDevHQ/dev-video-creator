---
name: stage-director
description: >
  Decides how the camera, the content and the overlays share the frame when a
  presenter is on camera: stage families, overlay slots, legibility over video,
  reframes, speech timing, and the director that ranks the best view per beat,
  offers legal switches while the speaker talks, picks overlay-vs-canvas treatments,
  rates layouts with reasons and guides speakers. Use when the user asks about
  presenter layouts, picture-in-picture, lower thirds, the camera, going full
  screen, the coach, or mentions stage-director. Loaded by motion-master when a
  presenter is present; may run alone for rating and coaching.
metadata:
  version: "0.1.0"
  source: "The Motion Decision Core, Parts II and V"
---

# Stage Director Skill

Routes: **Plan Stage** (inside motion-master's Plan Motion when presence ≥ 1), **Rate** (`workflows/rate.md`, on demand), **Coach** (`workflows/coach.md`, before/during/after a take). Read `workflows/routing.md` first.

Invariants: L0 is stage state, never an action; the speaker is chrome (never dimmed, never "others"); every reframe joins two clean stills; numbers live in `references/stage-tokens.md` and the director tokens in `references/director.md`; a speaking person is hidden only by a takeover ≤ 8 s.

Vocabulary: family, slot, treatment (overlay, bed, separate, glow-bed hero, text-behind), free region, eye row, hard/soft/hands zone, reframe, make-room, layout track, offer, escape hatch (you full, all full, back to composite, content full), receipt.
