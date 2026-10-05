import { parseHTML } from 'linkedom'
import { afterEach, expect, it, vi } from 'vitest'
import type { HarnessChoices } from '../shared/api'
const { detect } = vi.hoisted(() => ({ detect: vi.fn() }))
vi.mock('../app/api', () => ({ api: { harnesses: detect } }))
import { AgentSetup } from '../app/agent-setup'
afterEach(() => vi.unstubAllGlobals())
const mount = () => {
  const { document } = parseHTML(
    '<html><body><div id="setup"></div></body></html>'
  )
  vi.stubGlobal('document', document)
  const root = document.querySelector('#setup') as unknown as HTMLElement
  return { root, setup: new AgentSetup(root, null, vi.fn()) }
}
it('waits for an explicit detection click, reports each result, and never selects an unavailable agent', async () => {
  detect.mockReset()
  const resolve = new Map<string, (value: HarnessChoices) => void>()
  detect.mockImplementation(
    (id) => new Promise<HarnessChoices>((done) => resolve.set(id, done))
  )
  const { root, setup } = mount()
  expect(detect).not.toHaveBeenCalled()
  expect(root.querySelectorAll('input[disabled]')).toHaveLength(3)
  root.querySelector<HTMLButtonElement>('[data-detect-agents]')!.click()
  expect(detect).toHaveBeenCalledTimes(3)
  expect(root.querySelectorAll('.is-searching')).toHaveLength(3)
  resolve.get('kimi')!({
    selected: null,
    available: [{ id: 'kimi', ok: false }]
  })
  await vi.waitFor(() => expect(root.textContent).toContain('Not detected'))
  expect(root.querySelectorAll('.is-searching')).toHaveLength(2)
  resolve.get('claude-code')!({
    selected: null,
    available: [
      {
        id: 'claude-code',
        ok: true,
        models: {
          default: 'sonnet',
          options: [{ id: 'sonnet', label: 'Sonnet' }]
        }
      }
    ]
  })
  resolve.get('codex')!({
    selected: null,
    available: [{ id: 'codex', ok: true }]
  })
  await vi.waitFor(() =>
    expect(root.querySelector('.model-list')).not.toBeNull()
  )
  expect(root.querySelector('input[checked]')?.getAttribute('value')).toBe(
    'claude-code'
  )
  expect(
    root.querySelector('input[value="kimi"]')?.hasAttribute('disabled')
  ).toBe(true)
  expect(root.querySelector('.primary')?.hasAttribute('disabled')).toBe(false)
  setup.dispose()
})
it('keeps saving disabled when nothing is installed and offers detection again', async () => {
  detect.mockImplementation(async (id) => ({
    selected: null,
    available: [{ id, ok: false }]
  }))
  const { root, setup } = mount()
  root.querySelector<HTMLButtonElement>('[data-detect-agents]')!.click()
  await vi.waitFor(() =>
    expect(root.textContent).toContain('No supported agent was found')
  )
  expect(root.querySelector('.primary')?.hasAttribute('disabled')).toBe(true)
  expect(root.textContent).toContain('Detect again')
  setup.dispose()
})
it('ignores detection results when setup has been closed', async () => {
  let done!: (value: HarnessChoices) => void
  detect.mockImplementation(
    () =>
      new Promise<HarnessChoices>((resolve) => {
        done = resolve
      })
  )
  const { root, setup } = mount()
  root.querySelector<HTMLButtonElement>('[data-detect-agents]')!.click()
  setup.dispose()
  root.innerHTML = 'Closed'
  done({ selected: null, available: [{ id: 'kimi', ok: true }] })
  await Promise.resolve()
  expect(root.innerHTML).toBe('Closed')
})

it('shows supported models, disables unavailable models and detects automatically in settings', async () => {
  detect.mockReset()
  detect.mockImplementation(async (id) => ({
    selected: null,
    available: [
      {
        id,
        ok: id === 'codex',
        models: {
          default: null,
          source: 'Local catalog',
          options: [
            { id: 'model-a', label: 'Model A' },
            { id: 'model-b', label: 'Model B', unavailable: 'Update your CLI' }
          ]
        }
      }
    ]
  }))
  const { document } = parseHTML(
    '<html><body><div id="setup"></div></body></html>'
  )
  vi.stubGlobal('document', document)
  const root = document.querySelector('#setup') as unknown as HTMLElement
  const setup = new AgentSetup(
    root,
    { adapter: 'codex', model: 'model-a' },
    vi.fn(),
    'Save selection',
    true
  )
  await vi.waitFor(() => expect(root.textContent).toContain('Model A'))
  expect(detect).toHaveBeenCalledTimes(3)
  expect(
    root.querySelector('input[value="model-a"]')?.hasAttribute('checked')
  ).toBe(true)
  expect(
    root.querySelector('input[value="model-b"]')?.hasAttribute('disabled')
  ).toBe(true)
  expect(root.textContent).toContain('Update your CLI')
  expect(root.textContent).toContain('Local catalog')
  setup.dispose()
})
