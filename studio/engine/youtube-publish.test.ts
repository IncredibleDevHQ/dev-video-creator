import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
// YouTube is a stand-in: these checks prove the plumbing, not an upload.
const root = await mkdtemp(join(tmpdir(), 'minimal-youtube-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { publishToYouTube } = await import('./youtube-publish')
const { saveSetting, storeAsset, writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
afterAll(() => rm(root, { recursive: true, force: true }))
afterEach(() => vi.unstubAllGlobals())

const seed = async (id: string) => {
  const video = await storeAsset({
    body: Buffer.from('video'),
    contentType: 'video/mp4',
    extension: '.mp4',
    kind: 'produced-video',
    projectId: id
  })
  const poster = await storeAsset({
    body: Buffer.from('poster'),
    contentType: 'image/jpeg',
    extension: '.jpg',
    kind: 'poster',
    projectId: id
  })
  await writeRow('series', 'limits', {
    id: 'limits',
    title: 'Rate limits',
    about: '',
    createdAt: '',
    growth: 'one',
    episodes: [],
    repos: [],
    threads: []
  })
  await writeRow('projects', id, {
    project: {
      id,
      title: 'The outage',
      source: '',
      slides: [],
      episode: { series: 'limits', number: 2 },
      video: {
        settings: { presence: 'off', voice: { kind: 'record' } },
        scenes: [],
        transitions: [],
        inputKey: '',
        produced: {
          inputKey: '',
          objectKey: video.objectKey,
          posterKey: poster.objectKey
        }
      },
      release: {
        teasers: [],
        campaign: [
          {
            id: 'launch-youtube-0',
            channel: 'youtube',
            asset: 'episode',
            kind: 'launch',
            words: 'Why',
            offsetDays: 0,
            time: '08:00',
            state: 'approved'
          }
        ]
      }
    },
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
  // Signed in with the playlist scope (review 6).
  await saveSetting('account-google', {
    access: 'g',
    name: 'Acme',
    at: '',
    scopes:
      'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl'
  })
}

type Call = { url: string; method: string; body?: string }
const youtube = (
  kept: 'private' | 'public',
  thumbnail = 200,
  playlists = 200
) => {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call = {
        url: String(url),
        method: init.method || 'GET',
        body: typeof init.body === 'string' ? init.body : undefined
      }
      calls.push(call)
      if (call.url.includes('uploadType=resumable'))
        return new Response(null, {
          status: 200,
          headers: { location: 'https://upload.example/session-1' }
        })
      if (call.url === 'https://upload.example/session-1')
        return Response.json({ id: 'vid123', status: { privacyStatus: kept } })
      if (call.url.includes('thumbnails/set'))
        return new Response('{}', { status: thumbnail })
      if (call.url.includes('/playlists') && playlists !== 200)
        return new Response('{}', { status: playlists })
      if (call.url.includes('/playlists?part=snippet&mine=true'))
        return Response.json({
          items: [{ id: 'other', snippet: { title: 'Other' } }]
        })
      if (call.url.includes('/playlists?part=snippet,status'))
        return Response.json({ id: 'pl1' })
      if (call.url.includes('/playlistItems'))
        return Response.json({ id: 'pi1' })
      throw new Error(`No stand-in for ${call.url}`)
    })
  )
  return calls
}

it('uploads, sets the thumbnail, adds it to the series playlist, and schedules it', async () => {
  await seed('scheduled')
  const calls = youtube('private')
  const at = new Date(Date.now() + 3 * 86_400_000).toISOString()
  const started = await publishToYouTube('scheduled', {
    privacy: 'public',
    publishAt: at
  })
  expect(started.project.release!.youtube).toMatchObject({
    state: 'uploading',
    publishAt: at
  })
  await vi.waitFor(async () =>
    expect(
      (await loadProject('scheduled'))!.project.release!.youtube!.state
    ).toBe('uploaded')
  )
  const metadata = JSON.parse(calls[0].body!)
  // A scheduled video goes up private; YouTube publishes it at its time.
  expect(metadata.status).toEqual({
    privacyStatus: 'private',
    publishAt: at,
    selfDeclaredMadeForKids: false
  })
  expect(
    calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)
  ).toEqual([
    'POST /upload/youtube/v3/videos',
    'PUT /session-1',
    'POST /upload/youtube/v3/thumbnails/set',
    'GET /youtube/v3/playlists',
    'POST /youtube/v3/playlists',
    'POST /youtube/v3/playlistItems'
  ])
  expect(JSON.parse(calls[4].body!).snippet.title).toBe('Rate limits')
  const done = (await loadProject('scheduled'))!.project.release!
  expect(done.youtube).toMatchObject({ videoId: 'vid123', publishAt: at })
  expect(done.youtube!.notes).toBeUndefined()
  // The campaign's YouTube launch is this upload.
  expect(done.campaign[0]).toMatchObject({
    state: 'posted',
    postUrl: 'https://www.youtube.com/watch?v=vid123'
  })
})

it('says when YouTube kept it private, or refused the thumbnail', async () => {
  await seed('locked')
  youtube('private', 403)
  await publishToYouTube('locked', { privacy: 'public' })
  await vi.waitFor(async () =>
    expect((await loadProject('locked'))!.project.release!.youtube!.state).toBe(
      'uploaded'
    )
  )
  const notes = (await loadProject('locked'))!.project.release!.youtube!.notes!
  expect(notes[0]).toContain('verification and the audit')
  expect(notes[1]).toContain('verified by phone')
  await expect(
    publishToYouTube('locked', {
      privacy: 'public',
      publishAt: '2020-01-01T00:00:00Z'
    })
  ).rejects.toThrow('in the future')
})

it('keeps the reason when the upload fails', async () => {
  await seed('refused')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 403 }))
  )
  await publishToYouTube('refused', { privacy: 'private' })
  await vi.waitFor(async () =>
    expect(
      (await loadProject('refused'))!.project.release!.youtube
    ).toMatchObject({
      state: 'failed',
      error: 'YouTube refused the upload (403)'
    })
  )
})

it('keeps the video when the playlist fails, and never uploads twice', async () => {
  await seed('playlist')
  youtube('public', 200, 403)
  await publishToYouTube('playlist', { privacy: 'public' })
  // A second click while it uploads is refused.
  await expect(
    publishToYouTube('playlist', { privacy: 'public' })
  ).rejects.toThrow('It is uploading now')
  await vi.waitFor(async () =>
    expect(
      (await loadProject('playlist'))!.project.release!.youtube!.state
    ).toBe('uploaded')
  )
  const upload = (await loadProject('playlist'))!.project.release!.youtube!
  expect(upload.videoId).toBe('vid123')
  expect(upload.notes).toEqual([
    'It was not added to the “Rate limits” playlist: add it in YouTube Studio.'
  ])
  // Once it is up, the studio never uploads it again.
  await expect(
    publishToYouTube('playlist', { privacy: 'public' })
  ).rejects.toThrow('on YouTube already')
})

it('asks a YouTube sign-in from before playlists to be made again', async () => {
  const { canEditPlaylists, accountsView, recordSignIn } =
    await import('./accounts')
  await saveSetting('account-google', { access: 'g', name: 'Acme', at: '' })
  expect(await canEditPlaylists()).toBe(false)
  const google = (await accountsView()).accounts.find(
    (account) => account.provider === 'google'
  )
  expect(google?.connected?.signInAgain).toContain('playlists')
  // A failed sign-in is kept for the dialog to say.
  recordSignIn('x', { ok: false, error: 'The sign-in was cancelled' })
  const x = (await accountsView()).accounts.find(
    (account) => account.provider === 'x'
  )
  expect(x?.lastSignIn).toMatchObject({
    ok: false,
    error: 'The sign-in was cancelled'
  })
})
