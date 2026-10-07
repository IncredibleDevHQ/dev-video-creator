import { expect, it, vi } from 'vitest'
import type { Project } from '../shared/model'
import type { StudioSettings } from '../shared/settings'
vi.mock('../app/api', () => ({ api: {} }))
vi.mock('../app/assets/incredible-logo.svg', () => ({ default: 'logo.svg' }))
const { parseHTML } = await import('linkedom')
const { makeVideoDialog } = await import('../app/video-screen')
const {
  pickTemplate,
  sceneBeatChip,
  sceneBeatMenu,
  syncTemplateFields,
  templateFromForm
} = await import('../app/template-picker')
const { lookStyle, templateGalleryPage } =
  await import('../app/template-gallery-view')
const { NARRATIVES, STORY_GROUPS } = await import('../shared/narratives')
const { TemplateGallery } = await import('../app/template-gallery')

const settings = {
  voice: {
    selected: { kind: 'record' },
    clones: [],
    choices: []
  }
} as unknown as StudioSettings
const project = (narrative?: string, beats?: string[]) =>
  ({
    id: 'n',
    title: 'Tokens',
    source: '',
    slides: [],
    branding: {
      name: '',
      tagline: '',
      accent: '#e11d48',
      useAccent: true,
      palette: { ground: '#101418', text: '#f1f5f9', secondary: '#94a3b8' },
      logoKey: null,
      look: { id: 'midnight', name: 'Midnight' }
    },
    video: {
      settings: {
        presence: 'low',
        voice: { kind: 'record' },
        ...(narrative ? { narrative, direction: { preset: 'briefing' } } : {})
      },
      scenes: ['a', 'b', 'c'].map((id) => ({
        id: `scene-${id}`,
        slideId: id,
        phase: 'waiting',
        presence: null,
        beats: id === 'c' ? beats : null,
        moments: [],
        inputKey: '',
        produced: null,
        error: null
      })),
      transitions: [],
      inputKey: '',
      produced: null
    }
  }) as unknown as Project
const dialog = (current?: Parameters<typeof makeVideoDialog>[1]) =>
  parseHTML(`<div>${makeVideoDialog(settings, current)}</div>`).document
const names = (doc: Document, selector: string) =>
  [...doc.querySelectorAll(selector)].map((item) => item.textContent?.trim())

it('offers no template, the chosen one with how to tell it, and the gallery', () => {
  const plain = dialog()
  const values = (doc: Document) =>
    [...doc.querySelectorAll<HTMLInputElement>('input[name="narrative"]')].map(
      (radio) => radio.value
    )
  expect(values(plain)).toEqual([''])
  expect(plain.querySelector('.tpl-direction')).toBeNull()
  expect(plain.querySelector('.tpl-on-camera')?.hasAttribute('hidden')).toBe(
    true
  )
  expect(plain.querySelector('.tpl-presence')?.hasAttribute('hidden')).toBe(
    false
  )
  const browse = plain.querySelector('[data-action="open-templates"]')!
  expect(browse.textContent).toContain('Browse templates')
  expect(browse.textContent).toContain('61 stories, each told your way')
  // A template chosen in the gallery is waiting in the next dialog, once,
  // with its directions as chips and you on camera as the direction says.
  pickTemplate({ narrative: 'incident', direction: { preset: 'briefing' } })
  const picked = dialog()
  expect(values(picked)).toEqual(['', 'incident'])
  expect(picked.querySelector('.tpl-picker')?.textContent).toContain(
    'Incident walkthrough'
  )
  expect(names(picked, '.tpl-chip span')).toEqual([
    'Short and dramatic',
    'Briefing',
    'Explainer',
    'Deep dive',
    'Demo-led',
    'Faceless'
  ])
  expect(
    picked.querySelector('input[name="preset"][checked]')?.getAttribute('value')
  ).toBe('briefing')
  expect(
    picked.querySelector('select[name="length"] option[selected]')?.textContent
  ).toBe('2–4 min')
  expect(
    picked
      .querySelector('input[name="oncamera"][checked]')
      ?.getAttribute('value')
  ).toBe('ends')
  expect(picked.querySelector('.tpl-presence')?.hasAttribute('hidden')).toBe(
    true
  )
  expect(values(dialog())).toEqual([''])
  // The settings dialog shows the video's own, with its own length kept.
  const own = dialog({
    presence: 'low',
    voice: { kind: 'record' },
    narrative: 'security',
    direction: { preset: 'briefing', length: [300, 420] }
  })
  expect(names(own, '.tpl-chip span')).not.toContain('Short and dramatic')
  expect(
    own.querySelector('select[name="length"] option[selected]')?.textContent
  ).toBe('5–7 min')
})

it('keeps only what differs from the chosen direction', () => {
  const form = (entries: Array<[string, string]>) => {
    const values = new FormData()
    for (const [key, value] of entries) values.append(key, value)
    return values
  }
  const briefing: Array<[string, string]> = [
    ['narrative', 'incident'],
    ['preset', 'briefing'],
    ['length', '120,240'],
    ['elaboration', 'standard'],
    ['drama', 'calm'],
    ['structure', 'chronological'],
    ['audience', ''],
    ['oncamera', 'ends']
  ]
  expect(templateFromForm(form(briefing))).toEqual({
    narrative: 'incident',
    direction: { preset: 'briefing' },
    presence: 'low'
  })
  expect(
    templateFromForm(
      form([
        ['narrative', 'incident'],
        ['preset', 'deep-dive'],
        ['length', 'own'],
        ['length-from', '30'],
        ['length-to', '40'],
        ['length-unit', '60'],
        ['elaboration', 'thorough'],
        ['drama', 'lively'],
        ['structure', 'chronological'],
        ['audience', 'leaders'],
        ['oncamera', 'none'],
        ['leads', 'code']
      ])
    )
  ).toEqual({
    narrative: 'incident',
    direction: {
      preset: 'deep-dive',
      length: [1800, 2400],
      onCamera: 'none',
      audience: 'leaders',
      leads: ['code']
    },
    presence: 'off'
  })
  expect(() =>
    templateFromForm(
      form([
        ['narrative', 'incident'],
        ['preset', 'briefing'],
        ['length', 'own'],
        ['length-from', '9'],
        ['length-to', '4']
      ])
    )
  ).toThrow('Give the length as a range, the shorter end first')
  expect(templateFromForm(form([['narrative', '']]))).toEqual({})
})

it('takes on a direction’s settings when it is picked', () => {
  pickTemplate({ narrative: 'incident' })
  const doc = dialog()
  const form = doc.querySelector('form')!
  const short = doc.querySelector<HTMLInputElement>(
    'input[name="preset"][value="short-dramatic"]'
  )!
  syncTemplateFields(form, short)
  expect(
    doc.querySelector<HTMLSelectElement>('select[name="length"]')?.value
  ).toBe('45,90')
  expect(
    doc.querySelector<HTMLSelectElement>('select[name="drama"]')?.value
  ).toBe('dramatic')
  expect(
    doc.querySelector<HTMLInputElement>('input[name="oncamera"][value="leads"]')
      ?.checked
  ).toBe(true)
  // Your own length opens its two fields; no template hides the rest.
  doc.querySelector<HTMLOptionElement>(
    'select[name="length"] option[value="own"]'
  )!.selected = true
  syncTemplateFields(form, doc.querySelector('select[name="length"]'))
  expect(doc.querySelector('.tpl-length-own')?.hasAttribute('hidden')).toBe(
    false
  )
  syncTemplateFields(
    form,
    doc.querySelector('input[name="narrative"][value=""]')
  )
  expect(doc.querySelector('.tpl-direction')?.hasAttribute('hidden')).toBe(true)
  expect(doc.querySelector('.tpl-on-camera')?.hasAttribute('disabled')).toBe(
    true
  )
  expect(doc.querySelector('.tpl-presence')?.hasAttribute('hidden')).toBe(false)
})

it('draws previews in the notebook’s look', () => {
  expect(lookStyle(project().branding)).toBe(
    '--sk-ground:#101418;--sk-text:#f1f5f9;--sk-accent:#e11d48;--sk-secondary:#94a3b8'
  )
  expect(lookStyle(undefined)).toContain('--sk-ground:#ffffff')
})

it('names the beats a scene carries, and offers the others', () => {
  expect(sceneBeatChip(project(), 'scene-a')).toBe('')
  const told = project('incident', ['fix'])
  const chip = parseHTML(
    `<div>${sceneBeatChip(told, 'scene-a')}</div>`
  ).document.querySelector('button')!
  expect(chip.textContent).toContain('Impact · Timeline')
  const menu = parseHTML(
    `<div>${sceneBeatMenu(told, 'scene-c')}</div>`
  ).document
  const options = [...menu.querySelectorAll('[role="radio"]')]
  expect(options.map((option) => option.getAttribute('data-beat'))).toEqual([
    '',
    'impact',
    'timeline',
    'cause',
    'fix',
    'changes'
  ])
  expect(
    menu.querySelector('[data-beat="fix"]')!.getAttribute('aria-checked')
  ).toBe('true')
  expect(options[0].textContent).toContain('Fix · What changes')
})

it('opens a template, walks its beats in each direction, and uses one', () => {
  const { document, window } = parseHTML(
    '<!doctype html><html><head></head><body><main id="app"></main></body></html>'
  )
  vi.stubGlobal('document', document)
  vi.stubGlobal('window', Object.assign(window, { scrollTo: () => {} }))
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const root = document.getElementById('app')!
  const closed = vi.fn()
  const used = vi.fn()
  const gallery = new TemplateGallery(root, closed, used)
  gallery.open({
    look: project().branding,
    use: 'make',
    current: {},
    back: 'Back to notebook'
  })
  expect(
    [...root.querySelectorAll('.tpl-rail button span')].map(
      (name) => name.textContent
    )
  ).toEqual(['All templates', ...STORY_GROUPS.map((group) => group.name)])
  expect(root.querySelector('[data-tpl-group="all"]')?.textContent).toContain(
    String(NARRATIVES.length)
  )
  expect(root.querySelectorAll('.tpl-card')).toHaveLength(NARRATIVES.length)
  const click = (selector: string) =>
    root
      .querySelector<HTMLElement>(selector)!
      .dispatchEvent(new window.Event('click', { bubbles: true }))
  const titles = () =>
    [...root.querySelectorAll('.tpl-card h3')].map((title) => title.textContent)
  const search = (words: string) => {
    const field = root.querySelector<HTMLInputElement>('[data-tpl-search]')!
    field.value = words
    field.dispatchEvent(new window.Event('input', { bubbles: true }))
  }
  // A search reads the rules and the beats, not only the names.
  search('blameless')
  expect(titles()).toEqual(['Incident walkthrough'])
  click('[data-tpl-try="incident"]')
  expect(titles()).toContain('Incident walkthrough')
  search('zebra')
  expect(root.querySelector('.tpl-count')?.textContent).toContain(
    'No template matches “zebra”.'
  )
  search('')
  click('.tpl-rail [data-tpl-group="show"]')
  expect(root.querySelector('.tpl-head h1')?.textContent).toBe('Show')
  expect(titles()).toEqual([
    'Launch',
    'Release notes',
    'Build log',
    'Code change walkthrough',
    'Product overview'
  ])
  click('[data-tpl-open="launch"]')
  expect(root.querySelector('.tpl-detail h1')?.textContent).toBe('Launch')
  expect(
    root.querySelector('.tpl-variants [aria-selected="true"]')?.textContent
  ).toContain('Demo-led')
  expect(
    root.querySelector('.tpl-detail-meta')?.textContent?.replace(/\s+/g, ' ')
  ).toContain('2–5 min · Lively · On camera as a guide · Result first')
  expect(root.querySelector('.tpl-caption b')?.textContent).toBe(
    'What you can do now'
  )
  expect(root.querySelectorAll('.tpl-chapters button')).toHaveLength(6)
  click('[data-tpl-step="1"]')
  expect(root.querySelector('.tpl-caption b')?.textContent).toBe('The old way')
  // A short telling drops the optional beats, and leads on camera.
  click('[data-tpl-preset="short-dramatic"]')
  expect(
    root.querySelector('.tpl-detail-meta')?.textContent?.replace(/\s+/g, ' ')
  ).toContain('45–90 s · Dramatic')
  expect(names(document, '.tpl-left-out span')).toEqual([
    'Under the hood',
    'Proof'
  ])
  expect(
    root.querySelector('.tpl-stage.large')?.getAttribute('data-speaker')
  ).toBe('over')
  expect(root.querySelector('.tpl-insists')?.textContent).toContain(
    'Show it working before explaining it.'
  )
  click('[data-tpl-use]')
  expect(used).toHaveBeenCalledWith('launch', 'short-dramatic')
  expect(gallery.isOpen).toBe(false)
  gallery.open({ look: undefined, use: null, current: {}, back: 'Back home' })
  click('[data-tpl-close]')
  expect(closed).toHaveBeenCalled()
  vi.unstubAllGlobals()
})

it('says when a template is in use, or cannot be used yet', () => {
  const base = {
    group: 'all' as const,
    query: '',
    narrative: 'incident',
    preset: null,
    beat: 0,
    playing: false,
    look: undefined,
    back: 'Back'
  }
  const page = (state: Partial<Parameters<typeof templateGalleryPage>[0]>) =>
    templateGalleryPage({ ...base, use: 'settings', current: {}, ...state })
  expect(
    page({ current: { narrative: 'incident', preset: 'briefing' } })
  ).toContain('This video tells it this way.')
  expect(
    page({
      current: { narrative: 'incident', preset: 'briefing' },
      preset: 'deep-dive'
    })
  ).toContain('Tell it this way')
  expect(page({})).toContain('Switch this video to it')
  expect(page({ use: null })).toContain(
    'Open a notebook with finished wireframes'
  )
})
