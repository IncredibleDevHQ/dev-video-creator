import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
vi.mock('./voice-library', () => ({
  listClones: async () => [],
  voiceCatalogue: async () => ({ choices: [], error: null }),
  selectedVoice: async () => ({ kind: 'record' }),
  useVoice: vi.fn()
}))
vi.mock('./harness/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./harness/runtime')>()),
  inspectHarnesses: vi.fn(async () => [{ id: 'kimi', ok: true }])
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-settings-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { getStudioSettings, saveStudioSettings } = await import('./settings')
const { configureModelGateway } = await import('./model-gateway')
const { writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { refreshVideoKeys } = await import('./scene-model')
configureModelGateway({ envKey: '' })
afterAll(() => rm(root, { recursive: true, force: true }))
it('reports saved credentials without returning their contents or hints', async () => {
  const settings = await saveStudioSettings({
    models: {
      provider: 'custom',
      baseUrl: 'http://127.0.0.1:1234/v1',
      apiKey: 'test-model-secret',
      models: { writing: 'write', vision: 'see', coding: 'code' }
    },
    fishApiKey: 'test-fish-secret'
  })
  expect(settings.models.hasKey).toBe(true)
  expect(settings.voice.hasKey).toBe(true)
  const response = JSON.stringify(await getStudioSettings())
  expect(response).not.toContain('test-model-secret')
  expect(response).not.toContain('test-fish-secret')
  expect(response).not.toContain('keyHint')
})
it('a name change and a look change each invalidate exports, and neither changes the other', async () => {
  const snapshot: Snapshot = {
    project: {
      id: 'brand',
      title: 'Fixture',
      source: 'Fixture',
      branding: {
        name: '',
        tagline: '',
        accent: '#112233',
        useAccent: true,
        logoKey: null,
        palette: { ground: '#ffffff', text: '#000000', secondary: '#888888' },
        fonts: { display: 'Inter', body: 'Inter', mono: 'ui-monospace' },
        look: { id: 'site', name: 'example.com' }
      },
      slides: [
        {
          id: 'slide',
          title: 'Fixture',
          svg: '<svg><rect fill="#112233"/></svg>'
        }
      ],
      video: {
        settings: { presence: 'off', voice: { kind: 'record' } },
        inputKey: '',
        scenes: [
          {
            id: 'scene',
            slideId: 'slide',
            phase: 'produced',
            presence: null,
            inputKey: '',
            moments: [
              {
                id: 'moment',
                lines: 'Fixture',
                start: 0,
                end: 2,
                camera: 'none',
                layout: 'corner',
                overlay: null,
                recordingKey: 'record',
                take: {
                  id: 'take',
                  recordingKey: 'record',
                  objectKey: 'take.webm'
                },
                audio: null,
                audioKey: 'audio'
              }
            ],
            produced: null,
            error: null
          }
        ],
        transitions: [],
        produced: null
      }
    },
    status: 'ready',
    events: [],
    error: null
  }
  refreshVideoKeys(snapshot.project)
  const scene = snapshot.project.video!.scenes[0]
  scene.produced = { inputKey: scene.inputKey, objectKey: 'scene.mp4' }
  snapshot.project.video!.produced = {
    inputKey: snapshot.project.video!.inputKey,
    objectKey: 'video.mp4'
  }
  await writeRow('projects', 'brand', snapshot)
  const old = (await loadProject('brand'))!
  expect(old.views!.video.action).toBe('export')
  await saveStudioSettings({
    branding: {
      name: 'Sam',
      tagline: 'Engineering',
      accent: '#234567',
      useAccent: true,
      logoKey: null
    },
    projectId: 'brand'
  })
  const named = (await loadProject('brand'))!
  // Your name changes the video, not the notebook's look.
  expect(named.project.branding).toMatchObject({
    name: 'Sam',
    tagline: 'Engineering',
    accent: '#112233',
    look: { id: 'site' }
  })
  expect(named.project.slides[0].svg).toContain('#112233')
  expect(named.project.video!.scenes[0].moments[0].take).toEqual(
    scene.moments[0].take
  )
  expect(named.project.video!.scenes[0].inputKey).not.toBe(scene.inputKey)
  expect(named.views!.scenes.scene.produced).toBe(false)
  expect(named.views!.video.action).toBe('produce-video')
  expect(named.views!.video.enabled).toBe(false)
  const { applyLook } = await import('./look-apply')
  const restyled = await applyLook('brand', {
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
  // A look re-colours drawn wireframes and keeps the creator's name.
  expect(restyled.project.slides[0].svg).toContain('#234567')
  expect(restyled.project.branding).toMatchObject({
    name: 'Sam',
    accent: '#234567',
    look: { id: 'custom', name: 'Custom' },
    fonts: { display: 'Georgia' }
  })
  expect(restyled.project.video!.scenes[0].inputKey).not.toBe(
    named.project.video!.scenes[0].inputKey
  )
})

it('persists the creative harness and model for new notebooks and leaves the first-run choice unset', async () => {
  const settings = await saveStudioSettings({
    harness: { adapter: 'kimi', model: 'kimi-code/k3' }
  })
  expect(settings.harness).toEqual({ adapter: 'kimi', model: 'kimi-code/k3' })
  expect((await getStudioSettings()).harness).toEqual(settings.harness)
  await expect(
    saveStudioSettings({ harness: { adapter: 'unknown' } })
  ).rejects.toThrow('supported harness')
  expect((await saveStudioSettings({ harness: null })).harness).toBeNull()
})
