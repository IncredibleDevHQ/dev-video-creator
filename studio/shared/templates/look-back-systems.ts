// More stories that look back, about how systems grow and change: scaling,
// cutting the bill, a rewrite and a game day. Each table row is a slot:
// id | role | seconds | type | speaker | sketch | seam | move | builds.
import { variant, type TemplateStory } from './model'

export const SYSTEMS_STORIES: TemplateStory[] = [
  {
    id: 'scaling',
    group: 'look-back',
    name: 'Scaling story',
    line: 'How the system grew from thousands to millions, one wall at a time.',
    audience: 'Engineers who will hit the same walls'
  },
  {
    id: 'cost',
    group: 'look-back',
    name: 'Cost cut',
    line: 'How you cut the bill, change by change, and what it cost you.',
    audience: 'Engineers and the people who pay the bill'
  },
  {
    id: 'rewrite',
    group: 'look-back',
    name: 'Rewrite story',
    line: 'Why you rewrote it, how you made it safe, and whether it was worth it.',
    audience: 'Engineers weighing a rewrite'
  },
  {
    id: 'gameday',
    group: 'look-back',
    name: 'Game day',
    line: 'Breaking things on purpose, and what it taught you.',
    audience: 'Teams building for reliability'
  },
  {
    id: 'tech-debt',
    group: 'look-back',
    name: 'Tech debt paydown',
    line: 'The interest you were paying, how you chose what to fix, and what improved.',
    audience: 'Engineers and the people who plan their time'
  },
  {
    id: 'readiness',
    group: 'look-back',
    name: 'Peak readiness',
    line: 'Getting ready for the biggest day of the year, and how it went.',
    audience: 'Teams facing a launch, a sale or a big event'
  }
]

export const SYSTEMS_TEMPLATES = [
  variant(
    {
      id: 'scaling-walls',
      story: 'scaling',
      name: 'Wall by wall',
      tagline: 'Each bottleneck, and what broke it',
      purpose:
        'Growth told as the walls you hit: the curve, the first bottleneck and its fix, the next one in the profile, the architecture today, and what you would do sooner.',
      tone: 'Measured',
      pacing: 'Milestone by milestone',
      cover: 'curve'
    },
    `
curve | The curve | 12 | data | off | scaling | cut | Users climbing, the milestones pinned, the servers multiplying. | chart-scrub-readout counting-dynamic-scale
first-wall | First wall | 20 | explainer | off | overload | zoom | The first bottleneck: one part overheats. | reactive-displacement
first-fix | The fix | 20 | explainer | corner | layers | push | The fix, layer by layer, with you in the corner. | multi-phase-camera pip-pill
next-wall | Next wall | 20 | data | off | flame | zoom | The next bottleneck, in the profile. | coordinate-target-zoom
today | Today | 15 | explainer | off | c4zoom | push | The architecture today, from the map down. | multi-phase-camera
sooner | Sooner | 10 | speaker | beside | recap | end | What you would do sooner, beside you. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'scaling-number',
      story: 'scaling',
      name: 'The big number',
      tagline: 'The number behind you, then how',
      purpose:
        'The punchy version: the scale beside your face, the growth curve, the bottleneck that almost broke it, the fix, and one lesson in captions.',
      tone: 'Bold',
      pacing: 'Fast',
      cover: 'number'
    },
    `
number | The number | 8 | speaker | over | behind | cut | The scale you reached stands giant behind you: one database, millions of users. | remove-background 3d-text-depth-layers counting-dynamic-scale
growth | Growth | 15 | data | off | scaling | push | The growth curve, the milestones pinned. | chart-scrub-readout
almost | Almost broke | 20 | explainer | off | fault | zoom | The bottleneck that almost broke it. | svg-path-draw
fix | The fix | 20 | explainer | off | seqreveal | push | The fix, part by part. | spatial-pan-stations
lesson | Lesson | 8 | captions | over | headcaps | end | The lesson in captions over you. | caption-editorial-emphasis
`
  ),
  variant(
    {
      id: 'cost-steps',
      story: 'cost',
      name: 'Change by change',
      tagline: 'The bill, each change, what it saved',
      purpose:
        'How you cut the bill: the bill and its biggest line, the cost stepping down with each change, the change that saved the most, the trade-offs, and the habits that keep it down.',
      tone: 'Practical',
      pacing: 'Change by change',
      cover: 'curve'
    },
    `
bill | The bill | 12 | data | off | invoice | cut | The monthly bill, its biggest line marked. | grid-card-assemble
curve | Each change | 25 | data | off | costdown | push | The cost steps down with each change. | chart-scrub-readout
biggest | The biggest win | 20 | code | off | diff | push | The one change that saved the most. | css-marker-patterns
tradeoffs | What it cost us | 15 | motion | off | limits | push | The trade-offs, on honest cards. | split-tilt-cards
habits | Habits | 10 | speaker | beside | checklist | end | The habits that keep it down, beside you. | talking-head-recut
`
  ),
  variant(
    {
      id: 'cost-number',
      story: 'cost',
      name: 'The saving',
      tagline: 'The saving first, then the three changes',
      purpose:
        'The saving first, beside your face, then the bill, the curve stepping down, the single biggest change, and one lesson in captions.',
      tone: 'Upbeat',
      pacing: 'Number first',
      cover: 'number'
    },
    `
number | The saving | 8 | speaker | over | headline | cut | The saving, set beside your face. | kinetic-beat-slam counting-dynamic-scale
bill | The bill | 12 | data | off | invoice | push | The bill’s biggest lines. | grid-card-assemble
curve | The curve | 20 | data | off | costdown | push | The cost steps down, change by change. | chart-scrub-readout
biggest | Biggest win | 15 | code | off | diff | push | The one change that saved the most. | css-marker-patterns
lesson | Lesson | 8 | captions | over | headcaps | end | One lesson in captions over you. | caption-editorial-emphasis
`
  ),
  variant(
    {
      id: 'rewrite-race',
      story: 'rewrite',
      name: 'Old against new',
      tagline: 'The pain, the port, the same load on both',
      purpose:
        'A rewrite told with evidence: the old pain in one chart, why tuning was not enough, the port, the same load on old and new, shadow traffic before the switch, and the surprises.',
      tone: 'Evidence-led',
      pacing: 'Chart, code, race',
      cover: 'race'
    },
    `
pain | The old pain | 10 | data | off | spike | cut | The old pain in one chart: a stall every two minutes. | chart-scrub-readout
tuning | Why tuning failed | 15 | motion | off | limits | push | Each fix you tried, flipped to why it was not enough. | split-tilt-cards
port | The port | 20 | code | off | diff | push | The same function, in the old language and the new. | css-marker-patterns
race | Side by side | 15 | data | off | race | push | The same load on both: a spiky line against a flat one. | comparison-split
shadow | Shadow traffic | 15 | explainer | off | traffic | hold | Traffic copied to the new one before the switch. | camera-journey
surprises | Surprises | 10 | motion | off | ticklist | end | What surprised you on the way. | waterfall-entry
`
  ),
  variant(
    {
      id: 'rewrite-honest',
      story: 'rewrite',
      name: 'Was it worth it?',
      tagline: 'Told to camera, the honest version',
      purpose:
        'The honest rewrite story: why you did it, what you underestimated, the plan, what you got, and whether you would do it again, set beside your face.',
      tone: 'Candid',
      pacing: 'Talk, then show',
      cover: 'underestimated'
    },
    `
why | Why | 10 | speaker | full | lowerthird | cut | You, full frame: why you rewrote it. | lower-third talking-head-recut
underestimated | Underestimated | 20 | captions | over | headcaps | cut | What you underestimated, captioned. | caption-editorial-emphasis asr-keyword-glow
plan | The plan | 20 | explainer | corner | phases | push | The plan, phase by phase, with you in the corner. | svg-path-draw pip-pill
got | What we got | 15 | data | off | race | push | Old against new. | comparison-split
again | Again? | 8 | speaker | over | headline | end | Would you do it again? Your answer, beside your face. | kinetic-beat-slam
`
  ),
  variant(
    {
      id: 'gameday-report',
      story: 'gameday',
      name: 'Experiment report',
      tagline: 'Hypothesis, blast radius, result',
      purpose:
        'A chaos experiment written up: the hypothesis, the blast radius, the experiment, what actually happened, what you fixed, and the next one.',
      tone: 'Scientific',
      pacing: 'Step by step',
      cover: 'experiment'
    },
    `
hypothesis | Hypothesis | 10 | motion | off | kinetic | cut | What you expected, in a few words. | kinetic-type-beats
radius | Blast radius | 15 | explainer | off | c4zoom | zoom | The part of the system at risk, on the map. | multi-phase-camera
experiment | The experiment | 20 | explainer | off | chaos | hold | A zone is killed; traffic finds its way round. | svg-path-draw
happened | What happened | 15 | data | off | spike | push | What the graphs showed. | chart-scrub-readout
fixed | Fixed | 15 | motion | off | ticklist | push | What you fixed afterwards. | waterfall-entry
next | Next | 10 | speaker | beside | recap | end | The next experiment, beside you. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'gameday-live',
      story: 'gameday',
      name: 'War room',
      tagline: 'Breaking it live, told to camera',
      purpose:
        'The game day as it happened: the plan beside your face, the kill, the page and the clock, the recovery, and the verdict.',
      tone: 'Tense, fun',
      pacing: 'Live feel',
      cover: 'kill'
    },
    `
plan | The plan | 8 | speaker | over | headline | cut | What you are about to break, set beside your face. | kinetic-beat-slam
kill | The kill | 15 | explainer | off | chaos | cut | The zone goes down. | svg-path-draw
clock | The clock | 15 | captions | over | alert | cut | The page arrives; the clock runs. | caption-kinetic-slam lower-third
recovery | Recovery | 15 | explainer | off | recover | push | Services recover in turn. | waterfall-entry
verdict | Verdict | 8 | captions | over | headcaps | end | Did it hold? In captions. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'debt-burndown',
      story: 'tech-debt',
      name: 'Burn-down',
      tagline: 'The hotspots cool, the backlog shrinks',
      purpose:
        'Tech debt made visible: the interest you were paying, the inventory, how you ranked it by impact and effort, how you paid it down, and the hotspots cooling.',
      tone: 'Pragmatic',
      pacing: 'Inventory, choice, progress',
      cover: 'hotspots'
    },
    `
interest | The interest | 10 | data | off | bignumber | cut | The hours a week the old decisions cost you. | counting-dynamic-scale
inventory | The inventory | 15 | motion | off | ticklist | push | The debt, listed. | waterfall-entry
ranked | Ranked | 20 | data | off | matrix | push | Each item scored by impact and effort; the cheap big wins light up. | grid-card-assemble
paydown | Paying it down | 20 | code | corner | diff | push | One fix, as a diff, with you in the corner. | css-marker-patterns pip-pill
hotspots | Hotspots | 15 | data | off | heatmap | push | The code hotspots cool from red to green. | stat-bars-and-fills
improved | What improved | 10 | speaker | beside | recap | end | What got better, beside you. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'debt-interest',
      story: 'tech-debt',
      name: 'The interest',
      tagline: 'A third of the week, and how you got it back',
      purpose:
        'The punchy version: the share of the week lost to old decisions beside your face, the hotspots, the one fix that paid most, and the rule you now follow.',
      tone: 'Direct',
      pacing: 'Fast',
      cover: 'hotspots'
    },
    `
share | The share | 8 | speaker | over | headline | cut | The share of every week lost to old decisions, beside your face. | kinetic-beat-slam
hotspots | The hotspots | 15 | data | off | heatmap | push | Where the debt lives, cooling as you pay it down. | stat-bars-and-fills
best-fix | The best fix | 15 | code | off | diff | push | The one fix that paid back the most. | css-marker-patterns
rule | The rule | 8 | captions | over | headcaps | end | The rule you follow now, captioned. | caption-editorial-emphasis
`
  ),
  variant(
    {
      id: 'readiness-countdown',
      story: 'readiness',
      name: 'Countdown',
      tagline: 'Forecast, load tests, the day itself',
      purpose:
        'Readiness as a countdown: the date, the forecast, load tests ramped until something broke, the fixes, the game day, and the day itself against the forecast.',
      tone: 'Building tension',
      pacing: 'Countdown',
      cover: 'day'
    },
    `
date | The date | 8 | speaker | over | headline | cut | The date and the traffic you expect, beside your face. | kinetic-beat-slam
forecast | The forecast | 15 | data | off | scaling | push | The forecast curve, the peak pinned. | chart-scrub-readout
load | Load tests | 20 | explainer | off | overload | zoom | The load ramps until one part breaks. | reactive-displacement
fixes | Fixes | 15 | motion | off | ticklist | push | What you fixed before the day. | waterfall-entry
day | The day | 15 | data | off | countdown | hold | The day itself: actual traffic against the forecast. | chart-scrub-readout
next | Next year | 8 | captions | over | headcaps | end | What you will do differently next year, captioned. | caption-editorial-emphasis
`
  ),
  variant(
    {
      id: 'readiness-report',
      story: 'readiness',
      name: 'After action',
      tagline: 'How the day went, chart by chart',
      purpose:
        'The calm report after the day: what you planned for, the actual traffic against the forecast, what held, what wobbled, and the lessons.',
      tone: 'Even',
      pacing: 'Chart by chart',
      cover: 'actual'
    },
    `
planned | What we planned for | 12 | motion | off | ticklist | cut | The plan: capacity, freezes, people on call. | waterfall-entry
actual | Actual against forecast | 25 | data | off | countdown | hold | The day’s traffic against the forecast. | chart-scrub-readout
held | What held | 15 | explainer | off | calm | push | The parts that held, calm under the load. | svg-path-draw
wobbled | What wobbled | 15 | data | off | spike | push | The one wobble, and how long it lasted. | chart-scrub-readout
lessons | Lessons | 10 | speaker | beside | checklist | end | The lessons, ticked in beside you. | talking-head-recut
`
  )
]
