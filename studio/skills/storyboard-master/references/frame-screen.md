# Studio note: a screen frame

This frame is built on a real product capture. The capture for this frame is
in `production/` at the path `DISPATCH.md` names (`media`), already cut to the
frame.

- Play it as one muted `<video class="clip">`, a direct child of the frame
  root, with `data-start="0"`, the frame's `data-duration` and its own track
  index (the core contract's media rule). Never an `<audio>` element.
- The product is the hero: show it big, in a device or window frame from
  `frame.md` when the design has one. Zoom with transforms on a wrapper (a
  push to the part the narration names, then back), highlight with a ring or
  a dim of the rest, label with a short callout, each on its spoken cue.
- Never redraw or approximate the product's interface: what is shown of it is
  the capture.
