# Route: Pose Frame

Pose one frame as a still: the sketch pass Hyperframes runs once a plan is
approved and before anything animates. The creator sees every frame's still
on one board, approves it or leaves a note on a frame, and the build then
animates the approved pose without redrawing it. You pose one frame.

A still is a **static frame, not an unstyled one**: the frame's layout at its
key moment with the full `frame.md` treatment. Real fonts and colours, the
actual headline, number or label set where it will live, the hero at the size
it will have. Plain blocks only for what is not made yet: the creator's take
or a product capture when the dispatch says it does not exist. No motion.

## Read, in this order

1. `packet/DISPATCH.md`: your `frame_id`, the file you write, the canvas and
   the caption band, the frame's estimated length, the stand-in for its media,
   the frames beside it, and the creator's note when the frame is posed again.
2. `packet/FRAME_PACKET.md`: your frame's storyboard block (what it shows,
   its words, its type, beat and key message) and, when the plan named one,
   the blueprint whose shape fits it. There is no time-coded shot yet: you
   decide the layout, and the shot is written onto your still once it is
   approved.
3. `packet/ROLE.md`: Hyperframes' frame-worker contract, then the studio's
   note for this frame's build. Follow its file contract (one `<template>`,
   the root and its `data-composition-id`, styles and scripts inside the
   template, the one paused timeline registered at `window.__timelines`), its
   frame constraints on layout (the caption keep-out, filling the content
   area, short motion-graphics copy, never the narration's sentences) and its
   rules on design tokens. Its motion rules (revealing across the duration,
   each Scene a timeline phase) are the build's: today nothing moves.
4. `production/frame.md`: the design truth. Its fonts ship in
   `production/assets/fonts/` when the design names files.
5. For a camera frame, the layouts in
   `.claude/skills/storyboard-master/hyperframes/skills/talking-head-recut/references/layouts/`
   (`overlay`, `pip`, `split`, `stack`) when the run has them: pose the take in
   one of them, with its cards beside or over it.

## Pose

Write `production/compositions/frames/<frame_id>.html`: one `<template>`, ids
and classes starting with your `frame_id`, every element placed where it
lands, at its final size and opacity. Register the paused timeline with no
tweens: no `.to`, `.from` or `.fromTo`. Load GSAP inside the template all the
same, so the build adds its motion to this file.

Compose for the frame's job: the hero at 40–60% of the picture above the
caption band, few elements, each with a role, the copy short. Frame it
differently from the frames beside it. When the dispatch names a picture for
the take or the capture, place it as an `<img>` where the media will play;
otherwise draw the plain block it describes.

When the creator left a note, the pose and the still they saw are already in
`production/`: change what the note asks, and keep everything it does not
touch.

## Look, then submit

- `storyboard_try_pose` runs Hyperframes' own `check` on your pose alone,
  takes the still at its key moment, and returns its findings, how much of
  the picture the content fills, and the still's path. Look at the still: is
  the hero big enough to read on a phone, nothing cut by the edge or crossing
  the caption band, nothing overlapping by accident, every label next to what
  it names? Fix what you see and try again.
- `storyboard_submit_pose` checks the pose again and accepts it as the
  frame's still when it has no errors. A refusal lists what to fix. Stop once
  accepted.
