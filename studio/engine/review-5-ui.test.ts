import { parseHTML } from 'linkedom'
import { expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
vi.mock('../app/api', () => ({ api: {} }))
const { modelLabel } = await import('../app/agent-menu')
const { choicesRow } = await import('../app/notebook-choices')
const { activitySteps, usageTable, tokens } =
  await import('../app/activity-log')
const { sumUsage } = await import('../shared/usage')
const { pinTargetOf } = await import('../app/wireframe-pin')

const snapshot = (extra: Partial<Snapshot> = {}): Snapshot =>
  ({
    status: 'draft',
    error: null,
    events: [],
    project: {
      id: 'n',
      title: 'Fixture',
      source: 'Notes',
      slides: [],
      video: null,
      harness: { adapter: 'kimi', model: 'kimi-code/k3' },
      branding: {
        name: '',
        tagline: '',
        accent: '#3a5fcd',
        useAccent: true,
        logoKey: null,
        look: { id: 'paper', name: 'Paper' }
      }
    },
    ...extra
  }) as Snapshot

it('fills the choices beside Create with the agent, the length and the look', () => {
  expect(modelLabel('kimi-code/k3')).toBe('K3')
  expect(modelLabel('claude-opus-5-5')).toBe('Opus 5.5')
  const row = choicesRow(snapshot(), true)
  expect(row).toContain('Kimi K3')
  expect(row).toContain('about 5 min')
  expect(row).toContain('Paper look')
  const short = snapshot()
  short.project.length = 'short'
  // Length in minutes, the wireframes as the hint.
  expect(choicesRow(short, true)).toContain('about 3 min')
  expect(choicesRow(short, true)).toContain('≈ 6 wireframes')
  // After drawing starts the length is fixed.
  expect(choicesRow(snapshot(), false)).toMatch(
    /data-action="length-menu"[^>]*disabled/
  )
})

it('lists each step once, in wireframe words, folding the repeats a retry used to add', () => {
  const at = (n: number) => `2026-10-05T03:${String(n).padStart(2, '0')}:00Z`
  const steps = activitySteps(
    snapshot({
      events: [
        'Designing your 10 slides',
        'Draft 1 of 10 is available',
        'Stopped at the stage time limit. Saved artifacts are available; retry requires your action.',
        'Trying your slides again',
        'Draft 1 of 10 is available',
        'Draft 2 of 10 is available',
        'Slide 1 of 10',
        'Your slides are ready'
      ].map((message, i) => ({
        sequence: i + 1,
        projectId: 'n',
        time: at(i),
        kind: 'slide' as const,
        message
      }))
    })
  ).map((step) => step.message)
  expect(steps).toEqual([
    'Designing your 10 wireframes',
    'Draft 1 of 10 is available',
    'The agent ran out of time. Saved work is kept; Try again continues from there.',
    'Trying your wireframes again',
    'Draft 2 of 10 is available',
    'Your wireframes are ready'
  ])
})

it('names the part of a wireframe a click lands on', () => {
  const { document } = parseHTML(`<div class="stage"><svg>
<g id="s04-node-client" data-role="node"><rect/><text>User requests</text><text>one user</text></g>
<line id="s04-edge-1" data-role="connector" data-verb="sends to"/>
<text id="label">N / sec</text></svg></div>`)
  const stage = document.querySelector('.stage')!
  expect(
    pinTargetOf(document.querySelector('#s04-node-client text')!, stage)
  ).toEqual({
    id: 's04-node-client',
    label: 'User requests one user',
    kind: 'node'
  })
  expect(pinTargetOf(document.querySelector('#s04-edge-1')!, stage)).toEqual({
    id: 's04-edge-1',
    label: 'the “sends to” arrow',
    kind: 'connector'
  })
  expect(pinTargetOf(document.querySelector('#label')!, stage)).toMatchObject({
    id: 'label',
    label: 'N / sec'
  })
  expect(pinTargetOf(stage, stage)).toBeNull()
})

it('shows token use per step, from what each agent call reported', () => {
  const usage = (input: number, output: number, cacheRead: number) => ({
    input,
    output,
    cacheRead,
    cacheWrite: 0,
    final: true
  })
  const tokenUsage = sumUsage([
    { stage: 'story', operation: 'brief', usage: usage(1200, 300, 0) },
    { stage: 'story', operation: 'story', usage: usage(4000, 900, 20_000) },
    // A run from before calls named their operation counts as its stage's.
    { stage: 'drawing', usage: usage(66_580, 9442, 976_385) },
    { stage: 'drawing', operation: 'page' }
  ])
  expect(tokenUsage.stages.page).toMatchObject({
    totalRuns: 2,
    reportedRuns: 1,
    partial: true,
    output: 9442
  })
  const { document } = parseHTML(
    `<div>${usageTable(snapshot({ tokenUsage }))}</div>`
  )
  const rows = [...document.querySelectorAll('tbody tr')].map((row) =>
    [...row.children].map((cell) => cell.textContent)
  )
  expect(rows).toEqual([
    ['Reading the source', '1', '1.2 k', '0', '300', '1.5 k'],
    ['Story', '1', '4.0 k', '20 k', '900', '25 k'],
    ['Wireframes', '2', '67 k', '976 k', '9.4 k', '1.1 M*'],
    ['All steps', '4', '72 k', '996 k', '11 k', '1.1 M*']
  ])
  expect(document.querySelector('div')!.textContent).toContain(
    'did not report their tokens'
  )
  expect(usageTable(snapshot())).toBe('')
  expect(tokens(999)).toBe('999')
})
