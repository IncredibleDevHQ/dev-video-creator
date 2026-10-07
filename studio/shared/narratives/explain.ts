// Narratives that explain: how something works, and why it is built that
// way. Each beat row: id | name | function | core or optional | what the
// viewer knows | evidence | example sketch | long-form expansions.
import { narrative } from './model'

export const EXPLAIN = [
  narrative(
    {
      id: 'how-it-works',
      group: 'explain',
      name: 'How it works',
      line: 'One concept made concrete: an example before the abstraction.',
      audience: 'Developers who use it but never looked inside',
      rules: [
        'Concrete before abstract: an example comes before any definition.',
        'One idea per video.'
      ],
      needs: ['one concrete example', 'how the parts fit together'],
      preset: 'explainer'
    },
    `
question | The question | hook | core | The question they half-know, sharpened into a tension | quote numbers | kinetic | A second question that raises the stakes
example | One example | context | core | One concrete case, followed end to end, before anything is named | diagram demo | onerequest | A second example that behaves differently
mechanism | How it works | explain | core | The parts and how they work together, in the order the data meets them | diagram code | seqreveal | Each part in its own chapter; the code that implements it
breaks | Where it breaks | turn | optional | The conditions under which it fails, and what failure looks like | numbers diagram | overload | Failures from production; how others handle them
pattern | The pattern | payoff | core | The general rule, and where they will meet it again | diagram quote | zoomout | Related patterns; when not to use it
`
  ),
  narrative(
    {
      id: 'architecture',
      group: 'explain',
      name: 'Architecture tour',
      line: 'A guided tour of a system, from the map to the parts that matter.',
      audience: 'New teammates and the teams that depend on you',
      rules: [
        'Zoom in order: the system in context, its containers, their components, then code.',
        'Name an owner for every part.'
      ],
      needs: ['the parts of the system', 'one request path'],
      preset: 'explainer'
    },
    `
map | The map | context | core | The whole system on one page, and the part this tour covers | diagram | c4zoom | Each container in turn
journey | One request | explain | core | One request's path through the system, hop by hop | diagram demo | onerequest | A write path as well as a read path
parts | The parts | explain | core | Each part by its job, and who owns it | diagram code | layers | The code that matters in each part
data | Where data lives | explain | optional | What is stored where, and why | diagram | pipeline | Consistency, backups and retention
surprise | The surprising corner | turn | optional | The one thing nobody expects about this system | diagram code | limits | The history behind it
start | Where to start | action | core | Where to start reading, and whom to ask | code | prfiles | A first change to try
`
  ),
  narrative(
    {
      id: 'paper',
      group: 'explain',
      name: 'Paper explainer',
      line: 'A research paper’s one idea, and what it means for your work.',
      audience: 'Engineers who will not read the paper',
      rules: [
        'Show the result before the method.',
        'Name the limits the authors admit.'
      ],
      needs: ['the paper’s key figure or numbers'],
      preset: 'explainer'
    },
    `
result | The result | hook | core | The headline result, shown first | numbers | bars | Results across every benchmark
hard | Why it was hard | problem | core | Why the problem resisted earlier work | diagram | overload | The prior approaches, one by one
idea | The key idea | explain | core | The one idea, on the figure that carries it | diagram | figure | The method, step by step
evidence | The evidence | evidence | core | The numbers against the baseline | numbers | bars | The ablations
limits | The limits | turn | optional | What the paper does not show | quote | limits | Open questions and follow-up work
meaning | What it means | payoff | core | What it changes for the viewer’s own work | code quote | codehl | How to try it
`
  ),
  narrative(
    {
      id: 'ai-feature',
      group: 'explain',
      name: 'AI feature explained',
      line: 'How the model behind a feature works, and how you know it is good.',
      audience: 'Users and engineers curious about the AI',
      rules: [
        'Show the failures as well as the successes.',
        'Give numbers for quality and for cost.'
      ],
      needs: ['a demo or a transcript', 'some measure of quality'],
      preset: 'explainer'
    },
    `
demo | The demo | hook | core | What the feature does, shown working | demo | resultfirst | Several real inputs
failure | Where it failed | problem | core | The real input that broke the first version | demo quote | errorfix | More failure cases
pipeline | The pipeline | explain | core | Input to answer, stage by stage | diagram code | pipeline | The prompt and the context, in detail
evals | How it is checked | evidence | core | The eval set, and how each version scores | numbers | evals | Error analysis by category
guardrails | Guardrails | resolution | optional | What stops a bad answer reaching a user | diagram code | safeguard | Injection and abuse cases
cost | Cost and limits | payoff | core | What each answer costs, and where it is still wrong | numbers | limits | Latency, cost and quality traded off
`
  ),
  narrative(
    {
      id: 'myths',
      group: 'explain',
      name: 'Myth busting',
      line: 'Common beliefs, checked against the facts.',
      audience: 'Developers who heard it somewhere',
      rules: ['Every myth gets a counterexample, not just an opinion.'],
      needs: ['the belief', 'one counterexample'],
      preset: 'short-dramatic'
    },
    `
myth | The myth | hook | core | The belief, stated plainly | quote | kinetic | Where the belief comes from
counter | The counterexample | turn | core | The case that breaks it | code numbers | mythfact | More counterexamples
cost | What it costs | problem | optional | The bug or the waste the belief causes | code numbers | errorfix | A real failure it caused
truth | What is true | payoff | core | The rule that replaces the myth | quote | zoomout | The edge cases of the rule
`
  ),
  narrative(
    {
      id: 'observability',
      group: 'explain',
      name: 'How we debug',
      line: 'How you find problems: the signals, the tools and the playbook.',
      audience: 'Engineers on call',
      rules: ['Show what each signal could and could not tell you.'],
      needs: ['the symptom', 'what found the cause'],
      preset: 'explainer'
    },
    `
symptom | The symptom | hook | core | What looked wrong, and why the dashboards missed it | numbers | spike | Several signals compared
signals | The signals | context | core | Metrics, logs and traces, and what each told you | numbers timeline | scrub | How alerts are tuned
trace | The trace | explain | core | The trace that found it, span by span | diagram | trace | Querying traces across many requests
cause | The cause | turn | core | The slow span, and why it was slow | code | logzoom | Similar cases found afterwards
fix | Fix and watch | resolution | core | The fix, and what watches for it now | diff numbers | slo | The alert that would catch it next time
`
  ),
  narrative(
    {
      id: 'slo',
      group: 'explain',
      name: 'SLOs explained',
      line: 'What you promise, how you measure it, and what happens when you miss.',
      audience: 'Teams adopting service level objectives',
      rules: ['Translate every target into minutes of downtime.'],
      needs: ['the target', 'how it is measured'],
      preset: 'explainer',
      excludes: ['short-dramatic']
    },
    `
target | The wrong target | hook | core | Why a hundred per cent is the wrong target | numbers | kinetic | The cost of each extra nine
measure | What users feel | context | core | The measure that matches what users feel | numbers | spike | Choosing between candidate measures
budget | The budget | explain | core | The target, and the error budget it leaves | numbers | slo | The arithmetic of nines in minutes
burn | When it burns | turn | core | How burn-rate alerts warn before the budget is gone | numbers | bignumber | Fast and slow burn windows
policy | The policy | payoff | core | What the team does when the budget is spent | quote | ticklist | The policy applied, case by case
`
  ),
  narrative(
    {
      id: 'data-pipeline',
      group: 'explain',
      name: 'Data pipeline',
      line: 'Where an event is born, every hop it makes, and who uses it at the end.',
      audience: 'Engineers and analysts who depend on the data',
      rules: ['Follow one event before showing the whole flow.'],
      needs: ['the stages', 'volumes or latencies'],
      preset: 'explainer'
    },
    `
event | One event | hook | core | Where one event is born | diagram | onerequest | Several kinds of event
volume | The volume | context | core | How many events arrive, and how fast | numbers | bignumber | Peaks and growth
stages | The stages | explain | core | Each stage the event passes, and the time it takes | diagram | pipeline | Each stage in its own chapter
generations | Generations | context | optional | How the pipeline changed over time | diagram | thennow | Why each rewrite happened
readers | Who reads it | payoff | core | The teams and systems that use the result | diagram | seqreveal | Data quality and contracts
`
  ),
  narrative(
    {
      id: 'platform',
      group: 'explain',
      name: 'How we ship',
      line: 'The path from an idea to production, and what the platform does for it.',
      audience: 'Engineers here and the ones you hope to hire',
      rules: ['Measure the before and the after the same way.'],
      needs: ['the steps now', 'what they replaced'],
      preset: 'explainer'
    },
    `
before | Before | problem | core | What shipping used to take, and where the time went | numbers | pileup | A day in an engineer’s life, before
path | The golden path | explain | core | The steps from idea to production now | diagram | journey | Each step and the tool behind it
demo | Idea to production | evidence | core | A real service going out the new way | demo | cursorzoom | A rollback, too
adoption | Adoption | evidence | optional | How many teams ship this way | numbers | bignumber | What made teams switch
tradeoff | The trade-off | payoff | core | What it costs to keep the path paved | quote | limits | What is still hard
`
  ),
  narrative(
    {
      id: 'testing',
      group: 'explain',
      name: 'Testing strategy',
      line: 'The shape of your test suite, and why the textbook did not fit.',
      audience: 'Teams fighting slow or flaky CI',
      rules: ['Show one real test, not only the shape.'],
      needs: ['CI numbers before and after', 'an example test'],
      preset: 'explainer'
    },
    `
pain | The pain | hook | core | Slow or flaky CI, in numbers | numbers | spike | Where the minutes go
textbook | The textbook | context | core | The shape everyone recommends | diagram | testshape | Its origins and its assumptions
misfit | Why it did not fit | turn | core | Why that shape failed for you | diagram quote | limits | The failures, one by one
shape | Our shape | explain | core | The suite you chose, and one real test | diagram code | codehl | Each layer, with examples
results | Results | payoff | core | CI time and flakiness, before and after | numbers | race | What to try first
`
  ),
  narrative(
    {
      id: 'essay',
      group: 'explain',
      name: 'Point of view',
      line: 'An argued opinion: the common belief, a better model, the objections.',
      audience: 'Engineers who like a strong argument',
      rules: ['Answer the strongest objection, not a weak one.'],
      needs: ['the claim', 'the reasons for it'],
      preset: 'briefing'
    },
    `
thesis | The thesis | hook | core | The claim, in one sentence | quote | kinetic | Why it matters now
belief | The common belief | context | core | What most people believe instead | quote | quote | The belief at its strongest
model | A better model | explain | core | A simple model that explains the claim | diagram | seqreveal | The model applied to real cases
objections | Objections | turn | core | The best objections, answered | quote | limits | More objections
rule | The rule | payoff | core | What the viewer should do differently | quote | ticklist | Where the rule bends
`
  )
]
