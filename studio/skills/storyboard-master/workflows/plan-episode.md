# Route: Plan Episode

Turn one episode into its storyboard: the message, one structure, and the
frames of every scene, each with its job. This is faceless-explainer Step 3
(`skills/faceless-explainer/SKILL.md`), for an episode whose scenes are the
creator's pages and whose words are the creator's scripts.

## Read

1. `packet/BRIEF.md`: the episode, who it is for, its length (and whether it
   is strict), the series around it (arc, previously, threads, next), what the
   creator may be shown as (on camera or not), and any note from the creator.
2. `packet/PAGES.json`: the episode's pages in order. Each has its title, its
   script (`script`: the words spoken over it, exactly), what it carries
   (idea, kind, parts, beats, evidence), and whether a product capture exists.
   `packet/pages/<id>.svg` is the page as drawn, when you need its picture.
3. `packet/SOURCE.md`: the source the pages came from (information, not a
   template).
4. `packet/FRAME.md`: the episode's design. It tunes the voice, never the
   structure.
5. `packet/PREVIOUS.json`, when present: the plan the creator asked you to
   change, with their note in the brief. Change what they asked; keep the rest.
6. Upstream, in this order:
   - `skills/faceless-explainer/references/story-design.md` (the method: the
     teaching truth, the four structures, the frame sequence, the type enum,
     the hook strategies, the technique catalog, beats, continuity,
     transitions, script rules);
   - `skills/hyperframes-creative/references/story-spine.md` (hook language,
     value before evidence, the storyboard as a proposal, source-traceable
     visuals);
   - `skills/hyperframes-animation/blueprints-index.md` (the role → blueprint
     menu, for candidate blueprints);
   - [the build types](../references/build-types.md).

## Decide

1. **The teaching truth** of the episode: audience, the gap, the thesis (the
   `message`, one sentence written as a claim), the spine, the evidence, the
   landing. In a series, the message serves the arc's part for this episode.
2. **One structure** (`concept-explainer`, `how-to-process`, `listicle`,
   `story-explainer`, or a named compound such as `concept-explainer with
   process`). Name the hook strategy for the first seconds, from the nine.
3. **The scenes**: exactly the episode's pages, in their order, one scene each.
   Give each a build type and the reason (see build types). Camera only when
   the brief allows it; screen only when the page has a capture.
4. **The frames of each scene.** Cut the page's script into frames at sentence
   or clause boundaries, one job per frame, in order: the concatenated
   `voiceover` of a scene's frames must be its `script`, word for word. A page
   with no script gets lines you write: 6–20 words each, concrete, cue by cue.
   A silent frame (an empty `voiceover`) is allowed where a build holds or
   develops. For every frame set: `title`, `scene` (one visual idea, traced to
   the source), `voiceover`, `duration` (seconds; about 2.6 words a second plus
   a beat), `transition` (registry names only, 2–3 kinds in the whole episode,
   frame 1 `cut`), `type`, `persuasion` (a named technique), `beat` (a specific
   feeling), `blueprint` when a proven shape fits (an id from the index; omit
   otherwise), `narrativeRole`, `keyMessage`.
5. **Continuity.** The message lands by frame 2. Consecutive body frames share
   a stage and a seam. In a series, the first frame calls back to the previous
   episode and the last hands off to the next (`continuity`, one line). Keep
   to the length: the sum of the durations must fit the brief's range when it
   is strict.
6. **Video direction**, once for the episode: `palette` (which roles of
   `FRAME.md` carry what), `motion` (the grammar and the reveal model: each
   piece on its spoken cue, long-tail eases), `held` (which frames hold still,
   and why), `never` (what never appears, including the slideshow and the
   screensaver).

## Write and submit

Write `plan/episode.json`:

```json
{
  "message": "A request has a timer; a stream doesn't",
  "audience": "developers new to Cloudflare Stream",
  "structure": "story-explainer",
  "hook": "Stakes / consequence",
  "continuity": "Opens on last episode's frozen timer; hands off to the pipeline's cost.",
  "direction": {
    "palette": "...",
    "motion": "...",
    "held": "...",
    "never": "..."
  },
  "scenes": [
    {
      "pageId": "slide-id",
      "build": "camera",
      "buildReason": "The page is the creator's verdict on the trade-off.",
      "frames": [
        {
          "title": "The request runs out",
          "scene": "A request's countdown hits zero while the live picture keeps going",
          "voiceover": "Your request ended — your stream didn't.",
          "duration": 4,
          "transition": "cut",
          "type": "hook",
          "persuasion": "Before/after",
          "beat": "tension",
          "blueprint": "kinetic-type-beats",
          "narrativeRole": "Makes the limit felt before the fix is named.",
          "keyMessage": "A request has a timer; a stream doesn't."
        }
      ]
    }
  ]
}
```

Then call `storyboard_submit_plan` with `projectDir` set to the run directory.
The studio checks the plan (the pages and their order, every script spoken
word for word, the fields, the transitions, the length) and writes
`STORYBOARD.md` and `SCRIPT.md` from it. The creator then reviews it as a
proposal: "This video tells [audience] that [message]", and each frame's why.
