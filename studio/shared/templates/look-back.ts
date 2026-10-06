// Stories that look back: an incident, a bug hunt, a performance win, a
// migration, a security advisory and a retrospective. Each table row is a
// slot: id | role | seconds | type | speaker | sketch | seam | move | builds.
import { variant, type TemplateStory } from './model'

export const LOOK_BACK_STORIES: TemplateStory[] = [
  {
    id: 'incident',
    group: 'look-back',
    name: 'Incident walkthrough',
    line: 'What users felt, what happened when, why, and what changes now.',
    audience: 'Your team, or your customers'
  },
  {
    id: 'debugging',
    group: 'look-back',
    name: 'Debugging story',
    line: 'A bug hunt told as a mystery: the symptom, the suspects, the culprit.',
    audience: 'Engineers who like a good hunt'
  },
  {
    id: 'performance',
    group: 'look-back',
    name: 'Performance win',
    line: 'How you made it faster, why the number moved, and where it does not hold.',
    audience: 'Engineers who care about speed'
  },
  {
    id: 'migration',
    group: 'look-back',
    name: 'Migration story',
    line: 'Moving a live system without stopping it: why, how, and what broke.',
    audience: 'Teams facing the same move'
  },
  {
    id: 'security',
    group: 'look-back',
    name: 'Security advisory',
    line: 'A vulnerability explained: who is affected, how it works, what to do now.',
    audience: 'Your users and their security teams'
  },
  {
    id: 'retro',
    group: 'look-back',
    name: 'Retrospective',
    line: 'A year, a project or a quarter: what you learned, told honestly.',
    audience: 'Your team and the people who follow your work'
  }
]

export const LOOK_BACK_TEMPLATES = [
  variant(
    {
      id: 'incident',
      story: 'incident',
      name: 'Timeline',
      tagline: 'A blameless postmortem your team can act on',
      purpose:
        'An internal postmortem: what users felt, what happened when, why, and what changes now.',
      tone: 'Blameless, factual',
      pacing: 'Steady; the timeline carries it',
      cover: 'timeline'
    },
    `
impact | Impact | 15 | data | off | spike | cut | The error line spikes while minutes and failed requests count up. | dataviz-countup chart-scrub-readout
timeline | Timeline | 35 | explainer | off | scrub | match | A playhead scrubs through the hour, starting before the trigger; events pin, and the false lead greys out. | chart-scrub-readout waterfall-entry
root-cause | Root cause | 40 | explainer | corner | fault | hold | The bad change travels the graph; each service changes state as it is hit. | svg-path-draw
fix | Fix and follow-ups | 35 | explainer | corner | recover | push | Services recover in reverse order; follow-ups stack up with their owners. | waterfall-entry
lesson | Lesson | 25 | speaker | full | speaker | end | The author, full frame, with one lesson in a lower third. | talking-head-recut lower-third
`
  ),
  variant(
    {
      id: 'engineering-story',
      story: 'incident',
      name: 'Told as a story',
      tagline: 'A public postmortem, told as a story',
      purpose:
        'A public postmortem or case study: the moment it broke, a normal day, the cascade, the hunt, the safeguard.',
      tone: 'Narrative, honest',
      pacing: 'Cold open, then building',
      cover: 'cold-open'
    },
    `
cold-open | Cold open | 10 | motion | off | status | cut | The status flips red; the numbers that mattered count up. | ticker-takeover counting-dynamic-scale
normal-day | A normal day | 25 | explainer | off | calm | hold | How it usually works: a calm, healthy flow through the system. | svg-path-draw
cascade | The cascade | 35 | explainer | off | fault | zoom | The change lands, and the failure spreads in step with the clock. | chart-scrub-readout
finding-it | Finding it | 30 | code | off | logzoom | cut | Zoom into the log line, then the change that caused it. | coordinate-target-zoom
safeguard | The safeguard | 30 | explainer | off | safeguard | push | The new safeguard drops in and catches the replayed fault. | physics-press-reaction
for-you | What it means for you | 20 | speaker | full | speaker | end | The engineer, full frame, with one line for customers. | talking-head-recut
`
  ),
  variant(
    {
      id: 'incident-anchor',
      story: 'incident',
      name: 'Anchor desk',
      tagline: 'You report it like the news, apology first and last',
      purpose:
        'A public bulletin from the anchor desk: what users saw, said plainly, how the system works, what broke, the timeline over your shoulder, the fixes, and the apology to camera.',
      tone: 'Calm authority',
      pacing: 'Headline, then the story',
      cover: 'timeline'
    },
    `
users | What users saw | 10 | speaker | over | headline | cut | What users saw, said plainly, the headline number beside your face. | kinetic-beat-slam counting-dynamic-scale
normally | How it works | 20 | explainer | off | calm | match | How the system normally works, calm and healthy. | svg-path-draw
broke | What broke | 30 | explainer | corner | fault | zoom | The diagram takes the frame; the failure spreads while you narrate from the corner. | svg-path-draw pip-pill
timeline | Timeline | 25 | explainer | beside | anchor | hold | Over your shoulder, the timeline builds, minute by minute. | side-panel chart-scrub-readout talking-head-recut
fixes | What we changed | 20 | code | beside | diff | push | The fixes as a diff beside you. | css-marker-patterns split
sorry | To our users | 15 | captions | over | headcaps | end | The apology and the promise, in captions over you. | caption-editorial-emphasis embedded-captions
`
  ),
  variant(
    {
      id: 'incident-thriller',
      story: 'incident',
      name: 'Thriller',
      tagline: 'The pager, the clock, the hunt',
      purpose:
        'The incident as a thriller where the system is the villain: the page over your face with the clock in a lower third, the stakes, the hunt, the twist to camera, the fix and what changed for good.',
      tone: 'Tense, then relieved',
      pacing: 'Fast cuts against the clock',
      cover: 'page'
    },
    `
page | The page | 8 | captions | over | alert | cut | The pager fires: the alert over your face, the UTC clock in a lower third. | caption-kinetic-slam lower-third
stakes | The stakes | 12 | data | off | spike | cut | Errors climb while the minutes count. | dataviz-countup chart-scrub-readout
hunt | The hunt | 30 | explainer | off | fault | zoom | The failure spreads in step with the clock. | chart-scrub-readout svg-path-draw
twist | The twist | 15 | captions | over | jumpcut | cut | The cause, told to camera with a punch-in. | coordinate-target-zoom caption-kinetic-slam
fix | The fix | 20 | code | corner | diff | push | The fix as a diff, with you in the corner. | css-marker-patterns pip-pill
since | Ever since | 15 | captions | over | headcaps | end | What changed for good, captioned over you. | caption-editorial-emphasis asr-keyword-glow
`
  ),
  variant(
    {
      id: 'debug-whodunit',
      story: 'debugging',
      name: 'Whodunit',
      tagline: 'Suspects crossed out until one is left',
      purpose:
        'A bug hunt as a mystery: the impossible symptom, the suspects crossed out, the clue that did not fit, the culprit in the code, the fix, the guardrail and the moral.',
      tone: 'Playful suspense',
      pacing: 'Clue by clue',
      cover: 'suspects'
    },
    `
symptom | The symptom | 10 | motion | off | status | cut | The impossible symptom, stated flat: fine flips to failing. | ticker-takeover counting-dynamic-scale
suspects | The suspects | 30 | motion | off | suspects | cover | Each hypothesis gets a card; the dead ends are crossed out. | grid-card-assemble
clue | The clue | 20 | code | off | logzoom | zoom | Zoom into the log line that did not fit. | coordinate-target-zoom
culprit | The culprit | 25 | code | corner | codehl | hold | The guilty lines light up while you explain from the corner. | css-marker-patterns pip-pill
fix | The fix | 15 | code | off | diff | push | The fix as a diff, short and sweet. | css-marker-patterns
guardrail | The guardrail | 15 | explainer | off | safeguard | push | The test that stops it coming back catches a replay. | physics-press-reaction
moral | The moral | 10 | speaker | beside | recap | end | The lesson in three lines beside you. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'debug-screencast',
      story: 'debugging',
      name: 'Over my shoulder',
      tagline: 'The hunt on screen, your camera in a bubble',
      purpose:
        'Debugging as you did it: the bug reproduced on screen, the terminal, the line, the fix proved by a clean run, your camera in a bubble throughout, and one lesson to camera.',
      tone: 'Hands-on, unpolished',
      pacing: 'Real time, trimmed',
      cover: 'repro'
    },
    `
repro | Reproduce it | 20 | capture | corner | bubble | cut | The bug on screen, your camera in a bubble. | pip-pill camera-cursor-tracking
dig | Dig in | 35 | code | corner | bubbleterm | match | The terminal: commands, output, the odd line. | typewriter-reveal pip-pill
found | Found it | 25 | code | corner | codehl | zoom | Zoom into the line; your bubble stays with you. | coordinate-target-zoom pip-pill
prove | Fix and prove | 20 | capture | corner | stream | push | Run it again: the output streams clean. | transcript-scroll-artifact-reveal
lesson | One lesson | 10 | captions | over | headcaps | end | Full frame, the takeaway in captions. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'debug-short',
      story: 'debugging',
      name: 'The short',
      tagline: 'A bug in under a minute, jump cuts and captions',
      purpose:
        'The whole hunt in under a minute: the symptom captioned over you, the evidence, the reveal with a punch-in, the one-line fix and the moral.',
      tone: 'Punchy, funny',
      pacing: 'A cut every few seconds',
      cover: 'reveal'
    },
    `
symptom | The symptom | 6 | captions | over | headcaps | cut | The impossible symptom, captioned over your face. | caption-kinetic-slam
evidence | The evidence | 14 | code | off | logzoom | cut | The log line, zoomed. | coordinate-target-zoom
reveal | The reveal | 10 | captions | over | jumpcut | cut | The cause, with a punch-in. | coordinate-target-zoom caption-kinetic-slam
fix | The fix | 12 | code | off | diff | cut | The one-line fix. | css-marker-patterns
moral | The moral | 8 | captions | over | headcaps | end | The moral in four words. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'perf-before-after',
      story: 'performance',
      name: 'Big number',
      tagline: 'The number first, then how',
      purpose:
        'The win as one number beside your face, then where the time went, the change, the proof racing before against after, and what it cost.',
      tone: 'Confident, precise',
      pacing: 'Number, cause, proof',
      cover: 'number'
    },
    `
number | The number | 8 | speaker | over | headline | cut | The win as one number beside your face. | kinetic-beat-slam counting-dynamic-scale
time | Where time went | 30 | data | off | flame | zoom | The profile: the one wide bar that ate the time. | coordinate-target-zoom data-chart
change | The change | 30 | code | corner | diff | push | The change as a diff, with you in the corner. | css-marker-patterns pip-pill
proof | Proof | 20 | data | off | bars | push | Before and after race. | bar-chart-race stat-bars-and-fills
cost | What it cost | 12 | motion | off | limits | end | What it cost in memory and complexity, on honest cards. | split-tilt-cards
`
  ),
  variant(
    {
      id: 'perf-lab',
      story: 'performance',
      name: 'Lab notebook',
      tagline: 'The method, the runs, the winner',
      purpose:
        'A lab notebook of a benchmark: the setup, the baseline, each experiment racing it, why the winner wins, and what to try first.',
      tone: 'Rigorous, transparent',
      pacing: 'Run by run',
      cover: 'runs'
    },
    `
setup | The setup | 15 | motion | off | ticklist | cut | The machine, the load and the rules tick in. | waterfall-entry
baseline | Baseline | 20 | data | off | spike | hold | The baseline latency line, its p99 spike marked. | chart-scrub-readout
runs | The runs | 40 | data | off | bars | push | Each change races the baseline in turn. | bar-chart-race
why | Why it wins | 20 | data | off | flame | zoom | The profile, before and after. | data-chart coordinate-target-zoom
try | Try this first | 15 | speaker | beside | recap | end | What to try first, beside you. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'perf-race',
      story: 'performance',
      name: 'Side by side',
      tagline: 'Before and after, racing in sync',
      purpose:
        'Show, don’t claim: before and after run side by side, the same graph on the same scale, the profile that explains the gap, the change, and where the win does not hold.',
      tone: 'Visual, convincing',
      pacing: 'Race first, explain after',
      cover: 'race'
    },
    `
race | The race | 10 | data | off | race | cut | Before and after run side by side; after finishes first. | comparison-split
graph | Same scale | 20 | data | off | spike | hold | The same graph, the same scale: p99 before and after. | chart-scrub-readout
why | Why it moved | 25 | data | off | flame | zoom | The profile explains the gap. | coordinate-target-zoom data-chart
change | The change | 20 | code | off | diff | push | The change itself. | css-marker-patterns
caveats | Caveats | 10 | motion | off | limits | end | Where the win does not hold. | split-tilt-cards
`
  ),
  variant(
    {
      id: 'migration-heist',
      story: 'migration',
      name: 'The heist',
      tagline: 'The score, the crew, the job, the twist',
      purpose:
        'A migration told as a heist: the size of the job beside your face, the plan, the crew, cutover night, the twist told to camera, and the getaway in numbers.',
      tone: 'Playful, high stakes',
      pacing: 'Plan, crew, job, twist',
      cover: 'crew'
    },
    `
score | The score | 10 | speaker | over | headline | cut | The size of the job, beside your face: hosts, terabytes, no downtime. | kinetic-beat-slam counting-dynamic-scale
plan | The plan | 25 | explainer | corner | phases | push | The plan, phase by phase, with you in the corner. | svg-path-draw pip-pill
crew | The crew | 15 | motion | off | crew | cover | The teams, each with one job. | grid-card-assemble
job | The job | 30 | explainer | off | traffic | hold | Cutover night: traffic shifts from old to new. | camera-journey
twist | The twist | 20 | captions | over | jumpcut | cut | What went wrong, told to camera with a punch-in. | coordinate-target-zoom caption-kinetic-slam
getaway | The getaway | 15 | data | off | bars | end | The results, before against after. | bar-chart-race
`
  ),
  variant(
    {
      id: 'migration-phases',
      story: 'migration',
      name: 'Phase by phase',
      tagline: 'One diagram that changes with each phase',
      purpose:
        'The calm, technical version: why you moved, the old system, one diagram that changes phase by phase from dual writes to deleting the old store, the surprise, the way back, and the lessons.',
      tone: 'Methodical',
      pacing: 'One phase at a time',
      cover: 'phases'
    },
    `
why | Why move | 12 | motion | off | kinetic | cut | The forcing function, in a few words. | kinetic-type-beats
before | Before | 18 | explainer | off | calm | hold | The old system, as it ran. | svg-path-draw
phases | Phase by phase | 45 | explainer | off | phases | match | One diagram changes with each phase: dual write, read new, write new, delete old. | svg-path-draw card-morph-anchor
surprise | The surprise | 20 | code | off | logzoom | zoom | The one thing that broke, zoomed. | coordinate-target-zoom
way-back | The way back | 15 | explainer | off | rollout | push | The rollback plan, drawn against each phase. | svg-path-draw
lessons | Lessons | 15 | speaker | beside | checklist | end | Three lessons tick in beside you. | talking-head-recut
`
  ),
  variant(
    {
      id: 'migration-numbers',
      story: 'migration',
      name: 'By the numbers',
      tagline: 'Progress, cutover and results as charts',
      purpose:
        'A migration told in data: the size of the move, progress week by week, the cutover, the results before and after, and one lesson in captions.',
      tone: 'Matter-of-fact',
      pacing: 'Chart to chart',
      cover: 'progress'
    },
    `
scale | The scale | 10 | data | off | status | cut | The size of the move counts up: services, rows, requests. | counting-dynamic-scale dataviz-countup
progress | Progress | 35 | data | off | progress | hold | The share moved, week by week, the milestones pinned. | chart-scrub-readout
cutover | Cutover | 25 | explainer | off | traffic | push | Traffic shifts from old to new. | camera-journey
results | Results | 25 | data | off | bars | push | Cost and latency, before and after. | bar-chart-race
lesson | One lesson | 15 | captions | over | headcaps | end | The lesson in captions over you. | caption-editorial-emphasis
`
  ),
  variant(
    {
      id: 'security-advisory',
      story: 'security',
      name: 'Bulletin',
      tagline: 'Calm, clear, and what to do today',
      purpose:
        'A security bulletin people can trust: you on camera with the advisory in a lower third, who is affected, how the attack works and what stops it, the upgrade, the disclosure timeline and credits.',
      tone: 'Calm, precise, accountable',
      pacing: 'Unhurried',
      cover: 'affected'
    },
    `
notice | The notice | 10 | speaker | full | lowerthird | cut | You, full frame: who is affected and to patch today, the advisory in a lower third. | lower-third talking-head-recut
affected | Who is affected | 20 | motion | off | advisory | hold | The advisory card: severity, versions, the fixed release. | grid-card-assemble
how | How it works | 30 | explainer | off | attack | zoom | The attack path, replayed safely, then the guard that stops it. | svg-path-draw
upgrade | What to do | 20 | code | beside | terminal | push | The upgrade command types itself beside you. | typewriter-reveal split
disclosure | Timeline and thanks | 15 | explainer | off | scrub | push | Reported, fixed, released: the dates, and who found it. | chart-scrub-readout
after | What we are doing | 10 | speaker | beside | checklist | end | Follow-ups tick in beside you. | talking-head-recut
`
  ),
  variant(
    {
      id: 'security-replay',
      story: 'security',
      name: 'Attack replay',
      tagline: 'The exploit replayed, then patched',
      purpose:
        'For a technical audience: one crafted request as a cold open, the exploit replayed step by step, the vulnerable lines, the patch, and how to check your version.',
      tone: 'Forensic',
      pacing: 'Slow motion where it matters',
      cover: 'replay'
    },
    `
cold-open | Cold open | 8 | motion | off | kinetic | cut | One crafted request, set as kinetic type. | kinetic-type-beats chromatic-glitch
replay | The replay | 30 | explainer | off | attack | hold | The exploit replayed slowly, step by step. | svg-path-draw
root | The root cause | 25 | code | off | codehl | zoom | The vulnerable lines, highlighted. | css-marker-patterns coordinate-target-zoom
patch | The patch | 20 | code | off | diff | push | The patch as a diff. | css-marker-patterns
check | Check yourself | 17 | code | corner | bubbleterm | end | How to check your version, with you in a bubble. | typewriter-reveal pip-pill
`
  ),
  variant(
    {
      id: 'retro-lessons',
      story: 'retro',
      name: 'Three lessons',
      tagline: 'Told to camera, one lesson at a time',
      purpose:
        'A retrospective told to camera: the project’s name behind you, three lessons with the proof for each, and what changes next.',
      tone: 'Reflective, candid',
      pacing: 'Lesson, proof, lesson',
      cover: 'lesson-one'
    },
    `
open | Open | 10 | speaker | over | behind | cut | The project’s name stands giant behind you. | remove-background 3d-text-depth-layers
lesson-one | Lesson one | 30 | captions | over | headcaps | cut | You tell it; the captions mark the words that matter. | caption-editorial-emphasis asr-keyword-glow
proof | Show it | 20 | explainer | off | thennow | push | Then and now, wiped side by side. | comparison-split
lesson-two | Lesson two | 25 | motion | off | quote | cut | A line from someone on the team, as a pull quote. | titlecard-reveal css-marker-patterns
lesson-three | Lesson three | 30 | captions | over | jumpcut | cut | A punch-in for the hardest lesson. | coordinate-target-zoom caption-kinetic-slam
next | Next | 15 | speaker | beside | checklist | end | What changes next, ticked in beside you. | talking-head-recut
`
  ),
  variant(
    {
      id: 'retro-then-now',
      story: 'retro',
      name: 'Then and now',
      tagline: 'The year as a line, wins and misses',
      purpose:
        'A retrospective in pictures: where you started and where you are, the year as a line with its turning points, the wins racing, the honest misses, and what is next.',
      tone: 'Even, generous',
      pacing: 'Chapter by chapter',
      cover: 'then'
    },
    `
then | Then and now | 15 | explainer | off | thennow | cut | Where you started, then a wipe to where you are. | comparison-split
road | The road | 35 | data | off | progress | hold | The year as a line, the turning points pinned. | chart-scrub-readout
wins | Wins | 25 | data | off | bars | push | What got better, racing. | bar-chart-race
misses | Misses | 20 | motion | off | limits | push | What did not work, on honest cards. | split-tilt-cards
next | Next | 15 | speaker | beside | recap | end | What is next, beside you. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'retro-columns',
      story: 'retro',
      name: 'Well, wrong, lucky',
      tagline: 'The board: went well, went wrong, got lucky',
      purpose:
        'The retro board brought to life: the goal, what went well, what went wrong without blame, where you got lucky in someone’s own words, what you would change, and three takeaways.',
      tone: 'Blameless, warm',
      pacing: 'Column by column',
      cover: 'went-well'
    },
    `
goal | The goal | 10 | motion | off | kinetic | cut | What you set out to do, in a few words. | kinetic-type-beats
went-well | Went well | 25 | motion | off | columns | push | The first column fills: what went well. | grid-card-assemble
went-wrong | Went wrong | 25 | motion | off | columns | push | The next column: what went wrong, without blame. | grid-card-assemble
got-lucky | Got lucky | 20 | motion | off | quote | hold | Where you got lucky, in someone’s own words. | titlecard-reveal
change | We would change | 20 | motion | off | ticklist | push | What you would do differently, ticked in. | waterfall-entry
takeaways | Takeaways | 15 | speaker | beside | recap | end | Three takeaways beside you. | titlecard-reveal
`
  )
]
