# Route: Place Pages

New cards landed on the content map after its series was planned. Place only
these cards, each where it builds best, so the series still builds episode by
episode. Everything else stays as it is.

## Read

1. `packet/SERIES.json`:
   - the series' `outcome` and `audience`;
   - its through-`lines`;
   - the `length` each episode runs;
   - the creator's `directions`, each with what it is about and, when a plan
     answered it, its `answer` (followed, partly or not, and why);
   - the open `gaps`: what the series needs that no card covered yet, and the
     episode that needs it.
2. `packet/EPISODES.json`: the episodes in order. Each has:
   - its `number` and id (`episode`);
   - its `title`;
   - `made` (true once its video has started);
   - its `win` and what it `teaches`;
   - its cards (`pages`, each with id and title);
   - `seconds`, about how long it runs.
3. `packet/NEW.json`: the new cards. Each has its id, title, idea,
   `evidence`, `opens` (how its script begins) and `seconds`. A card with
   `fills` came from a note that answers that open gap.

## Decide

For each new card, one move:

- **`into`** an open episode (its id), **`after`** one of its cards (its id),
  or `after: null` to open the episode. Put it where a viewer meets it best:
  it must not need something only a later episode teaches.
- **`start`** a new episode (its `key` in `start`) when the new cards open a
  part of their own. A new episode goes after the last made episode, with
  `after` naming the episode it follows.
- **`closes`**: when a card fills an open gap, name the gap too, and put the
  card into the episode that needed it. A card with `fills` closes that gap
  unless it plainly doesn't answer it.
- **`left`: true**, with why, when it fits nothing in this series.

Never change a made episode. If a card belongs in a made episode, start a new
episode after it instead. Keep each episode near the length: when a card would
make one run long, start a new episode.

Every move has `why` in a line. A new episode has a `title`, `about` (its
message), `win`, `teaches`, `carries`, its through-`lines` and `after`.

When your moves change how a direction stands (a new card gives an episode
the opening a direction asked for, or fills what it was waiting on), answer
it again in `answers`: `followed`, `partly` or `not`, with `why`. Leave out
the directions your moves don't touch.

## Write and submit

Write `plan/place.json`:

```json
{
  "moves": [
    { "page": "new-card-1", "into": "episode-id", "after": "card-id", "why": "It shows the cost the episode's win depends on" },
    { "page": "new-card-2", "into": "episode-id", "after": null, "closes": "durable-objects", "why": "It explains the Durable Object episode 2 needs" },
    { "page": "new-card-3", "start": "k1", "why": "Pricing opens a part of its own" },
    { "page": "new-card-4", "left": true, "why": "A hiring post, outside this series" }
  ],
  "answers": [
    { "id": "direction-id", "state": "followed", "why": "Episode 2 now opens on the outage story" }
  ],
  "start": [
    { "key": "k1", "title": "What a minute costs", "about": "Running a pipeline has a price per minute.", "win": "Estimate what a pipeline costs to run", "teaches": ["per-minute pricing"], "carries": "Picks up the live pipeline; closes the series on cost.", "lines": ["lifecycle"], "after": "episode-id" }
  ]
}
```

Then call `storyboard_submit_placement` with `projectDir` set to the run
directory. The studio checks that every new card is placed once, made episodes
are untouched, new episodes come after the last made one, and gaps are real.
Then it places them.
