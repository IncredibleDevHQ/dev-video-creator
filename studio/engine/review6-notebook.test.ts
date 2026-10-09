import { expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
import { notesLength, NOTE_LIMIT } from '../shared/notes'
import { loadableFont } from '../shared/looks'
import { lengthForPages, lengthLabel } from '../shared/narratives'
import { modelName } from '../shared/agent-models'
import { presentationProgress } from '../app/progress'
import { notebookNextAction } from '../app/notebook-next-step'

const draft = {
  project: {
    id: 'n',
    title: 'Agents',
    source: 'Notes',
    slides: [],
    video: null
  },
  status: 'draft',
  error: null,
  events: []
} as unknown as Snapshot

it('counts the notes without the reader’s cut note', () => {
  const kept = 'x'.repeat(NOTE_LIMIT)
  const cut = `${kept} … [cut: the article goes on for 4,512 more characters]`
  expect(notesLength(cut)).toBe(NOTE_LIMIT)
  expect(notesLength(`${kept}y`)).toBe(NOTE_LIMIT + 1)
})

it('keeps a font only if it can load, else the nearest built-in', () => {
  expect(loadableFont('Inter')).toEqual({ value: 'Inter', replaced: false })
  expect(loadableFont('Georgia')).toEqual({ value: 'Georgia', replaced: false })
  expect(loadableFont('tiemposText')).toEqual({
    value: 'Georgia',
    replaced: true
  })
  expect(loadableFont('styreneA')).toEqual({ value: 'Inter', replaced: true })
  expect(loadableFont('JetBrains Mono').value).toBe('ui-monospace')
})

it('says lengths in seconds or whole and half minutes', () => {
  expect(lengthLabel([45, 90])).toBe('45–90 s')
  expect(lengthLabel([80, 130])).toBe('1.5–2 min')
  expect(lengthLabel([360, 600])).toBe('6–10 min')
  // Ten wireframes told thoroughly stay about ten wireframes long.
  expect(lengthForPages(10, 'thorough')).toEqual([300, 600])
})

it('names models plainly', () => {
  expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelName('opus')).toBe('Opus')
  expect(modelName('kimi-code/k3')).toBe('K3')
})

it('lets the Wireframe tab show an empty stage whose button starts the run', () => {
  const card = presentationProgress(draft)
  expect(card).toContain('No wireframes yet')
  expect(card).toContain('data-action="create-presentation"')
  expect(notebookNextAction(draft, true)).toContain('Creating…')
  expect(notebookNextAction(draft, true)).toContain('aria-busy="true"')
  expect(notebookNextAction(draft, true)).toContain('disabled')
})
