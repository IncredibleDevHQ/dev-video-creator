// Narratives that show: launches, releases and work in progress. Each beat
// row: id | name | function | core or optional | what the viewer knows |
// evidence | example sketch | long-form expansions.
import { narrative } from './model'

export const SHOW = [
  narrative(
    {
      id: 'launch',
      group: 'show',
      name: 'Launch',
      line: 'A feature or product launch: the outcome first, then how it works.',
      audience: 'Developers deciding whether to try it',
      rules: [
        'Lead with what people can do now, not the feature’s name.',
        'Show it working before explaining it.'
      ],
      needs: ['what is new', 'a demo or screenshots', 'how to try it'],
      preset: 'demo-led'
    },
    `
outcome | What you can do now | hook | core | The outcome, shown working | demo | resultfirst |
old-way | The old way | problem | core | What it took before | demo numbers | pileup | A day with the old way
walkthrough | Walkthrough | explain | core | The feature, step by step | demo | cursorzoom | Each part in its own chapter
inside | Under the hood | explain | optional | How it works inside | diagram code | peel | The engineering decisions behind it
proof | Proof | evidence | optional | Numbers from early users or benchmarks | numbers | bars |
try | Try it | action | core | How to try it today | terminal | tipcard |
`
  ),
  narrative(
    {
      id: 'release',
      group: 'show',
      name: 'Release notes',
      line: 'What is new in this release, the biggest change first.',
      audience: 'People who already use it',
      rules: [
        'The biggest change first.',
        'Name anything that breaks, with what to do.'
      ],
      needs: ['the changes in the release', 'the upgrade steps'],
      preset: 'briefing'
    },
    `
version | The release | hook | core | The version, and its biggest change in one line | quote | kinetic |
big-one | The big one | explain | core | The biggest change, shown working | demo | cursorzoom | Why it was built
more | Also new | explain | core | The other changes worth knowing | demo code | recipes | Each change in its own chapter
fixes | Fixes | context | optional | The fixes and smaller changes, as a list | quote | ticklist |
breaking | What breaks | turn | optional | Anything that behaves differently, and what to do | code diff | diff |
upgrade | Upgrade | action | core | How to upgrade | terminal | tipcard |
`
  ),
  narrative(
    {
      id: 'devlog',
      group: 'show',
      name: 'Build log',
      line: 'What you built, what failed on the way, and what surprised you.',
      audience: 'People following your work',
      rules: ['Keep the failures; they are the story.'],
      needs: ['what you built', 'what went wrong on the way'],
      preset: 'briefing'
    },
    `
goal | The goal | hook | core | What you set out to build, and why | quote | kinetic |
first-try | First attempt | problem | core | The naive version, and where it fell short | demo code | attempts | More attempts
progress | Progress | context | core | What got built, in order | timeline demo | montage | Week by week
hard | The hard part | turn | core | What failed or surprised you | code terminal | logzoom | The detours
insight | The insight | explain | optional | The idea that unlocked it | diagram | zoomout |
result | The result | payoff | core | What it does now, shown | demo | resultfirst |
next | Next | action | optional | What comes next | quote | roadmap |
`
  ),
  narrative(
    {
      id: 'code-change',
      group: 'show',
      name: 'Code change walkthrough',
      line: 'What a pull request changes, why, and how to review it.',
      audience: 'Reviewers and teammates',
      rules: [
        'Start from what changes for users, not from the files.',
        'Point reviewers at the risky part.'
      ],
      needs: ['the diff', 'the reason for the change'],
      preset: 'briefing'
    },
    `
why | Why | hook | core | What changes for users, in one line | quote | kinetic |
before | Before | problem | core | The behaviour before, or the bug | demo terminal | errorfix |
change | The change | explain | core | The key hunk, and what it does | diff | diff | Each file in turn
files | The map | context | optional | Which files change, and how they connect | diagram code | prfiles |
proof | Proof | evidence | core | The tests, or the behaviour after | terminal demo | safeguard |
review | How to review | action | core | Where to look hardest, and what to test | quote | ticklist |
`
  ),
  narrative(
    {
      id: 'overview',
      group: 'show',
      name: 'Product overview',
      line: 'What the product is, who it is for, and why it matters.',
      audience: 'People hearing about it for the first time',
      rules: [
        'The problem before the product.',
        'One main job, shown working.'
      ],
      needs: ['what the product does', 'a demo or screenshots'],
      preset: 'briefing'
    },
    `
problem | The problem | hook | core | The problem, as the viewer feels it | quote numbers | pileup |
what | What it is | explain | core | What the product is, in one line | quote | kinetic |
show | See it | evidence | core | The product doing its main job | demo | cursorzoom | Each main job in turn
inside | How it works | explain | optional | The idea behind it | diagram | layers |
who | Who uses it | evidence | optional | Who uses it, and what changed for them | numbers quote | customer |
start | Start | action | core | How to start | quote | cta |
`
  )
]
