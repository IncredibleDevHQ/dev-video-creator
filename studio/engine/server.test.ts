import { afterAll, expect, it, vi } from 'vitest'
import { once } from 'node:events'
const { slides, scene, production, load, source, notebook } = vi.hoisted(
  () => ({
    slides: vi.fn(),
    scene: vi.fn(),
    production: vi.fn(),
    load: vi.fn(),
    source: vi.fn(),
    notebook: vi.fn()
  })
)
vi.mock('./projects', () => ({
  createProject: vi.fn(),
  replaceBlockedSource: source,
  editSlide: vi.fn(),
  loadProject: load,
  chatSlide: vi.fn(),
  scheduleSlides: vi.fn(),
  retrySlides: slides
}))
vi.mock('./live-snapshots', () => ({ watchSnapshots: vi.fn() }))
vi.mock('./progress', () => ({ withProgress: async (value: unknown) => value }))
vi.mock('./notebook-chat', () => ({ chatNotebook: notebook }))
vi.mock('./video', () => ({
  makeVideo: vi.fn(),
  retryScene: scene,
  previewPresence: vi.fn(),
  replanPresence: vi.fn(),
  schedulePlanning: vi.fn(),
  chatVideo: vi.fn(),
  updateVideoSettings: vi.fn()
}))
vi.mock('./production', () => ({ produceScene: production }))
const { createStudioServer } = await import('./server')
const server = createStudioServer().listen(0, '127.0.0.1')
await once(server, 'listening')
const address = server.address() as { port: number }
afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
      server.closeAllConnections()
    })
)
const post = (path: string) =>
  fetch(`http://127.0.0.1:${address.port}/api/projects/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  })
it('does not expose the unused server practice setup route', async () => {
  expect((await post('plan/scenes/scene/practice')).status).toBe(404)
})
it('routes deck, planning and production retries to their respective jobs', async () => {
  slides.mockResolvedValue({ retried: 'slides' })
  scene.mockResolvedValue({ retried: 'planning' })
  production.mockResolvedValue({ retried: 'production' })
  load.mockImplementation(async (id: string) => ({
    project: {
      id,
      video: {
        scenes: [
          { id: 'scene', failure: id === 'render' ? 'production' : 'planning' }
        ]
      }
    }
  }))
  expect(await (await post('deck/retry')).json()).toEqual({ retried: 'slides' })
  expect(await (await post('plan/scenes/scene/retry')).json()).toEqual({
    retried: 'planning'
  })
  expect(await (await post('render/scenes/scene/retry')).json()).toEqual({
    retried: 'production'
  })
  expect(slides).toHaveBeenCalledExactlyOnceWith('deck')
  expect(scene).toHaveBeenCalledExactlyOnceWith('plan', 'scene')
  expect(production).toHaveBeenCalledExactlyOnceWith('render', 'scene')
})

it('routes pasted source recovery through the notebook API', async () => {
  load.mockResolvedValue({
    project: { id: 'blocked' },
    status: 'failed',
    sourceFailure: 'blocked'
  })
  source.mockResolvedValue({ project: { id: 'blocked' }, status: 'building' })
  const text = 'Article text with enough content to continue this notebook.'
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/projects/blocked/source`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    }
  )
  expect(response.status).toBe(200)
  expect((await response.json()).status).toBe('building')
  expect(source).toHaveBeenCalledExactlyOnceWith('blocked', text)
})

it('routes source questions to notebook chat', async () => {
  load.mockResolvedValue({
    project: { id: 'source-question' },
    status: 'ready'
  })
  notebook.mockResolvedValue({
    project: { id: 'source-question' },
    status: 'ready',
    events: []
  })
  const body = {
    anchor: { stage: 'notebook' },
    instruction: 'Explain this source'
  }
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/projects/source-question/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  )
  expect(response.status).toBe(200)
  expect(notebook).toHaveBeenCalledWith('source-question', body)
})

it('marks saved reviews and rejects mutation before dispatch', async () => {
  const review = createStudioServer({ readOnly: true }).listen(0, '127.0.0.1')
  await once(review, 'listening')
  const origin = `http://127.0.0.1:${
    (review.address() as { port: number }).port
  }`
  try {
    load.mockResolvedValue({ project: { id: 'review' }, status: 'ready' })
    const snapshot = await (await fetch(`${origin}/api/projects/review`)).json()
    expect(snapshot.readOnly).toBe(true)
    const calls = slides.mock.calls.length
    expect(
      (await fetch(`${origin}/api/projects/review/retry`, { method: 'POST' }))
        .status
    ).toBe(403)
    expect(slides.mock.calls).toHaveLength(calls)
  } finally {
    review.closeAllConnections()
    await new Promise<void>((resolve) => review.close(() => resolve()))
  }
})

it('releases live stream slots and replays saved state when reconnected', async () => {
  const unsubscribe = vi.fn()
  const { watchSnapshots } = await import('./live-snapshots')
  vi.mocked(watchSnapshots).mockImplementation((id, listener) => {
    void load(id).then(listener)
    return unsubscribe
  })
  load.mockResolvedValue({
    project: { id: 'live' },
    status: 'ready',
    events: []
  })
  const bounded = createStudioServer({ eventsLifetimeMs: 30 }).listen(
    0,
    '127.0.0.1'
  )
  await once(bounded, 'listening')
  const origin = `http://127.0.0.1:${
    (bounded.address() as { port: number }).port
  }`
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`${origin}/api/projects/live/events`)
      expect(response.headers.get('content-type')).toBe('text/event-stream')
      const text = await response.text()
      expect(text).toContain('"id":"live"')
    }
    expect(unsubscribe).toHaveBeenCalledTimes(2)
  } finally {
    bounded.closeAllConnections()
    await new Promise<void>((resolve) => bounded.close(() => resolve()))
  }
})
it('refuses another site’s form post before routing it', async () => {
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/projects/deck/retry`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Origin: 'https://example.com' },
      body: '{}'
    }
  )
  expect(response.status).toBe(403)
  expect((await response.json()).error).toBe(
    'The studio refuses requests from other sites'
  )
})
it('passes a refusal’s words through, and answers 500 for its own failures', async () => {
  const { Refusal } = await import('./refusal')
  slides.mockRejectedValueOnce(
    new Refusal('Your wireframes do not need a retry')
  )
  const refused = await post('deck/retry')
  expect(refused.status).toBe(400)
  expect((await refused.json()).error).toBe(
    'Your wireframes do not need a retry'
  )
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  slides.mockRejectedValueOnce(new Error('disk on fire'))
  const failed = await post('deck/retry')
  expect(failed.status).toBe(500)
  expect((await failed.json()).error).not.toContain('disk')
  quiet.mockRestore()
})
