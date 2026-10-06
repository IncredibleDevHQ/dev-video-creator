// Stories that teach: a quickstart, a feature tutorial, an integration, the
// fix for an error, a quick tip and a first tour. Each table row is a slot:
// id | role | seconds | type | speaker | sketch | seam | move | builds.
import { variant, type TemplateStory } from './model'

export const TEACH_STORIES: TemplateStory[] = [
  {
    id: 'quickstart',
    group: 'teach',
    name: 'Quickstart',
    line: 'From nothing to a first success in a few minutes.',
    audience: 'Developers trying it for the first time'
  },
  {
    id: 'tutorial',
    group: 'teach',
    name: 'Feature tutorial',
    line: 'One feature used end to end, with the error everyone hits.',
    audience: 'Developers trying it for the first time'
  },
  {
    id: 'integration',
    group: 'teach',
    name: 'Integration guide',
    line: 'Connect it to the tools people already use, and what that makes possible.',
    audience: 'Teams wiring it into their stack'
  },
  {
    id: 'troubleshooting',
    group: 'teach',
    name: 'Fix an error',
    line: 'One error people hit, the fix first, then why it happens.',
    audience: 'Someone stuck on this error right now'
  },
  {
    id: 'tip',
    group: 'teach',
    name: 'Quick tip',
    line: 'One useful thing in under a minute.',
    audience: 'Engineers who want one thing they can use today'
  },
  {
    id: 'onboarding',
    group: 'teach',
    name: 'Onboarding tour',
    line: 'A welcome for new users: the first things to do, shown.',
    audience: 'People who just signed up'
  },
  {
    id: 'api',
    group: 'teach',
    name: 'API walkthrough',
    line: 'The model behind the API, one full request and response, and the error people hit.',
    audience: 'Developers integrating it'
  },
  {
    id: 'recipes',
    group: 'teach',
    name: 'Three ways to use it',
    line: 'Uses people have not tried yet, each shown in under twenty seconds.',
    audience: 'People who already use it'
  },
  {
    id: 'faq',
    group: 'teach',
    name: 'FAQ answer',
    line: 'One question, answered in one line, then shown.',
    audience: 'People who typed this exact question'
  },
  {
    id: 'switching',
    group: 'teach',
    name: 'Switching guide',
    line: 'Coming from another tool: what maps to what, and the move.',
    audience: 'Teams moving from a competitor'
  }
]

export const TEACH_TEMPLATES = [
  variant(
    {
      id: 'quickstart-clock',
      story: 'quickstart',
      name: 'Against the clock',
      tagline: 'Zero to working, the timer running',
      purpose:
        'A quickstart that proves it is quick: the result first, the install and the key with your bubble on screen, the first call, and the clock stopping when it works.',
      tone: 'Brisk, encouraging',
      pacing: 'Real time, lightly trimmed',
      cover: 'works'
    },
    `
goal | What you will have | 6 | capture | corner | resultfirst | cut | What they will have in five minutes, playing, the timer ready to start. | video-text-pivot pip-pill
install | Install | 14 | code | corner | bubbleterm | match | One install command, typed, with your bubble beside it. | typewriter-reveal pip-pill
key | Add your key | 12 | capture | corner | cursorzoom | match | The dashboard, cursor-led to the key and back to the editor. | cursor-ui-demo camera-cursor-tracking pip-pill
first-call | First call | 18 | code | off | apiflow | push | The first request and its response, side by side. | typewriter-reveal
works | It works | 10 | motion | off | quickstart | cut | The steps tick off and the clock stops: a 200 OK, a live URL. | agent-progress-theater counting-dynamic-scale
next | Next | 10 | speaker | beside | steps | end | Three places to go next, beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'quickstart-code',
      story: 'quickstart',
      name: 'Code only',
      tagline: 'No one on camera, just the steps',
      purpose:
        'A faceless quickstart for the docs page: the result, the steps, the first request and its response, the same call in your own code, and where to go next.',
      tone: 'Plain, precise',
      pacing: 'One step a beat',
      cover: 'request'
    },
    `
result | The result | 6 | capture | off | resultfirst | cut | The working result, first. | video-text-pivot
steps | The steps | 18 | motion | off | quickstart | push | Install, add a key, first request: each ticks off against the clock. | agent-progress-theater
request | First request | 18 | code | off | apiflow | push | The request and the response, side by side. | typewriter-reveal
code | In your code | 18 | code | off | codehl | push | The same call in your own code, its key lines marked. | css-marker-patterns
next | Next | 8 | motion | off | ticklist | end | Where to go next, ticked in. | waterfall-entry
`
  ),
  variant(
    {
      id: 'feature-deep-dive',
      story: 'tutorial',
      name: 'Engineer to engineer',
      tagline: 'The problem in code, a live run, the limits',
      purpose:
        'Engineer to engineer: the problem in today’s code, a live run, how it works inside, the honest limits, and how to start.',
      tone: 'Peer to peer, honest',
      pacing: 'Code, run, explain',
      cover: 'problem-in-code'
    },
    `
problem-in-code | The problem in code | 25 | code | off | codehl | cut | The painful lines light up in the code people write today. | css-marker-patterns
live-run | Live run | 40 | capture | corner | stream | match | Run it: output streams, and the result pops. | transcript-scroll-artifact-reveal agent-progress-theater
inside | How it works | 50 | explainer | off | layers | hold | The request lights each layer it passes through. | multi-phase-camera
limits | Limits | 30 | motion | off | limits | push | Honest limits: cards flip to “works” or “not yet”. | split-tilt-cards grid-card-assemble
get-started | Get started | 35 | speaker | beside | steps | end | Three steps build beside the speaker. | talking-head-recut waterfall-entry
`
  ),
  variant(
    {
      id: 'tutorial-follow',
      story: 'tutorial',
      name: 'Follow along',
      tagline: 'On screen, step by step, your bubble along',
      purpose:
        'A tutorial they can follow: the result first, setup in the terminal, the build step by step on screen, the error everyone hits, a check that it works, and where to go next.',
      tone: 'Patient, practical',
      pacing: 'Step by step, in chapters',
      cover: 'build'
    },
    `
goal | The goal | 8 | capture | corner | resultfirst | cut | What they will have at the end, playing. | video-text-pivot pip-pill
setup | Set up | 20 | code | corner | bubbleterm | match | Install and configure, command by command. | typewriter-reveal pip-pill
build | Build it | 40 | capture | corner | bubble | match | Step by step on screen; your bubble follows along. | cursor-ui-demo camera-cursor-tracking pip-pill
error | The usual error | 15 | code | corner | logzoom | zoom | The error everyone hits, zoomed, and its fix. | coordinate-target-zoom pip-pill
check | Check it | 15 | capture | corner | stream | push | Run it; the output streams and the result pops. | transcript-scroll-artifact-reveal
next | Next steps | 12 | speaker | beside | steps | end | Three steps to go further, beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'integration-steps',
      story: 'integration',
      name: 'Step by step',
      tagline: 'Connect, send a test, done',
      purpose:
        'Connecting the two tools on screen: what you get, where the keys are, the connection, a test event flowing through, and what to build next.',
      tone: 'Practical',
      pacing: 'Click by click',
      cover: 'connect'
    },
    `
outcome | What you get | 8 | capture | corner | resultfirst | cut | The two tools working together, first. | video-text-pivot pip-pill
keys | The keys | 15 | capture | corner | bubble | match | Where to find the keys, cursor-led, your bubble along. | cursor-ui-demo pip-pill
connect | Connect | 20 | explainer | corner | integration | push | The two sides connect, and events start to flow. | svg-path-draw pip-pill
test | Send a test | 15 | code | off | apiflow | push | A test event and its response. | typewriter-reveal
next | Limits and next | 12 | speaker | beside | steps | end | What it does not sync, and three things to build with it, beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'integration-recipes',
      story: 'integration',
      name: 'Three recipes',
      tagline: 'Three things to build with it',
      purpose:
        'Three recipes instead of a manual: the promise beside your face, the connection, three uses each shown working, the code behind the best one, and where to find more.',
      tone: 'Upbeat, inventive',
      pacing: 'One recipe a beat',
      cover: 'recipes'
    },
    `
promise | The promise | 8 | speaker | over | headline | cut | What the integration makes possible, set beside your face. | kinetic-beat-slam
connect | Connect | 12 | explainer | off | integration | push | The two sides connect. | svg-path-draw
recipes | Three recipes | 40 | motion | off | recipes | push | Three uses, one card each, each shown working. | grid-card-assemble
code | The code | 15 | code | beside | codehl | push | The few lines behind the best one, beside you. | css-marker-patterns split
more | More | 8 | captions | over | headcaps | end | Where to find more recipes, in captions. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'fix-first',
      story: 'troubleshooting',
      name: 'Fix first',
      tagline: 'The error, the fix, then why',
      purpose:
        'For someone stuck right now: the exact error, the fix straight away, then why it happens and how to keep it from coming back.',
      tone: 'Direct, calm',
      pacing: 'The fix in the first ten seconds',
      cover: 'error'
    },
    `
error | The error | 8 | code | off | errorfix | cut | The exact error message, and the fix beneath it. | typewriter-reveal
fix | The fix | 14 | code | off | diff | push | The change that fixes it, as a diff. | css-marker-patterns
why | Why it happens | 25 | explainer | corner | onerequest | zoom | What actually goes wrong, one request at a time, with you in the corner. | svg-path-draw pip-pill
prevent | Keep it fixed | 15 | motion | off | ticklist | push | Three checks that keep it from coming back. | waterfall-entry
recap | Recap | 8 | captions | over | headcaps | end | The fix in one line, captioned over you. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'fix-walkthrough',
      story: 'troubleshooting',
      name: 'Walk it through',
      tagline: 'Reproduce, read, fix, verify',
      purpose:
        'A support walkthrough on screen: reproduce the error, read what it says, find the cause, fix it in the terminal and verify it, your camera in a bubble.',
      tone: 'Patient, reassuring',
      pacing: 'Step by step',
      cover: 'read'
    },
    `
reproduce | Reproduce it | 15 | capture | corner | bubble | cut | The error on screen, your bubble in the corner. | pip-pill camera-cursor-tracking
read | Read the error | 15 | code | corner | errorfix | zoom | Zoom into the message; the part that matters gets marked. | coordinate-target-zoom css-marker-patterns
cause | The cause | 20 | explainer | corner | fault | hold | Where it goes wrong, traced across the system. | svg-path-draw pip-pill
fix | Fix it | 15 | code | corner | bubbleterm | push | The fix, typed in the terminal. | typewriter-reveal pip-pill
verify | Verify | 12 | capture | corner | stream | push | Run it again; the output comes back clean. | transcript-scroll-artifact-reveal
escalate | Still stuck? | 8 | speaker | beside | steps | end | The next likely cause, and where to ask, beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'tip-short',
      story: 'tip',
      name: 'TIL short',
      tagline: 'One tip, captioned, under a minute',
      purpose:
        'One useful thing in under a minute: the itch in captions over you, the tip itself, a real before and after, and the payoff with a punch-in.',
      tone: 'Light, quick',
      pacing: 'A cut every few seconds',
      cover: 'tip'
    },
    `
itch | The itch | 6 | captions | over | headcaps | cut | The everyday annoyance, captioned over your face. | caption-kinetic-slam
tip | The tip | 14 | code | off | tipcard | cut | The command or setting, typed, with what it returns. | typewriter-reveal
example | In use | 14 | code | off | diff | push | A real before and after. | css-marker-patterns
payoff | The payoff | 6 | captions | over | jumpcut | end | What it saves you, with a punch-in. | coordinate-target-zoom caption-kinetic-slam
`
  ),
  variant(
    {
      id: 'tip-card',
      story: 'tip',
      name: 'Tip card',
      tagline: 'A tip as a card, no one on camera',
      purpose:
        'A tip for the docs or a feed: the problem in a few words, the tip, where it helps, and the rule to remember.',
      tone: 'Crisp',
      pacing: 'Quick',
      cover: 'tip'
    },
    `
problem | The problem | 5 | motion | off | kinetic | cut | The problem, in a few words. | kinetic-type-beats
tip | The tip | 14 | code | off | tipcard | push | The tip, typed. | typewriter-reveal
example | Where it helps | 14 | code | off | codehl | push | Where it helps, the lines marked. | css-marker-patterns
rule | The rule | 6 | motion | off | kinetic | end | The rule to remember. | kinetic-beat-slam
`
  ),
  variant(
    {
      id: 'onboarding-tour',
      story: 'onboarding',
      name: 'First steps',
      tagline: 'You welcome them, then the first three things',
      purpose:
        'A welcome for new users: you say hello, the first three things to do as a checklist, the first two shown on screen, and where to get help.',
      tone: 'Welcoming',
      pacing: 'Gentle',
      cover: 'checklist'
    },
    `
welcome | Welcome | 8 | speaker | full | lowerthird | cut | You, full frame: in two minutes they will have their first result. | lower-third talking-head-recut
checklist | First steps | 15 | motion | off | onboarding | push | The first three steps, the ring filling as each is done. | agent-progress-theater
step-one | Step one | 15 | capture | corner | cursorzoom | match | The first step on screen, cursor-led. | cursor-ui-demo pip-pill
step-two | Step two | 15 | capture | corner | bubble | match | The next step, your bubble along. | cursor-ui-demo pip-pill
help | Help | 8 | speaker | beside | steps | end | Where to get help, beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'onboarding-silent',
      story: 'onboarding',
      name: 'Product tour',
      tagline: 'A silent tour of the essentials',
      purpose:
        'A faceless tour for inside the product: what they can make, the three essentials, the product cursor-led, and the first action.',
      tone: 'Clear',
      pacing: 'One screen a beat',
      cover: 'essentials'
    },
    `
result | What you can make | 6 | capture | off | resultfirst | cut | What they can make, first. | video-text-pivot
essentials | Essentials | 25 | motion | off | recipes | push | The three essentials, one card each. | grid-card-assemble
tour | The tour | 25 | capture | off | cursorzoom | match | The product, cursor-led. | cursor-ui-demo
start | Start | 6 | motion | off | cta | end | The first action, pressed. | cta-morph-press
`
  ),
  variant(
    {
      id: 'api-three-calls',
      story: 'api',
      name: 'Three calls',
      tagline: 'The whole integration in three requests',
      purpose:
        'An API walkthrough beside you: the model behind it, how to authenticate, one full request and its response anatomy, the error people hit, and where the reference lives.',
      tone: 'Precise, friendly',
      pacing: 'Call by call',
      cover: 'request'
    },
    `
model | The model | 15 | explainer | beside | seqreveal | cut | The objects and how they relate, built beside you. | flowchart split
auth | Authenticate | 12 | code | off | tipcard | push | The key, set once, masked on screen. | typewriter-reveal
request | Request and response | 25 | code | off | apiflow | push | One full request and its response, the fields that matter called out. | typewriter-reveal
error | The usual error | 12 | code | off | errorfix | push | The error people hit, and the fix. | typewriter-reveal
reference | Reference | 8 | speaker | beside | steps | end | Where the full reference lives, beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'api-terminal',
      story: 'api',
      name: 'Terminal only',
      tagline: 'Requests and responses, no one on camera',
      purpose:
        'A faceless API tour in the terminal: the promise, each call typed with its response, the error and its fix, and the next call to try.',
      tone: 'Terse',
      pacing: 'Type, answer, next',
      cover: 'calls'
    },
    `
promise | The promise | 5 | motion | off | kinetic | cut | Three calls are the whole integration. | kinetic-type-beats
calls | The calls | 30 | code | off | apiflow | push | Each call typed, each response beside it. | typewriter-reveal
error | The error | 12 | code | off | errorfix | push | The error people hit, and the fix. | typewriter-reveal
next | Next call | 6 | motion | off | kinetic | end | The next call to try. | kinetic-beat-slam
`
  ),
  variant(
    {
      id: 'recipes-countdown',
      story: 'recipes',
      name: 'Countdown',
      tagline: 'Three uses, numbered, best one last',
      purpose:
        'Three uses people have not tried, introduced by you and counted down: each one its situation, the move and the result, the best one last.',
      tone: 'Playful',
      pacing: 'Under twenty seconds a use',
      cover: 'uses'
    },
    `
promise | The promise | 6 | speaker | over | headline | cut | Three things it does that they have not tried, beside your face. | kinetic-beat-slam
uses | The uses | 45 | motion | off | recipes | push | Each use on its numbered card: the situation, the move, the result. | grid-card-assemble
best | The best one | 15 | capture | corner | cursorzoom | match | The best one, shown working, with you in the corner. | cursor-ui-demo pip-pill
more | More | 6 | captions | over | headcaps | end | Where to find more, captioned. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'recipes-screen',
      story: 'recipes',
      name: 'On screen',
      tagline: 'Three uses, recorded, your bubble along',
      purpose:
        'Three uses recorded on screen with your bubble in the corner, each in the same layout so they are easy to skim.',
      tone: 'Practical',
      pacing: 'Same layout every time',
      cover: 'first'
    },
    `
first | First use | 20 | capture | corner | bubble | cut | The first use, start to result. | cursor-ui-demo pip-pill
second | Second use | 20 | capture | corner | cursorzoom | cut | The second, zoomed on every click. | cursor-ui-demo camera-cursor-tracking
third | Third use | 20 | code | corner | bubbleterm | cut | The third, in the terminal. | typewriter-reveal pip-pill
recap | Recap | 8 | motion | off | recipes | end | All three, side by side. | grid-card-assemble
`
  ),
  variant(
    {
      id: 'faq-asked',
      story: 'faq',
      name: 'Asked and answered',
      tagline: 'The question over you, the answer in a line',
      purpose:
        'One question as people type it, set over you; the one-line answer; it shown working; the caveat; and where to read more.',
      tone: 'Direct',
      pacing: 'Under a minute',
      cover: 'question'
    },
    `
question | The question | 6 | speaker | over | question | cut | The question, as people type it, set over you. | talking-head-recut discrete-text-sequence
answer | The answer | 8 | captions | over | headcaps | cut | The answer in one line, captioned. | caption-editorial-emphasis
show | Shown | 20 | capture | off | cursorzoom | push | The answer shown working. | cursor-ui-demo
caveat | The caveat | 8 | motion | off | limits | end | The one caveat, on a card. | split-tilt-cards
`
  ),
  variant(
    {
      id: 'faq-card',
      story: 'faq',
      name: 'Answer card',
      tagline: 'The answer as a card beside you',
      purpose:
        'A calmer answer: the question as a title, a short answer card beside you, a picture that proves it, and the link.',
      tone: 'Helpful',
      pacing: 'Unhurried',
      cover: 'answer'
    },
    `
question | The question | 6 | motion | off | kinetic | cut | The question as a title. | kinetic-type-beats
answer | The answer | 15 | speaker | beside | decision | push | The answer card stamps beside you. | titlecard-reveal
proof | The proof | 20 | explainer | off | onerequest | push | A picture that proves it. | svg-path-draw
link | Read more | 6 | motion | off | cta | end | The link, pressed. | cta-morph-press
`
  ),
  variant(
    {
      id: 'switching-map',
      story: 'switching',
      name: 'What maps to what',
      tagline: 'Their concepts, ours, and one import',
      purpose:
        'A guide for people arriving from another tool: what maps to what, the import command, what works differently, a check that it all moved, and help, your bubble along.',
      tone: 'Welcoming, precise',
      pacing: 'Map, move, check',
      cover: 'map'
    },
    `
map | What maps to what | 20 | explainer | off | mapping | cut | Their concepts on the left, ours on the right, joined one by one. | svg-path-draw
import | The import | 15 | code | corner | bubbleterm | push | One import command, typed, with your bubble beside it. | typewriter-reveal pip-pill
different | What is different | 15 | motion | off | limits | push | The few things that work differently, on cards. | split-tilt-cards
check | Check it moved | 15 | capture | corner | stream | push | Everything running in its new home. | transcript-scroll-artifact-reveal
help | Help | 8 | speaker | beside | steps | end | Where to ask for help moving, beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'switching-why',
      story: 'switching',
      name: 'Why people switch',
      tagline: 'Their reasons, then the move',
      purpose:
        'The reasons first: why teams switch in their own words, the side-by-side difference, the import, and how long it took them.',
      tone: 'Confident, fair',
      pacing: 'Reasons, then the move',
      cover: 'side-by-side'
    },
    `
reasons | Their reasons | 10 | captions | over | headcaps | cut | Why teams switch, captioned over you. | caption-editorial-emphasis
side-by-side | Side by side | 15 | motion | off | versus | push | The two, side by side on what matters. | comparison-split
import | The import | 15 | code | off | tipcard | push | The one command that moves it. | typewriter-reveal
took | How long it took | 8 | data | off | bignumber | end | How long it took, counting up. | counting-dynamic-scale
`
  )
]
