# Storyboard production: the next version of making a video

Agreed with the creator on 14–15 October 2026. Hyperframes' faceless-explainer
planning becomes the one structure for every scene of every episode; only how a
scene is built differs by its type. The studio stays a thin orchestrator over
Hyperframes 0.8.143: it plans with the agent, runs Hyperframes' own scripts and
CLI for everything deterministic, and keeps the creator in the loop.

## The levels

1. **Cards → series → episodes.** The map's cards (pages) are the root. A
   series plans its episodes from them: the creator's own episode ideas when
   they gave some, otherwise the agent groups the cards itself. New cards are
   placed into an episode or start a new one. Every episode can be changed.
2. **Episode → storyboard.** One plan per episode, written by the agent:
   - the message (one sentence, landing by frame 2), the audience;
   - the angle as one structure: concept, how-to, listicle or story, or a named
     compound;
   - the scenes: one per page of the episode, in order, each with a build type
     and the reason for it;
   - the frames: each with type (the eight Hyperframes types), persuasion
     technique, beat, scene line, voiceover (the page's script, verbatim, in
     cue-sized pieces), duration estimate, transition, candidate blueprint,
     narrative role and key message;
   - a `## Video direction` block written once.
3. **Scene build types.** `faceless` (invented visuals paced to the voice),
   `motion` (a design-led motion piece, catalog first), `camera` (the creator's
   take with designed overlays), `screen` (a product capture with callouts).
   A camera scene shows a placeholder to record or upload its lines; it waits
   for the take, and the other scenes keep going.
4. **Frames → shots → compositions.** Per scene, the agent writes each frame's
   time-coded shot sequence (blueprint, focal, roles, layout and motion inline),
   then one worker per frame builds its composition from a Hyperframes packet.

## Across episodes

- **Continuity and narrative.** The series holds one arc. Each episode knows
  its part of it, what the viewer saw last time ("previously"), the open
  threads, and what comes next. Its message serves the arc; its first and last
  frames carry the threads (a callback in, a hand-off out).
- **Length is an input.** The series sets each episode's length as a range
  and says whether it is strict (the plan must fit: a storyboard that runs over
  is refused and the agent cuts) or flexible (the range is a target, and the
  made video says where it landed). An episode can override it.
- **One brand.** The series' look (palette, fonts, logo) makes every
  episode's `frame.md`, so every episode looks and reads the same. The logo
  appears where the plan places it (an end card, a corner mark), never
  invented.

## The pipeline (one Hyperframes project per episode)

| Stage | Who | Output |
| --- | --- | --- |
| look | studio | `frame.md` from the notebook's look via `build-frame.mjs` |
| plan | agent (`storyboard-master`, Plan Episode) | plan JSON → `STORYBOARD.md`, `SCRIPT.md` |
| approve | creator | the proposal: message, scenes with build types, frame table |
| voice | studio | per-frame narration (the video's voice) or the scene's take, word timings, `audio_meta.json`, synced durations |
| shots | agent per scene (Design Shots) | time-coded shots added to each frame block |
| frames | one agent per frame (Build Frame) | `compositions/frames/NN-*.html` |
| assemble | studio | captions, `index.html`, transitions, `lint`, `check`, contact sheet; failing frames rebuilt with the findings |
| render | studio | `renders/video.mp4` → the video's produced file |

Upstream files are vendored byte for byte at the tag `v0.8.143`, with
provenance and blob ids checked by the test suite.

## Build order

1. Vendor the Hyperframes files; drive the pinned CLI and scripts.
2. The episode plan stage and its validation; `STORYBOARD.md` and `SCRIPT.md`.
3. Voice and takes; shots; frame workers; assembly; render; the stage machine.
4. The video page for a storyboard video, and the make dialog's choice.
5. Episode planning for a series from the map's cards.
6. Unit tests on every validator and writer; dev runs on Kimi K3; the final
   test on Opus 5.5 through Claude Code.
