import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ run: vi.fn(), load: vi.fn(), save: vi.fn() }))
vi.mock('../harness/runtime', () => ({ runEngineStage: mocks.run }))
vi.mock('../artifacts', () => ({
  loadStageCheckpoint: mocks.load,
  saveStageCheckpoint: mocks.save,
  archiveFiles: vi.fn()
}))
import { runValidatedJsonStage } from './stage'
const input = {
  projectId: 'notebook',
  sceneId: 'scene',
  inputKey: 'revision',
  checkpoint: 'treatment',
  route: 'Plan Scene',
  file: 'planning/treatment.json',
  tool: 'plan_submit_treatment',
  packet: {},
  selection: { adapter: 'kimi' as const, model: 'kimi-code/k3' },
  origin: 'http://localhost:4320',
  validate: () => ({
    ok: true,
    problems: [],
    warnings: [],
    value: { accepted: true }
  })
}
beforeEach(() => vi.clearAllMocks())
it('returns the persisted artifact without launching another harness', async () => {
  mocks.load.mockResolvedValue({ data: { accepted: true } })
  expect(await runValidatedJsonStage(input)).toEqual({ accepted: true })
  expect(mocks.run).not.toHaveBeenCalled()
})
it('shares concurrent work for the same notebook stage and input revision', async () => {
  let release: () => void = () => {}
  mocks.load
    .mockResolvedValueOnce(null)
    .mockResolvedValue({ data: { accepted: true } })
  mocks.run.mockImplementation(async () => {
    await new Promise<void>((resolve) => {
      release = resolve
    })
    return { status: 'done' }
  })
  const first = runValidatedJsonStage(input),
    second = runValidatedJsonStage(input)
  expect(first).toBe(second)
  await vi.waitFor(() => expect(mocks.run).toHaveBeenCalledOnce())
  release()
  expect(await first).toEqual({ accepted: true })
  expect(await second).toEqual({ accepted: true })
})
it('allows a failed stage to retry rather than retaining its rejected promise', async () => {
  mocks.load.mockResolvedValue(null)
  mocks.run.mockResolvedValue({
    status: 'error',
    failure: { message: 'Synthetic failure' }
  })
  await expect(runValidatedJsonStage(input)).rejects.toThrow(
    'Synthetic failure'
  )
  await expect(runValidatedJsonStage(input)).rejects.toThrow(
    'Synthetic failure'
  )
  expect(mocks.run).toHaveBeenCalledTimes(2)
})
it('forwards a smaller route budget to the harness runtime', async () => {
  mocks.load.mockResolvedValue(null)
  mocks.run.mockResolvedValue({
    status: 'error',
    failure: { message: 'Bounded run stopped' }
  })
  await expect(
    runValidatedJsonStage({
      ...input,
      timeoutMs: 120000,
      idleTimeoutMs: 45000,
      maxToolCalls: 20
    })
  ).rejects.toThrow('Bounded run stopped')
  expect(mocks.run).toHaveBeenCalledWith(
    expect.objectContaining({
      timeoutMs: 120000,
      idleTimeoutMs: 45000,
      maxToolCalls: 20
    })
  )
})

it('puts the current question in the resumed agent turn, not only replaceable packet files', async () => {
  mocks.load.mockResolvedValue(null)
  mocks.run.mockResolvedValue({
    status: 'error',
    failure: { message: 'Test stop' }
  })
  await expect(
    runValidatedJsonStage({
      ...input,
      session: { workspaceId: 'session' },
      stageContext: { question: 'How does the pipeline overlap work?' }
    })
  ).rejects.toThrow('Test stop')
  expect(mocks.run.mock.calls[0][0].task).toContain(
    'How does the pipeline overlap work?'
  )
  expect(mocks.run.mock.calls[0][0].task).toContain(
    'Current research turn revision'
  )
})
it('forwards a research chat effort while preserving content-generation defaults', async () => {
  mocks.load
    .mockResolvedValueOnce(null)
    .mockResolvedValue({ data: { accepted: true } })
  mocks.run.mockResolvedValue({ status: 'done' })
  await runValidatedJsonStage({
    ...input,
    inputKey: 'effort-research',
    operation: 'research',
    selection: { ...input.selection, effort: 'max' }
  })
  expect(mocks.run.mock.calls.at(-1)![0].effort).toBe('max')
  mocks.load
    .mockResolvedValueOnce(null)
    .mockResolvedValue({ data: { accepted: true } })
  await runValidatedJsonStage({
    ...input,
    inputKey: 'effort-content',
    operation: 'story',
    selection: { ...input.selection, effort: 'max' }
  })
  expect(mocks.run.mock.calls.at(-1)![0].effort).toBeUndefined()
})

it('research sends a current-turn pointer instead of duplicating the packet question', async () => {
  mocks.load.mockResolvedValue(null)
  mocks.run.mockResolvedValue({
    status: 'error',
    failure: { message: 'Test stop' }
  })
  await expect(
    runValidatedJsonStage({
      ...input,
      operation: 'research',
      route: 'Research Project',
      stageContext: { question: 'Unique question in packet only' }
    })
  ).rejects.toThrow('Test stop')
  const task = mocks.run.mock.calls.at(-1)![0].task
  expect(task).not.toContain('Unique question in packet only')
  expect(task).toContain('session-delta')
  expect(task).toContain('do not reread or replay earlier conversation')
})
