# Route: Build Frame

Build one frame's composition: faceless-explainer Step 5, one worker per
frame. You are that worker.

## Read, in this order

1. `packet/ROLE.md`: your complete role. It is Hyperframes' shared
   frame-worker contract and the workflow's delta, verbatim, then the studio's
   note for this frame's build. It supersedes everything else.
2. `packet/FRAME_PACKET.md`: your frame's storyboard block (its time-coded
   shot is the build spec), the blueprint it instantiates and every motion
   rule it cites, inlined. Its `RULES_DIR` holds any recipe it names but does
   not inline.
3. `packet/DISPATCH.md`: `PROJECT_DIR`, your `frame_id`, the canvas, the
   captions and their keep-out band, whether your frame has a confirmed
   sketch, and the media your frame plays.
4. `production/frame.md`: the design truth. Its fonts ship in
   `production/assets/fonts/` when the design names files.
5. `.claude/skills/storyboard-master/hyperframes/skills/faceless-explainer/references/cut-catalog.md`
   for a cut inside your frame.

## Build

Write `production/compositions/frames/<frame_id>.html`: exactly one
`<template>…</template>`, as the role says. Ids and classes start with your
`frame_id` (it starts with a letter).

## When the dispatch names a confirmed sketch

The creator approved your frame's still on the board. Its pose is already the
file you write, and its still sits in `production/boards/stills/`. The role's
"When a confirmed sketch exists" holds, with this difference: the sketch is
that composition and its still, not a cell of a `storyboard.html`. Read both
first and keep the composition: placement, hierarchy, copy and sizes were
approved. Put the real media where the pose shows a stand-in (a plain block
or a picture from the take or capture), then add the motion: each Scene of
your shot a phase of the timeline, each piece revealed on its cue, so the
frame arrives at the approved still and holds it. Your snapshot at the end
should read as that still, now reached by motion.

## Check, look, submit

- `storyboard_try_frame` runs Hyperframes' own `check` on your frame alone and
  returns its findings and the paths of snapshots at the start, middle and
  end. `fill` measures how much of the picture above the captions your
  content spans at its fullest moment; a "Sparse frame" warning means the
  hero is too small for the frame. Read the snapshots: does the frame read as
  its shot says, is the hero big enough (40–60% of the frame), nothing cut by
  the edge, nothing in the caption band, nothing dumped at once? Fix what you
  see, then try again.
- `storyboard_submit_frame` checks the frame again and accepts it when it has
  no errors. A refusal lists what to fix. Stop once accepted.
