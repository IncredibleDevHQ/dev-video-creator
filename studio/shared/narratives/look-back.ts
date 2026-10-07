// Narratives that look back: what happened, what you learned, what changed.
// Each beat row: id | name | function | core or optional | what the viewer
// knows | evidence | example sketch | long-form expansions.
import { narrative } from './model'

export const LOOK_BACK = [
  narrative(
    {
      id: 'incident',
      group: 'look-back',
      name: 'Incident walkthrough',
      line: 'What users felt, what happened when, why, and what changes now.',
      audience: 'Your team, or your customers',
      rules: [
        'Blameless: contributing factors, never a culprit.',
        'The timeline starts before the trigger.',
        'For customers: what they saw comes first, and an apology at both ends.'
      ],
      needs: ['impact numbers', 'a sequence of events', 'the fix'],
      preset: 'briefing'
    },
    `
impact | Impact | hook | core | Who was hurt, how much and for how long | numbers quote | spike | Impact by region or plan
timeline | Timeline | context | core | What happened when, starting before the trigger | timeline terminal | scrub | Detection and response, minute by minute
cause | Cause | turn | core | The contributing factors, not a culprit | diagram code terminal | fault | The false leads, and why they misled
fix | Fix | resolution | core | The mitigation, and the lasting fix | diff diagram numbers | recover | The safeguard, tested against a replay
changes | What changes | payoff | optional | The lessons, with owners and dates | quote creator | columns | Went well, went wrong, got lucky
`
  ),
  narrative(
    {
      id: 'debugging',
      group: 'look-back',
      name: 'Debugging story',
      line: 'A bug hunt told as a mystery: the symptom, the suspects, the culprit.',
      audience: 'Engineers who like a good hunt',
      rules: ['Keep the dead ends; they are the story.'],
      needs: ['the symptom', 'the cause', 'the fix'],
      preset: 'briefing'
    },
    `
symptom | The symptom | hook | core | The impossible symptom, stated flat | numbers | status |
stakes | The stakes | context | optional | Why it mattered | numbers | spike |
suspects | The suspects | explain | core | Each hypothesis, and the evidence against it | quote | suspects | Each dead end in its own chapter
clue | The clue | turn | core | The detail that did not fit | code terminal | logzoom |
culprit | The culprit | resolution | core | The cause, in the code | code | codehl |
guardrail | The guardrail | payoff | core | The fix, and the test that stops it coming back | diff | safeguard |
`
  ),
  narrative(
    {
      id: 'performance',
      group: 'look-back',
      name: 'Performance win',
      line: 'How you made it faster, why the number moved, and where it does not hold.',
      audience: 'Engineers who care about speed',
      rules: [
        'The same axes and scale for before and after.',
        'Explain why the number moved.'
      ],
      needs: ['before and after measurements', 'the change'],
      preset: 'briefing'
    },
    `
number | The number | hook | core | The improvement, as one number | numbers | bignumber |
feel | Why it matters | context | optional | What users felt before | numbers | spike |
profile | Where the time went | explain | core | The profile that showed the cost | numbers | flame | Several profiles compared
change | The change | resolution | core | What changed in the code | diff | diff |
proof | Proof | evidence | core | Before and after, on the same scale | numbers | race | The benchmark method
caveats | Caveats | payoff | core | Where the win does not hold | quote | limits |
`
  ),
  narrative(
    {
      id: 'migration',
      group: 'look-back',
      name: 'Migration story',
      line: 'Moving a live system without stopping it: why, how, and what broke.',
      audience: 'Teams facing the same move',
      rules: ['Always show the way back.'],
      needs: ['the phases', 'what went wrong'],
      preset: 'explainer'
    },
    `
why | Why move | hook | core | The forcing function | quote | kinetic |
scale | The scale | context | core | The size of the move, and the no-downtime constraint | numbers | bignumber |
plan | The plan | explain | core | The phases, from dual writes to deleting the old store | diagram | phases | Each phase in detail
surprise | The surprise | turn | core | What broke or surprised you | code terminal | logzoom |
cutover | Cutover | resolution | core | Moving the traffic, with a way back | diagram numbers | traffic |
results | Results | payoff | core | Where things stand, and the lessons | numbers | progress |
`
  ),
  narrative(
    {
      id: 'security',
      group: 'look-back',
      name: 'Security advisory',
      line: 'A vulnerability explained: who is affected, how it works, what to do now.',
      audience: 'Your users and their security teams',
      rules: [
        'Who is affected and what to do, first.',
        'Never show a working exploit.'
      ],
      needs: ['the affected versions', 'the fix'],
      preset: 'briefing',
      excludes: ['short-dramatic']
    },
    `
affected | Who is affected | hook | core | Who is affected, and what to do now | quote | advisory |
how | How it works | explain | core | How the flaw works, shown safely | diagram code | attack |
fix | What to do | resolution | core | The upgrade or the workaround | terminal | tipcard |
disclosure | Disclosure | context | optional | Reported, fixed, released, and who found it | timeline | scrub |
follow-up | What we are doing | payoff | core | The follow-ups, and how to reach you | quote | ticklist |
`
  ),
  narrative(
    {
      id: 'retro',
      group: 'look-back',
      name: 'Retrospective',
      line: 'A year, a project or a quarter: what you learned, told honestly.',
      audience: 'Your team and the people who follow your work',
      rules: ['Candid, with numbers where they exist.'],
      needs: ['the goals', 'what happened'],
      preset: 'briefing'
    },
    `
goal | The goal | context | core | What you set out to do | quote | kinetic |
road | What happened | context | core | The road, with its turning points | timeline | progress | Each turning point in its own chapter
worked | What worked | evidence | core | The wins | numbers | bars |
missed | What did not | turn | core | The misses, without blame | quote | limits |
change | What changes | payoff | core | What you would do differently | quote | columns |
`
  ),
  narrative(
    {
      id: 'scaling',
      group: 'look-back',
      name: 'Scaling story',
      line: 'How the system grew from thousands to millions, one wall at a time.',
      audience: 'Engineers who will hit the same walls',
      rules: ['Show what broke at each milestone.'],
      needs: ['growth numbers', 'the bottlenecks'],
      preset: 'explainer'
    },
    `
curve | The curve | hook | core | The growth, with its milestones | numbers | scaling |
wall | The first wall | problem | core | The first bottleneck you hit | diagram numbers | overload | Each wall in its own chapter
stopgaps | Stopgaps | explain | optional | The quick fixes, and why they ran out | diagram | limits |
fix | The real fix | resolution | core | The partitioning, sharding or redesign that held | diagram | layers |
next | The next wall | payoff | core | What will break next | numbers | spike |
`
  ),
  narrative(
    {
      id: 'cost',
      group: 'look-back',
      name: 'Cost cut',
      line: 'How you cut the bill, change by change, and what it cost you.',
      audience: 'Engineers and the people who pay the bill',
      rules: ['Label each saving with the change that made it.'],
      needs: ['the bill before and after', 'the changes'],
      preset: 'briefing'
    },
    `
bill | The bill | hook | core | The bill, and its biggest line | numbers | invoice |
culprit | The culprit | explain | core | Where the money actually went | numbers diagram | flame |
changes | The changes | resolution | core | Each change, and what it saved | numbers | costdown | Each change in depth
tradeoffs | What it cost us | turn | core | What you gave up for the saving | quote | limits |
habits | Habits | payoff | optional | The habits that keep it down | quote | ticklist |
`
  ),
  narrative(
    {
      id: 'rewrite',
      group: 'look-back',
      name: 'Rewrite story',
      line: 'Why you rewrote it, how you made it safe, and whether it was worth it.',
      audience: 'Engineers weighing a rewrite',
      rules: ['Show the old pain before the new language.'],
      needs: ['the old pain in numbers', 'a side-by-side measurement'],
      preset: 'explainer'
    },
    `
pain | The old pain | hook | core | The problem, in one chart | numbers | spike |
tuning | Why tuning failed | problem | core | What you tried before rewriting | quote | limits |
choice | Why this design | explain | core | Why the new language or design | quote diagram | tradeoff |
port | The port | explain | core | How the code moved across | code diff | diff | Shadow traffic before the switch
benchmark | Side by side | evidence | core | The same load on old and new | numbers | race |
worth | Was it worth it | payoff | core | What surprised you, and the verdict | quote | ticklist |
`
  ),
  narrative(
    {
      id: 'gameday',
      group: 'look-back',
      name: 'Game day',
      line: 'Breaking things on purpose, and what it taught you.',
      audience: 'Teams building for reliability',
      rules: ['State the hypothesis before the result.'],
      needs: ['the hypothesis', 'what happened'],
      preset: 'briefing'
    },
    `
hypothesis | Hypothesis | hook | core | What you expected to happen | quote | kinetic |
radius | Blast radius | context | core | What could break, and the plan to stop | diagram | c4zoom |
experiment | The experiment | explain | core | What you broke, and how | diagram | chaos |
result | What happened | evidence | core | What the graphs did: confirmed or refuted | numbers | spike |
fixes | Fixes | payoff | core | What you fixed, and the next experiment | quote | ticklist |
`
  ),
  narrative(
    {
      id: 'tech-debt',
      group: 'look-back',
      name: 'Tech debt paydown',
      line: 'The interest you were paying, how you chose what to fix, and what improved.',
      audience: 'Engineers and the people who plan their time',
      rules: ['Make the cost visible before the fix.'],
      needs: ['what the debt costs', 'what was fixed'],
      preset: 'briefing'
    },
    `
interest | The interest | hook | core | What the debt costs every week | numbers | bignumber |
inventory | Inventory | context | core | What the debt is | quote | ticklist |
ranking | Ranking | explain | core | How you chose what to pay first | numbers | matrix |
paydown | Paydown | resolution | core | One fix, start to finish | diff | diff | More fixes
improved | What improved | payoff | core | The hotspots cooling, and the numbers | numbers | heatmap |
`
  ),
  narrative(
    {
      id: 'readiness',
      group: 'look-back',
      name: 'Peak readiness',
      line: 'Getting ready for the biggest day of the year, and how it went.',
      audience: 'Teams facing a launch, a sale or a big event',
      rules: ['Compare what happened with what was forecast.'],
      needs: ['the forecast', 'what happened on the day'],
      preset: 'briefing'
    },
    `
date | The date | hook | core | The day, and the traffic expected | numbers | bignumber |
forecast | Forecast | context | core | The forecast, and how it was made | numbers | scaling |
tests | Load tests | explain | core | Load ramped until something broke | numbers diagram | overload | Each test in turn
fixes | Fixes | resolution | core | What you fixed before the day | quote | ticklist |
actual | The day | evidence | core | Actual traffic against the forecast | numbers | countdown |
lessons | Lessons | payoff | optional | What you will change next year | quote | columns |
`
  )
]
