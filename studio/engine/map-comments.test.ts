import { once } from 'node:events'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import type { Snapshot } from '../shared/api'
import type { MapComment } from '../shared/voice'
import {
  addVoiceComment,
  changeComment,
  loadComments,
  targetOf
} from './map-comments'
import { readAsset, writeRow } from './persistence'
// OpenAI's transcription and Jev are stand-ins: these checks prove where a
// comment goes and what is kept, not what a model hears.

const map = 'comment-map'
const realFetch = globalThis.fetch
const calls: string[] = []
let heard: string | null = 'Make episode two shorter: the intro drags'
const stand = (kind = 'direction') =>
  vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    calls.push(url)
    if (url.endsWith('/audio/transcriptions')) {
      const form = init?.body as FormData
      expect(form.get('model')).toBe('gpt-4o-mini-transcribe')
      expect((form.get('file') as File).name).toBe('comment.webm')
      return heard === null
        ? new Response('{"error":"no"}', { status: 500 })
        : Response.json({ text: heard })
    }
    if (url.includes('typesafe'))
      return Response.json({
        answers: {
          kind: {
            type: 'choice',
            choice: kind,
            probabilities: { [kind]: 0.86 },
            confidence: 0.86
          }
        }
      })
    return realFetch(input, init)
  })

beforeAll(async () => {
  const snapshot: Snapshot = {
    project: {
      id: map,
      title: 'Streamline',
      source: '',
      slides: [],
      video: null
    },
    status: 'ready',
    error: null,
    events: []
  }
  await writeRow('projects', map, snapshot)
  process.env.OPENAI_API_KEY = 'sk-test-0123456789abcdef'
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.TYPESAFE_API_KEY
  calls.length = 0
  heard = 'Make episode two shorter: the intro drags'
})
afterAll(() => {
  delete process.env.OPENAI_API_KEY
})

const audio = Buffer.alloc(4000, 7)

describe('comments on the map', () => {
  it('checks what a comment is pinned to', () => {
    expect(targetOf({ kind: 'lane', id: 'ep-1' })).toEqual({
      kind: 'lane',
      id: 'ep-1'
    })
    expect(targetOf({ kind: 'spot', x: 10.4, y: -3.6 })).toEqual({
      kind: 'spot',
      x: 10,
      y: -4
    })
    expect(targetOf({ kind: 'series', id: 'ignored' })).toEqual({
      kind: 'series'
    })
    expect(() => targetOf({ kind: 'lane', id: '../x' })).toThrow(/Choose what/)
    expect(() => targetOf({ kind: 'planet', id: 'x' })).toThrow(/Choose what/)
    expect(() => targetOf({ kind: 'spot', x: 'a', y: 1 })).toThrow(
      /Choose where/
    )
  })

  it('keeps a said comment, writes it down and reads its kind', async () => {
    vi.stubGlobal('fetch', stand('direction'))
    process.env.TYPESAFE_API_KEY = 'test-jev'
    const comments = await addVoiceComment(
      map,
      audio,
      'audio/webm;codecs=opus',
      {
        target: { kind: 'lane', id: 'ep-2' },
        seconds: 4.4,
        about: 'Ep 2 “Deploy it”'
      }
    )
    const comment = comments.at(-1)!
    expect(comment).toMatchObject({
      by: 'creator',
      text: 'Make episode two shorter: the intro drags',
      target: { kind: 'lane', id: 'ep-2' },
      state: 'open',
      kind: 'direction',
      sure: 0.86,
      audio: { seconds: 4 },
      replies: []
    })
    expect(Buffer.from(await readAsset(comment.audio!.objectKey))).toEqual(
      audio
    )
    expect(calls.some((url) => url.endsWith('/audio/transcriptions'))).toBe(
      true
    )
  })

  it('keeps the recording when it cannot be written down, and takes said replies', async () => {
    heard = null
    vi.stubGlobal('fetch', stand())
    const comments = await addVoiceComment(map, audio, 'audio/webm', {
      target: { kind: 'series' },
      seconds: 2
    })
    const unheard = comments.at(-1)!
    expect(unheard).toMatchObject({
      text: '',
      unheard: true,
      target: { kind: 'series' }
    })
    expect(unheard.kind).toBeUndefined()
    heard = 'Also mention the free tier'
    const replied = await addVoiceComment(map, audio, 'audio/webm', {
      reply: unheard.id,
      seconds: 3
    })
    expect(replied.find((c) => c.id === unheard.id)!.replies[0]).toMatchObject({
      text: 'Also mention the free tier',
      audio: { seconds: 3 }
    })
    await expect(
      addVoiceComment(map, audio, 'video/mp4', { target: { kind: 'series' } })
    ).rejects.toThrow(/WebM/)
    await expect(
      addVoiceComment(map, audio, 'audio/webm', { reply: 'gone' })
    ).rejects.toThrow(/gone/)
    await expect(
      addVoiceComment('no-such-map', audio, 'audio/webm', {
        target: { kind: 'series' }
      })
    ).rejects.toThrow(/Map not found/)
  })

  it('adds, answers, resolves, reopens and removes typed comments', async () => {
    let comments: MapComment[] = await changeComment(map, {
      action: 'add',
      target: { kind: 'page', id: 'card-1' },
      text: 'Open with the outage story'
    })
    const added = comments.at(-1)!
    // Without Jev there is no kind, and nothing was asked.
    expect(added.kind).toBeUndefined()
    comments = await changeComment(map, {
      action: 'reply',
      id: added.id,
      text: 'Noted',
      by: 'ai'
    })
    expect(comments.find((c) => c.id === added.id)!.replies[0]).toMatchObject({
      by: 'ai',
      text: 'Noted'
    })
    comments = await changeComment(map, {
      action: 'resolve',
      id: added.id,
      outcome: 'Made a direction'
    })
    expect(comments.find((c) => c.id === added.id)).toMatchObject({
      state: 'resolved',
      outcome: 'Made a direction'
    })
    comments = await changeComment(map, { action: 'reopen', id: added.id })
    expect(comments.find((c) => c.id === added.id)!.outcome).toBeUndefined()
    const before = (await loadComments(map)).length
    comments = await changeComment(map, { action: 'remove', id: added.id })
    expect(comments).toHaveLength(before - 1)
    await expect(
      changeComment(map, { action: 'reply', id: 'gone', text: 'x' })
    ).rejects.toThrow(/gone/)
    await expect(
      changeComment(map, {
        action: 'add',
        target: { kind: 'series' },
        text: ' '
      })
    ).rejects.toThrow(/Write the comment/)
  })
})

describe('the comment routes', () => {
  it('takes a said comment over PUT, with its place in the header', async () => {
    vi.stubGlobal('fetch', stand())
    const { createStudioServer } = await import('./server')
    const server = createStudioServer().listen(0, '127.0.0.1')
    await once(server, 'listening')
    const { port } = server.address() as { port: number }
    try {
      const meta = {
        target: { kind: 'lane', id: 'ep-3' },
        seconds: 5,
        about: 'Ep 3 “Security”'
      }
      const response = await realFetch(
        `http://127.0.0.1:${port}/api/projects/${map}/comments/voice`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'audio/webm',
            'x-studio-comment': encodeURIComponent(JSON.stringify(meta))
          },
          body: audio
        }
      )
      expect(response.status).toBe(200)
      const body = (await response.json()) as { comments: MapComment[] }
      expect(body.comments.at(-1)).toMatchObject({
        target: { kind: 'lane', id: 'ep-3' },
        text: heard
      })
      const typed = await realFetch(
        `http://127.0.0.1:${port}/api/projects/${map}/comments`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            target: { kind: 'series' },
            text: 'Keep it under ten minutes'
          })
        }
      )
      expect(
        ((await typed.json()) as { comments: MapComment[] }).comments.at(-1)!
          .text
      ).toBe('Keep it under ten minutes')
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
