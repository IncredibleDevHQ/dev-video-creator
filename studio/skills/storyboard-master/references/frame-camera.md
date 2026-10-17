# Studio note: a camera frame

This frame is built on the creator's take. The take for this frame is in
`production/` at the path `DISPATCH.md` names (`media`), already cut to the
frame, every frame a keyframe.

- Play it as one muted `<video class="clip">`, a direct child of the frame
  root, with `data-start="0"`, the frame's `data-duration` and its own track
  index (the core contract's media rule). Its sound is the frame's voice
  track, mounted by the assembler: never an `<audio>` element, never unmuted.
- Place it by the layout the shot names, from talking-head-recut's layouts
  (`overlay`: full bleed; `pip`: a framed corner; `split`: half the canvas;
  `stack`: the top half). Move between layouts with transforms on a wrapper,
  as those layout files do, on the creator's words.
- Cards carry what the shot says: a kicker, a number, a short claim, a quote
  the creator says. Never a sentence of the narration (the captions carry the
  words). Keep cards clear of the face; keep everything above the caption
  band.
- The take is real footage: no filters, crops of the face or effects on it
  beyond what the layout does.
