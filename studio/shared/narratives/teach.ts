// Narratives that teach: getting someone from stuck to working. Each beat
// row: id | name | function | core or optional | what the viewer knows |
// evidence | example sketch | long-form expansions.
import { narrative } from './model'

export const TEACH = [
  narrative(
    {
      id: 'quickstart',
      group: 'teach',
      name: 'Quickstart',
      line: 'From nothing installed to a first visible success.',
      audience: 'Developers trying it for the first time',
      rules: [
        'Show the result first.',
        'Every step shortens the time to the first success.'
      ],
      needs: ['the install steps', 'a first call or action that visibly works'],
      preset: 'demo-led'
    },
    `
result | What you will have | hook | core | The working result, shown first | demo | resultfirst |
before | Before you start | context | optional | What they need installed or signed up for | terminal | ticklist | Differences between platforms
install | Install | explain | core | The install, in one command | terminal | tipcard | Other package managers
first-call | First call | explain | core | The first request, and the response that proves it worked | code terminal | apiflow | The error responses
success | It works | payoff | core | The visible success, and how long it took | demo | quickstart |
next | Next | action | core | The one next step | code | ticklist | Three paths onward
`
  ),
  narrative(
    {
      id: 'tutorial',
      group: 'teach',
      name: 'Feature tutorial',
      line: 'One feature used end to end, with the error everyone hits.',
      audience: 'Developers trying it for the first time',
      rules: [
        'One step per beat, each with a result they can see.',
        'Name the common error before they hit it.'
      ],
      needs: ['the steps', 'the finished result'],
      preset: 'explainer'
    },
    `
result | The result | hook | core | What they will build, working | demo | resultfirst |
problem | Why | problem | optional | The problem it solves in the code they write today | code | codehl |
steps | The steps | explain | core | Each step in order, with its result | demo code | cursorzoom | One chapter per step
error | The usual error | turn | core | The error everyone hits, and the fix | code terminal | errorfix | Other common errors
limits | Limits | turn | optional | What it does not do yet | quote | limits | The workarounds
recap | Recap | action | core | What they built, and where to go next | code | ticklist |
`
  ),
  narrative(
    {
      id: 'integration',
      group: 'teach',
      name: 'Integration guide',
      line: 'Connect it to the tools people already use, and what that makes possible.',
      audience: 'Teams wiring it into their stack',
      rules: ['Say exactly what syncs and what does not.'],
      needs: ['the connection steps', 'one event flowing through'],
      preset: 'demo-led'
    },
    `
job | The job | hook | core | What the two tools do together | demo | resultfirst |
connect | Connect | explain | core | How to authorise the connection | demo | integration |
flow | What flows | explain | core | What syncs, in which direction | diagram | pipeline | Each kind of event in turn
live | Trigger it | evidence | core | One real event, triggered live | demo terminal | apiflow |
limits | Limits | payoff | core | What does not sync, and what to build next | quote | limits | Recipes built on it
`
  ),
  narrative(
    {
      id: 'troubleshooting',
      group: 'teach',
      name: 'Fix an error',
      line: 'One error people hit, the fix first, then why it happens.',
      audience: 'Someone stuck on this error right now',
      rules: [
        'Use the error text as the title.',
        'The fix first, then the explanation.'
      ],
      needs: ['the exact error', 'the fix'],
      preset: 'briefing',
      excludes: ['short-dramatic']
    },
    `
error | The error | hook | core | The exact error, word for word | terminal | errorfix | Variants of the message
meaning | What it means | context | core | What the error is really saying | diagram | onerequest |
cause | Likely cause | explain | core | The most likely cause | code | codehl | The less likely causes
fix | The fix | resolution | core | The fix, with the output to expect | terminal diff | diff |
verify | Verify | evidence | core | How to confirm it is fixed | terminal | ticklist |
escalate | Still stuck | action | optional | The next cause to check, and where to ask | quote | cta |
`
  ),
  narrative(
    {
      id: 'tip',
      group: 'teach',
      name: 'Quick tip',
      line: 'One useful thing, shown in use.',
      audience: 'Engineers who want one thing they can use today',
      rules: ['One tip per video.'],
      needs: ['the tip', 'one example'],
      preset: 'short-dramatic',
      excludes: ['deep-dive']
    },
    `
itch | The itch | hook | core | The everyday annoyance | quote | kinetic |
tip | The tip | explain | core | The command or setting | terminal code | tipcard |
example | In use | evidence | core | A real before and after | code diff | diff |
gotcha | The gotcha | turn | optional | The one catch | quote | limits |
`
  ),
  narrative(
    {
      id: 'onboarding',
      group: 'teach',
      name: 'Onboarding tour',
      line: 'A welcome for new users: the first things to do, shown.',
      audience: 'People who just signed up',
      rules: ['Aim every step at the first visible result.'],
      needs: ['the first steps in the product'],
      preset: 'demo-led'
    },
    `
welcome | Welcome | hook | core | What they will have done by the end | creator demo | resultfirst |
steps | First steps | explain | core | The first steps toward the moment it proves its value | demo | onboarding | One chapter per step
first-result | First result | payoff | core | The first visible result | demo | cursorzoom |
help | Help | action | core | Where to get help next | quote | cta |
`
  ),
  narrative(
    {
      id: 'api',
      group: 'teach',
      name: 'API walkthrough',
      line: 'The model behind the API, one full request and response, and the error people hit.',
      audience: 'Developers integrating it',
      rules: ['Mask every key on screen.'],
      needs: ['the core objects', 'one request and its response'],
      preset: 'explainer'
    },
    `
model | The model | context | core | The objects and how they relate | diagram | seqreveal |
auth | Authenticate | explain | core | How to authenticate, with keys masked | code | tipcard |
request | Request and response | explain | core | One full request, and the fields that matter in its response | code terminal | apiflow | Each endpoint in turn
error | The usual error | turn | core | The error people hit, and the fix | terminal | errorfix | Pagination, limits and retries
reference | Reference | action | core | Where the full reference lives | quote | cta |
`
  ),
  narrative(
    {
      id: 'recipes',
      group: 'teach',
      name: 'Three ways to use it',
      line: 'Uses people have not tried yet, each shown working.',
      audience: 'People who already use it',
      rules: ['The same layout for every use.', 'The best one last.'],
      needs: ['the uses, each with a result'],
      preset: 'demo-led'
    },
    `
promise | The promise | hook | core | How many uses, and that they are new to them | quote | kinetic |
uses | The uses | explain | core | Each use: the situation, the move, the result | demo code | recipes | More uses
best | The best one | payoff | core | The best use, shown working | demo | cursorzoom |
more | More | action | optional | Where to find more | quote | cta |
`
  ),
  narrative(
    {
      id: 'faq',
      group: 'teach',
      name: 'FAQ answer',
      line: 'One question, answered in one line, then shown.',
      audience: 'People who typed this exact question',
      rules: ['Answer in the first line.'],
      needs: ['the question', 'its answer'],
      preset: 'short-dramatic',
      excludes: ['deep-dive']
    },
    `
question | The question | hook | core | The question, as people type it | quote | kinetic |
answer | The answer | explain | core | The answer, in one line | quote | quote |
show | Show it | evidence | core | The answer shown working | demo diagram | cursorzoom |
caveat | The caveat | turn | optional | The one caveat | quote | limits |
`
  ),
  narrative(
    {
      id: 'switching',
      group: 'teach',
      name: 'Switching guide',
      line: 'Coming from another tool: what maps to what, and the move.',
      audience: 'Teams moving from a competitor',
      rules: ['Be fair to the tool they are leaving.'],
      needs: ['what maps to what', 'the import steps'],
      preset: 'demo-led'
    },
    `
reasons | Why people switch | hook | core | Why teams move, in their words | quote | quote |
map | What maps to what | explain | core | Their concepts and ours, side by side | diagram | mapping | Each concept in depth
move | The move | explain | core | The import, step by step | terminal | tipcard |
different | What is different | turn | core | The few things that work differently | quote | limits |
check | Check it moved | evidence | core | Everything running in its new home | demo | resultfirst |
`
  )
]
