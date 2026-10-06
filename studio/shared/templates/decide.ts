// Stories that decide: a design decision and a comparison. Each table row is
// a slot: id | role | seconds | type | speaker | sketch | seam | move |
// builds.
import { variant, type TemplateStory } from './model'

export const DECIDE_STORIES: TemplateStory[] = [
  {
    id: 'design-decision',
    group: 'decide',
    name: 'Design decision',
    line: 'An RFC or ADR in minutes: the decision, why, and what else was on the table.',
    audience: 'Engineers on and around the team'
  },
  {
    id: 'comparison',
    group: 'decide',
    name: 'Comparison',
    line: 'One option or the other, judged fairly on what matters to your readers.',
    audience: 'Developers choosing between tools'
  }
]

export const DECIDE_TEMPLATES = [
  variant(
    {
      id: 'design-decision',
      story: 'design-decision',
      name: 'Decision first',
      tagline: 'A design doc or RFC, decision first',
      purpose:
        'A design doc or RFC in three minutes: the decision first, then why, then what else was considered.',
      tone: 'Candid, decision-first',
      pacing: 'Calm; one idea per diagram',
      cover: 'decision'
    },
    `
decision | Decision | 15 | speaker | beside | decision | cut | The one-line decision stamps onto a card while the author says it. | titlecard-reveal spring-pop-entrance
context | Context | 25 | explainer | off | c4zoom | match | Wide, then zoom: the system in context, then one part opens and the painful path glows. | multi-phase-camera coordinate-target-zoom
proposal | Proposal | 60 | explainer | corner | spotlight | push | Spotlight walk: each component lights in turn, the rest dims, and a request travels the new path. | svg-path-draw ambient-glow-bloom
trade-offs | Trade-offs | 40 | motion | off | tradeoff | cover | Each alternative gets one honest line, then folds away with the constraint it broke. | comparison-split grid-card-assemble card-morph-anchor
rollout | Risks and rollout | 25 | motion | off | rollout | cut | The rollout line draws; risks pin onto the phase they threaten. | svg-path-draw waterfall-entry
ask | The ask | 15 | speaker | beside | checklist | end | Owners and dates tick in beside the author. | talking-head-recut
`
  ),
  variant(
    {
      id: 'decision-pitch',
      story: 'design-decision',
      name: 'The pitch',
      tagline: 'You argue for it, objections answered',
      purpose:
        'A proposal you argue for on camera: the cost of doing nothing, how it fails today, the new design, the objections answered one by one, and what you need.',
      tone: 'Persuasive, direct',
      pacing: 'Builds to the ask',
      cover: 'cost'
    },
    `
cost | The cost | 10 | speaker | over | headline | cut | The cost of doing nothing, as one number beside your face. | kinetic-beat-slam counting-dynamic-scale
today | Today | 25 | explainer | corner | fault | match | How it fails today: the failure spreads along the graph while you watch from the corner. | svg-path-draw pip-pill
proposal | The proposal | 40 | explainer | corner | spotlight | push | The new design lights up one part at a time as you walk it. | ambient-glow-bloom svg-path-draw
objections | Objections | 30 | motion | off | limits | cover | The questions you expect, each card flipping to its answer. | split-tilt-cards
ask | The ask | 15 | captions | over | headcaps | end | What you need and by when, in captions over you. | caption-pill-karaoke asr-keyword-glow
`
  ),
  variant(
    {
      id: 'decision-options',
      story: 'design-decision',
      name: 'Options on the table',
      tagline: 'Every option scored, then the choice',
      purpose:
        'A decision shown as a fair contest: the question, the constraints, each option with one honest line, a scored matrix, and the choice with what would make you revisit it.',
      tone: 'Even-handed, analytical',
      pacing: 'Steady; the matrix is the peak',
      cover: 'scored'
    },
    `
question | The question | 8 | motion | off | kinetic | cut | The decision as a question, in kinetic type. | kinetic-type-beats
constraints | Constraints | 20 | motion | off | ticklist | push | The goals and non-goals tick in. | waterfall-entry
options | The options | 40 | motion | off | tradeoff | cover | Each option gets one honest line; the losers fold away. | comparison-split grid-card-assemble
scored | Scored | 25 | data | off | matrix | hold | The options against the criteria, cell by cell, until one column wins. | grid-card-assemble stat-bars-and-fills
choice | The choice | 17 | speaker | beside | decision | end | The decision stamps beside you, with what would make you revisit it. | titlecard-reveal spring-pop-entrance
`
  ),
  variant(
    {
      id: 'decision-verdict',
      story: 'design-decision',
      name: '60-second verdict',
      tagline: 'The contrarian question, answered in a minute',
      purpose:
        'The short version for a busy team: the question people keep asking, the answer set beside your face, the options it beat, what it costs, and when you would revisit it.',
      tone: 'Crisp, confident',
      pacing: 'One beat every few seconds',
      cover: 'question'
    },
    `
question | The question | 6 | captions | over | headcaps | cut | The question people keep asking, captioned over you. | caption-kinetic-slam asr-keyword-glow
answer | The answer | 8 | speaker | over | headline | cut | The decision, set large beside your face. | kinetic-beat-slam
why | Why | 26 | motion | off | tradeoff | push | The options it beat, and the one line that sank each. | comparison-split
cost | The cost | 12 | motion | off | limits | cut | What it costs you, on honest cards. | split-tilt-cards
revisit | When to revisit | 8 | captions | over | headcaps | end | What would change your mind, in captions. | caption-pill-karaoke
`
  ),
  variant(
    {
      id: 'comparison-faceoff',
      story: 'comparison',
      name: 'Face-off',
      tagline: 'Round by round, then your verdict',
      purpose:
        'Two contenders in rounds: the matchup, the fair setup, a measured race, the same task in code, the rest of the scorecard, and your verdict set beside your face.',
      tone: 'Playful, fair',
      pacing: 'Round, round, round, verdict',
      cover: 'matchup'
    },
    `
matchup | The matchup | 8 | motion | off | versus | cut | Two names slam in, with VS between them. | comparison-split kinetic-beat-slam
rules | The rules | 12 | motion | off | ticklist | push | The fair setup ticks in: same machine, same load, same task. | waterfall-entry
round-one | Round one | 25 | data | off | bars | push | The first measure races; the round’s winner lights up. | bar-chart-race
round-two | Round two | 25 | code | off | diff | push | The same task in both; the shorter code wins. | css-marker-patterns
round-three | Round three | 20 | data | off | matrix | push | The rest of the scorecard fills in. | stat-bars-and-fills grid-card-assemble
verdict | The verdict | 15 | speaker | over | headline | end | Your verdict, by use case, set beside your face. | kinetic-beat-slam talking-head-recut
`
  ),
  variant(
    {
      id: 'comparison-tree',
      story: 'comparison',
      name: 'When to use which',
      tagline: 'A decision tree, not a winner',
      purpose:
        'No winner, just the right pick: the take everyone repeats, a decision tree that narrows it down, a case for each side, and a rule of thumb.',
      tone: 'Practical, nuanced',
      pacing: 'One question at a time',
      cover: 'tree'
    },
    `
myth | The myth | 10 | captions | over | headcaps | cut | The take everyone repeats, in captions over you. | caption-kinetic-slam
tree | The decision | 35 | explainer | corner | tree | hold | A decision tree: each question narrows it down, with you in the corner. | flowchart pip-pill
case-one | When the first | 25 | explainer | off | onerequest | push | A case where the first one wins, shown end to end. | svg-path-draw
case-two | When the second | 25 | explainer | off | overload | push | A case where it breaks, and the second one holds. | reactive-displacement
rule | Rule of thumb | 15 | speaker | beside | recap | end | The rule in three lines beside you. | titlecard-reveal
`
  )
]
