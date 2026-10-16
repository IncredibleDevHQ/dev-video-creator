# Route: Plan Series

Outline one series from a content map's cards, the way a course is outlined
from its material: what a viewer can do by the end, the lines that run through
it, episodes in the order a viewer learns, and what the material doesn't cover.
Every episode later becomes one storyboard (Plan Episode).

## Read

1. `packet/SERIES.json`:
   - the series' `title` and what it is `about`;
   - `outcome` and `audience` (null when the creator gave none; then you
     propose them);
   - `directions`: the creator's own ideas for the series, each with an `id`,
     its `text`, and what it is `about` (the whole series, one episode, or
     some cards);
   - `length`: how long each episode runs, a range in seconds, and whether it
     is strict;
   - `episodes`: the episodes that exist, each with its id (`episode`), its
     `title`, its cards, `made` (true once its video has started) and `named`
     (true when the creator named it);
   - `last`: the last outline, when there was one: its through-lines, each
     episode's win and teachings, and its `gaps`, each with what the creator
     did with it (`state`: open, explained or ignored).
2. `packet/PAGES.json`: every drawn card, in the map's order. Each has its id,
   title, idea, `evidence` (lines from the source), `opens` (how its script
   begins), topic and `seconds` (about how long it runs when spoken).
3. `packet/SOURCE.md`: the source the map came from, with every note added
   since.
4. `hyperframes/skills/hyperframes-creative/references/story-spine.md` (value
   before evidence; every part traces to the message) and
   `hyperframes/skills/faceless-explainer/references/story-design.md` § 1
   (the teaching truth).

## Decide, top down

1. **Outcome and audience.** Complete "By the end, viewers can …" with
   something specific a viewer could show. Name who it is for and what they
   already know. Keep the creator's when given; propose them when not. A
   vague outcome makes a list of topics, not a series.
2. **Through-lines.** Read all the cards together: their ideas and evidence,
   not only their titles. Name one to four lines that run from episode to
   episode: a question that keeps coming back, an object the viewer follows,
   a number that changes. Each has an `id` (a short slug), a `name` (two to
   four words) and a `line` (one sentence).
3. **Episodes, in the order a viewer learns.** This is not the order the
   cards were written in.
   - Each episode has one message (`about`) and gives one `win`: what the
     viewer can do or understand after it.
   - `teaches` lists one to four things it introduces.
   - `needs` lists what it assumes. Each need comes `from` an earlier
     episode's number (one that teaches it) or names a `gap`. An episode
     never needs something a later one teaches.
   - The first episode gives an early win and a reason to watch the next.
     The middle lifts, with a payoff or a turn. The last lands the outcome.
   - Name episodes like chapters of a journey, not categories. An open
     episode's title is yours to change: when its cards change, name it for
     what it holds now, not for a card that moved away. A made episode keeps
     its title, and so does one the creator `named`.
   - Don't force episodes to the same size. Merge thin ones; split ones that
     carry two messages.
   - `carries` says what the episode picks up from the one before and hands
     to the next: the open loop.
   - `lines` lists the through-line ids it carries.
   - `pages` lists its cards' ids, in the order a viewer meets them.
4. **Every card once.** Each drawn card goes into exactly one episode, or into
   `left` with why it fits none.
5. **Episodes that exist.** Each appears once, with its `episode` id.
   - A **made** episode keeps its number and exactly its cards.
   - Open episodes you may move, rename and re-card freely.
   - New episodes have no `episode`.
6. **Gaps.** List what the series needs that no card covers: a prerequisite
   the cards assume, a step they skip, a payoff they promise. Each gap has:
   - an `id`;
   - what is `missing`;
   - the `episode` number that needs it;
   - `why` it matters;
   - `ask`: the question that would fill it, put to the creator.

   Never invent material to cover a gap. Up to eight gaps.

   When `last.gaps` is there, keep each gap's `id` while it still holds.
   - A gap the creator `ignored` stays out of `gaps`.
   - One they `explained` is covered by a line in its episode; name it again
     only if it is still needed, with the same id.
   - For each `open` gap you no longer list, say why in `resolved`: the card
     that covers it now, or why the series no longer needs it. Keep a gap
     while the audience would still need it; a card that names a thing is not
     a card that explains it.
7. **Directions.** Follow them wherever you can: their episodes, their order,
   their names, their emphasis. When two disagree, follow the more specific
   one (an episode's over the whole series'). Answer every one: `followed`,
   `partly` or `not`, with `why` in a line.
8. **The length.** Sum each episode's `seconds`. It must land inside the range
   when the length is strict, and near it when not. Split or merge episodes
   to get there.
9. **Check it as the viewer.** Read the outline as someone in the audience.
   Where would you be confused, bored (`slow`), `overloaded`, or lost because
   something is assumed (`assumes`)? Fix what you can in the plan. Flag what
   remains, at most six flags, each with its episode number and a line.

## Write and submit

Write `plan/series.json`:

```json
{
  "outcome": "By the end, viewers can run their own video pipeline on Cloudflare",
  "audience": "Developers who ship on Workers and have never processed video",
  "lines": [
    { "id": "lifecycle", "name": "The session that outlives", "line": "A session keeps running after the request that started it ends." }
  ],
  "episodes": [
    {
      "episode": "notebook-id-of-an-existing-episode",
      "title": "When streaming isn't enough",
      "about": "Managed streaming leaves cases you must build yourself.",
      "win": "Tell when a custom pipeline is worth building",
      "teaches": ["what managed streaming covers", "the cases it leaves"],
      "needs": [],
      "carries": "Opens the series; hands off the question of what a pipeline is made of.",
      "lines": ["lifecycle"],
      "pages": ["card-id-1", "card-id-2"]
    },
    {
      "title": "Two halves, three primitives",
      "about": "A pipeline is a container that outlives a Worker that controls it.",
      "win": "Sketch the pieces of a pipeline and what each does",
      "teaches": ["container", "orchestrator", "controller"],
      "needs": [{ "what": "the cases managed streaming leaves", "from": 1 }, { "what": "what a Durable Object is", "gap": "durable-objects" }],
      "carries": "Picks up why to build; hands off how the session stays alive.",
      "lines": ["lifecycle"],
      "pages": ["card-id-3"]
    }
  ],
  "gaps": [
    { "id": "durable-objects", "missing": "What a Durable Object is", "episode": 2, "why": "Episode 2's orchestrator is one, and no card says what it is", "ask": "In a line or two: what is a Durable Object, and why does the orchestrator need one?" }
  ],
  "overlaps": [{ "pages": ["card-id-4", "card-id-5"], "note": "Both explain the WebSocket preview" }],
  "left": [{ "page": "card-id-6", "why": "A product announcement, outside this series' story" }],
  "resolved": [{ "id": "deploy-steps", "why": "The new card “Deploy it to your account” covers it" }],
  "directions": [{ "id": "direction-id", "state": "followed", "why": "The security story now closes the series" }],
  "flags": [{ "episode": 2, "kind": "overloaded", "line": "Three new primitives in one episode" }]
}
```

Then call `storyboard_submit_series` with `projectDir` set to the run
directory. The studio checks it and puts it into the episodes:
- every made episode at its place, with its cards;
- every card once, or left with why;
- each need from an earlier episode or a gap;
- every gap of the last plan kept, or resolved with why;
- every direction answered;
- the length.
