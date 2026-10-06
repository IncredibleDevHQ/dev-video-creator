// Stories that explain how a team builds: a data pipeline, how you ship, a
// testing strategy and a point of view. Each table row is a slot: id | role |
// seconds | type | speaker | sketch | seam | move | builds.
import { variant, type TemplateStory } from './model'

export const PRACTICE_STORIES: TemplateStory[] = [
  {
    id: 'data-pipeline',
    group: 'explain',
    name: 'Data pipeline',
    line: 'Where an event is born, every hop it makes, and who uses it at the end.',
    audience: 'Engineers and analysts who depend on the data'
  },
  {
    id: 'platform',
    group: 'explain',
    name: 'How we ship',
    line: 'The path from an idea to production, and what the platform does for it.',
    audience: 'Engineers here and the ones you hope to hire'
  },
  {
    id: 'testing',
    group: 'explain',
    name: 'Testing strategy',
    line: 'The shape of your test suite, and why the textbook did not fit.',
    audience: 'Teams fighting slow or flaky CI'
  },
  {
    id: 'essay',
    group: 'explain',
    name: 'Point of view',
    line: 'An argued opinion: the common belief, a better model, the objections.',
    audience: 'Engineers who like a strong argument'
  }
]

export const PRACTICE_TEMPLATES = [
  variant(
    {
      id: 'pipeline-event',
      story: 'data-pipeline',
      name: 'Follow one event',
      tagline: 'One event, every hop, a stopwatch at each',
      purpose:
        'A data pipeline told through one event: where it is born, the volume around it, each stage it passes with the time it takes, how the pipeline changed over the years, and who reads the result.',
      tone: 'Curious, calm',
      pacing: 'Hop by hop',
      cover: 'hops'
    },
    `
born | Where it starts | 10 | explainer | off | onerequest | cut | One event is born when a user presses play. | svg-path-draw
volume | The volume | 10 | data | off | bignumber | push | How many like it arrive every day. | counting-dynamic-scale
hops | Hop by hop | 30 | explainer | off | pipeline | hold | The event travels each stage, the time at every hop. | svg-path-draw flowchart
generations | Generations | 20 | explainer | corner | thennow | push | The batch pipeline of then, wiped to the streaming one of now, with you in the corner. | comparison-split pip-pill
readers | Who reads it | 15 | explainer | off | seqreveal | end | The teams and systems that read the result, one by one. | spatial-pan-stations
`
  ),
  variant(
    {
      id: 'pipeline-counters',
      story: 'data-pipeline',
      name: 'Live counters',
      tagline: 'The scale over your face, then the flow',
      purpose:
        'The punchy version: the daily scale set beside your face, the pipeline with its counters running, the slowest hop, and the one thing you would change.',
      tone: 'Energetic',
      pacing: 'Fast',
      cover: 'flow'
    },
    `
scale | The scale | 8 | speaker | over | headline | cut | Events a day, set beside your face. | kinetic-beat-slam counting-dynamic-scale
flow | The flow | 25 | explainer | off | pipeline | push | The pipeline with its counters running. | svg-path-draw
slowest | The slowest hop | 15 | data | off | trace | zoom | The hop that costs the most time, zoomed. | coordinate-target-zoom
change | One change | 8 | captions | over | headcaps | end | The one thing you would change, captioned. | caption-editorial-emphasis
`
  ),
  variant(
    {
      id: 'platform-golden-path',
      story: 'platform',
      name: 'Golden path',
      tagline: 'Two weeks of waiting, collapsed',
      purpose:
        'How you ship, as a journey: an engineer’s path before, with its waiting, the golden path that replaced it, a service going from idea to production, how many teams use it, and the trade-off.',
      tone: 'Matter-of-fact',
      pacing: 'Before, after, proof',
      cover: 'journey'
    },
    `
before | Before | 12 | motion | off | pileup | cut | A new service, and the tickets and waits piling up. | overwhelm-surround
journey | The golden path | 25 | explainer | off | journey | hold | The steps from idea to production, the waiting between them collapsing. | camera-journey
demo | Idea to production | 25 | capture | corner | cursorzoom | match | A new service created and deployed, cursor-led, with you in the corner. | cursor-ui-demo pip-pill
adoption | Adoption | 12 | data | off | bignumber | push | How many teams ship this way now. | counting-dynamic-scale
tradeoff | The trade-off | 10 | speaker | beside | recap | end | What it costs you to keep the path paved, beside you. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'platform-deploy',
      story: 'platform',
      name: 'Deploy day',
      tagline: 'One change through the pipeline, your bubble along',
      purpose:
        'A real deploy, start to finish: the change, the checks, the staged rollout stepping through its percentages, the dashboards watching, and done.',
      tone: 'Hands-on',
      pacing: 'Real time, trimmed',
      cover: 'rollout'
    },
    `
change | The change | 10 | code | corner | diff | cut | The change going out, with you in a bubble. | css-marker-patterns pip-pill
checks | The checks | 15 | capture | corner | stream | push | The checks run and turn green. | agent-progress-theater
rollout | Staged rollout | 20 | explainer | off | rollout | hold | The rollout steps from a few hosts to all of them. | svg-path-draw
watch | Watching | 15 | data | off | slo | push | The dashboards watching the error budget. | chart-scrub-readout
done | Done | 6 | captions | over | headcaps | end | Done, and how long it took, captioned. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'testing-shape',
      story: 'testing',
      name: 'Our shape',
      tagline: 'The pyramid that did not fit, and ours',
      purpose:
        'Your testing strategy argued calmly: the flaky CI, the textbook pyramid, why it did not fit, the shape you chose, one real test, and what changed.',
      tone: 'Reasoned',
      pacing: 'Problem, model, proof',
      cover: 'shape'
    },
    `
flaky | Flaky CI | 10 | data | off | spike | cut | The flaky runs, red on the chart. | chart-scrub-readout
shape | The shape | 25 | explainer | beside | testshape | hold | The textbook pyramid turns into the shape that fits you, beside you. | card-morph-anchor split
one-test | One real test | 20 | code | off | codehl | push | One test from the suite, its key lines marked. | css-marker-patterns
results | Results | 15 | data | off | bars | push | CI time and flaky runs, before and after. | bar-chart-race
rule | The rule | 8 | speaker | over | headline | end | Your rule for what to test, set beside your face. | kinetic-beat-slam
`
  ),
  variant(
    {
      id: 'testing-fast',
      story: 'testing',
      name: 'Faster CI',
      tagline: 'CI minutes melting away, no one on camera',
      purpose:
        'The results-first version: CI time shrinking, the shape change behind it, the tests you deleted, and the rule you keep.',
      tone: 'Brisk',
      pacing: 'Numbers first',
      cover: 'minutes'
    },
    `
minutes | The minutes | 10 | data | off | race | cut | Old CI and new CI run side by side. | comparison-split
shape | The shape | 20 | explainer | off | testshape | push | The pyramid becomes a honeycomb. | card-morph-anchor
deleted | Deleted | 15 | code | off | diff | push | The slow end-to-end tests you deleted. | css-marker-patterns
rule | The rule | 6 | motion | off | kinetic | end | The rule, in a few words. | kinetic-beat-slam
`
  ),
  variant(
    {
      id: 'essay-argument',
      story: 'essay',
      name: 'The argument',
      tagline: 'Thesis, the common belief, a better model',
      purpose:
        'A point of view made carefully: the thesis, the belief most people hold, a simple model drawn beside you, the objections answered, and the rule it leaves you with.',
      tone: 'Thoughtful, firm',
      pacing: 'One idea at a time',
      cover: 'model'
    },
    `
thesis | The thesis | 8 | motion | off | kinetic | cut | Your thesis, in a few words. | kinetic-type-beats
belief | The common belief | 15 | motion | off | quote | push | What most people believe, as a pull quote. | titlecard-reveal
model | A better model | 30 | explainer | beside | whiteboard | hold | The model, drawn beside you as you explain it. | whiteboard-area svg-path-draw
objections | Objections | 20 | motion | off | limits | push | The strongest objections, each flipped to your answer. | split-tilt-cards
rule | The rule | 10 | speaker | beside | recap | end | The rule it leaves you with, beside you. | titlecard-reveal
`
  ),
  variant(
    {
      id: 'essay-take',
      story: 'essay',
      name: 'Hot take',
      tagline: 'The take, the evidence, the verdict',
      purpose:
        'A strong opinion in under a minute: the take behind you, the belief it overturns, the evidence, and your verdict to camera.',
      tone: 'Bold, funny',
      pacing: 'Punchy',
      cover: 'take'
    },
    `
take | The take | 8 | speaker | over | behind | cut | The take stands giant behind you. | remove-background 3d-text-depth-layers
belief | What people think | 10 | motion | off | mythfact | push | What people think, flipped to what is true. | split-tilt-cards
evidence | Evidence | 20 | data | off | bars | push | The numbers behind the take. | bar-chart-race
verdict | Verdict | 8 | captions | over | jumpcut | end | Your verdict, with a punch-in. | coordinate-target-zoom caption-kinetic-slam
`
  )
]
