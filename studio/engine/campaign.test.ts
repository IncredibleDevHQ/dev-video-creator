import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
// X is a stand-in: these checks prove the plumbing, not a real post.
const root = await mkdtemp(join(tmpdir(), 'minimal-campaign-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const plan = await import('../shared/campaign')
const { changeItem, planCampaignFor, postItem } = await import('./campaign')
const { saveSetting, storeAsset, writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
afterAll(() => rm(root, { recursive: true, force: true }))
afterEach(() => vi.unstubAllGlobals())

const project = (
  release: Partial<NonNullable<Project['release']>> = {}
): Project => ({
  id: 'launch',
  title: 'The Outage!',
  source: '',
  slides: [
    {
      id: 'a',
      title: 'a',
      svg: '',
      narration: 'We were down for five minutes. Here is why.'
    }
  ],
  video: null,
  release: {
    teasers: [
      {
        id: 't-x',
        channel: 'x',
        aspect: '1:1',
        segments: [],
        state: 'ready',
        objectKey: '',
        at: ''
      }
    ],
    posts: {
      x: 'It broke at 14:02.',
      linkedin: 'Last week our API failed.\nHere is what we learned.',
      youtube: 'Why it broke.',
      at: ''
    },
    campaign: [],
    ...release
  }
})

it('plans around the release: teasers before, launch on the day, a clip and a quote after', () => {
  const items = plan.planCampaign(project())
  expect(
    items.map((item) => [item.kind, item.channel, item.offsetDays])
  ).toEqual([
    ['teaser', 'x', -14],
    ['teaser', 'linkedin', -7],
    ['teaser', 'x', -2],
    ['launch', 'youtube', 0],
    ['launch', 'x', 0],
    ['launch', 'linkedin', 0],
    ['clip', 'x', 2],
    ['quote', 'linkedin', 7]
  ])
  expect(items[0]).toMatchObject({
    asset: 't-x',
    words: 'It broke at 14:02. Out soon.'
  })
  expect(items[4].words).toBe('It broke at 14:02. {link}')
  expect(items[7].words).toBe('“We were down for five minutes.”\n\n{link}')
  // The last episode of a run gets a recap; a posted item stays as it went.
  const posted = { ...items[0], state: 'posted' as const, words: 'Sent' }
  const again = plan.planCampaign(project({ campaign: [posted] }), {
    lastOfRun: true
  })
  expect(again[0]).toEqual(posted)
  expect(again.at(-1)).toMatchObject({ kind: 'recap', offsetDays: 10 })
  // One that may have gone out stays too, never offered as a new draft.
  const maybe = { ...items[1], state: 'unknown' as const }
  expect(
    plan
      .planCampaign(project({ campaign: [maybe] }))
      .find((entry) => entry.id === maybe.id)
  ).toEqual(maybe)
})

it('dates each item from the release, and knows which are due', () => {
  const release = {
    ...project().release!,
    at: new Date(2026, 9, 20, 12).toISOString()
  }
  const [first] = plan.planCampaign({ ...project(), release })
  expect(plan.dueAt(release.at, first)).toEqual(new Date(2026, 9, 6, 9, 0))
  release.campaign = [
    { ...first, state: 'approved' },
    { ...first, id: 'b', state: 'draft' },
    { ...first, id: 'c', state: 'approved', offsetDays: 3 }
  ]
  expect(
    plan.dueItems(release, new Date(2026, 9, 7)).map((item) => item.id)
  ).toEqual([first.id])
  expect(plan.whenWords(-14)).toBe('14 days before')
  expect(plan.whenWords(7)).toBe('a week after')
  expect(plan.whenWords(0)).toBe('on the day')
  expect(
    plan.withUtm('https://www.youtube.com/watch?v=abc', project(), first)
  ).toBe(
    'https://www.youtube.com/watch?v=abc&utm_source=x&utm_medium=social&utm_campaign=the-outage&utm_content=teaser-14'
  )
})

it('changes, approves and posts an item only when asked, with its tagged link', async () => {
  const teaser = await storeAsset({
    body: Buffer.from('teaser'),
    contentType: 'video/mp4',
    extension: '.mp4',
    kind: 'teaser',
    projectId: 'launch'
  })
  const base = project()
  base.release!.teasers[0].objectKey = teaser.objectKey
  await writeRow('projects', 'launch', {
    project: base,
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
  await expect(planCampaignFor('launch')).rejects.toThrow(
    'Set when it goes out first'
  )
  await writeRow('projects', 'launch', {
    project: {
      ...base,
      release: { ...base.release!, at: '2026-10-20T09:00:00.000Z' }
    },
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
  const planned = await planCampaignFor('launch')
  expect(planned.project.release!.campaign).toHaveLength(8)
  await expect(
    changeItem('launch', { item: 'teaser-x--14', time: '9am' })
  ).rejects.toThrow('HH:MM')
  await changeItem('launch', {
    item: 'launch-x-0',
    words: 'Out now: {link}',
    state: 'approved'
  })
  // Without the video's link, a post that links to it waits.
  await expect(postItem('launch', { item: 'launch-x-0' })).rejects.toThrow(
    'YouTube link first'
  )
  await expect(
    postItem('launch', { item: 'launch-youtube-0' })
  ).rejects.toThrow('goes out with the upload')
  const current = (await loadProject('launch'))!
  current.project.release!.youtube = {
    state: 'uploaded',
    videoId: 'dQw4w9WgXcQ',
    at: ''
  }
  await writeRow('projects', 'launch', current)
  await saveSetting('account-x', { access: 'x', name: '@acme', at: '' })
  const sent: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      sent.push(String(url))
      if (String(url).endsWith('/2/tweets')) {
        sent.push(String(init!.body))
        return new Response(JSON.stringify({ data: { id: '99' } }))
      }
      if (String(url).includes('/initialize'))
        return new Response(JSON.stringify({ data: { id: 'm' } }))
      if (String(url).includes('/finalize'))
        return new Response(JSON.stringify({ data: {} }))
      return new Response(null, { status: 204 })
    })
  )
  const done = await postItem('launch', { item: 'launch-x-0' })
  const item = done.project.release!.campaign.find(
    (entry) => entry.id === 'launch-x-0'
  )!
  expect(item).toMatchObject({
    state: 'posted',
    postUrl: 'https://x.com/i/web/status/99'
  })
  expect(JSON.parse(sent.at(-1)!).text).toBe(
    'Out now: https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=x&utm_medium=social&utm_campaign=the-outage&utm_content=launch0'
  )
  // A teaser item uploads its teaser first.
  await postItem('launch', { item: 'teaser-x--14' })
  expect(sent.some((url) => url.includes('/media/upload/initialize'))).toBe(
    true
  )
  await expect(postItem('launch', { item: 'launch-x-0' })).rejects.toThrow(
    'gone out already'
  )
  await expect(
    changeItem('launch', { item: 'launch-x-0', words: 'x' })
  ).rejects.toThrow('gone out already')
})

it('claims an item before posting it, finds a teaser cut later, and checks the length', async () => {
  const base = project({
    at: '2026-10-20T09:00:00.000Z',
    youtube: { state: 'uploaded', videoId: 'dQw4w9WgXcQ', at: '' }
  })
  base.id = 'claims'
  // Planned before any teaser was cut: the item's asset is a placeholder.
  base.release!.teasers = []
  base.release!.campaign = plan.planCampaign(base)
  const teaser = await storeAsset({
    body: Buffer.from('t'),
    contentType: 'video/mp4',
    extension: '.mp4',
    kind: 'teaser',
    projectId: 'claims'
  })
  base.release!.teasers = [
    {
      id: 'late',
      channel: 'x',
      aspect: '1:1',
      segments: [],
      state: 'ready',
      objectKey: teaser.objectKey,
      at: ''
    }
  ]
  await writeRow('projects', 'claims', {
    project: base,
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
  await saveSetting('account-x', { access: 'x', name: '@acme', at: '' })
  let release!: () => void
  const held = new Promise<void>((done) => (release = done))
  const uploads: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      uploads.push(String(url))
      if (String(url).includes('/initialize')) {
        await held
        return new Response(JSON.stringify({ data: { id: 'm' } }))
      }
      if (String(url).includes('/finalize')) return new Response('{}')
      if (String(url).endsWith('/2/tweets'))
        return new Response(JSON.stringify({ data: { id: '5' } }))
      return new Response(null, { status: 204 })
    })
  )
  const first = postItem('claims', { item: 'teaser-x--14' })
  await vi.waitFor(() => expect(uploads.length).toBe(1))
  // A second click while it uploads is refused, never posted twice.
  await expect(postItem('claims', { item: 'teaser-x--14' })).rejects.toThrow(
    'being posted now'
  )
  expect(
    (await loadProject('claims'))!.project.release!.campaign.find(
      (item) => item.id === 'teaser-x--14'
    )!.state
  ).toBe('posting')
  release()
  expect(
    (await first).project.release!.campaign.find(
      (item) => item.id === 'teaser-x--14'
    )
  ).toMatchObject({ state: 'posted' })
  expect(uploads.filter((url) => url.includes('/initialize'))).toHaveLength(1)
  // Too long once the link is in: refused with the count, and nothing claimed.
  await changeItem('claims', {
    item: 'launch-x-0',
    words: `${'y'.repeat(260)} {link}`
  })
  await expect(postItem('claims', { item: 'launch-x-0' })).rejects.toThrow(
    'It is 284 characters; X takes 280'
  )
  // A refused post goes back to how it was, with why.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 403 }))
  )
  await changeItem('claims', {
    item: 'launch-x-0',
    words: 'Out now {link}',
    state: 'approved'
  })
  await expect(postItem('claims', { item: 'launch-x-0' })).rejects.toThrow(
    'refused (403)'
  )
  expect(
    (await loadProject('claims'))!.project.release!.campaign.find(
      (item) => item.id === 'launch-x-0'
    )
  ).toMatchObject({
    state: 'approved',
    note: 'The post on X was refused (403)'
  })
})

it('posts the words on screen, and treats a post with no answer as maybe out', async () => {
  const base = project()
  await writeRow('projects', 'launch', {
    project: {
      ...base,
      release: {
        ...base.release!,
        at: '2026-10-20T09:00:00.000Z',
        youtube: { state: 'uploaded', videoId: 'dQw4w9WgXcQ', at: '' }
      }
    },
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
  await planCampaignFor('launch')
  await saveSetting('account-x', { access: 'x', name: '@acme', at: '' })
  // The final request gets no answer.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).endsWith('/2/tweets'))
        throw new DOMException('The operation timed out.', 'TimeoutError')
      return new Response(null, { status: 204 })
    })
  )
  await expect(
    postItem('launch', { item: 'launch-x-0', words: 'Typed just now' })
  ).rejects.toThrow('may have gone out')
  const after = (await loadProject('launch'))!.project.release!.campaign.find(
    (entry) => entry.id === 'launch-x-0'
  )!
  // The typed words were kept, and the post is not offered as failed.
  expect(after.words).toBe('Typed just now')
  expect(after.state).toBe('unknown')
  expect(after.note).toContain('Check your feed')
  await expect(postItem('launch', { item: 'launch-x-0' })).rejects.toThrow(
    'Check your feed first'
  )
  // Seen in the feed: it went out.
  const seen = await changeItem('launch', {
    item: 'launch-x-0',
    state: 'posted'
  })
  expect(
    seen.project.release!.campaign.find((entry) => entry.id === 'launch-x-0')!
      .state
  ).toBe('posted')
})
