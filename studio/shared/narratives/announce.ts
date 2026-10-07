// Narratives that announce: changes people need to know about, and when.
// Each beat row: id | name | function | core or optional | what the viewer
// knows | evidence | example sketch | long-form expansions.
import { narrative } from './model'

export const ANNOUNCE = [
  narrative(
    {
      id: 'deprecation',
      group: 'announce',
      name: 'Deprecation notice',
      line: 'What is going away, by when, and how to move, the dates first.',
      audience: 'Everyone who still uses the old way',
      rules: [
        'The dates first, and again at the end.',
        'Show the new way working.'
      ],
      needs: ['the dates', 'the replacement', 'the migration steps'],
      preset: 'briefing',
      excludes: ['short-dramatic', 'deep-dive']
    },
    `
dates | The dates | hook | core | What goes away, and when | timeline | deprecation |
what | What changes | explain | core | The old way and the new way, side by side | code diff | diff |
who | Who is affected | context | core | Who needs to act, and who does not | quote | tree |
why | Why | context | optional | Why it is going away | quote | kinetic |
how | How to move | resolution | core | The migration, step by step | terminal code | quickstart | Each step in depth
help | Help | action | core | Where to get help, and the dates again | quote | cta |
`
  ),
  narrative(
    {
      id: 'maintenance',
      group: 'announce',
      name: 'Maintenance and status',
      line: 'Planned work or a live problem: when, what to expect, what to do.',
      audience: 'Users and their on-call teams',
      rules: [
        'Give times in UTC as well as local time.',
        'Say plainly what will not work.'
      ],
      needs: ['the window or the start time', 'what is affected'],
      preset: 'briefing',
      excludes: ['short-dramatic', 'deep-dive']
    },
    `
window | When | hook | core | When it happens, or when it started | timeline | maintenance |
impact | What to expect | context | core | What will and will not work | quote | limits |
doing | What we are doing | explain | core | The work, or the response so far | diagram | recover |
before | What to do | action | core | What to do before or during it | quote | ticklist |
follow | Updates | action | optional | Where updates appear, and when the next one is due | quote | cta |
`
  ),
  narrative(
    {
      id: 'product-update',
      group: 'announce',
      name: 'Product update',
      line: 'What shipped this quarter, and what comes next.',
      audience: 'Customers and the community',
      rules: ['The work users asked for first.', 'Promise only what is close.'],
      needs: ['what shipped', 'what is planned'],
      preset: 'briefing'
    },
    `
hello | Hello | hook | core | The period, and its headline | quote numbers | kinetic |
shipped | What shipped | evidence | core | The shipped work, the best first | demo | recipes | Each feature in its own chapter
numbers | In numbers | evidence | optional | The numbers that moved | numbers | wrapped |
feedback | You asked | turn | optional | What users asked for, and what came of it | quote | quote |
next | What is next | payoff | core | Now, next and later | quote | roadmap |
thanks | Thanks | action | core | Thanks, and where to send feedback | quote | cta |
`
  ),
  narrative(
    {
      id: 'project-update',
      group: 'announce',
      name: 'Project update',
      line: 'Status, progress, risks and one ask, for the people backing the work.',
      audience: 'Leadership and partner teams',
      rules: ['The bottom line first.', 'One ask, with a date.'],
      needs: ['the status', 'progress since the last update', 'the risks'],
      preset: 'briefing',
      excludes: ['short-dramatic']
    },
    `
status | The status | hook | core | On track or not, in one line | quote | rag |
progress | Progress | evidence | core | What moved since the last update | numbers timeline | hill |
changed | What changed | context | optional | Changes to scope, dates or people | quote | thennow |
risks | Risks | turn | core | The risks, and what is being done about them | quote | limits |
ask | The ask | action | core | The one decision or help you need | quote | cta |
`
  ),
  narrative(
    {
      id: 'pricing',
      group: 'announce',
      name: 'Pricing change',
      line: 'What changes, who it affects, why, and what to do about it.',
      audience: 'Customers on the plans that change',
      rules: ['Say plainly who pays more.', 'Give the date and the options.'],
      needs: ['the old and new prices', 'the date', 'who is affected'],
      preset: 'briefing',
      excludes: ['short-dramatic', 'deep-dive']
    },
    `
bottom-line | The bottom line | hook | core | What changes, and when | quote | kinetic |
change | The change | explain | core | The old and the new plans, side by side | numbers | pricing |
who | Who it affects | context | core | Who pays more, who pays less, who is unaffected | quote | tree |
why | Why | context | core | The reason, plainly | numbers quote | bars |
what-to-do | What to do | action | core | What to do, and by when | quote | ticklist |
`
  ),
  narrative(
    {
      id: 'year-review',
      group: 'announce',
      name: 'Year in review',
      line: 'The year in numbers, the moments that mattered, and what is next.',
      audience: 'Your users and your team',
      rules: ['Real numbers, not adjectives.'],
      needs: ['the year’s numbers', 'its moments'],
      preset: 'briefing'
    },
    `
year | The year | hook | core | The year in one line | quote | kinetic |
numbers | In numbers | evidence | core | The numbers that tell the year | numbers | wrapped |
moments | Moments | context | core | The moments that mattered | timeline demo | montage | Each moment in its own chapter
wrong | What went wrong | turn | optional | What did not go to plan | quote | limits |
next | Next year | payoff | core | What comes next | quote | roadmap |
thanks | Thanks | action | core | Thanks to the people who made it happen | creator quote | teamgrid |
`
  ),
  narrative(
    {
      id: 'preview',
      group: 'announce',
      name: 'Preview invite',
      line: 'Something new in preview: what it is, what stage it is in, who gets in.',
      audience: 'Early adopters',
      rules: ['Show only what works today.', 'Say what is missing.'],
      needs: ['what works today', 'how to get access'],
      preset: 'demo-led',
      excludes: ['deep-dive']
    },
    `
vision | The vision | hook | core | What it will make possible | quote | kinetic |
demo | First look | evidence | core | What works today, shown | demo | resultfirst |
stage | The stage | context | core | Alpha, beta or preview, and what that means | quote | stages |
limits | Limits | turn | core | What does not work yet | quote | limits |
get-in | Get in | action | core | Who can join, and how | quote | cta |
`
  ),
  narrative(
    {
      id: 'event',
      group: 'announce',
      name: 'Event invite',
      line: 'A talk or webinar worth an hour: what they will learn, who, and when.',
      audience: 'People deciding whether to sign up',
      rules: ['What they will learn, not the agenda.'],
      needs: ['the date and time', 'what they will learn'],
      preset: 'short-dramatic',
      excludes: ['deep-dive']
    },
    `
claim | The claim | hook | core | The one thing they will learn | quote | kinetic |
learn | What you will learn | explain | core | The things they will take away | quote | recipes |
who | Who | context | optional | Who is speaking, and why them | creator | teamgrid |
card | When and where | action | core | The date, the time, and how to sign up | quote | eventcard |
`
  ),
  narrative(
    {
      id: 'license',
      group: 'announce',
      name: 'License change',
      line: 'What changes in the license, who is affected and who is not, and why.',
      audience: 'Users, contributors and their lawyers',
      rules: ['Answer “am I affected?” first.', 'Point to the full text.'],
      needs: ['the old and new terms', 'the date'],
      preset: 'briefing',
      excludes: ['short-dramatic', 'deep-dive']
    },
    `
who | Who is affected | hook | core | Who is affected, and who is not | quote | tree |
what | What changes | explain | core | The old terms and the new, side by side | diff | diff |
why | Why | context | core | The reason for the change | quote | kinetic |
cases | Cases | evidence | optional | Common situations, answered | quote | limits |
date | When | action | core | When it takes effect, and where to ask | timeline | cta |
`
  ),
  narrative(
    {
      id: 'trust',
      group: 'announce',
      name: 'Trust milestone',
      line: 'A certification or audit passed, and what it unlocks for customers.',
      audience: 'Customers and their security reviewers',
      rules: ['Say exactly what the audit covers.'],
      needs: ['the certification and its scope', 'how to get the report'],
      preset: 'briefing',
      excludes: ['deep-dive']
    },
    `
badge | The milestone | hook | core | The certification, and what it covers | quote | badge |
unlocks | What it unlocks | explain | core | What customers can now do | quote | ticklist |
controls | What it took | explain | optional | The controls and the work behind them | diagram | safeguard |
audit | The audit | context | optional | The audit, from start to report | timeline | progress |
report | Get the report | action | core | How to get the report | quote | cta |
`
  )
]
