import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, it, expect, vi } from 'vitest'
import type { HarnessAdapter } from './types'
const root = await mkdtemp(join(tmpdir(), 'minimal-harness-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'store')
const { runEngineStage, readEngineRun, recoverEngineRuns, cancelEngineRun } =
  await import('./runtime')
const { writeRow } = await import('../persistence')
const context = {
  origin: 'http://127.0.0.1:1',
  mcpShimPath: join(root, 'shim.mjs'),
  skillsDir: join(root, 'skills')
}
await mkdir(join(context.skillsDir, 'video-planner'), { recursive: true })
await writeFile(
  join(context.skillsDir, 'video-planner', 'SKILL.md'),
  '---\nname: video-planner\nmetadata:\n  version: "0.1.0"\n---\nSynthetic protocol fixture.\n'
)
const base = {
  projectId: 'fixture',
  stage: 'planning' as const,
  adapter: 'codex' as const,
  task: 'Synthetic protocol check',
  packet: { 'packet/PLAN.json': '{"fixture":true}' },
  context
}
const adapter = (run: HarnessAdapter['run']): HarnessAdapter => ({
  id: 'codex',
  available: async () => ({ ok: true }),
  run
})
afterAll(() => rm(root, { recursive: true, force: true }))
it('writes an isolated packet and requires stage acceptance after a successful CLI exit', async () => {
  const accept = vi.fn(async (directory: string) => {
    expect(
      directory.startsWith(join(root, 'store', 'engine-workspaces', 'fixture'))
    ).toBe(true)
    expect(
      await readFile(join(directory, 'packet/PLAN.json'), 'utf8')
    ).toContain('fixture')
    expect(
      await readFile(
        join(directory, '.claude/skills/video-planner/SKILL.md'),
        'utf8'
      )
    ).toContain('Synthetic')
  })
  const result = await runEngineStage({
    ...base,
    effort: 'high',
    accept,
    adapterOverride: adapter(async (run, emit) => {
      expect(run.inputs.capabilityScope).toBe('planning')
      expect(run.inputs.effort).toBe('high')
      emit({ type: 'session', ts: 1, model: 'fixture-model' })
      emit({ type: 'text', ts: 2, text: 'Synthetic result' })
      return { exitCode: 0, resumeId: 'fixture-session' }
    })
  })
  expect(accept).toHaveBeenCalledOnce()
  expect(result.status).toBe('done')
  expect((await readEngineRun(result.id))?.reportedModel).toBe('fixture-model')
  expect(result.resumeId).toBe('fixture-session')
})
it('gives a page call light thinking, a response limit and only its route, and keeps usage read after the run', async () => {
  const skill = join(context.skillsDir, 'page-master')
  await mkdir(join(skill, 'workflows'), { recursive: true })
  await mkdir(join(skill, 'vendor'), { recursive: true })
  await writeFile(
    join(skill, 'SKILL.md'),
    '---\nname: page-master\n---\nSynthetic route fixture.\n'
  )
  await writeFile(join(skill, 'workflows', 'draw-page.md'), 'Synthetic route')
  await writeFile(join(skill, 'vendor', 'manual.md'), 'Synthetic manual')
  const usage = {
    input: 10,
    output: 2,
    cacheRead: 30,
    cacheWrite: 0,
    final: true
  }
  const result = await runEngineStage({
    ...base,
    stage: 'drawing',
    operation: 'page',
    stageContext: { draw: 1 },
    accept: async () => {},
    adapterOverride: adapter(async (run) => {
      expect(run.inputs.effort).toBe('medium')
      expect(run.inputs.maxOutputTokens).toBe(32_000)
      const installed = join(run.projectDir, '.claude/skills/page-master')
      expect(
        await readFile(join(installed, 'workflows/draw-page.md'), 'utf8')
      ).toBe('Synthetic route')
      await expect(
        readFile(join(installed, 'vendor/manual.md'), 'utf8')
      ).rejects.toThrow()
      expect(
        JSON.parse(
          await readFile(join(run.projectDir, 'motion/inputs.json'), 'utf8')
        )
      ).not.toHaveProperty('context')
      return { exitCode: 0, usage }
    })
  })
  expect(result).toMatchObject({
    status: 'done',
    operation: 'page',
    effort: 'medium',
    usage
  })
})
it('does not accept an empty successful exit as a valid composition', async () => {
  const result = await runEngineStage({
    ...base,
    accept: async () => {
      throw new Error('Missing submitted plan')
    },
    adapterOverride: adapter(async () => ({ exitCode: 0 }))
  })
  expect(result.status).toBe('error')
  expect(result.failure?.message).toBe('Missing submitted plan')
})
it('redacts keys in streamed events and does not retry a reported quota failure', async () => {
  const run = vi.fn<HarnessAdapter['run']>(async (_run, emit) => {
    emit({
      type: 'error',
      ts: 1,
      error: 'Usage credits exhausted fixture-secret'
    })
    return { exitCode: 0 }
  })
  const accept = vi.fn()
  const result = await runEngineStage({
    ...base,
    redact: ['fixture-secret'],
    accept,
    adapterOverride: adapter(run)
  })
  expect(result.status).toBe('error')
  expect(result.failure?.category).toBe('quota')
  expect(JSON.stringify(await readEngineRun(result.id))).not.toContain(
    'fixture-secret'
  )
  expect(run).toHaveBeenCalledOnce()
  expect(accept).not.toHaveBeenCalled()
})
it('refuses packet traversal before launching a harness', async () => {
  const run = vi.fn<HarnessAdapter['run']>(async () => ({ exitCode: 0 }))
  await expect(
    runEngineStage({
      ...base,
      packet: { 'packet/../../outside.txt': 'bad' },
      accept: async () => {},
      adapterOverride: adapter(run)
    })
  ).rejects.toThrow('Invalid packet')
  expect(run).not.toHaveBeenCalled()
})
it('recovers interrupted runs as actionable failures without launching a model', async () => {
  await writeRow('engine-runs', 'interrupted', {
    id: 'interrupted',
    projectId: 'fixture',
    stage: 'planning',
    adapter: 'codex',
    status: 'running',
    startedAt: new Date().toISOString(),
    events: []
  })
  await recoverEngineRuns()
  expect((await readEngineRun('interrupted'))?.failure?.category).toBe(
    'interrupted'
  )
  expect((await readEngineRun('interrupted'))?.status).toBe('error')
})
it('cancels a live process handle and skips acceptance', async () => {
  let started = ''
  const accept = vi.fn()
  const work = runEngineStage({
    ...base,
    accept,
    adapterOverride: adapter(async (run, _emit, signal) => {
      started = run.id
      await new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve(), { once: true })
      )
      return { exitCode: 130 }
    })
  })
  await vi.waitFor(() => expect(started).not.toBe(''))
  expect(cancelEngineRun(started)).toBe(true)
  expect((await work).status).toBe('cancelled')
  expect(accept).not.toHaveBeenCalled()
  expect(cancelEngineRun(started)).toBe(false)
})

it('stops the CLI immediately when persisting progress fails', async () => {
  const accept = vi.fn()
  let stopped = false
  const result = await runEngineStage({
    ...base,
    accept,
    onEvent: async () => {
      throw new Error('Fixture storage unavailable')
    },
    adapterOverride: adapter(async (_run, emit, signal) => {
      const stoppedPromise = new Promise<void>((resolve) =>
        signal.addEventListener(
          'abort',
          () => {
            stopped = true
            resolve()
          },
          { once: true }
        )
      )
      emit({ type: 'text', ts: 1, text: 'Fixture progress' })
      await stoppedPromise
      return { exitCode: 130 }
    })
  })
  expect(stopped).toBe(true)
  expect(result.status).toBe('error')
  expect(result.failure?.category).toBe('storage')
  expect(accept).not.toHaveBeenCalled()
})

for (const budget of [
  { timeoutMs: 30 },
  { idleTimeoutMs: 30 },
  { maxToolCalls: 2 }
])
  it(`stops at the budget without retry or acceptance: ${JSON.stringify(budget)}`, async () => {
    const accept = vi.fn()
    const run = vi.fn<HarnessAdapter['run']>(async (_run, emit, signal) => {
      const stopped = new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve(), { once: true })
      )
      if ('maxToolCalls' in budget)
        for (let i = 0; i < 3; i++)
          emit({ type: 'tool', ts: Date.now(), tool: 'fixture' })
      await stopped
      return { exitCode: 130 }
    })
    const result = await runEngineStage({
      ...base,
      ...budget,
      accept,
      adapterOverride: adapter(run)
    })
    expect(result.status).toBe('error')
    expect(result.failure?.message).toMatch(
      /ran out of time|stopped responding|used up its steps/
    )
    // The wall-clock budget includes preparation: under load it may correctly
    // expire before launching the CLI. Neither path may retry or accept output.
    expect(run.mock.calls.length).toBeLessThanOrEqual(1)
    if ('maxToolCalls' in budget) expect(run).toHaveBeenCalledOnce()
    expect(accept).not.toHaveBeenCalled()
  })

it('ends the harness immediately after a durable accepted submission, recording success', async () => {
  const { handleEngineRpc } = await import('./submissions')
  const accept = vi.fn(async () => {})
  const result = await runEngineStage({
    ...base,
    accept,
    tools: () => [
      {
        name: 'submit',
        completesRun: true,
        description: 'Fixture',
        inputSchema: {},
        call: async () => ({ accepted: true })
      }
    ],
    adapterOverride: adapter(async (run, _emit, signal) => {
      const stopped = new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve(), { once: true })
      )
      await handleEngineRpc(String(run.inputs.submissionToken), {
        id: 1,
        method: 'tools/call',
        params: { name: 'submit' }
      })
      await stopped
      return { exitCode: 130 }
    })
  })
  expect(result.status).toBe('done')
  expect(result.failure).toBeUndefined()
  expect(accept).toHaveBeenCalledOnce()
})
it('does not end a run for refused submissions or ordinary tool results', async () => {
  const { handleEngineRpc } = await import('./submissions')
  let attempt = 0
  const result = await runEngineStage({
    ...base,
    accept: async () => {},
    tools: () => [
      {
        name: 'ordinary',
        description: 'Fixture',
        inputSchema: {},
        call: async () => ({ accepted: true })
      },
      {
        name: 'submit',
        completesRun: true,
        description: 'Fixture',
        inputSchema: {},
        call: async () => ({ accepted: ++attempt > 1 })
      }
    ],
    adapterOverride: adapter(async (run, _emit, signal) => {
      const token = String(run.inputs.submissionToken)
      for (const name of ['ordinary', 'submit']) {
        await handleEngineRpc(token, {
          id: 1,
          method: 'tools/call',
          params: { name }
        })
        expect(signal.aborted).toBe(false)
      }
      await handleEngineRpc(token, {
        id: 2,
        method: 'tools/call',
        params: { name: 'submit' }
      })
      expect(signal.aborted).toBe(true)
      return { exitCode: 130 }
    })
  })
  expect(result.status).toBe('done')
  expect(attempt).toBe(2)
})

it('does not launch another deck stage after the creator stops it', async () => {
  await writeRow('projects', 'stopped-deck', { stopping: true })
  const run = vi.fn<HarnessAdapter['run']>(async () => ({ exitCode: 0 }))
  await expect(
    runEngineStage({
      ...base,
      projectId: 'stopped-deck',
      accept: async () => {},
      adapterOverride: adapter(run)
    })
  ).rejects.toThrow('Stopped. Saved work is kept')
  expect(run).not.toHaveBeenCalled()
})

it('reports an archive failure instead of claiming a safely retained provider failure', async () => {
  const result = await runEngineStage({
    ...base,
    accept: async () => {},
    adapterOverride: adapter(async (run) => {
      await writeFile(
        join(run.projectDir, 'production'),
        'Invalid output directory fixture'
      )
      throw new Error('provider failure')
    })
  })
  expect(result.status).toBe('error')
  expect(result.failure?.category).toBe('storage')
  expect(result.failure?.message).toBe(
    'Could not save run artifacts. Restore storage access before retrying.'
  )
  expect((await readEngineRun(result.id))?.failure?.category).toBe('storage')
})

it('seeds accepted production code before the harness starts and refuses escaping seeds', async () => {
  const run = vi.fn<HarnessAdapter['run']>(async (run) => {
    expect(
      await readFile(join(run.projectDir, 'production/index.html'), 'utf8')
    ).toBe('<html>accepted preview fixture</html>')
    return { exitCode: 0 }
  })
  await mkdir(join(context.skillsDir, 'scene-producer'), { recursive: true })
  await writeFile(
    join(context.skillsDir, 'scene-producer', 'SKILL.md'),
    'Synthetic production fixture'
  )
  const result = await runEngineStage({
    ...base,
    stage: 'composition',
    productionSeed: {
      'production/index.html': '<html>accepted preview fixture</html>'
    },
    accept: async () => {},
    adapterOverride: adapter(run)
  })
  expect(result.status).toBe('done')
  await expect(
    runEngineStage({
      ...base,
      stage: 'composition',
      productionSeed: { 'production/../private': 'invalid' },
      accept: async () => {},
      adapterOverride: adapter(run)
    })
  ).rejects.toThrow('Invalid production seed')
  expect(run).toHaveBeenCalledOnce()
})

it('shutdown waits for cancelled runs to retain their final state', async () => {
  const { stopEngineRuns } = await import('./runtime')
  let started = false
  const work = runEngineStage({
    ...base,
    accept: async () => {
      throw new Error('Must not accept')
    },
    adapterOverride: adapter(async (_run, _emit, signal) => {
      started = true
      await new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve(), { once: true })
      )
      return { exitCode: 130 }
    })
  })
  await vi.waitFor(() => expect(started).toBe(true))
  expect(await stopEngineRuns()).toBe(true)
  const record = await work
  expect(record.status).toBe('cancelled')
  expect((await readEngineRun(record.id))?.finishedAt).toBeTruthy()
  const run = vi.fn<HarnessAdapter['run']>(async () => ({ exitCode: 0 }))
  await expect(
    runEngineStage({
      ...base,
      accept: async () => {},
      adapterOverride: adapter(run)
    })
  ).rejects.toThrow('shutting down')
  expect(run).not.toHaveBeenCalled()
})
