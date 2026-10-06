import { expect, it, vi } from 'vitest'
import type { Project } from '../shared/model'
import type { StudioSettings } from '../shared/settings'
vi.mock('../app/api', () => ({ api: {} }))
vi.mock('../app/assets/incredible-logo.svg', () => ({ default: 'logo.svg' }))
const { parseHTML } = await import('linkedom')
const { makeVideoDialog } = await import('../app/video-screen')
const { pickTemplate, sceneSlotChip, sceneSlotMenu, templatePicker } =
  await import('../app/template-picker')
const { lookStyle, templateGalleryPage } =
  await import('../app/template-gallery-view')
const { VIDEO_TEMPLATES } = await import('../shared/video-templates')
const { TemplateGallery } = await import('../app/template-gallery')

const settings = {
  voice: {
    selected: { kind: 'record' },
    clones: [],
    choices: []
  }
} as unknown as StudioSettings
const project = (template?: string) =>
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
        ...(template ? { template } : {})
      },
      scenes: ['a', 'b', 'c'].map((id) => ({
        id: `scene-${id}`,
        slideId: id,
        phase: 'waiting',
        presence: null,
        slot: id === 'c' ? 'pattern' : null,
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

it('offers no template, the chosen one, and the way to the gallery', () => {
  const { document } = parseHTML(
    `<div>${makeVideoDialog(settings, undefined, undefined)}</div>`
  )
  const values = (doc: Document) =>
    [...doc.querySelectorAll<HTMLInputElement>('input[name="template"]')].map(
      (radio) => radio.value
    )
  expect(values(document)).toEqual([''])
  expect(
    document.querySelector('input[value=""]')?.hasAttribute('checked')
  ).toBe(true)
  const browse = document.querySelector('[data-action="open-templates"]')!
  expect(browse.textContent).toContain('Browse templates')
  expect(browse.textContent).toMatch(/\d+ ways to tell \d+\s+stories/)
  // A template chosen in the gallery is waiting in the next dialog, once.
  pickTemplate('incident')
  const picked = parseHTML(`<div>${makeVideoDialog(settings)}</div>`).document
  expect(values(picked)).toEqual(['', 'incident'])
  expect(
    picked.querySelector('input[value="incident"]')?.hasAttribute('checked')
  ).toBe(true)
  expect(picked.querySelector('.tpl-option b')?.textContent).toBe('No template')
  expect(picked.querySelector('.tpl-picker')?.textContent).toContain(
    'Incident walkthrough'
  )
  expect(picked.querySelector('.tpl-picker')?.textContent).toContain(
    'Choose another'
  )
  const again = parseHTML(`<div>${makeVideoDialog(settings)}</div>`).document
  expect(values(again)).toEqual([''])
  // The settings dialog shows the video's own template.
  expect(
    templatePicker('launch-demo').includes('value="launch-demo" checked')
  ).toBe(true)
})

it('draws previews in the notebook’s look', () => {
  expect(lookStyle(project().branding)).toBe(
    '--sk-ground:#101418;--sk-text:#f1f5f9;--sk-accent:#e11d48;--sk-secondary:#94a3b8'
  )
  expect(lookStyle(undefined)).toContain('--sk-ground:#ffffff')
})

it('names the slot a scene plays, and offers the others', () => {
  expect(sceneSlotChip(project(), 'scene-a')).toBe('')
  const shaped = project('how-it-works')
  const chip = parseHTML(
    `<div>${sceneSlotChip(shaped, 'scene-b')}</div>`
  ).document.querySelector('button')!
  expect(chip.textContent).toContain('Mechanism')
  expect(chip.textContent).toContain('3/6')
  const menu = parseHTML(
    `<div>${sceneSlotMenu(shaped, 'scene-c')}</div>`
  ).document
  const options = [...menu.querySelectorAll('[role="radio"]')]
  expect(options.map((option) => option.getAttribute('data-slot'))).toEqual([
    '',
    'hook',
    'example',
    'mechanism',
    'breaking-point',
    'pattern',
    'recap'
  ])
  expect(
    menu.querySelector('[data-slot="pattern"]')!.getAttribute('aria-checked')
  ).toBe('true')
  expect(options[0].textContent).toContain('Recap')
})

it('opens a template from the gallery, steps its slots, and uses it', () => {
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
    current: undefined,
    back: 'Back to notebook'
  })
  expect(root.querySelectorAll('.tpl-card')).toHaveLength(
    VIDEO_TEMPLATES.length
  )
  expect(root.querySelector('[data-tpl-story="all"]')?.textContent).toContain(
    String(VIDEO_TEMPLATES.length)
  )
  const click = (selector: string) =>
    root
      .querySelector<HTMLElement>(selector)!
      .dispatchEvent(new window.Event('click', { bubbles: true }))
  const titles = () =>
    [...root.querySelectorAll('.tpl-card h3')].map((title) => title.textContent)
  // A search finds templates by their story, words and slots.
  const search = (words: string) => {
    const field = root.querySelector<HTMLInputElement>('[data-tpl-search]')!
    field.value = words
    field.dispatchEvent(new window.Event('input', { bubbles: true }))
  }
  search('incident caption')
  expect(titles()).toEqual(expect.arrayContaining(['Anchor desk', 'Thriller']))
  expect(
    [...root.querySelectorAll('.tpl-card-story')].every(
      (story) => story.textContent === 'Incident walkthrough'
    )
  ).toBe(true)
  search('zebra')
  expect(root.querySelector('.tpl-count')?.textContent).toBe(
    'No template matches “zebra”.'
  )
  search('')
  expect(root.querySelectorAll('.tpl-card')).toHaveLength(
    VIDEO_TEMPLATES.length
  )
  click('.tpl-rail [data-tpl-story="launch"]')
  expect(root.querySelector('.tpl-head h1')?.textContent).toBe('Launch')
  expect(titles()).toEqual([
    'Result first',
    'Keynote',
    'Teaser',
    'Founder walkthrough'
  ])
  expect(root.querySelector('.tpl-card p')?.textContent).toBe(
    'The outcome plays first, then the walkthrough'
  )
  click('[data-tpl-open="launch-keynote"]')
  expect(root.querySelector('.tpl-detail h1')?.textContent).toBe('Keynote')
  expect(root.querySelector('.tpl-now h2')?.textContent).toBe('On stage')
  // The other ways to tell the story are a tab away.
  expect(
    [...root.querySelectorAll('.tpl-variants [role="tab"]')].map((tab) =>
      tab.textContent?.trim()
    )
  ).toEqual(['Result first', 'Keynote', 'Teaser', 'Founder walkthrough'])
  click('.tpl-variants [data-tpl-open="launch-demo"]')
  expect(root.querySelector('.tpl-detail h1')?.textContent).toBe('Result first')
  expect(
    root.querySelector('.tpl-variants [aria-selected="true"]')?.textContent
  ).toContain('Result first')
  const facts = [...root.querySelectorAll('.tpl-facts dd')].map(
    (fact) => fact.textContent
  )
  expect(facts.at(-1)).toBe('Some of it')
  expect(root.querySelector('.tpl-player-time')?.textContent).toBe(
    '0:00–0:06 of 1:30'
  )
  click('[data-tpl-step="1"]')
  expect(root.querySelector('.tpl-now h2')?.textContent).toBe('The old way')
  click('[data-tpl-slot="5"]')
  expect(root.querySelector('.tpl-now h2')?.textContent).toBe('Try it')
  expect(root.querySelector('.tpl-now-meta')?.textContent).toContain(
    'Ends the video'
  )
  click('[data-tpl-step="1"]')
  expect(root.querySelector('.tpl-now h2')?.textContent).toBe('Result first')
  // Back to the story's other ways, then into this one again to use it.
  click('.tpl-crumb')
  expect(titles()).toEqual([
    'Result first',
    'Keynote',
    'Teaser',
    'Founder walkthrough'
  ])
  click('[data-tpl-open="launch-demo"]')
  click('[data-tpl-use]')
  expect(used).toHaveBeenCalledWith('launch-demo')
  expect(gallery.isOpen).toBe(false)
  gallery.open({
    look: undefined,
    use: null,
    current: undefined,
    back: 'Back home'
  })
  click('[data-tpl-close]')
  expect(closed).toHaveBeenCalled()
  vi.unstubAllGlobals()
})

it('says when a template is in use, or cannot be used yet', () => {
  const base = {
    story: 'all',
    query: '',
    templateId: 'incident',
    slot: 0,
    playing: false,
    look: undefined,
    back: 'Back'
  }
  expect(
    templateGalleryPage({ ...base, use: 'settings', current: 'incident' })
  ).toContain('This video uses this template.')
  expect(
    templateGalleryPage({ ...base, use: 'settings', current: undefined })
  ).toContain('Switch this video to it')
  expect(
    templateGalleryPage({ ...base, use: null, current: undefined })
  ).toContain('Open a notebook with finished wireframes')
})
