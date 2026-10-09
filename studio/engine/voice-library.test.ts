import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, expect, it, vi } from 'vitest'
import type { VoiceClone } from '../shared/settings'
const { speak } = vi.hoisted(() => ({ speak: vi.fn() }))
vi.mock('./voice', async (original) => ({
  ...(await original<typeof import('./voice')>()),
  narrationClock: speak,
  systemVoiceAvailable: async () => false
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-voice-library-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const {
  createClone,
  listClones,
  resolveVoice,
  selectedVoice,
  previewVoice,
  deleteClone,
  voiceCatalogue,
  useVoice,
  retryClone
} = await import('./voice-library')
const { saveFishKey } = await import('./credentials')
const { readRow, writeRow } = await import('./persistence')
const { runCommand } = await import('./voice')
const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes('licensed=true'))
    return Response.json({
      items: [
        {
          _id: 'licensed-voice',
          title: 'Narrator',
          state: 'trained',
          type: 'tts',
          licensed: true,
          languages: ['en']
        },
        {
          _id: 'not-ready',
          title: 'Training',
          state: 'training',
          type: 'tts',
          licensed: true
        }
      ]
    })
  if (url.includes('self=true')) return Response.json({ items: [] })
  if (init?.method === 'POST')
    return Response.json(
      { _id: 'private-model', state: 'trained' },
      { status: 201 }
    )
  return Response.json({ _id: 'private-model', state: 'trained' })
})
vi.stubGlobal('fetch', fetcher)
speak.mockResolvedValue({
  audio: Buffer.from('synthetic voice sample'),
  duration: 1,
  provider: 'stub',
  moments: []
})
await saveFishKey('test-voice-provider-secret')
const fixture = join(root, 'read.wav')
await runCommand('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'sine=frequency=440:sample_rate=44100',
  '-t',
  '30',
  fixture
])
const read = await readFile(fixture)
afterAll(async () => {
  vi.unstubAllGlobals()
  await rm(root, { recursive: true, force: true })
})
it('requires consent and a read of roughly 30 seconds before provider upload', async () => {
  await expect(createClone(read, 'audio/wav', false)).rejects.toThrow(/Confirm/)
  const short = join(root, 'short.wav')
  await runCommand('ffmpeg', ['-y', '-i', fixture, '-t', '3', short])
  await expect(
    createClone(await readFile(short), 'audio/wav', true)
  ).rejects.toThrow(/30 seconds/)
  expect(fetcher).not.toHaveBeenCalled()
})
it('creates a private clone, waits for its sample, selects it and deletes its saved read', async () => {
  const clone = await createClone(read, 'audio/wav', true)
  await vi.waitFor(async () =>
    expect((await readRow<VoiceClone>('voice-clones', clone.id))!.state).toBe(
      'ready'
    )
  )
  const stored = (await readRow<VoiceClone>('voice-clones', clone.id))!
  const upload = fetcher.mock.calls.find(
    ([, init]) => init?.method === 'POST'
  )![1]!.body as FormData
  expect(upload.get('visibility')).toBe('private')
  expect(upload.get('train_mode')).toBe('fast')
  expect(upload.get('type')).toBe('tts')
  expect((upload.get('voices') as File).size).toBeGreaterThan(2000000)
  expect(await resolveVoice({ kind: 'clone', id: clone.id })).toEqual({
    referenceId: 'private-model'
  })
  expect(await selectedVoice()).toEqual({ kind: 'clone', id: clone.id })
  expect(await previewVoice({ kind: 'clone', id: clone.id })).toBe(
    stored.sampleKey
  )
  await useVoice({ kind: 'clone', id: clone.id })
  expect(speak).toHaveBeenCalledWith(expect.any(Array), {
    referenceId: 'private-model'
  })
  await deleteClone(clone.id)
  expect(
    fetcher.mock.calls.some(
      ([url, init]) =>
        url.endsWith('/model/private-model') && init?.method === 'DELETE'
    )
  ).toBe(true)
  await expect(
    readFile(join(root, 'objects', stored.recordingKey!))
  ).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(
    readFile(join(root, 'objects', stored.sampleKey!))
  ).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await listClones()).toEqual([])
  expect(await selectedVoice()).toEqual({ kind: 'record' })
  await expect(resolveVoice({ kind: 'clone', id: clone.id })).rejects.toThrow(
    /not ready/
  )
})
it('routes catalogue voices to their selected reference, and rejects unavailable choices', async () => {
  expect((await voiceCatalogue(true)).choices.map((voice) => voice.id)).toEqual(
    ['fish:licensed-voice']
  )
  expect(await resolveVoice({ kind: 'ai', id: 'fish:licensed-voice' })).toEqual(
    { referenceId: 'licensed-voice' }
  )
  await expect(
    resolveVoice({ kind: 'ai', id: 'fish:not-ready' })
  ).rejects.toThrow(/available/)
})
it('stops expired clone polling and explicit retry reuses its provider reference', async () => {
  const started = new Date(Date.now() - 11 * 60 * 1000).toISOString()
  const clone: VoiceClone = {
    id: 'expired',
    name: 'My voice',
    state: 'training',
    referenceId: 'retained-private-model',
    recordingKey: null,
    sampleKey: null,
    duration: 30,
    consentAt: started,
    error: null
  }
  await writeRow('voice-clones', clone.id, clone)
  const calls = fetcher.mock.calls.length
  await listClones()
  await vi.waitFor(async () =>
    expect((await readRow<VoiceClone>('voice-clones', clone.id))?.state).toBe(
      'failed'
    )
  )
  expect(fetcher.mock.calls).toHaveLength(calls)
  expect(
    (await readRow<VoiceClone>('voice-clones', clone.id))?.referenceId
  ).toBe('retained-private-model')
  await listClones()
  expect(fetcher.mock.calls).toHaveLength(calls)
  await retryClone(clone.id)
  await vi.waitFor(async () =>
    expect((await readRow<VoiceClone>('voice-clones', clone.id))?.state).toBe(
      'ready'
    )
  )
  const newCalls = fetcher.mock.calls.slice(calls)
  expect(
    newCalls.some(([url]) => url.endsWith('/model/retained-private-model'))
  ).toBe(true)
  expect(newCalls.some(([, init]) => init?.method === 'POST')).toBe(false)
})

it('recovers a lost creation response before deletion and retains evidence if remote deletion fails', async () => {
  const clone: VoiceClone = {
    id: 'lost-response',
    name: 'My voice',
    state: 'failed',
    recordingKey: null,
    sampleKey: null,
    duration: 30,
    consentAt: new Date().toISOString(),
    error: 'Connection lost'
  }
  await writeRow('voice-clones', clone.id, clone)
  fetcher.mockImplementationOnce(async () =>
    Response.json({
      items: [
        { _id: 'unrelated', title: 'Studio voice another-id' },
        { _id: 'recovered-model', title: 'Studio voice lost-response' }
      ]
    })
  )
  fetcher.mockImplementationOnce(
    async () => new Response('Unavailable', { status: 503 })
  )
  // The provider's refusal, in its own words.
  await expect(deleteClone(clone.id)).rejects.toThrow(
    'Fish Audio rejected the request (503): Unavailable'
  )
  const retained = await readRow<VoiceClone>('voice-clones', clone.id)
  expect(retained?.state).toBe('failed')
  expect(retained?.referenceId).toBe('recovered-model')
  expect(fetcher.mock.calls.at(-1)?.[0]).toMatch(/\/model\/recovered-model$/)
  expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBe('DELETE')
  const calls = fetcher.mock.calls.length
  await deleteClone(clone.id)
  expect(fetcher.mock.calls.slice(calls)).toHaveLength(1)
  expect((await readRow<VoiceClone>('voice-clones', clone.id))?.state).toBe(
    'deleted'
  )
})
it('does not delete a different provider clone with a similar title', async () => {
  const clone: VoiceClone = {
    id: 'never-created',
    name: 'My voice',
    state: 'failed',
    recordingKey: null,
    sampleKey: null,
    duration: 30,
    consentAt: new Date().toISOString(),
    error: 'Failed'
  }
  await writeRow('voice-clones', clone.id, clone)
  fetcher.mockImplementationOnce(async () =>
    Response.json({
      items: [{ _id: 'unrelated', title: 'Studio voice never-created-other' }]
    })
  )
  const calls = fetcher.mock.calls.length
  await deleteClone(clone.id)
  expect(fetcher.mock.calls.slice(calls)).toHaveLength(1)
  expect((await readRow<VoiceClone>('voice-clones', clone.id))?.state).toBe(
    'deleted'
  )
})
it('does not restart clone training while deletion is checking the provider', async () => {
  const clone: VoiceClone = {
    id: 'deleting',
    name: 'My voice',
    state: 'creating',
    recordingKey: null,
    sampleKey: null,
    duration: 30,
    consentAt: new Date().toISOString(),
    error: null
  }
  await writeRow('voice-clones', clone.id, clone)
  let finish!: (response: Response) => void
  fetcher.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      })
  )
  const removal = deleteClone(clone.id)
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  const calls = fetcher.mock.calls.length
  await listClones()
  expect(fetcher.mock.calls).toHaveLength(calls)
  await expect(deleteClone(clone.id)).rejects.toThrow('current voice operation')
  finish(Response.json({ items: [] }))
  await removal
  expect((await readRow<VoiceClone>('voice-clones', clone.id))?.state).toBe(
    'deleted'
  )
})
