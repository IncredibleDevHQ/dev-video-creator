// Narratives that decide: choices, the options, and the evidence behind
// them. Each beat row: id | name | function | core or optional | what the
// viewer knows | evidence | example sketch | long-form expansions.
import { narrative } from './model'

export const DECIDE = [
  narrative(
    {
      id: 'design-decision',
      group: 'decide',
      name: 'Design decision',
      line: 'An RFC or ADR told plainly: the decision, why, and what else was on the table.',
      audience: 'Engineers on and around the team',
      rules: [
        'State the decision first.',
        'Give the losing options a fair hearing.'
      ],
      needs: ['the options considered', 'the reason for the choice'],
      preset: 'briefing'
    },
    `
decision | The decision | hook | core | The decision, in one line | quote | kinetic |
context | Context | context | core | The forces that made a decision necessary | diagram | c4zoom | The history that led here
goals | Goals and non-goals | context | optional | What it must do, and what it deliberately will not | quote | ticklist |
options | The options | explain | core | Each option, and what it would cost | diagram | tradeoff | Each option in depth
choice | Why this one | resolution | core | Why the chosen option wins | numbers diagram | matrix | The scoring, criterion by criterion
consequences | Consequences | payoff | core | What gets better, what gets worse, and when you would revisit it | quote | limits | The rollout and its risks
`
  ),
  narrative(
    {
      id: 'comparison',
      group: 'decide',
      name: 'Comparison',
      line: 'One option or the other, judged fairly on what matters to your readers.',
      audience: 'Developers choosing between tools',
      rules: [
        'The same machine, the same load, the same task.',
        'Give the verdict by situation, not one winner.'
      ],
      needs: ['the criteria', 'the measurements'],
      preset: 'briefing'
    },
    `
matchup | The matchup | hook | core | What is compared, and the result nobody expects | quote | versus |
setup | A fair setup | context | core | The criteria, and how each was measured | numbers | ticklist |
rounds | The rounds | evidence | core | One criterion at a time, with numbers | numbers code | bars | More criteria
surprises | Surprises | turn | optional | What did not go as expected | numbers | spike |
verdict | The verdict | payoff | core | Which to use, situation by situation | quote | tree |
`
  ),
  narrative(
    {
      id: 'experiment',
      group: 'decide',
      name: 'Experiment readout',
      line: 'The hypothesis, the result with its uncertainty, and the decision.',
      audience: 'Product and engineering teams',
      rules: [
        'Give the range, not only the best estimate.',
        'Show the guardrail metrics.'
      ],
      needs: ['the hypothesis', 'the result with its uncertainty'],
      preset: 'briefing'
    },
    `
decision | The decision | hook | core | What was decided, and how sure you are | numbers | bignumber |
hypothesis | Hypothesis | context | core | What you expected, and why | quote | kinetic |
setup | Setup | context | core | Who saw what, and for how long | numbers | ticklist |
result | Result | evidence | core | The main metric, with its range | numbers | abtest | Results by segment
guardrails | Guardrails | evidence | core | The metrics that must not move, holding steady | numbers | rag |
next | Next | action | optional | What happens next | quote | roadmap |
`
  )
]
