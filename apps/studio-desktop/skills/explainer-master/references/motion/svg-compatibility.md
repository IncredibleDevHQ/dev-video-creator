# SVG Compatibility

> Adapted from diffusionstudio/lottie `skills/text-to-lottie/references/svg-compatibility.md`
> at commit 3c72912fad543897f90045ed4d355813837927fc (MIT; LICENSE alongside).
> This copy targets the Studio's native SVG/SMIL runtime: its player is the
> production Chromium renderer, and object clips are finite SMIL animations on
> real named parts. Where the original says "Skottie" or "Lottie", read "the
> Studio renderer"; the verification frames are the review captures, not an
> upstream player.

Use this reference whenever the source artwork is SVG — which is always, for
Quiver objects — and before animating one.

## Prevention-first intake

- Inspect the `viewBox`, width, height, coordinate origin, groups, masks,
  gradients, style attributes, and text before animating.
- Preserve the asset's viewBox; place and scale the object in the scene
  around it.
- Quiver artwork arrives self-contained; keep it that way: no external
  classes, web fonts, CSS variables, remote references, or scripts.
- Keep group and part names meaningful when binding behaviors — the part map
  is the contract the scene program plays against.
- Compare the resting artwork against the accepted library original before
  finishing; an adaptation must not silently redraw it.

## Geometry cleanup

- Resolve nested transforms into path/group coordinates when the scene's
  motion driver must address a part directly.
- Keep strokes as strokes when the stroke is the drawing (a trace, a route);
  a trim-style reveal is authored as a finite SMIL dash animation with a
  numeric duration, never a wall-clock loop.
- Flatten only structure-free wrapper groups; keep the named parts and ports
  the role record requires.
- Avoid fragile boolean intersections when a simple separate path stack is
  visually equivalent.

## Fill rules and compound paths

- Watch self-intersections, compound paths, and holes. Even-odd and non-zero
  fill rules render differently across renderers; keep the asset's own
  `fill-rule` unless you measured the change.
- If a shape relies on overlapping subpaths to cancel areas, split or rebuild
  it into simpler visible shapes before animating near it.
- Verify holes at frame 0, during the action, and at the settled frame.

## Masks, clips, gradients, and effects

- Use a mask or clip only when a path morph would be unsafe — a discrete
  state replacement is often clearer.
- If a mask moves, check all masked frames for popping or disappearing
  content.
- Prefer simple linear/radial gradients already present in the asset; do not
  add renderer-specific filters, blurs, or blend modes.
- Align crisp icon geometry to avoid fuzzy fractional-pixel edges at the
  planned display size.

## Text and morphing

- Text in a scene belongs to the scene, not the object: artwork keeps text
  out (the brief's `keepsTextOut`); labels are scene `<text>` elements.
- Avoid path morphing unless source and target paths have compatible vertex
  structure and direction; otherwise use a mask, a crossfade, or a discrete
  replacement.

## Renderer differences

- The Studio renderer is the source of truth: the hidden-window review and
  the production export use the same compiler and driver. A result working
  in another renderer is not proof it works here.
- Prefer explicit fills, simple masks, local assets, and few renderer-specific
  features.

## Animation strategy

- Animate semantic parts (gate, contents, status light, port, queue slots),
  never arbitrary path fragments.
- For diagrams, preserve reading order and trace paths in the direction users
  should understand them.
- First identify what should move to show the behavior: part drawing, reveal
  masks, layer assembly, color/state transition, or transform choreography.
- Keep the scene's background still by default; motion belongs to the object
  performing its job.

## Verification

- Compare the resting artwork against the accepted original at matching
  scale, then the action midpoint, then the settled frame.
- Look for holes filling incorrectly, clipped strokes, gradient jumps, masked
  areas disappearing, and intersections rendering differently than the
  source.
- The effect marker is where the depiction aligns with the scene's semantic
  event; check that frame in the in-scene review, not only in isolation.
