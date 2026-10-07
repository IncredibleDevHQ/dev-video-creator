import { expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
vi.mock('../app/api', () => ({ api: {} }))
const { parseHTML } = await import('linkedom')
const { givenAnswer, repoAsk, repoChip, repoDialog } =
  await import('../app/repo-view')
const { repoAskKey } = await import('../shared/repos')

const snapshot = (extra: Partial<Snapshot> = {}, project: object = {}) =>
  ({
    project: {
      id: 'n',
      title: 'Bursts',
      source: '',
      slides: [],
      video: null,
      ...project
    },
    status: 'ready',
    error: null,
    events: [],
    ...extra
  }) as Snapshot
const doc = (html: string) => parseHTML(`<div>${html}</div>`).document
const link = {
  path: '/code/limiter',
  name: 'limiter',
  branch: 'fix-burst',
  base: 'main'
}
const slide = { id: 'a', title: 'The fix', svg: '<svg/>' }
const need = { kind: 'code' as const, what: 'the setting', source: null }

it('names the linked repo and its branch, and links one', () => {
  expect(repoChip(snapshot(), true)).toContain('No repo')
  expect(repoChip(snapshot({}, { repos: [link] }), true)).toContain(
    'limiter · fix-burst'
  )
  const empty = doc(repoDialog(snapshot()))
  expect(empty.querySelector('select')).toBeNull()
  expect(empty.querySelector('button.primary')?.hasAttribute('disabled')).toBe(
    true
  )
  const found = doc(
    repoDialog(snapshot(), {
      path: '/code/limiter',
      name: 'limiter',
      current: 'fix-burst',
      branches: ['fix-burst', 'main'],
      base: 'main'
    })
  )
  expect(
    found.querySelector<HTMLSelectElement>('#repo-branch option[selected]')
      ?.textContent
  ).toBe('fix-burst')
  expect(found.querySelector('#repo-base option[selected]')?.textContent).toBe(
    'main'
  )
})

it('offers to ask the repo, says while it asks, and why it failed', () => {
  expect(repoAsk(snapshot(), slide, need, true)).toBe('')
  const linked = snapshot({}, { repos: [link] })
  expect(repoAsk(linked, slide, need, true)).toContain('Ask limiter')
  // The creator on camera is never the repo's to answer.
  expect(repoAsk(linked, slide, { ...need, kind: 'creator' }, true)).toBe('')
  const key = repoAskKey('a', 'the setting')
  const ask = { slideId: 'a', what: 'the setting', at: 'now' }
  expect(
    repoAsk(
      snapshot(
        { repoAsks: { [key]: { ...ask, state: 'asking' } } },
        {
          repos: [link]
        }
      ),
      slide,
      need,
      true
    )
  ).toContain('Asking limiter…')
  const failed = repoAsk(
    snapshot(
      {
        repoAsks: {
          [key]: { ...ask, state: 'failed', error: 'The agent stopped' }
        }
      },
      { repos: [link] }
    ),
    slide,
    need,
    true
  )
  expect(failed).toContain('The agent stopped')
  expect(failed).toContain('Try again')
})

it('shows where an answer came from, and asks again', () => {
  const answer = {
    what: 'the setting',
    answer: 'A burst of 40.',
    from: {
      repo: 'limiter',
      branch: 'fix-burst',
      commit: 'abcdef1234',
      files: [{ path: 'bucket.ts', lines: [2, 2] as [number, number] }]
    }
  }
  const given = doc(givenAnswer(snapshot(), slide, answer, true))
  expect(given.querySelector('.provenance')?.textContent).toBe(
    'From limiter · fix-burst @ abcdef1 bucket.ts:2–2'
  )
  expect(given.querySelector('form.ask-again')).not.toBeNull()
  expect(givenAnswer(snapshot(), slide, { what: 'x', answer: 'y' }, true)).toBe(
    '<p class="evidence-given"><b>x</b> y</p>'
  )
})
