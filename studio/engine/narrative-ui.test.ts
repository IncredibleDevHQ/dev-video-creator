import { expect, it, vi } from 'vitest'
import type { Project } from '../shared/model'
import type { StudioSettings } from '../shared/settings'
vi.mock('../app/api', () => ({ api: {} }))
vi.mock('../app/assets/incredible-logo.svg', () => ({ default: 'logo.svg' }))
const { parseHTML } = await import('linkedom')
const { makeVideoDialog } = await import('../app/video-screen')
const {
  keepMakeChoices,
  keptMakeChoices,
  pickTemplate,
  restoreMakeChoices,
  sceneBeatChip,
  sceneBeatMenu,
  syncTemplateFields,
  templateFromForm
} = await import('../app/template-picker')
const { lookStyle, templateGalleryPage } =
  await import('../app/template-gallery-view')
const { NARRATIVES, STORY_GROUPS, directionSettings, narrativeById } =
  await import('../shared/narratives')
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
  // The length is chips now (review 6), the chosen one checked.
  expect(
    picked
      .querySelector('input[name="length"][checked]')
      ?.closest('label')
      ?.textContent?.trim()
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
    own
      .querySelector('input[name="length"][checked]')
      ?.closest('label')
      ?.textContent?.trim()
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
  const lengths = () => [
    ...doc.querySelectorAll<HTMLInputElement>('input[name="length"]')
  ]
  expect(lengths().find((input) => input.checked)?.value).toBe('45,90')
  expect(
    doc.querySelector<HTMLSelectElement>('select[name="drama"]')?.value
  ).toBe('dramatic')
  expect(
    doc.querySelector<HTMLInputElement>('input[name="oncamera"][value="leads"]')
      ?.checked
  ).toBe(true)
  // Your own length opens its two fields; no template hides the rest.
  // As a browser does for a radio group: one checked, the rest not.
  const own = lengths().find((input) => input.value === 'own')!
  for (const input of lengths()) input.checked = input === own
  syncTemplateFields(form, own)
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

it('keeps the make dialog’s choices while the gallery is open', () => {
  const voices = {
    voice: {
      selected: { kind: 'record' },
      clones: [],
      choices: [{ id: 'system:Daniel', name: 'Daniel', language: 'en-GB' }]
    }
  } as unknown as StudioSettings
  const slides = ['a', 'b', 'c'].map((id) => ({ id, title: id })) as never
  const open = () => {
    const doc = parseHTML(
      `<div>${makeVideoDialog(
        voices,
        undefined,
        { slides, selected: null, only: false },
        undefined,
        { narrative: 'incident', direction: { preset: 'briefing' } }
      )}</div>`
    ).document
    // As a browser does: what the markup checks starts checked.
    for (const input of doc.querySelectorAll('input'))
      input.checked = input.hasAttribute('checked')
    return doc
  }
  const inputs = (doc: Document, name: string) => [
    ...doc.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)
  ]
  // As a browser does for a radio group: one checked, the rest not.
  const choose = (doc: Document, name: string, value: string) =>
    inputs(doc, name).forEach(
      (input) => (input.checked = input.value === value)
    )
  const state = (doc: Document) => ({
    scenes: inputs(doc, 'scene')
      .filter((input) => input.checked)
      .map((input) => input.value),
    ...Object.fromEntries(
      ['oncamera', 'voice', 'length', 'preset'].map((name) => [
        name,
        inputs(doc, name).find((input) => input.checked)?.value
      ])
    )
  })
  const before = open()
  inputs(before, 'scene')[1].checked = false
  choose(before, 'oncamera', 'none')
  choose(before, 'voice', 'ai:system:Daniel')
  choose(before, 'length', '45,90')
  expect(keepMakeChoices(before)).toBe(true)
  expect(keptMakeChoices()).toBe(true)
  // Left without a pick, the dialog comes back as it was left.
  const back = open()
  restoreMakeChoices(back)
  expect(keptMakeChoices()).toBe(false)
  expect(state(back)).toEqual({
    scenes: ['a', 'c'],
    oncamera: 'none',
    voice: 'ai:system:Daniel',
    length: '45,90',
    preset: 'briefing'
  })
  // Another story brings its own direction; scenes, camera and voice stay.
  keepMakeChoices(back)
  pickTemplate({ narrative: 'security', direction: { preset: 'explainer' } })
  const other = open()
  restoreMakeChoices(other)
  expect(state(other)).toEqual({
    scenes: ['a', 'c'],
    oncamera: 'none',
    voice: 'ai:system:Daniel',
    length: directionSettings(narrativeById('security')!, {
      preset: 'explainer'
    }).length.join(','),
    preset: 'explainer'
  })
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

it('offers the template beside the agent before the wireframes', async () => {
  const { choicesRow } = await import('../app/notebook-choices')
  const { pageStory, storyGaps } = await import('../app/wireframe-story')
  const snapshot = (project: object, status = 'draft') =>
    ({
      project: {
        id: 'n',
        title: 'T',
        source: '',
        slides: [],
        video: null,
        ...project
      },
      status,
      error: null,
      events: []
    }) as never
  const chips = (html: string) =>
    names(parseHTML(`<div>${html}</div>`).document, '.choice')
  expect(chips(choicesRow(snapshot({}), true))).toEqual([
    'your agent',
    'No template',
    'about 5 min',
    'Paper look',
    'No repo'
  ])
  expect(
    chips(
      choicesRow(
        snapshot({ narrative: 'incident', direction: { preset: 'briefing' } }),
        true
      )
    ).slice(1, 3)
  ).toEqual(['Incident walkthrough', 'Briefing, 2–4 min'])
  // On a wireframe: the beats it carries and the evidence it still needs.
  const slide = {
    id: 'a',
    title: 'Impact',
    svg: '<svg/>',
    beats: ['impact'],
    needs: [
      { kind: 'numbers' as const, what: 'how many failed', source: null },
      { kind: 'quote' as const, what: 'the trigger', source: 'A sentence.' }
    ],
    answers: []
  }
  const ready = snapshot({ narrative: 'incident', slides: [slide] }, 'ready')
  const page = parseHTML(`<div>${pageStory(ready, slide, true)}</div>`).document
  expect(names(page, '.page-beats b')).toEqual(['Impact'])
  expect(page.querySelectorAll('.evidence-ask')).toHaveLength(1)
  expect(
    page.querySelector('.evidence-ask')?.getAttribute('data-evidence-what')
  ).toBe('how many failed')
  expect(pageStory(snapshot({}, 'ready'), slide, true)).toBe('')
  // Core beats no page carries, each a click from a page of its own.
  const gaps = parseHTML(`<div>${storyGaps(ready, true)}</div>`).document
  expect(
    [...gaps.querySelectorAll('[data-action="add-beat"]')].map((item) =>
      item.getAttribute('data-beat')
    )
  ).toEqual(['timeline', 'cause', 'fix'])
  expect(
    storyGaps(
      snapshot({ narrative: 'incident', slides: [slide] }, 'building'),
      true
    )
  ).toBe('')
  // The gallery plans a notebook's wireframes before there are any.
  const page2 = templateGalleryPage({
    group: 'all',
    query: '',
    narrative: 'incident',
    preset: null,
    beat: 0,
    playing: false,
    look: undefined,
    use: 'notebook',
    current: {},
    back: 'Back'
  })
  expect(page2).toContain('Use for this notebook')
  expect(page2).toContain('Your wireframes are planned from its beats.')
})

it('names a scene’s shot, offers the others, and follows the direction', async () => {
  const { sceneShotChip, sceneShotMenu } = await import('../app/shot-picker')
  const { sceneSettings } = await import('../app/camera-settings')
  expect(sceneShotChip(project(), 'scene-a')).toBe('')
  const told = project('incident')
  // The orchestrator walks the wireframes, one scene each.
  told.slides = ['a', 'b', 'c'].map((id) => ({
    id,
    title: id,
    svg: '<svg/>'
  }))
  const chip = parseHTML(
    `<div>${sceneShotChip(told, 'scene-a')}</div>`
  ).document
  expect(chip.querySelector('button')?.textContent?.trim()).toBe('Title')
  const menu = parseHTML(
    `<div>${sceneShotMenu(told, 'scene-b')}</div>`
  ).document
  const options = [...menu.querySelectorAll('[role="radio"]')]
  expect(options[0].getAttribute('data-shot')).toBe('')
  expect(options[0].getAttribute('aria-checked')).toBe('true')
  // The title shot is the opening's alone.
  expect(options.map((item) => item.getAttribute('data-shot'))).not.toContain(
    'title-reveal'
  )
  // The choice is named, not the system that made it (review 6).
  expect(menu.querySelector('.popover-note')?.textContent).toContain(
    'We suggest'
  )
  // A briefing keeps you off camera between the first and last scenes.
  const video = told.video!
  const middle = parseHTML(
    `<div>${sceneSettings(video.scenes[1], video.settings, 1, true, 3)}</div>`
  ).document
  expect(middle.querySelector('.settings-note')?.textContent?.trim()).toBe(
    'Following the template’s direction · Off'
  )
  // The scene's menu makes its animation when it can; a left-out scene's
  // offers only Make this scene (review 6).
  const ready = {
    ...video.scenes[1],
    phase: 'waiting',
    creativePlan: { record: 'r' },
    animationKey: 'k',
    moments: [{ id: 'm1', start: 0, end: 4 }]
  } as never
  const menu2 = (inVideo: boolean) =>
    parseHTML(
      `<div>${sceneSettings(ready, video.settings, 1, inVideo, 3)}</div>`
    ).document
  expect(menu2(true).querySelector('[data-action="make-animation"]')).not.toBe(
    null
  )
  const left = menu2(false)
  expect(left.querySelector('[data-presence]')).toBeNull()
  expect(left.querySelector('[data-action="make-animation"]')).toBeNull()
  expect(
    left.querySelector('[data-action="make-scene"]')?.textContent?.trim()
  ).toBe('Make this scene')
})

it('says what Jev suggests once, and where it reads a page differently', async () => {
  const { choicesRow } = await import('../app/notebook-choices')
  const { pageStory } = await import('../app/wireframe-story')
  const suggestion = {
    at: 'now',
    narratives: [
      { id: 'incident', p: 0.52 },
      { id: 'debugging', p: 0.31 }
    ],
    confidence: 0.52,
    preset: 'briefing',
    length: null,
    audience: null,
    evidence: {},
    elaboration: 'standard',
    drama: 'calm',
    preselected: false
  }
  const snapshot = (project: object, extra: object = {}) =>
    ({
      project: {
        id: 'n',
        title: 'T',
        source: '',
        slides: [],
        video: null,
        ...project
      },
      status: 'draft',
      error: null,
      events: [],
      suggestion,
      ...extra
    }) as never
  const unsure = parseHTML(
    `<div>${choicesRow(snapshot({}), true)}</div>`
  ).document
  expect(
    [...unsure.querySelectorAll('[data-action="take-suggestion"]')].map(
      (item) => item.getAttribute('data-narrative')
    )
  ).toEqual(['incident', 'debugging'])
  expect(choicesRow(snapshot({}), false)).not.toContain('take-suggestion')
  // A long shot is left out.
  expect(
    choicesRow(
      snapshot(
        {},
        {
          suggestion: {
            ...suggestion,
            narratives: [...suggestion.narratives, { id: 'retro', p: 0.06 }]
          }
        }
      ),
      true
    )
  ).not.toContain('data-narrative="retro"')
  // A template Jev set says so in its chip, and the row is gone.
  const sure = choicesRow(
    snapshot(
      { narrative: 'incident' },
      { suggestion: { ...suggestion, preselected: true } }
    ),
    true
  )
  expect(sure).toContain('Incident walkthrough <small>suggested</small>')
  expect(sure).not.toContain('take-suggestion')
  // A page Jev reads as another beat than it was given.
  const slide = { id: 'a', title: 'Why', svg: '<svg/>', beats: ['cause'] }
  const read = (beat: string, confidence: number) =>
    snapshot(
      { narrative: 'incident', slides: [slide] },
      {
        status: 'ready',
        coverageReading: { at: 'now', pages: { a: { beat, confidence } } }
      }
    )
  expect(pageStory(read('fix', 0.8), slide, true)).toContain('Reads as “Fix”')
  expect(pageStory(read('none', 0.8), slide, true)).toContain(
    'Reads as none of the story’s beats'
  )
  expect(pageStory(read('cause', 0.9), slide, true)).not.toContain('page-check')
  expect(pageStory(read('fix', 0.4), slide, true)).not.toContain('page-check')
})
