// Stories that share: a customer's story, a team, an open source project, a
// talk and a demo day. Each table row is a slot: id | role | seconds | type |
// speaker | sketch | seam | move | builds.
import { variant, type TemplateStory } from './model'

export const SHARE_STORIES: TemplateStory[] = [
  {
    id: 'customer',
    group: 'share',
    name: 'Customer story',
    line: 'How one team uses it, in their words and their numbers.',
    audience: 'Teams like theirs'
  },
  {
    id: 'team',
    group: 'share',
    name: 'Team intro',
    line: 'Who the team is, what it owns, how it works, and how to join.',
    audience: 'Candidates and the teams you work with'
  },
  {
    id: 'oss',
    group: 'share',
    name: 'Open source project',
    line: 'What the project does, why it is open, and how to help.',
    audience: 'Developers and would-be contributors'
  },
  {
    id: 'talk',
    group: 'share',
    name: 'Talk recap',
    line: 'A conference talk’s one idea in two minutes.',
    audience: 'People who missed the talk'
  },
  {
    id: 'demo-day',
    group: 'share',
    name: 'Demo day',
    line: 'What the team built this sprint, shown working.',
    audience: 'The rest of the company'
  },
  {
    id: 'interview',
    group: 'share',
    name: 'Engineer interview',
    line: 'One engineer, their hardest moment, and what they learned.',
    audience: 'People who remember people more than systems'
  },
  {
    id: 'data-report',
    group: 'share',
    name: 'Data report',
    line: 'A recurring report from your own data: the table, the surprise, the trend.',
    audience: 'People who wait for the next edition'
  },
  {
    id: 'listicle',
    group: 'share',
    name: 'Lessons list',
    line: 'The things you learned, numbered, one idea each.',
    audience: 'Engineers who like a list they can argue with'
  },
  {
    id: 'community',
    group: 'share',
    name: 'Community spotlight',
    line: 'The people building with it, and what they made.',
    audience: 'The community and would-be contributors'
  },
  {
    id: 'event-recap',
    group: 'share',
    name: 'Launch week recap',
    line: 'A week of launches, grouped by theme, the best ones shown.',
    audience: 'People who could not follow every day'
  }
]

export const SHARE_TEMPLATES = [
  variant(
    {
      id: 'customer-results',
      story: 'customer',
      name: 'Results first',
      tagline: 'Their numbers, then their story',
      purpose:
        'A case study that leads with outcomes: the numbers, what it was like before, what they built, the product doing it, and the line they would tell a peer.',
      tone: 'Confident, specific',
      pacing: 'Numbers, then story',
      cover: 'numbers'
    },
    `
numbers | The numbers | 10 | data | off | customer | cut | Their before-and-after numbers, card by card. | dataviz-countup grid-card-assemble
before | Before | 15 | motion | off | pileup | push | What it was like before: the work piling up. | overwhelm-surround
built | What they built | 25 | explainer | off | seqreveal | push | Their setup, part by part. | spatial-pan-stations
how | How | 20 | capture | off | cursorzoom | match | The product doing it, cursor-led. | cursor-ui-demo
quote | In their words | 10 | motion | off | quote | end | The line they would tell a peer. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'customer-interview',
      story: 'customer',
      name: 'In their words',
      tagline: 'Their engineer tells it to camera',
      purpose:
        'The customer tells it: who they are in a lower third, the problem in captions, the switch from then to now, the results, and their advice to a team like theirs.',
      tone: 'Authentic',
      pacing: 'Conversational',
      cover: 'who'
    },
    `
who | Who they are | 10 | speaker | full | lowerthird | cut | Their engineer, full frame, name and company in a lower third. | lower-third talking-head-recut
problem | The problem | 20 | captions | over | headcaps | cut | The problem in their words, captioned. | caption-editorial-emphasis asr-keyword-glow
switch | The switch | 20 | explainer | off | thennow | push | Then and now, wiped across. | comparison-split
results | Results | 15 | data | off | customer | push | The numbers. | dataviz-countup
advice | Advice | 10 | speaker | over | question | end | A question over them, and their advice. | talking-head-recut discrete-text-sequence
`
  ),
  variant(
    {
      id: 'team-meet',
      story: 'team',
      name: 'Meet the team',
      tagline: 'Who we are, what we own, how we work',
      purpose:
        'A team introduction: hello from you, the people, what the team owns on the map, how you work, and how to join or reach you.',
      tone: 'Friendly',
      pacing: 'Easygoing',
      cover: 'people'
    },
    `
hello | Hello | 8 | speaker | full | lowerthird | cut | You, full frame, with your name and team. | lower-third talking-head-recut
people | The people | 15 | motion | off | teamgrid | push | The team, face by face. | grid-card-assemble
own | What we own | 20 | explainer | off | c4zoom | zoom | The systems the team owns, on the map. | multi-phase-camera
how | How we work | 20 | motion | off | ticklist | push | The rituals: planning, reviews, on-call. | waterfall-entry
join | Join us | 8 | motion | off | cta | end | How to join or reach the team. | cta-morph-press
`
  ),
  variant(
    {
      id: 'team-day',
      story: 'team',
      name: 'A day on the team',
      tagline: 'A day in moving pictures',
      purpose:
        'A day on the team as a montage: the day hour by hour, the work on screen, an on-call moment told to camera, something shipping, and the invitation to join.',
      tone: 'Lively',
      pacing: 'Montage',
      cover: 'day'
    },
    `
day | The day | 15 | motion | off | montage | cut | The day, hour by hour, one frame each. | grid-card-assemble
work | The work | 20 | capture | corner | stream | push | Work on screen, with one of you in the corner. | transcript-scroll-artifact-reveal
on-call | On call | 12 | captions | over | alert | cut | An on-call page, told to camera. | caption-kinetic-slam lower-third
ship | Ship | 12 | capture | off | resultfirst | push | Something shipping, working. | video-text-pivot
join | Join us | 8 | captions | over | headcaps | end | The invitation, captioned. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'oss-readme',
      story: 'oss',
      name: 'README tour',
      tagline: 'What it does, install, example, contribute',
      purpose:
        'An open source project in two minutes, in README order: the project, what it does, the install, an example, how it is built, and how to contribute.',
      tone: 'Welcoming',
      pacing: 'README order',
      cover: 'repo'
    },
    `
repo | The project | 10 | motion | off | stars | cut | The repository, its stars counting up. | counting-dynamic-scale
does | What it does | 15 | capture | off | resultfirst | push | It working, first. | video-text-pivot
install | Install | 15 | code | corner | bubbleterm | match | The install, typed, your bubble beside it. | typewriter-reveal pip-pill
example | Example | 20 | code | off | codehl | push | A real example, its key lines marked. | css-marker-patterns
inside | Inside | 20 | explainer | off | layers | push | How it is built, layer by layer. | multi-phase-camera
contribute | Contribute | 10 | speaker | beside | steps | end | How to contribute, beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'oss-why',
      story: 'oss',
      name: 'Why we opened it',
      tagline: 'The story behind open-sourcing it',
      purpose:
        'Why you open-sourced it: the name behind you, why in captions, what is in the box, the repository and its good first issues, and the invitation.',
      tone: 'Personal, generous',
      pacing: 'Story, then invite',
      cover: 'name'
    },
    `
name | The name | 8 | speaker | over | behind | cut | The project’s name stands giant behind you. | remove-background 3d-text-depth-layers
why | Why | 20 | captions | over | headcaps | cut | Why you opened it, captioned. | caption-editorial-emphasis
box | What is in it | 20 | explainer | off | seqreveal | push | The parts, one by one. | spatial-pan-stations
repo | The repository | 12 | motion | off | stars | push | Stars, contributors and good first issues. | counting-dynamic-scale
invite | Come help | 8 | speaker | full | lowerthird | end | The invitation, full frame. | talking-head-recut lower-third
`
  ),
  variant(
    {
      id: 'talk-slides',
      story: 'talk',
      name: 'Slide recap',
      tagline: 'The talk’s one idea, from its slides',
      purpose:
        'A conference talk in two minutes: the one idea, the slides that carried it with you in the corner, the demo, and three takeaways.',
      tone: 'Clear',
      pacing: 'Slide by slide',
      cover: 'slides'
    },
    `
idea | The idea | 8 | motion | off | kinetic | cut | The talk’s one idea, in kinetic type. | kinetic-type-beats
slides | Key slides | 30 | motion | corner | slides | push | The slides that carried it, the key line marked, with you in the corner. | titlecard-reveal pip-pill
demo | The demo | 25 | capture | corner | stream | match | The demo from the talk, trimmed. | transcript-scroll-artifact-reveal
takeaways | Takeaways | 12 | speaker | beside | recap | end | Three takeaways, beside you. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'talk-stage',
      story: 'talk',
      name: 'From the stage',
      tagline: 'The line that landed, then the why',
      purpose:
        'The talk as highlights: the line that got a reaction, the problem, the idea built part by part, the proof, and where to watch the whole thing.',
      tone: 'Energetic',
      pacing: 'Highlight reel',
      cover: 'line'
    },
    `
line | The line | 8 | captions | over | headcaps | cut | The line that landed, captioned over you. | caption-kinetic-slam
problem | The problem | 15 | explainer | off | overload | push | The problem the talk is about. | reactive-displacement
idea | The idea | 25 | explainer | off | seqreveal | push | The idea, built part by part. | spatial-pan-stations
proof | The proof | 15 | data | off | bars | push | The numbers from the talk. | bar-chart-race
watch | Watch it | 7 | speaker | over | headline | end | Where to watch the whole talk, beside your face. | kinetic-beat-slam
`
  ),
  variant(
    {
      id: 'demo-show',
      story: 'demo-day',
      name: 'Show and tell',
      tagline: 'What we built this sprint, working',
      purpose:
        'An internal demo: what you built beside your face, the demo with you in the corner, how it works, the number it moved, and what is next.',
      tone: 'Proud, informal',
      pacing: 'Demo-heavy',
      cover: 'demo'
    },
    `
what | What we built | 8 | speaker | over | headline | cut | What you built, set beside your face. | kinetic-beat-slam
demo | Demo | 30 | capture | corner | cursorzoom | match | The demo, cursor-led, with you in the corner. | cursor-ui-demo pip-pill
how | How | 20 | explainer | off | layers | push | How it works, layer by layer. | multi-phase-camera
moved | What it moved | 12 | data | off | bars | push | The number it moved. | stat-bars-and-fills
next | Next | 10 | speaker | beside | steps | end | What is next, beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'demo-reel',
      story: 'demo-day',
      name: 'Silent reel',
      tagline: 'Sixty seconds, no one on camera',
      purpose:
        'A demo-day reel with no talking head: the thing working, the three steps that make it work, one number, and the team behind it.',
      tone: 'Snappy',
      pacing: 'On the beat',
      cover: 'result'
    },
    `
result | The result | 10 | capture | off | resultfirst | cut | The thing working. | video-text-pivot
steps | Three steps | 25 | motion | off | recipes | push | The three steps that make it work. | grid-card-assemble
number | One number | 10 | data | off | bignumber | push | One number counts up. | dataviz-countup
team | The team | 10 | motion | off | teamgrid | end | The team behind it. | grid-card-assemble
`
  ),
  variant(
    {
      id: 'team-principles',
      story: 'team',
      name: 'How we work',
      tagline: 'A principle, the practice, a story, the trade-off',
      purpose:
        'How the team works, drawn as it is explained: a principle, how it plays out in practice, a story where it mattered, and what it costs you.',
      tone: 'Candid',
      pacing: 'Principle by principle',
      cover: 'practice'
    },
    `
principle | The principle | 8 | motion | off | kinetic | cut | The principle, in a few words. | kinetic-type-beats
practice | In practice | 25 | explainer | beside | whiteboard | hold | How it works day to day, drawn beside you. | whiteboard-area svg-path-draw
story | A story | 20 | captions | over | headcaps | cut | A time it mattered, told to camera. | caption-editorial-emphasis
tradeoff | The trade-off | 12 | motion | off | limits | push | What it costs, on honest cards. | split-tilt-cards
join | Join us | 8 | motion | off | cta | end | How to join. | cta-morph-press
`
  ),
  variant(
    {
      id: 'oss-launch',
      story: 'oss',
      name: 'Benchmark launch',
      tagline: 'The pain, one-line install, the benchmark',
      purpose:
        'An open source launch with numbers: the pain, the one-line install, the benchmark where yours is the tiny bar, the roadmap, and how to help.',
      tone: 'Confident',
      pacing: 'Fast',
      cover: 'benchmark'
    },
    `
pain | The pain | 8 | motion | off | pileup | cut | The slow, painful way it is done today. | overwhelm-surround
install | One line | 10 | code | off | tipcard | push | The one-line install. | typewriter-reveal
benchmark | The benchmark | 15 | data | off | bars | push | The benchmark: yours is the tiny bar. | bar-chart-race
roadmap | Roadmap | 12 | motion | off | roadmap | push | What is next. | grid-card-assemble
help | How to help | 8 | motion | off | stars | end | Stars, issues and the first good one to pick up. | counting-dynamic-scale
`
  ),
  variant(
    {
      id: 'talk-conference',
      story: 'talk',
      name: 'Conference takeaways',
      tagline: 'Forty talks, the three that mattered',
      purpose:
        'A whole conference in two minutes: where and why you went, the three talks that mattered, the best line you heard, and what your team will try.',
      tone: 'Lively',
      pacing: 'Three beats',
      cover: 'three'
    },
    `
where | Where and why | 8 | speaker | over | headline | cut | The conference and why you went, beside your face. | kinetic-beat-slam
three | Three talks | 30 | motion | off | recipes | push | The three talks that mattered, one card each. | grid-card-assemble
best-line | The best line | 12 | motion | off | quote | hold | The best line you heard. | titlecard-reveal
try | What we will try | 10 | speaker | beside | checklist | end | What your team will try, ticked in beside you. | talking-head-recut
`
  ),
  variant(
    {
      id: 'interview-qa',
      story: 'interview',
      name: 'Q&A',
      tagline: 'Questions on screen, answers to camera',
      purpose:
        'An engineer in their own words: their best line first, who they are, then each question on screen before they answer, the hardest moment, the lesson and what is next.',
      tone: 'Warm, human',
      pacing: 'Question, answer',
      cover: 'question'
    },
    `
best-line | Their best line | 6 | captions | over | headcaps | cut | Their best line first, captioned. | caption-editorial-emphasis
who | Who they are | 10 | speaker | full | lowerthird | cut | Full frame, name and team in a lower third. | lower-third talking-head-recut
question | The hardest moment | 25 | speaker | over | question | cut | The question appears over them, then they answer. | talking-head-recut discrete-text-sequence
show | Show it | 15 | explainer | off | calm | push | What they are describing, shown. | svg-path-draw
lesson | The lesson | 12 | speaker | over | question | end | The last question, and their lesson. | talking-head-recut discrete-text-sequence
`
  ),
  variant(
    {
      id: 'interview-profile',
      story: 'interview',
      name: 'Profile',
      tagline: 'Cut around their quotes',
      purpose:
        'A short profile cut around quotes: their name behind them, a punch-in on the line that matters, what they built, and what they would tell someone starting out.',
      tone: 'Energetic',
      pacing: 'Quote to quote',
      cover: 'name'
    },
    `
name | Their name | 6 | speaker | over | behind | cut | Their name stands giant behind them. | remove-background 3d-text-depth-layers
line | The line | 10 | captions | over | jumpcut | cut | The line that matters, with a punch-in. | coordinate-target-zoom caption-kinetic-slam
built | What they built | 20 | explainer | off | seqreveal | push | What they built, part by part. | spatial-pan-stations
advice | Advice | 10 | motion | off | quote | end | What they would tell someone starting out. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'report-league',
      story: 'data-report',
      name: 'League table',
      tagline: 'The table, the surprise, the trend',
      purpose:
        'A recurring data report: this edition’s table sorting itself, the surprise of the quarter, the trend over time, how you measured it, and when the next one lands.',
      tone: 'Even, nerdy',
      pacing: 'Table, then story',
      cover: 'table'
    },
    `
table | The table | 20 | data | off | league | cut | This edition’s table sorts itself. | stat-bars-and-fills
surprise | The surprise | 15 | data | off | spike | push | The surprise of the quarter, on one chart. | chart-scrub-readout
trend | The trend | 15 | data | off | progress | push | The trend across editions. | chart-scrub-readout
method | How we measure | 12 | motion | off | ticklist | push | How the numbers are counted. | waterfall-entry
next | Next edition | 6 | motion | off | kinetic | end | When the next report lands. | kinetic-type-beats
`
  ),
  variant(
    {
      id: 'report-quarter',
      story: 'data-report',
      name: 'Quarter in numbers',
      tagline: 'The headline number beside you, then the table',
      purpose:
        'The quarter’s report presented: the headline number beside your face, the numbers that moved, the table, and what you would watch next quarter.',
      tone: 'Upbeat',
      pacing: 'Number first',
      cover: 'numbers'
    },
    `
headline | The headline | 8 | speaker | over | headline | cut | The headline number, beside your face. | kinetic-beat-slam
numbers | The numbers | 15 | data | off | wrapped | push | The numbers that moved, tile by tile. | dataviz-countup
table | The table | 15 | data | off | league | push | The table, sorted. | stat-bars-and-fills
watch | Watch next | 8 | captions | over | headcaps | end | What to watch next quarter, captioned. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'list-numbered',
      story: 'listicle',
      name: 'Numbered',
      tagline: 'Big numerals, one lesson each',
      purpose:
        'Lessons as a countdown: the promise, then each lesson as a big numeral with one line, a quick proof for the best one, and the one you would keep if you could keep only one.',
      tone: 'Wry',
      pacing: 'One lesson a beat',
      cover: 'lessons'
    },
    `
promise | The promise | 6 | motion | off | kinetic | cut | How many lessons, and from how many years. | kinetic-type-beats
lessons | The lessons | 40 | motion | off | numbered | push | Each lesson as a big numeral and one line. | kinetic-beat-slam discrete-text-sequence
proof | Proof | 12 | code | off | diff | push | A quick proof for the best one. | css-marker-patterns
keep | Keep one | 8 | captions | over | headcaps | end | The one you would keep, captioned over you. | caption-editorial-emphasis
`
  ),
  variant(
    {
      id: 'list-told',
      story: 'listicle',
      name: 'Told to camera',
      tagline: 'You count them down, cut by cut',
      purpose:
        'You tell the lessons yourself: the number behind you, each lesson with a punch-in and a picture to prove it, and the one that took longest to learn.',
      tone: 'Personal',
      pacing: 'Cut by cut',
      cover: 'lesson'
    },
    `
count | The count | 6 | speaker | over | behind | cut | The number of lessons stands behind you. | remove-background
lesson | A lesson | 15 | captions | over | jumpcut | cut | A lesson, told with a punch-in. | coordinate-target-zoom caption-kinetic-slam
picture | The picture | 15 | motion | off | numbered | push | The lessons, numbered on screen. | kinetic-beat-slam
longest | The longest one | 15 | speaker | full | lowerthird | end | The one that took longest to learn, full frame. | talking-head-recut lower-third
`
  ),
  variant(
    {
      id: 'community-makers',
      story: 'community',
      name: 'Makers',
      tagline: 'The community number, then the makers',
      purpose:
        'A spotlight on the community: the number that shows its size, makers and their projects one by one, one project shown working, and how to get featured.',
      tone: 'Generous',
      pacing: 'Maker by maker',
      cover: 'makers'
    },
    `
number | The community | 8 | data | off | bignumber | cut | The community’s size, counting up. | counting-dynamic-scale
makers | The makers | 25 | motion | off | teamgrid | push | Makers and their projects, card by card. | grid-card-assemble
project | One project | 20 | capture | off | resultfirst | push | One project shown working. | video-text-pivot
featured | Get featured | 8 | captions | over | headcaps | end | How to get featured next time, captioned. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'community-host',
      story: 'community',
      name: 'Hosted',
      tagline: 'You introduce each maker',
      purpose:
        'You host the spotlight: each maker introduced over your shoulder, their project in a bubble capture, and a thank-you.',
      tone: 'Warm',
      pacing: 'Easy',
      cover: 'makers'
    },
    `
hello | Hello | 6 | speaker | full | lowerthird | cut | You, full frame, hosting. | lower-third talking-head-recut
makers | This month’s makers | 25 | speaker | over | roundup | push | Each maker on a card beside you: name, project, one line. | side-panel talking-head-recut
project | A project | 20 | capture | corner | bubble | match | One project on screen, your bubble along. | cursor-ui-demo pip-pill
thanks | Thank you | 6 | captions | over | headcaps | end | Thank you, captioned. | caption-editorial-emphasis
`
  ),
  variant(
    {
      id: 'recap-themes',
      story: 'event-recap',
      name: 'By theme',
      tagline: 'The week as tiles, grouped by theme',
      purpose:
        'A launch week in one video: the week as tiles grouped by theme, the three launches that matter most, everything else at speed, and where to read more.',
      tone: 'Upbeat',
      pacing: 'Tiles, then three',
      cover: 'week'
    },
    `
week | The week | 12 | motion | off | montage | cut | The week as tiles, day by day. | grid-card-assemble
top-three | The top three | 30 | capture | off | resultfirst | push | The three launches that matter most, shown. | video-text-pivot
rest | Everything else | 15 | motion | off | ticklist | push | Everything else, ticked in. | waterfall-entry
more | Read more | 6 | motion | off | cta | end | Where to read more. | cta-morph-press
`
  ),
  variant(
    {
      id: 'recap-host',
      story: 'event-recap',
      name: 'Hosted recap',
      tagline: 'You walk through the week',
      purpose:
        'You walk through the week: the number of launches beside your face, each day a card over your shoulder, one demo, and what to try first.',
      tone: 'Friendly',
      pacing: 'Day by day',
      cover: 'days'
    },
    `
count | The count | 6 | speaker | over | headline | cut | How many launches, beside your face. | kinetic-beat-slam
days | Day by day | 30 | speaker | over | roundup | push | Each day a card beside you. | side-panel talking-head-recut
demo | One demo | 20 | capture | corner | cursorzoom | match | The one to try first, shown. | cursor-ui-demo pip-pill
try | Try first | 6 | captions | over | headcaps | end | What to try first, captioned. | caption-pill-karaoke
`
  )
]
