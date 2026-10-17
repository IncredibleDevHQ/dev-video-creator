# Build types

Every scene is planned the same way (faceless-explainer frames). Its build
type says what carries the picture and what sets the clock. One episode may
use several; the studio keeps one design (`frame.md`), one voice, one caption
style and one transition grammar across all of them.

| Build | The picture | The clock | Upstream guidance |
| --- | --- | --- | --- |
| `faceless` | Invented visuals: type, diagrams, data, abstract graphics | The narration's words | `skills/faceless-explainer/references/visual-design.md` |
| `motion` | A design-led motion piece: kinetic type, a count-up, a chart hit, a logo build, a map; catalog blocks first | The beat, or the narration when there is one | `skills/motion-graphics/SKILL.md`, `skills/motion-graphics/references/` |
| `camera` | The creator's take, playing untouched, with designed cards over or beside it | The take: its own words and pauses | `skills/talking-head-recut/SKILL.md` (layouts, zones, styles) |
| `screen` | A captured product demo, playing untouched, with callouts, zooms and highlights | The capture, under the narration | `skills/hyperframes-creative/references/storyboard-recipe.md` § 2 (real proof is real) |

## Choosing (Plan Episode)

Choose by what the scene must do, then by what exists:

- **camera** for the hook, an opinion, a judgment call, a personal story, the
  close: where the creator's face is the evidence. Only when the brief allows
  the creator on camera. The creator records or uploads the scene's lines; the
  scene waits for the take while the rest is made.
- **screen** when the page shows the product working and a capture exists
  (the page lists it). Never invent a product's interface.
- **motion** for one idea that lands best as a single designed move: a number,
  a named concept, a short claim, a brand moment. Short scenes, one or two
  frames.
- **faceless** for everything that explains: mechanisms, steps, comparisons,
  evidence. The default.

Give the reason in one line (`buildReason`), in the scene's own terms ("the
page states the creator's verdict on the trade-off", not "variety").

## What changes downstream

- **faceless**: frames invent their hero (`focal`) and its elements
  (`roles`); type is often the primary visual.
- **motion**: the shot is one continuous design move per frame, built from a
  registry block or the motion vocabulary; the reveal still follows the line
  when there is one; no slide-like text blocks.
- **camera**: the take plays full frame or in a layout (`overlay`, `pip`,
  `split`, `stack` from talking-head-recut); cards carry a kicker, a number, a
  quote or a short claim the creator says, timed to their words; never a
  sentence of narration as text (the captions carry the words). The video
  element is muted; the take's sound is the voice track.
- **screen**: the capture plays muted under the narration; the shot names
  where to zoom, what to highlight and when, by the narration's cues.
