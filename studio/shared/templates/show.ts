// Stories that show: a launch, a feature tutorial, release notes and a build
// log. Each table row is a slot: id | role | seconds | type | speaker |
// sketch | seam | move | builds.
import { variant, type TemplateStory } from './model'

export const SHOW_STORIES: TemplateStory[] = [
  {
    id: 'launch',
    group: 'show',
    name: 'Launch',
    line: 'A feature or product launch: the outcome first, then how it works.',
    audience: 'Developers deciding whether to try it'
  },
  {
    id: 'release',
    group: 'show',
    name: 'Release notes',
    line: 'What is new in this release, the biggest change first.',
    audience: 'People who already use it'
  },
  {
    id: 'devlog',
    group: 'show',
    name: 'Build log',
    line: 'What you built, what failed on the way, and what surprised you.',
    audience: 'People following your work'
  },
  {
    id: 'code-change',
    group: 'show',
    name: 'Code change walkthrough',
    line: 'What a pull request changes, why, and how to review it.',
    audience: 'Reviewers and teammates'
  },
  {
    id: 'overview',
    group: 'show',
    name: 'Product overview',
    line: 'What the product is and why it matters, in under two minutes.',
    audience: 'People hearing about it for the first time'
  }
]

export const SHOW_TEMPLATES = [
  variant(
    {
      id: 'launch-demo',
      story: 'launch',
      name: 'Result first',
      tagline: 'The outcome plays first, then the walkthrough',
      purpose:
        'A feature or product launch: the outcome, the old pain, the walkthrough, a look under the hood, the proof, one way to try it.',
      tone: 'Show, don’t tell; honest about limits',
      pacing: 'Cursor-led; zoom on every click',
      cover: 'walkthrough'
    },
    `
result-first | Result first | 6 | capture | off | resultfirst | cut | The finished outcome plays, then rewinds to the start. | video-text-pivot cursor-ui-demo
old-way | The old way | 14 | motion | off | pileup | cover | Manual steps pile up while a clock spins. | overwhelm-surround
walkthrough | Walkthrough | 35 | capture | corner | cursorzoom | match | Cursor-led: zoom to each click, and a callout names what changed. | cursor-ui-demo camera-cursor-tracking cursor-click-ripple
under-the-hood | Under the hood | 15 | explainer | off | peel | push | The interface peels back to the diagram behind the button. | card-morph-anchor
proof | Proof | 12 | data | off | bars | cut | Before and after race: latency, cost, steps. | dataviz-countup stat-bars-and-fills bar-chart-race
try-it | Try it | 8 | code | beside | terminal | end | The install command types itself, beside the speaker. | typewriter-reveal cta-morph-press
`
  ),
  variant(
    {
      id: 'launch-keynote',
      story: 'launch',
      name: 'Keynote',
      tagline: 'On stage, three moments and one more thing',
      purpose:
        'A launch on stage: the name giant behind you, the problem in your words, three demo moments with you in the corner, the numbers, one more thing, and how to try it.',
      tone: 'Big, confident',
      pacing: 'Builds to the reveal',
      cover: 'stage'
    },
    `
stage | On stage | 10 | speaker | over | keynote | cut | The product’s name stands giant, then you step into the light. | titlecard-reveal remove-background
problem | The problem | 15 | captions | over | headcaps | cut | The pain in your words, the captions marking it. | caption-editorial-emphasis asr-keyword-glow
demo | Three moments | 35 | capture | corner | cursorzoom | match | Three demo moments, one per click, each zoomed, with you in the corner. | cursor-ui-demo camera-cursor-tracking pip-pill
numbers | The numbers | 15 | data | off | bars | push | Before and after race. | bar-chart-race
one-more | One more thing | 10 | speaker | over | headline | cut | One more thing, set beside your face. | kinetic-beat-slam
try-it | Try it | 10 | code | beside | terminal | end | The install command beside you. | typewriter-reveal cta-morph-press
`
  ),
  variant(
    {
      id: 'launch-teaser',
      story: 'launch',
      name: 'Teaser',
      tagline: 'Thirty seconds of motion, no talking head',
      purpose:
        'A short, punchy teaser with no one on camera: three words slammed in time, quick cuts of the product, one number, and the call to action.',
      tone: 'Punchy',
      pacing: 'On the beat',
      cover: 'punch'
    },
    `
punch | Punch | 5 | motion | off | kinetic | cut | Three words, slammed in time. | kinetic-type-beats kinetic-beat-slam
flash | Flash | 10 | capture | off | resultfirst | cut | Quick cuts of the product doing its thing. | video-text-pivot device-surface-showcase
number | The number | 6 | data | off | bignumber | cut | One number counts up. | dataviz-countup
call | Call to action | 6 | motion | off | cta | end | The button presses itself, then the logo locks up. | cta-morph-press logo-assemble-lockup
`
  ),
  variant(
    {
      id: 'launch-founder',
      story: 'launch',
      name: 'Founder walkthrough',
      tagline: 'Your screen and your face, one job end to end',
      purpose:
        'A personal launch, as if you sat next to them: hello with your name, the pain in your words, one job done end to end on screen with your bubble along, one number, and the install line.',
      tone: 'Personal, unpolished on purpose',
      pacing: 'One take feel',
      cover: 'walk'
    },
    `
hello | Hello | 8 | speaker | full | lowerthird | cut | You, full frame, with your name and role. | lower-third talking-head-recut
pain | The pain | 15 | captions | over | headcaps | cut | The problem in your words, captioned. | caption-editorial-emphasis
walk | Walkthrough | 45 | capture | corner | bubble | match | Your screen, one job end to end, your bubble along. | cursor-ui-demo camera-cursor-tracking pip-pill
proof | Proof | 12 | data | off | bars | push | One number that shows it works. | dataviz-countup stat-bars-and-fills
try-it | Try it | 10 | code | corner | bubbleterm | end | The install line, with your bubble beside it. | typewriter-reveal pip-pill
`
  ),
  variant(
    {
      id: 'release-roundup',
      story: 'release',
      name: 'News roundup',
      tagline: 'The big one first, then two more, card by card',
      purpose:
        'Release notes in news order: the version beside your face, the most-wanted change in action, two more as cards beside you, the rest at speed, and how to upgrade.',
      tone: 'Upbeat, brief',
      pacing: 'Biggest first',
      cover: 'two-more'
    },
    `
version | This release | 6 | speaker | over | headline | cut | The version number, set beside your face. | kinetic-beat-slam
big-one | The big one | 30 | capture | corner | cursorzoom | match | The most-wanted change, in action, with you in the corner. | cursor-ui-demo pip-pill
two-more | Two more | 30 | speaker | over | roundup | push | Two more changes, each a card beside you: its name and one line. | side-panel talking-head-recut grid-card-assemble
also | Also | 12 | motion | off | ticklist | push | The rest tick in, fast. | waterfall-entry agent-progress-theater
upgrade | Upgrade | 10 | code | beside | terminal | end | The upgrade command beside you. | typewriter-reveal
`
  ),
  variant(
    {
      id: 'release-changelog',
      story: 'release',
      name: 'Changelog',
      tagline: 'A kinetic list, no one on camera',
      purpose:
        'The changelog brought to life: the version slammed in, the changes ticking in as a list, one change worth watching, the numbers, and the upgrade.',
      tone: 'Crisp',
      pacing: 'Fast list, one slow moment',
      cover: 'list'
    },
    `
version | The version | 5 | motion | off | kinetic | cut | The version number slams in. | kinetic-beat-slam ticker-takeover
list | The list | 30 | motion | off | ticklist | push | The changes tick in as a list. | waterfall-entry grid-card-assemble
spotlight | Spotlight | 25 | capture | off | cursorzoom | match | The one change worth watching, cursor-led. | cursor-ui-demo
numbers | Numbers | 10 | data | off | bars | push | Faster and smaller: before and after. | bar-chart-race
upgrade | Get it | 6 | motion | off | cta | end | The upgrade button presses itself. | cta-morph-press
`
  ),
  variant(
    {
      id: 'devlog-weeks',
      story: 'devlog',
      name: 'Week by week',
      tagline: 'A montage of weeks, the hard part to camera',
      purpose:
        'A build log: the goal behind you, the weeks filling in one frame each, the hard part told to camera, the thing working, and what is next.',
      tone: 'Personal, energetic',
      pacing: 'Montage, then a pause',
      cover: 'weeks'
    },
    `
goal | The goal | 10 | speaker | over | behind | cut | What you set out to build stands giant behind you. | remove-background 3d-text-depth-layers
weeks | Week by week | 40 | motion | off | montage | hold | The weeks fill in, one frame each, the line growing. | grid-card-assemble chart-scrub-readout
hard | The hard part | 30 | captions | over | jumpcut | cut | The surprise, told to camera with a punch-in. | coordinate-target-zoom caption-kinetic-slam
show | Show it | 25 | capture | corner | resultfirst | push | The thing itself, working, with you in the corner. | video-text-pivot pip-pill
next | Next | 15 | speaker | beside | checklist | end | What is next, ticked in beside you. | talking-head-recut
`
  ),
  variant(
    {
      id: 'devlog-adventure',
      story: 'devlog',
      name: 'Coding adventure',
      tagline: 'Attempt, failure, insight, better attempt',
      purpose:
        'A build told as an adventure, all in moving pictures: the goal, the naive attempt failing where everyone can see it, the insight, a better attempt, the result, and what you will try next.',
      tone: 'Curious, gentle',
      pacing: 'Try, fail, learn, repeat',
      cover: 'naive'
    },
    `
goal | The goal | 8 | motion | off | kinetic | cut | What you want to make, in a few words. | kinetic-type-beats
naive | The naive attempt | 22 | explainer | off | attempts | push | The first tries, and the moment each one visibly fails. | svg-path-draw
insight | The insight | 20 | explainer | off | zoomout | hold | Step back: what the failures taught you. | zoom-out-workspace-reveal
better | A better attempt | 25 | explainer | off | calm | push | The next try, running smoothly. | svg-path-draw
result | The result | 15 | capture | off | resultfirst | cut | The thing itself, working. | video-text-pivot
next | Next | 10 | speaker | beside | recap | end | What you will try next, beside you. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'pr-files',
      story: 'code-change',
      name: 'File by file',
      tagline: 'What changes for users, then the hunk that matters',
      purpose:
        'A pull request explained for its reviewers: what changes for users, the old behaviour, the one hunk that matters, the knock-on changes, the proof, and what to look at first.',
      tone: 'Precise',
      pacing: 'Hunk by hunk, twelve lines at most',
      cover: 'hunk'
    },
    `
for-users | What changes | 8 | motion | off | kinetic | cut | What changes for users, in a few words. | kinetic-type-beats
before | The old behaviour | 12 | code | off | errorfix | push | What people saw before this change. | typewriter-reveal
hunk | The hunk that matters | 25 | code | corner | diff | zoom | The one hunk that matters, twelve lines at most, with you in the corner. | css-marker-patterns pip-pill
files | Knock-on changes | 12 | code | off | prfiles | push | The other files it touches, the tree collapsing onto that hunk. | grid-card-assemble
proof | Proof | 15 | capture | corner | stream | push | The tests run green. | transcript-scroll-artifact-reveal
review | How to review | 10 | motion | off | ticklist | end | What to look at first, and who helped. | waterfall-entry
`
  ),
  variant(
    {
      id: 'pr-short',
      story: 'code-change',
      name: 'Sixty-second PR',
      tagline: 'The change in under a minute',
      purpose:
        'A small change in under a minute: the diff stats and what it fixes in captions over you, the files, the lines that matter, and what you need from reviewers.',
      tone: 'Quick',
      pacing: 'Length follows the diff',
      cover: 'diff'
    },
    `
what | What it fixes | 8 | captions | over | headcaps | cut | The diff stats and what they fix, captioned over you. | caption-kinetic-slam
files | Files | 12 | code | off | prfiles | push | The files it touches. | grid-card-assemble
diff | The diff | 20 | code | off | diff | push | The lines that matter. | css-marker-patterns
ask | The ask | 8 | speaker | over | headline | end | What you need from reviewers, set beside your face. | kinetic-beat-slam
`
  ),
  variant(
    {
      id: 'release-monthly',
      story: 'release',
      name: 'Monthly roundup',
      tagline: 'The month’s top three, then the quick list',
      purpose:
        'The month in one video: how many things shipped, the three that change the way people work shown with your bubble, the quick list, and the link.',
      tone: 'Quick, friendly',
      pacing: 'Three demos, then a list',
      cover: 'top-three'
    },
    `
count | This month | 6 | speaker | over | headline | cut | How many things shipped, beside your face. | kinetic-beat-slam
top-three | The top three | 35 | capture | corner | bubble | match | The three that change how people work, ten seconds each. | cursor-ui-demo pip-pill
quick | Quick list | 12 | motion | off | ticklist | push | The rest, each tagged new, preview or generally available. | waterfall-entry
link | Read more | 5 | motion | off | cta | end | Where the full list lives. | cta-morph-press
`
  ),
  variant(
    {
      id: 'overview-fast',
      story: 'overview',
      name: 'Under two minutes',
      tagline: 'Fast, faceless, the whole product',
      purpose:
        'The product in under two minutes, voice over moving pictures: the problem, what it is, how it works inside, three things it does, and how to start.',
      tone: 'Quick, witty',
      pacing: 'A new picture every few seconds',
      cover: 'inside'
    },
    `
problem | The problem | 8 | motion | off | pileup | cut | The problem it exists for, piling up. | overwhelm-surround
what | What it is | 10 | motion | off | kinetic | cut | What it is, in a few words. | kinetic-type-beats
inside | Inside | 25 | explainer | off | layers | push | How it works, layer by layer. | multi-phase-camera
does | Three things | 25 | capture | off | resultfirst | push | Three things it does, shown. | video-text-pivot
start | Start | 6 | motion | off | cta | end | How to start. | cta-morph-press
`
  ),
  variant(
    {
      id: 'overview-guided',
      story: 'overview',
      name: 'Guided overview',
      tagline: 'You introduce it, then show it',
      purpose:
        'You introduce the product: the problem in your words, what it is beside you, the product on screen, who uses it, and where to start.',
      tone: 'Friendly',
      pacing: 'Talk, show, talk',
      cover: 'show'
    },
    `
problem | The problem | 10 | captions | over | headcaps | cut | The problem in your words, captioned. | caption-editorial-emphasis
what | What it is | 12 | speaker | beside | decision | push | What it is, stamped beside you. | titlecard-reveal
show | On screen | 30 | capture | corner | cursorzoom | match | The product on screen, with you in the corner. | cursor-ui-demo pip-pill
who | Who uses it | 10 | data | off | customer | push | Who uses it, and what changed for them. | dataviz-countup
start | Start | 6 | speaker | beside | steps | end | Where to start, beside you. | waterfall-entry
`
  )
]
