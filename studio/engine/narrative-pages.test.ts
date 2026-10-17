import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
// The agents are stand-ins: these checks prove the plumbing, not a model.
const { story } = vi.hoisted(() => ({ story: vi.fn() }))
vi.mock('./creative/brief', () => ({ prepareCreativeBrief: vi.fn() }))
vi.mock('./creative/story', () => ({ prepareCreativeStory: story }))
vi.mock('./creative/pages', () => ({
  prepareCreativePages: vi.fn(
    async (input: { outline: { scenes: unknown[] } }) =>
      input.outline.scenes.map(() => '<svg viewBox="0 0 10 10"><rect/></svg>')
  )
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-narrative-pages-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { readRow, writeRow } = await import('./persistence')
const { editSlide, loadProject, scheduleSlides } = await import('./projects')
const { setNotebookTemplate } = await import('./notebook-intake')
const { answerEvidence, chatSlide, settledChanges } =
  await import('./slide-changes')
// The change queue runs in the background; let it finish before cleaning up.
afterAll(async () => {
  await Promise.all(['gaps', 'asks'].map((id) => settledChanges(id)))
  await rm(root, { recursive: true, force: true })
})

const seed = async (
  id: string,
  status: Snapshot['status'],
  slides: Snapshot['project']['slides'] = []
) =>
  writeRow('projects', id, {
    project: {
      id,
      title: 'Tokens',
      source: 'A request spends one token. The bucket refills over time.',
      harness: { adapter: 'kimi' },
      slides,
      video: null
    },
    status,
    error: null,
    events: []
  } satisfies Snapshot)

it('takes a template before the wireframes, and drops an old outline', async () => {
  await seed('draft', 'draft')
  await writeRow('outlines', 'draft', { outline: { scenes: [] } })
  const set = await setNotebookTemplate('draft', {
    narrative: 'incident',
    direction: { preset: 'deep-dive' }
  })
  expect(set.project).toMatchObject({
    narrative: 'incident',
    direction: { preset: 'deep-dive' }
  })
  expect(await readRow('outlines', 'draft')).toBeNull()
  const defaulted = await setNotebookTemplate('draft', { narrative: 'launch' })
  expect(defaulted.project.direction).toEqual({ preset: 'demo-led' })
  const none = await setNotebookTemplate('draft', { narrative: null })
  expect(none.project.narrative).toBeUndefined()
  await expect(
    setNotebookTemplate('draft', { narrative: 'mystery' })
  ).rejects.toThrow('Choose one of the templates')
  await seed('drawn', 'ready', [{ id: 's1', title: 'One', svg: '<svg/>' }])
  await expect(
    setNotebookTemplate('drawn', { narrative: 'incident' })
  ).rejects.toThrow('Choose the template before the wireframes are drawn')
})

it('plans the wireframes from the beats, keeping each page’s beats and needs', async () => {
  await seed('build', 'building')
  const saved = (await readRow<Snapshot>('projects', 'build'))!
  saved.project.narrative = 'incident'
  saved.project.direction = { preset: 'short-dramatic' }
  await writeRow('projects', 'build', saved)
  const scene = (beats: string[], needs: unknown[] = []) => ({
    title: beats.join(' and '),
    idea: 'An idea.',
    kind: 'diagram',
    seconds: 20,
    parts: [],
    relations: [],
    narration: 'Spoken words.',
    source: [],
    beats,
    needs
  })
  story.mockResolvedValue({
    title: 'Outage',
    targetSeconds: 60,
    glossary: [],
    scenes: [
      scene(['impact'], [{ kind: 'numbers', what: 'failures', source: null }]),
      scene(['timeline', 'cause']),
      scene(['fix'])
    ]
  })
  scheduleSlides('build')
  await vi.waitFor(
    async () => expect((await loadProject('build'))!.status).toBe('ready'),
    { timeout: 5000 }
  )
  const asked = story.mock.calls[0]
  expect(asked[6]).toMatchObject({
    narrative: 'incident',
    pages: [3, 6],
    lengthLabel: '45–90 s'
  })
  const slides = (await loadProject('build'))!.project.slides
  expect(slides.map((slide) => slide.beats)).toEqual([
    ['impact'],
    ['timeline', 'cause'],
    ['fix']
  ])
  expect(slides[0].needs).toEqual([
    { kind: 'numbers', what: 'failures', source: null }
  ])
})

it('adds a page for a beat after the pages that carry earlier ones', async () => {
  await seed('gaps', 'ready', [
    { id: 'a', title: 'Impact', svg: '<svg/>', beats: ['impact'] },
    { id: 'b', title: 'Fix', svg: '<svg/>', beats: ['fix'] }
  ])
  const saved = (await readRow<Snapshot>('projects', 'gaps'))!
  saved.project.narrative = 'incident'
  await writeRow('projects', 'gaps', saved)
  const added = await editSlide('gaps', { action: 'add', beat: 'cause' })
  expect(
    added.project.slides.map((slide) =>
      slide.id.length > 2 ? 'new' : slide.id
    )
  ).toEqual(['a', 'new', 'b'])
  expect(added.project.slides[1]).toMatchObject({
    title: 'Cause',
    svg: null,
    beats: ['cause']
  })
  await expect(
    editSlide('gaps', { action: 'add', beat: 'zebra' })
  ).rejects.toThrow('Choose a beat of this notebook’s template')
  // The blank page is drawn from what the creator says it shows.
  const asked = await chatSlide('gaps', {
    anchor: { stage: 'presentation', slideId: added.project.slides[1].id },
    instruction: 'The contributing factors.'
  })
  expect(asked.changes?.at(-1)).toMatchObject({ state: 'queued' })
})

it('keeps the creator’s answer with the page and redraws it', async () => {
  await seed('asks', 'ready', [
    {
      id: 'a',
      title: 'Impact',
      svg: '<svg/>',
      beats: ['impact'],
      needs: [{ kind: 'numbers', what: 'failures', source: null }]
    }
  ])
  const answered = await answerEvidence('asks', {
    slideId: 'a',
    what: 'failures',
    answer: '41% of requests'
  })
  expect(answered.project.slides[0].answers).toEqual([
    { what: 'failures', answer: '41% of requests' }
  ])
  expect(answered.changes?.at(-1)?.instruction).toContain(
    'failures: 41% of requests'
  )
  await expect(
    answerEvidence('asks', { slideId: 'a', what: 'nothing', answer: 'x' })
  ).rejects.toThrow('This wireframe does not ask for that')
  await expect(
    answerEvidence('asks', { slideId: 'a', what: 'failures', answer: ' ' })
  ).rejects.toThrow('Add an answer')
})
