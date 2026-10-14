# Route: Plan Series

Group a content map's pages (its cards) into the episodes of one series: an
arc with threads that run through it, and episodes that each tell one part
of it, in order. Every episode later becomes one storyboard (Plan Episode).

## Read

1. `packet/SERIES.json`: the series' title and what it is about, the creator's
   own ideas for episodes (`ideas`, possibly empty), the length each episode
   should run (`length`: a range in seconds, and whether it is strict), and the
   episodes that already exist (`kept`), each with its pages.
2. `packet/PAGES.json`: every drawn page of the map in the map's order: its
   id, title, idea, topic when grouped, and `seconds`, about how long its
   script runs when spoken.
3. `packet/SOURCE.md`: the source the map came from.
4. `hyperframes/skills/hyperframes-creative/references/story-spine.md` (value
   before evidence; every part traces to the message) and
   `hyperframes/skills/faceless-explainer/references/story-design.md` § 1
   (the teaching truth).

## Decide

1. **The arc**: the series' through-line in one sentence, and the threads
   (questions, objects, numbers) that run from episode to episode.
2. **The episodes**, in order. When the creator gave ideas, follow them: their
   episodes, their order, their names where they named them. Where they gave
   none, organise the pages yourself: each episode one part of the arc, one
   message, built from pages that belong together; earlier episodes set up what
   later ones need.
3. **Kept episodes stay**: list them first, in their order, with all their
   pages. A new page that belongs to one of them may be added at its end.
4. **Every page once.** Each drawn page goes into exactly one episode, except a
   page that fits none, which you leave out and name in `left`.
5. **The length.** Sum each episode's `seconds`: it must land inside the range
   when the length is strict, and near it when flexible. Split or merge
   episodes to get there.
6. For each episode: `title` (short), `about` (its message, one sentence),
   `carries` (what it picks up from the episode before and hands to the next),
   and `pages` (ids, in the order a viewer meets them).

## Write and submit

Write `plan/series.json`:

```json
{
  "arc": "From one request to a live pipeline, and what it costs to run",
  "threads": ["the frozen timer", "the cost of a minute"],
  "episodes": [
    {
      "title": "Why a request isn't enough",
      "about": "A stream outlives any request, so it needs a pipeline.",
      "carries": "Opens the series; hands off the question of how a frame travels.",
      "pages": ["page-id-1", "page-id-2"]
    }
  ],
  "left": []
}
```

Then call `storyboard_submit_series` with `projectDir` set to the run
directory. The studio checks it (every page once, kept episodes first, the
length) and makes the new episodes.
