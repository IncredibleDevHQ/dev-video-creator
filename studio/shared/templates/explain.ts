// Stories that explain: how one thing works, a tour of a system, and a
// paper's one idea. Each table row is a slot: id | role | seconds | type |
// speaker | sketch | seam | move | builds.
import { variant, type TemplateStory } from './model'

export const EXPLAIN_STORIES: TemplateStory[] = [
  {
    id: 'how-it-works',
    group: 'explain',
    name: 'How it works',
    line: 'One concept made concrete: an example before the abstraction.',
    audience: 'Developers who use it but never looked inside'
  },
  {
    id: 'architecture',
    group: 'explain',
    name: 'Architecture tour',
    line: 'A guided tour of a system, from the map to the parts that matter.',
    audience: 'New teammates and the teams that depend on you'
  },
  {
    id: 'paper',
    group: 'explain',
    name: 'Paper explainer',
    line: 'A research paper’s one idea, and what it means for your work.',
    audience: 'Engineers who will not read the paper'
  }
]

export const EXPLAIN_TEMPLATES = [
  variant(
    {
      id: 'how-it-works',
      story: 'how-it-works',
      name: 'One request',
      tagline: 'Follow one request before naming anything',
      purpose:
        'One concept, the way the best teaching channels do it: a hook, one example, the mechanism, the breaking point, the pattern.',
      tone: 'Curious, concrete',
      pacing: 'A reveal on every phrase',
      cover: 'example'
    },
    `
hook | Hook | 8 | motion | off | kinetic | cut | The question lands word by word; one word swaps to show the tension. | kinetic-type-beats kinetic-beat-slam
example | One example | 22 | explainer | off | onerequest | match | Follow one request end to end before anything is named. | svg-path-draw
mechanism | Mechanism | 35 | explainer | off | seqreveal | hold | Components arrive in order, and requests flow along the edges as the voice names each one. | spatial-pan-stations center-outward-expansion flowchart
breaking-point | Breaking point | 25 | explainer | off | overload | zoom | Load ramps; one part overheats and its queue backs up. | reactive-displacement
pattern | The pattern | 20 | motion | off | zoomout | push | Zoom out: the one example becomes the general pattern, and it gets its name. | zoom-out-workspace-reveal grid-card-assemble
recap | Recap | 10 | speaker | beside | recap | end | Three points build while the speaker shares the frame. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'how-it-works-fast',
      story: 'how-it-works',
      name: 'Speed run',
      tagline: 'Fast, faceless, under two minutes',
      purpose:
        'The quick version, voice over moving pictures and no face: the question they half-know, one example, the inside, the code that matters, the gotcha and the rule, in about a hundred seconds.',
      tone: 'Quick, witty, dense',
      pacing: 'A new picture every few seconds',
      cover: 'code'
    },
    `
question | The question | 5 | motion | off | kinetic | cut | The question they half-know, slammed in word by word. | kinetic-type-beats kinetic-beat-slam
example | One example | 18 | explainer | off | onerequest | cut | A single request crosses the system before anything is named. | svg-path-draw
inside | Inside | 30 | explainer | off | seqreveal | zoom | The parts arrive in the order the data meets them, each labelled in place. | spatial-pan-stations flowchart
code | In code | 20 | code | off | codehl | cut | The ten lines that matter, highlighted as the voice reads them. | css-marker-patterns typewriter-reveal
gotcha | The gotcha | 15 | explainer | off | overload | push | The one thing people get wrong, shown breaking. | reactive-displacement
rule | The rule | 12 | motion | off | zoomout | end | Zoom out to the general rule, and it gets its name. | zoom-out-workspace-reveal
`
  ),
  variant(
    {
      id: 'how-it-works-board',
      story: 'how-it-works',
      name: 'At the lightboard',
      tagline: 'You draw it while you explain it',
      purpose:
        'A teacher at a lightboard: you promise what they will understand, the diagram draws itself beside you as you talk, one case walks it, it breaks, and you leave them a rule of thumb.',
      tone: 'Warm, patient, personal',
      pacing: 'One stroke at a time',
      cover: 'draw'
    },
    `
promise | The promise | 10 | speaker | full | lowerthird | cut | You, full frame, say what they will understand by the end; your name sits in a lower third. | talking-head-recut lower-third
draw | Draw the system | 40 | explainer | beside | whiteboard | hold | The diagram draws itself beside you, stroke by stroke, as you name each part. | whiteboard-area svg-path-draw
walk | Walk one case | 35 | explainer | beside | onerequest | match | One request walks the drawing while you point the way. | svg-path-draw split
breaks | Where it breaks | 30 | explainer | off | overload | zoom | The drawing takes the frame; one part overheats as the load climbs. | reactive-displacement coordinate-target-zoom
rule | Rule of thumb | 20 | speaker | over | headline | push | The rule, set large in the space beside your face. | kinetic-beat-slam talking-head-recut
close | Close | 15 | speaker | beside | recap | end | Three points build beside you. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'how-it-works-desk',
      story: 'how-it-works',
      name: 'Desk interview',
      tagline: 'Their questions over you, your answers to camera',
      purpose:
        'An expert at the desk: each part opens with a question a viewer would ask, set over you, which you answer to camera before the sketch takes over.',
      tone: 'Conversational, expert',
      pacing: 'Question, answer, picture',
      cover: 'first-question'
    },
    `
first-question | First question | 10 | speaker | over | question | cut | A viewer’s first question appears over you, and you answer it to camera. | talking-head-recut discrete-text-sequence
on-paper | On paper | 30 | explainer | beside | whiteboard | hold | You sketch it as you talk; the drawing builds beside you. | whiteboard-area svg-path-draw
second-question | Second question | 8 | speaker | over | question | cut | The next question lands over you. | talking-head-recut discrete-text-sequence
failure | The failure | 30 | explainer | off | overload | zoom | The drawing takes the frame, and the failure plays out. | reactive-displacement
last-question | Last question | 8 | speaker | over | question | cut | The question everyone ends on, over you. | talking-head-recut discrete-text-sequence
advice | The advice | 24 | speaker | full | lowerthird | end | Your answer, full frame, with your name in a lower third. | lower-third talking-head-recut
`
  ),
  variant(
    {
      id: 'how-it-works-read',
      story: 'how-it-works',
      name: 'Read along',
      tagline: 'The post on screen, you reacting in a bubble',
      purpose:
        'Your own post as the stage: your take in captions, then the post on screen with its lines marked as you read, its diagram and its code zoomed, and your verdict to camera.',
      tone: 'Opinionated, lively',
      pacing: 'Read, react, zoom',
      cover: 'post'
    },
    `
take | Your take | 6 | captions | over | headcaps | cut | Your one-line take, captioned over your face. | caption-kinetic-slam asr-keyword-glow
post | The post | 30 | capture | corner | readalong | hold | The post on screen, its lines marked as you read them; your bubble reacts. | css-marker-patterns pip-pill 3d-page-scroll
diagram | The diagram | 25 | explainer | corner | spotlight | zoom | Zoom into the post’s diagram; its parts light as you name them. | coordinate-target-zoom ambient-glow-bloom
code | The code | 25 | code | corner | codehl | push | The code block, the lines that matter marked. | css-marker-patterns pip-pill
verdict | The verdict | 14 | captions | over | jumpcut | end | Back to you for the verdict, with a punch-in. | coordinate-target-zoom caption-kinetic-slam
`
  ),
  variant(
    {
      id: 'architecture-map',
      story: 'architecture',
      name: 'Map first',
      tagline: 'The whole map, then a zoom into each part',
      purpose:
        'A system tour from the map down: the whole system, one request through it, the parts by their job, where the data lives, and the honest limits.',
      tone: 'Clear, orderly',
      pacing: 'Zoom levels, one at a time',
      cover: 'map'
    },
    `
map | The map | 15 | explainer | off | c4zoom | zoom | The whole system on one map, then a zoom into the part this tour is about. | multi-phase-camera coordinate-target-zoom
journey | One request | 30 | explainer | corner | spotlight | match | One request lights each part it passes; the rest dims. | svg-path-draw ambient-glow-bloom
parts | The parts | 40 | explainer | corner | layers | hold | Layer by layer, each part named by its job, with you in the corner. | spatial-pan-stations pip-pill
data | Where the data lives | 25 | explainer | off | onerequest | push | Stores and queues light up with what they hold. | flowchart svg-path-draw
limits | Edges and limits | 20 | motion | off | limits | cut | The known limits, on honest cards that flip. | split-tilt-cards
next | Read next | 10 | speaker | beside | steps | end | Three places to read next build beside you. | waterfall-entry
`
  ),
  variant(
    {
      id: 'architecture-guided',
      story: 'architecture',
      name: 'Guided tour',
      tagline: 'You walk them through it, station by station',
      purpose:
        'A tour with a guide: you welcome them, each station arrives beside you, one request makes every hop, you point out the surprising corner, and you open the file to read first.',
      tone: 'Friendly, first person',
      pacing: 'Station by station',
      cover: 'stations'
    },
    `
welcome | Welcome | 10 | speaker | full | lowerthird | cut | You, full frame, with your name and team in a lower third. | lower-third talking-head-recut
stations | Stations | 40 | explainer | beside | seqreveal | push | Station by station, each part arrives beside you as you name it. | spatial-pan-stations split
hops | Every hop | 30 | explainer | corner | onerequest | match | One request makes every hop while you narrate from the corner. | svg-path-draw camera-journey pip-pill
surprise | The surprising corner | 15 | speaker | over | headline | cut | The one thing nobody expects, set beside your face. | kinetic-beat-slam
start-here | Start reading here | 20 | code | corner | codehl | push | The file to read first, its key lines marked, with you in the corner. | camera-cursor-tracking css-marker-patterns pip-pill
owners | Who owns what | 10 | speaker | beside | checklist | end | Owners tick in beside you. | talking-head-recut waterfall-entry
`
  ),
  variant(
    {
      id: 'paper-figure',
      story: 'paper',
      name: 'The one figure',
      tagline: 'The result, then the figure that proves it',
      purpose:
        'A paper told through its key figure: the result first, why the problem was hard, the figure zoomed, the idea built part by part, the limits, and what it unlocks.',
      tone: 'Careful, plain-spoken',
      pacing: 'Slow on the figure, brisk elsewhere',
      cover: 'figure'
    },
    `
result | The result | 10 | data | off | bars | cut | The headline result races the old best. | bar-chart-race stat-bars-and-fills
hard | Why it was hard | 20 | explainer | off | overload | match | Why the problem resisted: the old approach strains and stalls. | reactive-displacement
figure | The figure | 30 | explainer | off | figure | zoom | Zoom into the one figure that carries the idea; its key bar grows. | coordinate-target-zoom data-chart
idea | The idea | 35 | explainer | corner | seqreveal | hold | The mechanism, built part by part, with you in the corner. | spatial-pan-stations pip-pill
limits | The limits | 15 | motion | off | limits | push | What the paper does not show, card by card. | split-tilt-cards
unlocks | What it unlocks | 10 | speaker | beside | recap | end | What it means for your work, beside you. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'paper-plain',
      story: 'paper',
      name: 'In plain words',
      tagline: 'The title behind you, the idea in your words',
      purpose:
        'You take the paper personally: its title stands behind you, one sentence from it as a pull quote, your plain-words version in captions, the proof zoomed, and where it shows up in your code.',
      tone: 'Enthusiastic, plain-spoken',
      pacing: 'Talk, then show',
      cover: 'title'
    },
    `
title | The title | 8 | speaker | over | behind | cut | The paper’s title stands giant behind you. | remove-background 3d-text-depth-layers
quote | In their words | 15 | motion | off | quote | hold | One sentence from the paper as a pull quote, the key phrase underlined. | css-marker-patterns titlecard-reveal
plain | In plain words | 35 | captions | over | headcaps | cut | You explain it in plain words; the captions mark the terms. | caption-editorial-emphasis asr-keyword-glow
proof | The proof | 25 | explainer | off | figure | zoom | The figure, zoomed, its key bar lit. | coordinate-target-zoom data-chart
use | Use it | 17 | code | beside | codehl | end | Where it shows up in your code, beside you. | css-marker-patterns split
`
  ),
  variant(
    {
      id: 'paper-reel',
      story: 'paper',
      name: 'Result reel',
      tagline: 'The result plays first, no one on camera',
      purpose:
        'A brisk, faceless reel: the result itself playing, what earlier work managed, the key idea on its figure, the numbers against the baseline, and what it unlocks.',
      tone: 'Excited, brisk',
      pacing: 'Result first, then why',
      cover: 'result'
    },
    `
result | The result | 8 | capture | off | resultfirst | cut | The result itself, playing, before any explanation. | video-text-pivot
before | Before this | 15 | explainer | off | thennow | push | What earlier work managed, wiped across to what this one does. | comparison-split
key-idea | The key idea | 30 | explainer | off | figure | zoom | The one figure, zoomed, the idea labelled in place. | coordinate-target-zoom data-chart
numbers | The numbers | 20 | data | off | bars | push | Against the baseline, racing. | bar-chart-race
next | What comes next | 7 | motion | off | kinetic | end | What it unlocks, in a few words. | kinetic-type-beats
`
  )
]
