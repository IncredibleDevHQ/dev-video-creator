# One length window for a series

16 October 2026. The creator asked for a slider that decides how long a
series' videos run, with a series-wide minimum and maximum, strong enough to
shape episode planning, scene planning and the video, and modelled on how
HyperFrames handles length.

## What HyperFrames does

- **The target lives in the brief, nowhere else.** No CLI option sets a
  length. The brief's `length:` becomes the storyboard's advisory
  `duration:`.
- **Words follow time.** About 2.5 words a second is natural pace (15 s ≈ 37
  words, 60 s ≈ 150), and the script should feel shorter than the video
  (`hyperframes-creative/references/narration.md`).
- **The voice wins.** Each spoken frame lasts as long as its clip, and silent
  frames keep their planned seconds. Frames run back to back, and their sum
  becomes the video's length.
- **Drift is reported, never fixed.** Assembly warns past 10% from the
  target; nothing trims or splits.
- **Explainers have a sweet spot:** 30–90 s, rarely past 3 minutes. Pacing
  rules: a 3–5 s hook, one or two sentences a frame (6–20 words), and a held
  frame where the message lands.

## What the studio had

A window (`Series.length`, a minimum, a maximum and whether it is strict)
existed, but only as two number fields in the plan bar. It reached episode
planning and the storyboard brief's `length:`, and it was lost or ignored
after that:

- it was never a word budget;
- the scripts' own length decided nothing;
- the episodes' segues weren't counted;
- the length measured after voicing and after rendering was computed but
  never shown;
- saving the video's settings dropped the length.

## What changed

- **One slider, one set of rules** (`shared/length.ts`, `app/length-range.ts`):
  - two ends on stops that are fine where explainers live (15 s … 20 min),
    with the 30–90 s sweet spot drawn faintly on the track;
  - under it, the words the window allows and how many episodes the map's
    cards make;
  - a note past 3 minutes;
  - a Must fit toggle.
- **A series setting.** A chip on the series ("60–90 s each") opens the
  slider. Moving it marks each lane whose running time falls outside, live.
  Letting go saves it to every episode whose video hasn't started. The plan
  bar shows the same chip instead of number fields, and the make-video
  dialog uses the same slider for one video.
- **Segues are counted.** On the Stripe series, episodes spoke about 6 s of
  line into each card and about 9 s of close beyond their cards' scripts.
  Planning, organising and the lanes count both. The planner is told the
  allowance and about how many episodes the cards make at this length.
- **Episode planning.** The window decides the episode count. The series
  check uses the episode plan's own tolerance (a tenth under, a twentieth
  over). A card that alone runs past the longest is flagged, and
  organising warns, or refuses when strict, when new cards push an episode
  past it.
- **Scene planning.** The brief carries HyperFrames' pace and meets the
  length from the scripts:
  - spoken word for word and paced to land inside;
  - short of the window: keep every word, and reach the length with frames
    that breathe, a held frame and silent beats;
  - long and strict: cut to a word budget.

  The planner now reads `narration.md`. The plan check says how to reach a
  length that is too short instead of "cut or merge".

- **Video.** Once voiced in full, an episode that runs outside its window
  says so before a frame is built. The storyboard's length line marks too
  long or too short, and uses the made video's own length. Saving the
  video's settings keeps its length and how it is made.

## Live evidence (throwaway store, Claude Code on Opus 5.5)

- **The slider in the browser.** Dragging both ends to 60–90 s marked
  episodes 1–3 as running outside before the hand let go, and saved the
  window to every open episode.
- **Episode planning.** Planned again at 60–90 s, the Stripe series went
  from four episodes to six; the slider had said about six. Four landed
  inside the window. The planner flagged the two outside with its reason:
  a direction kept the whole retry policy in one episode (about 116 s), and
  merging the one-card episode (about 48 s) would push a neighbour past
  90 s.
- **Scene planning.** Episode 4's script runs about 48 s spoken. Its brief
  said so, and the storyboard was planned to 73.5 s with every word kept,
  frames given room and a silent held frame where the message lands.

## Not in this pass

- Card scripts are still written without a length target: the story
  planner could take one per card.
- Voice speed and pause length are not used to pull a voiced episode into
  its window.
- Strict windows don't re-plan automatically after voicing.
