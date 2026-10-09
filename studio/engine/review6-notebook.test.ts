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
  // As the editor's markdown writes it back: the cut note's brackets and
  // other characters escaped, & as an entity, a table padded. Each is still
  // one character, or one space, to the creator.
  const written = String.raw`a\_b\* &amp; |  c   |  d  |`
  expect(notesLength(written)).toBe('a_b* & | c | d |'.length)
  expect(
    notesLength(
      'x'.repeat(NOTE_LIMIT - 3) +
        String.raw`a\_ … \[cut: the article goes on for 4,512 more characters\]`
    )
  ).toBe(NOTE_LIMIT - 1)
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

it('says on the notebook’s look when a site’s fonts stand in', async () => {
  const { withLook, fontsStandingIn } = await import('./looks')
  // Each stand-in once, the words agreeing with how many there are.
  expect(fontsStandingIn([{ value: 'Inter' }, { value: 'Inter' }])).toBe(
    'Its fonts can’t be loaded here, so Inter stands in.'
  )
  expect(fontsStandingIn([{ value: 'Georgia' }])).toBe(
    'One of its fonts can’t be loaded here, so Georgia stands in.'
  )
  expect(fontsStandingIn([{ value: 'Georgia' }, { value: 'Inter' }])).toBe(
    'Its fonts can’t be loaded here, so Georgia and Inter stand in.'
  )
  const { LOOKS } = await import('../shared/looks')
  const site = {
    ...LOOKS[0],
    id: 'site',
    name: 'anthropic.com',
    description:
      'Colours read from anthropic.com. Its fonts can’t be loaded here, so Georgia and Inter stand in.'
  }
  expect(withLook(undefined, site).look).toEqual({
    id: 'site',
    name: 'anthropic.com',
    note: site.description
  })
  // A look of the studio's own describes itself.
  expect(withLook(undefined, LOOKS[0]).look).toEqual({
    id: LOOKS[0].id,
    name: LOOKS[0].name
  })
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
