import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
const { inspect } = vi.hoisted(() => ({ inspect: vi.fn() }))
vi.mock('./harness/runtime', async (original) => ({
  ...(await original<typeof import('./harness/runtime')>()),
  inspectHarnesses: inspect
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-harness-choice-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { availableHarness } = await import('./notebook-intake')
afterAll(() => rm(root, { recursive: true, force: true }))

it('keeps only a model the agent lists as available', async () => {
  inspect.mockResolvedValue([
    {
      id: 'claude-code',
      ok: true,
      models: {
        options: [
          { id: 'claude-opus-5-5', label: 'Opus 5.5' },
          { id: 'claude-old', label: 'Old', unavailable: true }
        ]
      }
    }
  ])
  // Kept with the name the agent's list gives it, as the picker shows it,
  // never a name sent in.
  await expect(
    availableHarness({
      adapter: 'claude-code',
      model: 'claude-opus-5-5',
      label: 'Sent in'
    })
  ).resolves.toEqual({
    adapter: 'claude-code',
    model: 'claude-opus-5-5',
    label: 'Opus 5.5'
  })
  await expect(availableHarness({ adapter: 'claude-code' })).resolves.toEqual({
    adapter: 'claude-code'
  })
  for (const model of ['no-such-model', 'claude-old'])
    await expect(
      availableHarness({ adapter: 'claude-code', model })
    ).rejects.toThrow('Choose an available model for this agent')
})

it('trusts the model when the agent lists none', async () => {
  inspect.mockResolvedValue([{ id: 'codex', ok: true }])
  await expect(
    availableHarness({ adapter: 'codex', model: 'gpt-6-astra' })
  ).resolves.toEqual({ adapter: 'codex', model: 'gpt-6-astra' })
})
