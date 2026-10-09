// Narratives that share: customers, teams, community and talks. Each beat
// row: id | name | function | core or optional | what the viewer knows |
// evidence | example sketch | long-form expansions.
import { narrative } from './model'

export const SHARE = [
  narrative(
    {
      id: 'customer',
      group: 'share',
      name: 'Customer story',
      line: 'How one team uses it, in their words and their numbers.',
      audience: 'Teams like theirs',
      rules: ['Their words and their numbers, not yours.'],
      needs: ['their numbers', 'a quote or an interview'],
      preset: 'briefing'
    },
    `
result | The result | hook | core | The result, in their numbers | numbers | customer |
who | Who they are | context | optional | The team, and what they do | creator quote | teamgrid |
before | Before | problem | core | What it was like before | quote numbers | pileup |
how | How they use it | explain | core | How they use it, shown | demo diagram | seqreveal | Their setup in detail
advice | In their words | payoff | core | What they would tell a team like theirs | quote creator | quote |
`
  ),
  narrative(
    {
      id: 'team',
      group: 'share',
      name: 'Team intro',
      line: 'Who the team is, what it owns, how it works, and how to join.',
      audience: 'Candidates and the teams you work with',
      rules: ['Show real work, not slogans.'],
      needs: ['what the team owns', 'how it works'],
      preset: 'briefing'
    },
    `
hello | Hello | hook | core | Who the team is, in one line | creator | teamgrid |
own | What we own | context | core | The systems the team owns | diagram | c4zoom |
how | How we work | explain | core | How the team works, day to day | quote | ticklist | A day on the team
story | A story | evidence | optional | One story that shows the team at work | timeline demo | montage |
join | Join | action | core | How to join, or how to work with you | quote | cta |
`
  ),
  narrative(
    {
      id: 'oss',
      group: 'share',
      name: 'Open source project',
      line: 'What the project does, why it is open, and how to help.',
      audience: 'Developers and would-be contributors',
      rules: ['A working example early.'],
      needs: ['the repository', 'one working example'],
      preset: 'demo-led'
    },
    `
does | What it does | hook | core | What it does, shown working | demo | resultfirst |
why | Why it exists | problem | core | The problem behind it, and why it is open | quote | pileup |
install | Install | explain | core | The install, and a first example | terminal code | tipcard |
inside | How it works | explain | optional | How it is built | diagram code | layers | Each module in turn
traction | Traction | evidence | optional | Stars, users or benchmarks | numbers | stars |
contribute | Contribute | action | core | How to help, starting with a good first issue | quote | roadmap |
`
  ),
  narrative(
    {
      id: 'talk',
      group: 'share',
      name: 'Talk recap',
      line: 'A conference talk’s one idea, and the moments worth seeing.',
      audience: 'People who missed the talk',
      rules: ['One idea, not the whole agenda.'],
      needs: ['the slides or the transcript'],
      preset: 'briefing'
    },
    `
idea | The idea | hook | core | The talk’s one idea | quote | kinetic |
problem | The problem | problem | core | The problem the talk tackles | diagram | overload |
argument | The argument | explain | core | The argument, slide by slide | diagram | slides | Each section of the talk
proof | Proof | evidence | optional | The demo or the numbers from the talk | demo numbers | bars |
takeaways | Takeaways | payoff | core | What to take away | quote | ticklist |
watch | Watch | action | optional | Where to watch the whole talk | quote | cta |
`
  ),
  narrative(
    {
      id: 'demo-day',
      group: 'share',
      name: 'Demo day',
      line: 'What the team built this sprint, shown working.',
      audience: 'The rest of the company',
      rules: ['Show it working, live if you can.'],
      needs: ['a working demo'],
      preset: 'demo-led'
    },
    `
what | What we built | hook | core | What the team built, in one line | quote | kinetic |
demo | The demo | evidence | core | It working, end to end | demo | cursorzoom | Each piece in turn
how | How it works | explain | optional | How it is built | diagram | layers |
moved | What moved | evidence | optional | The numbers it moved | numbers | bars |
next | Next | action | core | What comes next, and what you need | quote | roadmap |
`
  ),
  narrative(
    {
      id: 'interview',
      group: 'share',
      name: 'Engineer interview',
      line: 'One engineer, their hardest moment, and what they learned.',
      audience: 'People who remember people more than systems',
      rules: ['Their words, lightly cut.'],
      needs: ['the interview recording or its transcript'],
      preset: 'briefing',
      excludes: ['faceless']
    },
    `
line | The best line | hook | core | Their best line, first | creator quote | quote |
who | Who they are | context | core | Who they are, and what they work on | creator diagram | layers |
moment | The hard moment | problem | core | Their hardest moment, in their words | creator | kinetic |
built | What they built | explain | optional | The work behind the story | diagram demo | seqreveal |
lesson | The lesson | payoff | core | What they learned | creator quote | quote |
`
  ),
  narrative(
    {
      id: 'data-report',
      group: 'share',
      name: 'Data report',
      line: 'A recurring report from your own data: the table, the surprise, the trend.',
      audience: 'People who wait for the next edition',
      rules: [
        'The same layout every edition.',
        'Say where the data comes from.'
      ],
      needs: ['the data'],
      preset: 'briefing'
    },
    `
headline | The headline | hook | core | The headline finding | numbers | bignumber |
table | The table | evidence | core | The ranking or the table | numbers | league |
surprise | The surprise | turn | core | The result nobody expected | numbers | spike |
trend | The trend | evidence | core | How it moved since the last edition | numbers | progress |
method | Method | context | optional | Where the data comes from | quote | ticklist |
next | Next edition | action | optional | What to watch for next time | quote | kinetic |
`
  ),
  narrative(
    {
      id: 'listicle',
      group: 'share',
      name: 'Lessons list',
      line: 'The things you learned, numbered, one idea each.',
      audience: 'Engineers who like a list they can argue with',
      rules: ['One idea per item.', 'The strongest last.'],
      needs: ['the lessons'],
      preset: 'briefing'
    },
    `
promise | The promise | hook | core | How many lessons, and why they matter | quote | kinetic |
lessons | The lessons | explain | core | Each lesson, with one example | quote code | numbered | Each lesson in its own chapter
proof | One in depth | evidence | optional | One lesson shown in the code | code diff | diff |
keep | The one to keep | payoff | core | The lesson to keep if they keep only one | quote | quote |
`
  ),
  narrative(
    {
      id: 'community',
      group: 'share',
      name: 'Community spotlight',
      line: 'The people building with it, and what they made.',
      audience: 'The community and would-be contributors',
      rules: ['Name every maker.'],
      needs: ['the projects and their makers'],
      preset: 'briefing'
    },
    `
number | The community | hook | core | How many are building, and with what | numbers | bignumber |
makers | Makers | context | core | The people behind the projects | creator | teamgrid |
projects | Projects | evidence | core | What they made, shown | demo | resultfirst | Each project in its own chapter
featured | Featured | payoff | optional | The project of the month | demo | cursorzoom |
join | Join | action | core | How to share yours | quote | cta |
`
  ),
  narrative(
    {
      id: 'event-recap',
      group: 'share',
      name: 'Launch week recap',
      line: 'A week of launches, grouped by theme, the best ones shown.',
      audience: 'People who could not follow every day',
      rules: ['Group by theme, not by day.'],
      needs: ['the launches'],
      preset: 'briefing'
    },
    `
week | The week | hook | core | How many launches, and the theme | numbers | montage |
best | The best ones | evidence | core | The best launches, shown | demo | resultfirst | Each launch in its own chapter
rest | The rest | context | core | Everything else, grouped by theme | quote | ticklist |
try | Try it | action | core | Where to try them | quote | cta |
`
  )
]
