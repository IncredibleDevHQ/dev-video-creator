// Stories that announce: a deprecation, planned maintenance or a live
// update, a product update, a project update, a pricing change and a year
// in review. Each table row is a slot: id | role | seconds | type | speaker |
// sketch | seam | move | builds.
import { variant, type TemplateStory } from './model'

export const ANNOUNCE_STORIES: TemplateStory[] = [
  {
    id: 'deprecation',
    group: 'announce',
    name: 'Deprecation notice',
    line: 'What is going away, by when, and how to move, the dates first.',
    audience: 'Everyone who still uses the old way'
  },
  {
    id: 'maintenance',
    group: 'announce',
    name: 'Maintenance and status',
    line: 'Planned work or a live problem: when, what to expect, what to do.',
    audience: 'Users and their on-call teams'
  },
  {
    id: 'product-update',
    group: 'announce',
    name: 'Product update',
    line: 'What shipped this quarter, and what comes next.',
    audience: 'Customers and the community'
  },
  {
    id: 'project-update',
    group: 'announce',
    name: 'Project update',
    line: 'Status, progress, risks and one ask, for the people backing the work.',
    audience: 'Leadership and partner teams'
  },
  {
    id: 'pricing',
    group: 'announce',
    name: 'Pricing change',
    line: 'What changes, who it affects, why, and what to do about it.',
    audience: 'Customers on the plans that change'
  },
  {
    id: 'year-review',
    group: 'announce',
    name: 'Year in review',
    line: 'The year in numbers, the moments that mattered, and what is next.',
    audience: 'Your users and your team'
  },
  {
    id: 'preview',
    group: 'announce',
    name: 'Preview invite',
    line: 'Something new in preview: what it is, what stage it is in, who gets in.',
    audience: 'Early adopters'
  },
  {
    id: 'event',
    group: 'announce',
    name: 'Event invite',
    line: 'A talk or webinar worth an hour: what they will learn, who, and when.',
    audience: 'People deciding whether to sign up'
  },
  {
    id: 'license',
    group: 'announce',
    name: 'License change',
    line: 'What changes in the license, who is affected and who is not, and why.',
    audience: 'Users, contributors and their lawyers'
  },
  {
    id: 'trust',
    group: 'announce',
    name: 'Trust milestone',
    line: 'A certification or audit passed, and what it unlocks for customers.',
    audience: 'Customers and their security reviewers'
  }
]

export const ANNOUNCE_TEMPLATES = [
  variant(
    {
      id: 'deprecation-notice',
      story: 'deprecation',
      name: 'The notice',
      tagline: 'The dates first, then the way across',
      purpose:
        'A deprecation people can act on: the dates up front, what changes, how to tell if it affects you, how to migrate, and where to get help, said by you.',
      tone: 'Clear, accountable',
      pacing: 'Dates, change, path',
      cover: 'dates'
    },
    `
dates | The dates | 12 | motion | off | deprecation | cut | The dates up front: deprecated, read-only, removed. | waterfall-entry chart-scrub-readout
what | What changes | 18 | code | beside | diff | push | The old call and the new one, as a diff beside you. | css-marker-patterns split
who | Who is affected | 15 | motion | off | ticklist | push | How to tell whether it affects you, ticked in. | waterfall-entry
how | How to move | 25 | code | corner | bubbleterm | match | The migration, command by command, with you in a bubble. | typewriter-reveal pip-pill
help | Help | 10 | speaker | full | lowerthird | end | You, full frame, with where to get help in a lower third. | lower-third talking-head-recut
`
  ),
  variant(
    {
      id: 'deprecation-guide',
      story: 'deprecation',
      name: 'Migration guide',
      tagline: 'Old and new code, then the steps',
      purpose:
        'The hands-on version: the old way and the new side by side, the steps, a check that it works, and the dates to remember.',
      tone: 'Helpful, precise',
      pacing: 'Step by step',
      cover: 'before-after'
    },
    `
before-after | Old and new | 15 | code | off | diff | cut | The old code and the new code, side by side. | css-marker-patterns
steps | The steps | 25 | motion | off | quickstart | push | Each step of the move ticks off. | agent-progress-theater
verify | Check it | 15 | capture | corner | stream | push | Run it; the new path answers. | transcript-scroll-artifact-reveal
dates | Remember | 10 | motion | off | deprecation | end | The dates to remember. | waterfall-entry
`
  ),
  variant(
    {
      id: 'maintenance-notice',
      story: 'maintenance',
      name: 'Heads-up',
      tagline: 'When, what keeps working, what to do',
      purpose:
        'Planned maintenance in under a minute: the window, what keeps working and what pauses, what to do beforehand, and where to follow along.',
      tone: 'Calm, specific',
      pacing: 'Unhurried',
      cover: 'window'
    },
    `
window | The window | 10 | motion | off | maintenance | cut | The window on the calendar, in UTC. | grid-card-assemble
impact | What to expect | 15 | motion | off | limits | push | Each part flips to “works” or “paused”. | split-tilt-cards
before | Before then | 12 | motion | off | ticklist | push | What to do beforehand, ticked in. | waterfall-entry
follow | Follow along | 8 | speaker | beside | steps | end | Where to follow the updates, beside you. | talking-head-recut
`
  ),
  variant(
    {
      id: 'status-update',
      story: 'maintenance',
      name: 'Live update',
      tagline: 'An update while it is still broken',
      purpose:
        'An update while something is still wrong: what we know, the impact so far, what we are doing, and when the next update comes, said plainly on camera.',
      tone: 'Steady, honest',
      pacing: 'Short and factual',
      cover: 'know'
    },
    `
know | What we know | 12 | speaker | full | lowerthird | cut | You, full frame, the time of this update in a lower third. | lower-third talking-head-recut
impact | Impact so far | 12 | data | off | spike | cut | Errors and minutes so far. | chart-scrub-readout
doing | What we are doing | 15 | explainer | corner | recover | push | The mitigation, service by service, with you in the corner. | svg-path-draw pip-pill
next | Next update | 8 | captions | over | headcaps | end | When the next update comes, in captions. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'update-roadmap',
      story: 'product-update',
      name: 'Now, next, later',
      tagline: 'What shipped and what is coming',
      purpose:
        'A quarterly product update: hello from you, what shipped, the roadmap’s now, next and later, and the question you want answered.',
      tone: 'Open, upbeat',
      pacing: 'Column by column',
      cover: 'roadmap'
    },
    `
hello | Hello | 8 | speaker | full | lowerthird | cut | You, full frame, with your name and role. | lower-third talking-head-recut
shipped | Shipped | 25 | motion | off | ticklist | push | What shipped this quarter, ticked in. | waterfall-entry
roadmap | Now, next, later | 30 | motion | corner | roadmap | push | The roadmap’s columns, one card moving to Now, with you in the corner. | grid-card-assemble pip-pill
feedback | Tell us | 12 | speaker | over | question | end | The question you want answered, set over you. | talking-head-recut discrete-text-sequence
`
  ),
  variant(
    {
      id: 'update-letter',
      story: 'product-update',
      name: 'Letter from the team',
      tagline: 'A video letter, with the numbers',
      purpose:
        'A warm letter to users: hello in captions, the numbers that grew, the most-asked-for feature shown, what is next, and a thank-you.',
      tone: 'Warm, grateful',
      pacing: 'Gentle',
      cover: 'numbers'
    },
    `
hello | Hello | 10 | captions | over | headcaps | cut | Hello, to camera, captioned. | caption-editorial-emphasis
numbers | The numbers | 15 | data | off | wrapped | push | The numbers that grew, tile by tile. | dataviz-countup grid-card-assemble
feature | One feature | 25 | capture | corner | cursorzoom | match | The feature people asked for most, shown working. | cursor-ui-demo pip-pill
next | Next | 15 | motion | off | roadmap | push | What comes next. | grid-card-assemble
thanks | Thank you | 8 | speaker | full | speaker | end | A thank-you, full frame. | talking-head-recut
`
  ),
  variant(
    {
      id: 'project-status',
      story: 'project-update',
      name: 'Status report',
      tagline: 'Green, amber, red, and one ask',
      purpose:
        'For the people backing the work: the status at a glance, progress against milestones, the risks and their mitigations, and the one thing you need.',
      tone: 'Factual, brief',
      pacing: 'One screen a point',
      cover: 'status'
    },
    `
status | Status | 12 | motion | off | rag | cut | Scope, schedule, budget and risk at a glance. | grid-card-assemble
progress | Progress | 18 | data | off | hill | push | Each piece of work on the hill: still figuring it out, or making it happen. | chart-scrub-readout
risks | Risks | 15 | motion | off | limits | push | Each risk on a card, turning to its mitigation. | split-tilt-cards
ask | The ask | 10 | speaker | beside | decision | end | The one ask, stamped beside you. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'project-bottom-line',
      story: 'project-update',
      name: 'Bottom line first',
      tagline: 'The answer first, then the detail',
      purpose:
        'For a busy leader: the bottom line beside your face, what moved since last time, the risk that matters, and what you need by when.',
      tone: 'Crisp',
      pacing: 'Answer first',
      cover: 'bottom-line'
    },
    `
bottom-line | Bottom line | 8 | speaker | over | headline | cut | The bottom line, set beside your face. | kinetic-beat-slam
changed | What moved | 15 | data | off | bars | push | What moved since the last update. | stat-bars-and-fills
risk | The risk | 12 | motion | off | rag | push | The one risk that matters, marked red. | grid-card-assemble
ask | The ask | 8 | captions | over | headcaps | end | What you need, and by when, in captions. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'pricing-plain',
      story: 'pricing',
      name: 'Plain and early',
      tagline: 'What changes, who, why, and when',
      purpose:
        'A pricing change explained before it lands: you on camera, what changes and from when, who it affects, why in two numbers, and what to do if it affects you.',
      tone: 'Transparent',
      pacing: 'Unhurried',
      cover: 'change'
    },
    `
bottom-line | The bottom line | 8 | speaker | full | lowerthird | cut | The bottom line first: for most customers the bill stays the same or drops. | lower-third talking-head-recut
change | What changes | 15 | motion | off | pricing | push | Old prices and new, the change marked, and the date it starts. | grid-card-assemble
who | Who it affects | 12 | motion | off | ticklist | push | How to tell whether it affects you. | waterfall-entry
why | Why | 15 | data | off | bars | push | Why, in two numbers. | stat-bars-and-fills
what-to-do | What to do | 10 | speaker | beside | steps | end | What to do if it affects you, beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'pricing-compare',
      story: 'pricing',
      name: 'Old and new',
      tagline: 'The plans side by side, the cheapest path',
      purpose:
        'For a technical audience: old and new plans side by side, what three typical teams pay before and after, the cheapest path for each, and the question everyone asks.',
      tone: 'Even, factual',
      pacing: 'Compare, then advise',
      cover: 'compare'
    },
    `
compare | Old and new | 15 | motion | off | pricing | cut | The plans side by side, the change marked. | comparison-split
usage | By usage | 20 | data | off | bars | push | What three typical teams pay before and after. | bar-chart-race
path | Cheapest path | 15 | explainer | off | tree | push | A decision tree to the cheapest plan for you. | flowchart
faq | The question | 10 | speaker | over | question | end | The question everyone asks, answered to camera. | talking-head-recut
`
  ),
  variant(
    {
      id: 'year-wrapped',
      story: 'year-review',
      name: 'Wrapped',
      tagline: 'The year in big numbers',
      purpose:
        'A year in review as a reel: the year slammed in, the big numbers, the moments month by month, the favourite feature, and a thank-you.',
      tone: 'Celebratory',
      pacing: 'On the beat',
      cover: 'numbers'
    },
    `
year | The year | 5 | motion | off | kinetic | cut | The year, slammed in. | kinetic-beat-slam
numbers | In numbers | 15 | data | off | wrapped | push | The big numbers, tile by tile. | dataviz-countup
moments | Moments | 25 | motion | off | montage | push | The year month by month, one frame each. | grid-card-assemble
favourite | Favourite | 15 | capture | off | resultfirst | push | The feature people loved most, playing. | video-text-pivot
thanks | Thank you | 8 | captions | over | headcaps | end | Thank you, captioned over you. | caption-editorial-emphasis
`
  ),
  variant(
    {
      id: 'year-letter',
      story: 'year-review',
      name: 'Year-end letter',
      tagline: 'Told to camera, the year behind you',
      purpose:
        'A personal year-end note: the year behind you, what you are proud of, what you got wrong, what is next, and a last word.',
      tone: 'Reflective, warm',
      pacing: 'Unhurried',
      cover: 'open'
    },
    `
open | The year | 10 | speaker | over | behind | cut | The year stands giant behind you. | remove-background 3d-text-depth-layers
proud | Proud of | 25 | data | off | wrapped | push | What you are proud of, in numbers. | dataviz-countup
wrong | Got wrong | 20 | motion | off | limits | push | What did not work, on honest cards. | split-tilt-cards
next | Next year | 20 | motion | corner | roadmap | push | What comes next, with you in the corner. | grid-card-assemble pip-pill
close | A last word | 10 | speaker | full | speaker | end | A last word, full frame. | talking-head-recut
`
  ),
  variant(
    {
      id: 'preview-flashes',
      story: 'preview',
      name: 'First look',
      tagline: 'The vision over you, demo flashes, how to get in',
      purpose:
        'A preview announced with energy: the vision in one line over you, three quick demo moments, the exact stage and its limits, and how to get in and give feedback.',
      tone: 'Excited, honest',
      pacing: 'Fast, then clear',
      cover: 'stage'
    },
    `
vision | The vision | 8 | captions | over | headcaps | cut | The vision in one line, captioned over you. | caption-kinetic-slam
demo | Three moments | 25 | capture | off | resultfirst | cut | Three quick demo moments. | video-text-pivot device-surface-showcase
stage | The stage | 12 | motion | off | stages | push | Private, public preview, generally available: where it is now. | waterfall-entry
limits | Not yet | 12 | motion | off | limits | push | What works, and what does not yet. | split-tilt-cards
get-in | Get in | 8 | speaker | over | headline | end | Who gets in and how, set beside your face. | kinetic-beat-slam
`
  ),
  variant(
    {
      id: 'preview-walk',
      story: 'preview',
      name: 'Early access',
      tagline: 'A calm look, beside you, with the stage made clear',
      purpose:
        'A calmer preview walkthrough: what it is beside you, the flow on screen, the stage and the absence of guarantees, and where feedback goes.',
      tone: 'Calm',
      pacing: 'Walkthrough',
      cover: 'flow'
    },
    `
what | What it is | 10 | speaker | beside | decision | cut | What it is, stamped beside you. | titlecard-reveal
flow | The flow | 30 | capture | corner | cursorzoom | match | The flow on screen, cursor-led. | cursor-ui-demo pip-pill
stage | The stage | 12 | motion | off | stages | push | The stage it is in, and what that promises. | waterfall-entry
feedback | Feedback | 8 | speaker | beside | steps | end | Where feedback goes, beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'event-speaker',
      story: 'event',
      name: 'Speaker teaser',
      tagline: 'The claim, the speaker, the date',
      purpose:
        'A teaser that earns sign-ups: a surprising claim from the speaker, three things they will learn, who is speaking, the date and time with its time zone, and how to register.',
      tone: 'Inviting',
      pacing: 'Claim, promise, date',
      cover: 'card'
    },
    `
claim | The claim | 8 | speaker | over | headline | cut | A surprising claim, set beside the speaker’s face. | kinetic-beat-slam
learn | What you will learn | 20 | motion | off | recipes | push | Three things they will learn, one card each. | grid-card-assemble
card | When and who | 12 | motion | off | eventcard | push | The date, the time in UTC, and the speaker. | grid-card-assemble
register | Register | 6 | captions | over | headcaps | end | Register, captioned. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'event-cards',
      story: 'event',
      name: 'Card invite',
      tagline: 'No one on camera, just the session',
      purpose:
        'A quiet invite with no one on camera: the title behind a countdown, the speakers, what they will learn, and the date.',
      tone: 'Clear',
      pacing: 'Card by card',
      cover: 'card'
    },
    `
title | The session | 8 | motion | off | kinetic | cut | The session’s title, in kinetic type. | kinetic-type-beats
speakers | Speakers | 12 | motion | off | teamgrid | push | The speakers, face by face. | grid-card-assemble
learn | What you will learn | 15 | motion | off | ticklist | push | What they will learn, ticked in. | waterfall-entry
card | When | 8 | motion | off | eventcard | end | The date and how to register. | grid-card-assemble
`
  ),
  variant(
    {
      id: 'license-plain',
      story: 'license',
      name: 'Plain answer',
      tagline: 'Who is affected first, then why',
      purpose:
        'A license change explained plainly: who is affected and who is not, said first by you, what exactly changes, why, and where the questions are answered.',
      tone: 'Plain, respectful',
      pacing: 'Unhurried',
      cover: 'who'
    },
    `
who | Who is affected | 12 | speaker | full | lowerthird | cut | You, full frame: who is affected, and who is not. | lower-third talking-head-recut
what | What changes | 15 | code | off | diff | push | The license text, old and new. | css-marker-patterns
why | Why | 15 | captions | over | headcaps | cut | Why, captioned. | caption-editorial-emphasis
faq | Questions | 8 | speaker | beside | steps | end | Where the questions are answered, beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'license-tree',
      story: 'license',
      name: 'Am I affected?',
      tagline: 'A decision tree to your answer',
      purpose:
        'A faceless guide: a decision tree that tells each viewer whether they are affected, the cases on cards, and the date it takes effect.',
      tone: 'Neutral',
      pacing: 'Question by question',
      cover: 'tree'
    },
    `
tree | Am I affected? | 25 | explainer | off | tree | cut | A decision tree to each viewer’s answer. | flowchart
cases | Common cases | 15 | motion | off | limits | push | The common cases, each flipped to its answer. | split-tilt-cards
date | When | 8 | motion | off | kinetic | end | The date it takes effect. | kinetic-beat-slam
`
  ),
  variant(
    {
      id: 'trust-badge',
      story: 'trust',
      name: 'Badge reveal',
      tagline: 'The badge, then what it unlocks',
      purpose:
        'A certification announced for customers: the badge revealed, what it unlocks for them, how you got there, and where to find the report.',
      tone: 'Proud, sober',
      pacing: 'Reveal, then detail',
      cover: 'badge'
    },
    `
badge | The badge | 10 | motion | off | badge | cut | The badge revealed, with what it unlocks. | spring-pop-entrance
unlocks | What it unlocks | 15 | motion | off | ticklist | push | What customers can now do, ticked in. | waterfall-entry
how | How we got there | 20 | data | off | progress | push | The months of work, the milestones pinned. | chart-scrub-readout
report | The report | 8 | speaker | beside | steps | end | Where to request the report, beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'trust-audit',
      story: 'trust',
      name: 'Behind the audit',
      tagline: 'What the auditors checked, told to camera',
      purpose:
        'For security reviewers: what the audit covered, the controls that mattered most, one you had to build, and what it means for their review.',
      tone: 'Precise, candid',
      pacing: 'Control by control',
      cover: 'controls'
    },
    `
covered | What it covered | 12 | speaker | full | lowerthird | cut | You, full frame, with your role: what the audit covered. | lower-third talking-head-recut
controls | The controls | 20 | motion | off | ticklist | push | The controls that mattered most, ticked in. | waterfall-entry
built | One we built | 20 | explainer | corner | safeguard | push | One control you had to build, catching what it should. | physics-press-reaction pip-pill
review | For your review | 8 | motion | off | badge | end | The badge, and what it saves their review. | spring-pop-entrance
`
  )
]
