import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
// Google, X and LinkedIn are stand-ins: these checks prove the plumbing.
const root = await mkdtemp(join(tmpdir(), 'minimal-accounts-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const accounts = await import('./accounts')
const numbers = await import('./numbers')
const { postToLinkedIn, postToX, xCost } = await import('./posting')
const { biggestDrop, numberLessons, retentionByBeat } =
  await import('../shared/numbers')
const { saveSetting, writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
afterAll(() => rm(root, { recursive: true, force: true }))
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.X_CLIENT_ID
  delete process.env.X_CLIENT_SECRET
})

type Call = [string, RequestInit | undefined]
const reply = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) => new Response(JSON.stringify(body), { status, headers })
/** A stand-in web: each address answers as the provider would. */
const web = (routes: Array<[RegExp, (init?: RequestInit) => Response]>) => {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push([String(url), init])
      const route = routes.find(([pattern]) => pattern.test(String(url)))
      if (!route) throw new Error(`No stand-in for ${url}`)
      return route[1](init)
    })
  )
  return calls
}

it('signs in with PKCE, keeps the tokens with the engine, and never shows them', async () => {
  await expect(accounts.connectAccount('google')).rejects.toThrow('client id')
  await accounts.saveAccountApp('google', {
    clientId: 'google-app',
    clientSecret: 'google-secret'
  })
  const { url } = await accounts.connectAccount('google')
  const asked = new URL(url)
  expect(asked.origin + asked.pathname).toBe(
    'https://accounts.google.com/o/oauth2/v2/auth'
  )
  expect(asked.searchParams.get('code_challenge_method')).toBe('S256')
  expect(asked.searchParams.get('redirect_uri')).toBe(
    'http://127.0.0.1:4320/api/accounts/google/callback'
  )
  expect(asked.searchParams.get('scope')).toContain('yt-analytics.readonly')
  const calls = web([
    [
      /oauth2\.googleapis\.com\/token/,
      () =>
        reply({
          access_token: 'access-1',
          refresh_token: 'refresh-1',
          expires_in: 3600
        })
    ],
    [
      /youtube\/v3\/channels/,
      () =>
        reply({
          items: [{ id: 'UC1', snippet: { title: 'Acme Engineering' } }]
        })
    ]
  ])
  await expect(
    accounts.finishConnect(
      'google',
      new URLSearchParams({ state: 'forged', code: 'c' })
    )
  ).rejects.toThrow('expired')
  expect(
    await accounts.finishConnect(
      'google',
      new URLSearchParams({
        state: asked.searchParams.get('state')!,
        code: 'the-code'
      })
    )
  ).toBe('Acme Engineering')
  const exchange = new URLSearchParams(String(calls[0][1]!.body))
  expect(exchange.get('code_verifier')).toHaveLength(64)
  expect(exchange.get('client_secret')).toBe('google-secret')
  // The page sees who is connected, never a secret or a token.
  const view = await accounts.accountsView()
  const shown = JSON.stringify(view)
  for (const secret of ['google-secret', 'access-1', 'refresh-1'])
    expect(shown).not.toContain(secret)
  expect(view.accounts[0]).toMatchObject({
    provider: 'google',
    clientId: 'google-app',
    hasSecret: true,
    connected: { name: 'Acme Engineering' }
  })
})

it('takes the app from .env, sends X its credentials as Basic auth, and refreshes', async () => {
  process.env.X_CLIENT_ID = 'x-app'
  process.env.X_CLIENT_SECRET = 'x-secret'
  await saveSetting('account-x', {
    access: 'old',
    refresh: 'refresh-x',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    name: '@acme',
    id: '42',
    at: ''
  })
  const calls = web([
    [
      /api\.x\.com\/2\/oauth2\/token/,
      () => reply({ access_token: 'new', expires_in: 7200 })
    ],
    [/api\.x\.com\/2\/tweets$/, () => reply({ data: { id: '1790' } }, 201)]
  ])
  expect(await postToX('It broke at 14:02.')).toBe(
    'https://x.com/i/web/status/1790'
  )
  expect((calls[0][1]!.headers as Record<string, string>).authorization).toBe(
    `Basic ${Buffer.from('x-app:x-secret').toString('base64')}`
  )
  expect((calls[1][1]!.headers as Record<string, string>).authorization).toBe(
    'Bearer new'
  )
  expect(
    (await accounts.accountsView()).accounts.find(
      (item) => item.provider === 'x'
    )
  ).toMatchObject({ fromEnvironment: true, clientId: 'x-app' })
  expect(
    xCost('See https://acme.dev', { post: 0.015, postWithLink: 0.2 })
  ).toBe(0.2)
})

it('posts a teaser on X and on LinkedIn, uploading the video first', async () => {
  await saveSetting('account-x', { access: 'x', name: '@acme', at: '' })
  const x = web([
    [/media\/upload\/initialize/, () => reply({ data: { id: 'm1' } })],
    [/media\/upload\/m1\/append/, () => new Response(null, { status: 204 })],
    [
      /media\/upload\/m1\/finalize/,
      () =>
        reply({
          data: { processing_info: { state: 'pending', check_after_secs: 1 } }
        })
    ],
    [
      /command=STATUS/,
      () => reply({ data: { processing_info: { state: 'succeeded' } } })
    ],
    [/2\/tweets$/, () => reply({ data: { id: '7' } })]
  ])
  await postToX('Teaser', Buffer.alloc(5 * 1024 * 1024), { wait: 2 })
  expect(x.filter(([url]) => url.includes('/append'))).toHaveLength(2)
  expect(JSON.parse(String(x.at(-1)![1]!.body))).toEqual({
    text: 'Teaser',
    media: { media_ids: ['m1'] }
  })
  await saveSetting('account-linkedin', {
    access: 'li',
    id: 'abc',
    name: 'Ada',
    at: ''
  })
  const li = web([
    [
      /initializeUpload/,
      () =>
        reply({
          value: {
            video: 'urn:li:video:9',
            uploadToken: 't',
            uploadInstructions: [
              {
                uploadUrl: 'https://upload.example/part',
                firstByte: 0,
                lastByte: 9
              }
            ]
          }
        })
    ],
    [
      /upload\.example\/part/,
      () => new Response(null, { status: 200, headers: { etag: 'e1' } })
    ],
    [/finalizeUpload/, () => new Response(null, { status: 200 })],
    [
      /rest\/posts/,
      () =>
        new Response(null, {
          status: 201,
          headers: { 'x-restli-id': 'urn:li:share:5' }
        })
    ]
  ])
  expect(await postToLinkedIn('Teaser', Buffer.alloc(10), 'The outage')).toBe(
    'https://www.linkedin.com/feed/update/urn:li:share:5/'
  )
  const post = JSON.parse(String(li.at(-1)![1]!.body))
  expect(post).toMatchObject({
    author: 'urn:li:person:abc',
    commentary: 'Teaser',
    content: { media: { id: 'urn:li:video:9' } }
  })
  expect(
    JSON.parse(String(li[2][1]!.body)).finalizeUploadRequest.uploadedPartIds
  ).toEqual(['e1'])
})

// Four scenes of ten seconds: the incident's beats.
const project = (): Project => ({
  id: 'numbers',
  title: 'The outage',
  source: '',
  slides: ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id, svg: '' })),
  video: {
    settings: {
      presence: 'off',
      voice: { kind: 'record' },
      narrative: 'incident',
      direction: { preset: 'briefing' }
    },
    scenes: ['impact', 'timeline', 'cause', 'fix'].map((beat, index) => ({
      id: `s${index}`,
      slideId: ['a', 'b', 'c', 'd'][index],
      phase: 'done',
      presence: null,
      beats: [beat],
      moments: [],
      inputKey: '',
      produced: null,
      error: null
    })) as never,
    transitions: [],
    inputKey: '',
    produced: {
      inputKey: '',
      objectKey: 'n/video/x.mp4',
      clock: [0, 1, 2, 3].map((index) => ({
        sceneId: `s${index}`,
        start: index * 10,
        duration: 10
      }))
    }
  }
})
// Retention: most stay through the impact, many leave in the timeline.
const curve = Array.from({ length: 101 }, (_, index) =>
  index <= 25
    ? 1 - index * 0.004
    : index <= 50
      ? 0.9 - (index - 25) * 0.012
      : 0.6 - (index - 50) * 0.001
)

it('reads retention against the beats, and says what it suggests', () => {
  const beats = retentionByBeat(project(), curve)
  expect(beats.map((beat) => [beat.title, beat.from, beat.to])).toEqual([
    ['Impact', 1, 0.9],
    ['Timeline', 0.9, 0.6],
    ['Cause', 0.6, 0.57],
    ['Fix', 0.57, 0.55]
  ])
  expect(biggestDrop(beats)).toBe(
    'People left during timeline: 30 of every hundred'
  )
  expect(numberLessons(beats)).toEqual([
    'Shorten timeline: that is where people left',
    'More of what held: fix'
  ])
})

it('reads the video’s numbers and the posts’, and keeps the creator’s own', async () => {
  await saveSetting('account-google', { access: 'g', name: 'Acme', at: '' })
  await saveSetting('account-x', { access: 'x', name: '@acme', at: '' })
  await writeRow('projects', 'numbers', {
    project: {
      ...project(),
      release: {
        teasers: [],
        campaign: [
          {
            id: 'c1',
            channel: 'x',
            asset: 'episode',
            kind: 'launch',
            words: 'It is out',
            offsetDays: 0,
            time: '09:00',
            state: 'posted',
            postUrl: 'https://x.com/i/web/status/77'
          }
        ]
      }
    },
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
  await expect(
    numbers.setYouTubeVideo('numbers', { video: 'not a link' })
  ).rejects.toThrow('YouTube link')
  await numbers.setYouTubeVideo('numbers', {
    video: 'https://youtu.be/dQw4w9WgXcQ?t=3'
  })
  const calls = web([
    [/metrics=views/, () => reply({ rows: [[1200, 3400.5]] })],
    [
      /audienceWatchRatio/,
      () =>
        reply({
          rows: [
            [0.01, 0.98],
            [0, 1]
          ]
        })
    ],
    [
      /api\.x\.com\/2\/tweets\?ids=77/,
      () =>
        reply({
          data: [
            {
              id: '77',
              public_metrics: { impression_count: 900, like_count: 31 }
            }
          ]
        })
    ]
  ])
  const read = await numbers.readNumbers('numbers')
  expect(new URL(calls[0][0]).searchParams.get('filters')).toBe(
    'video==dQw4w9WgXcQ'
  )
  expect(read.project.release!.numbers).toEqual([
    expect.objectContaining({
      source: 'youtube',
      views: 1200,
      watchMinutes: 3400.5,
      retention: [1, 0.98]
    }),
    expect.objectContaining({
      source: 'x',
      posts: { c1: expect.objectContaining({ impressions: 900, likes: 31 }) }
    })
  ])
  await numbers.enterNumbers('numbers', { impressions: '480', likes: '12' })
  expect(
    (await loadProject('numbers'))!.project.release!.numbers!.at(-1)
  ).toMatchObject({
    source: 'hand',
    posts: { linkedin: { impressions: 480, likes: 12 } }
  })
  await expect(numbers.enterNumbers('numbers', {})).rejects.toThrow(
    'at least one'
  )
})
