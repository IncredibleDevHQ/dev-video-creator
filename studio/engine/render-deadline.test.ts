import { afterEach, expect, it, vi } from 'vitest'
import { generationStops } from './generation-errors'
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('@hyperframes/producer', () => ({
  createRenderJob: () => ({ warnings: [] }),
  executeRenderJob: execute
}))
vi.mock('../render/runtime', () => ({ RUNTIME_PATHS: {} }))
const { renderProductionBundle } = await import('../render/production-render')
afterEach(() => {
  vi.restoreAllMocks()
  execute.mockReset()
})
it('aborts previews and productions at the shared deadline', async () => {
  const controller = new AbortController()
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
  execute.mockImplementation(
    async (_job, _dir, _output, _progress, signal: AbortSignal) => {
      expect(signal).toBe(controller.signal)
      controller.abort()
      throw new Error('Internal renderer cancellation')
    }
  )
  await expect(
    renderProductionBundle({ 'index.html': '<html></html>' }, { fps: 30 })
  ).rejects.toThrow(generationStops.time)
  expect(AbortSignal.timeout).toHaveBeenCalledWith(600000)
})
it('combines caller cancellation with the render deadline', async () => {
  const caller = new AbortController()
  execute.mockImplementation(
    async (_job, _dir, _output, _progress, signal: AbortSignal) => {
      caller.abort()
      expect(signal.aborted).toBe(true)
      throw new Error('Cancelled')
    }
  )
  await expect(
    renderProductionBundle(
      { 'index.html': '<html></html>' },
      { fps: 30, signal: caller.signal }
    )
  ).rejects.toThrow('Cancelled')
})
