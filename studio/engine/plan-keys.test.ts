import { expect, it, vi } from 'vitest'
import type { Project } from '../shared/model'
// Plans kept through the engine's own routes (review 6): a notebook planned
// while 32b14a0c put the model's shown name in the key, and one planned as
// now. Production stops at its clock here: reaching it means the stored
// plan passed production's check.
vi.mock('./creative/clock', () => ({
  prepareCreativeClock: vi.fn(async () => {
    throw new Error('reached the clock')
  })
}))
vi.mock('./voice-library', () => ({
  listClones: async () => [],
  voiceCatalogue: async () => ({ choices: [], error: null }),
  selectedVoice: async () => ({ kind: 'record' }),
  resolveVoice: vi.fn(async () => undefined),
  useVoice: vi.fn()
}))
vi.mock('./harness/runtime', async (original) => ({
  ...(await original<typeof import('./harness/runtime')>()),
  inspectHarnesses: vi.fn(async () => [
    {
      id: 'codex',
      ok: true,
      models: { options: [{ id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' }] }
    }
  ])
}))
const { writeRow } = await import('./persistence')
const { loadProject, editSlide } = await import('./projects')
const { applyIdentity } = await import('./branding')
const { applyLook } = await import('./look-apply')
const { setNotebookHarness } = await import('./notebook-intake')
const { updateVideoSettings } = await import('./video')
const { buildCreativeProduction } = await import('./creative/production')
const { refreshVideoKeys, reconcileVideo, scenePlanKey } =
  await import('./scene-model')

const seed = async (id: string, legacy: boolean) => {
  const project: Project = {
    id,
    title: 'Tokens',
    source: 'Text',
    slides: ['a', 'b', 'c'].map((s) => ({
      id: s,
      title: s,
      svg: '<svg><rect fill="#112233"/></svg>',
      narration: `Words for ${s}.`
    })),
    branding: {
      name: '',
      tagline: '',
      accent: '#112233',
      useAccent: true,
      logoKey: null,
      palette: { ground: '#ffffff', text: '#000000', secondary: '#888888' }
    },
    video: {
      settings: {
        presence: 'off',
        voice: { kind: 'record' },
        harness: {
          adapter: 'codex',
          model: 'gpt-6.1-sol',
          label: 'GPT-6.1-Sol'
        }
      },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: null
    }
  }
  reconcileVideo(project, { project, events: [] })
  for (const scene of project.video!.scenes) {
    scene.planKey = scenePlanKey(project, scene, legacy)
    scene.creativePlan = { recordId: `r-${scene.id}`, inputKey: scene.planKey }
    scene.phase = 'waiting'
    await writeRow('creative-scenes', scene.id, {
      id: `r-${scene.id}`,
      projectId: id,
      sceneId: scene.id,
      inputKey: scene.planKey,
      selection: project.video!.settings.harness,
      treatment: {},
      moments: [],
      createdAt: ''
    })
  }
  refreshVideoKeys(project)
  await writeRow('projects', id, {
    project,
    status: 'ready',
    error: null,
    events: []
  })
  return project.video!.scenes.map((scene) => scene.planKey!)
}
// Production's own check of the stored plan: past it, the clock.
const producible = async (id: string, pages = ['a', 'b', 'c']) => {
  const { project } = (await loadProject(id))!
  for (const scene of project.video!.scenes)
    if (pages.includes(scene.slideId))
      await expect(
        buildCreativeProduction(project, scene, 'http://127.0.0.1:1')
      ).rejects.toThrow('reached the clock')
}
const phases = async (id: string) =>
  (await loadProject(id))!.project.video!.scenes.map((scene) => scene.phase)

it('keeps every plan through an identity save, older ones too', async () => {
  for (const legacy of [false, true]) {
    const id = `identity-${legacy}`
    const stored = await seed(id, legacy)
    await applyIdentity(id, {
      name: 'Ada',
      tagline: '',
      logoKey: null
    } as never)
    const { project } = (await loadProject(id))!
    expect(project.video!.scenes.map((scene) => scene.planKey)).toEqual(stored)
    await producible(id)
  }
})

it('keeps every plan through a look, and an edit after it re-plans only its page', async () => {
  for (const legacy of [false, true]) {
    const id = `look-${legacy}`
    await seed(id, legacy)
    await applyLook(id, {
      id: 'custom',
      name: 'Custom',
      palette: {
        ground: '#ffffff',
        text: '#000000',
        accent: '#234567',
        secondary: '#888888'
      },
      fonts: { display: 'Georgia', body: 'Inter', mono: 'ui-monospace' }
    })
    const { project } = (await loadProject(id))!
    expect(project.slides[0].svg).toContain('#234567')
    await producible(id)
    await editSlide(id, {
      action: 'script',
      slideId: 'c',
      narration: 'New words for c.'
    })
    expect(await phases(id)).toEqual(['waiting', 'waiting', 'queued'])
  }
})

it('keeps an older plan when the agent’s list names its model anew', async () => {
  const id = 'harness'
  await seed(id, true)
  // The notebook's agent chosen again, named as the list now names it.
  await setNotebookHarness(id, {
    adapter: 'codex',
    model: 'gpt-6.1-sol',
    label: 'GPT-6.1 Sol'
  })
  await editSlide(id, {
    action: 'script',
    slideId: 'c',
    narration: 'New words for c.'
  })
  expect(await phases(id)).toEqual(['waiting', 'waiting', 'queued'])
  await producible(id, ['a', 'b'])
  // The video's settings saved with it, the list naming it again.
  const settings = await seed('settings', true)
  await updateVideoSettings('settings', {
    presence: 'off',
    voice: { kind: 'record' },
    harness: { adapter: 'codex', model: 'gpt-6.1-sol' }
  })
  const saved = (await loadProject('settings'))!.project.video!
  expect(saved.settings.harness?.label).toBe('GPT-6.1 Sol')
  expect(saved.scenes.map((scene) => scene.planKey)).toEqual(settings)
  expect(saved.scenes.map((scene) => scene.phase)).toEqual(
    Array(3).fill('waiting')
  )
})

it('keeps how the video is made and how long it runs when its settings are saved', async () => {
  await seed('length', false)
  const { changeProject } = await import('./projects')
  await changeProject('length', (current) => {
    current.project.video!.settings.production = 'storyboard'
    current.project.video!.settings.length = { min: 60, max: 90, strict: true }
  })
  // The settings dialog asks neither.
  await updateVideoSettings('length', {
    presence: 'off',
    voice: { kind: 'record' }
  })
  const saved = (await loadProject('length'))!.project.video!.settings
  expect(saved.production).toBe('storyboard')
  expect(saved.length).toEqual({ min: 60, max: 90, strict: true })
})

it('waits for the scenes being made before a new look or name', async () => {
  const id = 'making'
  await seed(id, false)
  const { changeProject } = await import('./projects')
  await changeProject(id, (current) => {
    current.project.video!.scenes[1].phase = 'producing'
  })
  const look = {
    id: 'custom',
    name: 'Custom',
    palette: {
      ground: '#ffffff',
      text: '#000000',
      accent: '#234567',
      secondary: '#888888'
    },
    fonts: { display: 'Georgia', body: 'Inter', mono: 'ui-monospace' }
  }
  // Refused, not left behind: the scene would stay "Producing" (review 6).
  await expect(applyLook(id, look)).rejects.toThrow('being made to finish')
  await expect(
    applyIdentity(id, { name: 'Ada', tagline: '', logoKey: null } as never)
  ).rejects.toThrow('being made to finish')
  // From Settings, refused before anything is saved.
  const { saveStudioSettings, getStudioSettings } = await import('./settings')
  const before = (await getStudioSettings()).branding
  await expect(
    saveStudioSettings({
      projectId: id,
      branding: {
        name: 'Ada',
        tagline: '',
        accent: '#112233',
        useAccent: true,
        logoKey: null
      }
    })
  ).rejects.toThrow('being made to finish')
  expect((await getStudioSettings()).branding).toEqual(before)
  const { project } = (await loadProject(id))!
  expect(project.slides[0].svg).toContain('#112233')
  expect(project.branding?.name).toBe('')
})

it('opens a notebook d24d80b8 moved with its made scenes as they were', async () => {
  const id = 'moved'
  await seed(id, true)
  const { changeProject } = await import('./projects')
  // As d24d80b8 left it: the keys moved to the new form, and with them the
  // keys of what was made; nothing made since.
  const { readRow } = await import('./persistence')
  const saved = (await readRow<{ project: Project }>('projects', id))!
  for (const scene of saved.project.video!.scenes) {
    scene.animation = {
      inputKey: scene.animationKey!,
      objectKey: 'a.mp4',
      moments: []
    }
    const to = scenePlanKey(saved.project, scene)
    scene.legacyPlanKey = { from: scene.planKey!, to }
    scene.planKey = to
  }
  refreshVideoKeys(saved.project)
  await writeRow('projects', id, saved)
  // Read, and changed once: the keys are back, and production's check of
  // the stored plan passes, with no edit first.
  const { project } = (await loadProject(id))!
  expect(
    project.video!.scenes.every(
      (scene) => scene.animation?.inputKey === scene.animationKey
    )
  ).toBe(true)
  await changeProject(id, () => {})
  await producible(id)
})
