# Route: Design Shots

Design how every frame of one scene looks and moves: faceless-explainer Step 4
(`skills/faceless-explainer/SKILL.md`), for one scene of the episode. You
write each frame's **time-coded shot sequence**; you write no HTML.

## Read

1. `packet/SCENE.json`: the scene's build type and why, its frames (title,
   scene line, voiceover, type, persuasion, beat, candidate blueprint,
   narrative role, key message), each frame's **measured duration** and its
   **spoken words with their times** inside the frame, the scenes before and
   after it, and each frame's **approved still** (`still`, a picture under
   `packet/stills/`) when it has one.
2. `packet/DIRECTION.md`: the episode's message, structure and `## Video
   direction` (palette roles, motion grammar, held frames, never). Every frame
   inherits it; your windows carry only the delta.
3. `packet/FRAME.md`: the design truth. Name colours and type by role, never
   by value.
4. Upstream:
   - `skills/faceless-explainer/references/visual-design.md` (the method: the
     unit is a time-coded shot; pace reveals to the voiceover, never
     front-load; pick the shape from a blueprint; focal and roles; layout
     inline; the caption band);
   - `skills/hyperframes-animation/blueprints-index.md`, then
     `skills/hyperframes-animation/blueprints/<id>.md` for each blueprint you
     instantiate (its slots and its signature move);
   - `skills/faceless-explainer/references/motion-language.md` and
     `skills/hyperframes-animation/rules-index.md` (motion names; do not invent
     them);
   - `skills/faceless-explainer/references/cut-catalog.md` (seams inside a
     frame);
   - [the build types](../references/build-types.md), and for this scene's
     build: `skills/talking-head-recut/references/DESIGN_INDEX.md` and
     `references/layouts/` (camera), or `skills/motion-graphics/references/`
     (motion).

## Design

A frame with a `still` has a layout the creator approved: look at the
picture first. Its placement, copy and sizes are settled; your shot stages
how the frame arrives at that picture on the voice's cues and holds it. Name
the still's own elements in `focal`, `roles` and the windows, and choose the
blueprint whose motion fits the layout; never a different layout.

For every frame of the scene:

- **blueprint**: the id you instantiate with its posture, `<id> (Reproduce)`
  or `<id> (Adapt)`, or `compose` when no blueprint fits. An Adapt keeps the
  signature move and says what it keeps and changes in `adapt`.
- **focal**: the hero of the beat. Faceless and motion: the invented element
  (a hero word, a diagram node, a chart series). Camera: the creator, or the
  card when it takes the frame. Screen: the part of the product the frame is
  about.
- **roles**: each element and its role (foreground subject, background dimmed
  30–50%, supporting), few and load-bearing.
- **windows**: the shot, as consecutive windows from `0` to the frame's
  duration, one per spoken cue: each says what is on screen, what moves, and
  where it sits (layout inline). Use the word times: a piece appears when its
  word is spoken, spread across the back half, and the frame ends on a held
  read. A silent frame paces to its beat. Camera: the take plays throughout;
  windows say the layout (`overlay`, `pip`, `split`, `stack`) and when each
  card enters and leaves, on the creator's words. Screen: the capture plays;
  windows say where to zoom and what to highlight, on the narration's cues.

Keep content in the top 83% (the captions own the bottom band). Vary framing
across the scene; never the same framing twice in a row.

## Write and submit

Write `plan/shots.json`:

```json
{
  "frames": [
    {
      "number": 3,
      "blueprint": "dataviz-countup (Adapt)",
      "adapt": "Keep the count-up ring; the trend chart becomes the snowball's rings.",
      "focal": "the snowball",
      "roles": "snowball = foreground subject · hill = background (dim ~40%) · ring labels = supporting",
      "windows": [
        { "from": 0, "to": 1.2, "text": "Solid hill gradient (dim ~40%); the snowball seats upper-left with a progress ring — centered, ~50% of frame." },
        { "from": 1.2, "to": 3.4, "text": "On each spoken turn the snowball rolls and gains a labelled ring (layer-reveal); the total counts up beside it." },
        { "from": 3.4, "to": 5.0, "text": "The final ring lands dead-centre, accent glow blooms, and the total holds still." }
      ]
    }
  ]
}
```

Then call `storyboard_submit_shots` with `projectDir` set to the run directory.
The studio checks every frame (its blueprint, its windows from 0 to its
duration, its focal and roles) and adds the shots to `STORYBOARD.md`.
