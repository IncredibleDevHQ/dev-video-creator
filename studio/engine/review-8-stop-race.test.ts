import { expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'

// Review 8 round 1: after Stop, the page kept "Stopping…" until a reload,
// because the Stop answer, read before the stop landed, replaced the newer
// state the live stream had already brought. The network is a stand-in.
vi.mock('../app/api', () => ({ api: { stopStoryboard: vi.fn() } }))
const { api } = await import('../app/api')
const { clickStoryboard } = await import('../app/storyboard-controller')

const at = (sequence: number, status: string, stopping?: boolean) =>
  ({
    project: {
      id: 'ep',
      title: 'Episode',
      source: '',
      slides: [],
      video: {
        storyboard: {
          id: 'sb-ep',
          pages: [],
          stage: 'stills',
          status,
          ...(stopping ? { stopping } : {}),
          updatedAt: ''
        }
      }
    },
    status: 'ready',
    error: null,
    events: [
      { sequence, message: 'x', kind: 'video', time: '', projectId: 'ep' }
    ]
  }) as unknown as Snapshot

it('keeps the newer state when the Stop answer comes after the stop has landed', async () => {
  // The Stop answer says "stopping"; the stream already said "stopped".
  vi.mocked(api.stopStoryboard).mockResolvedValue(at(5, 'working', true))
  const stopped = at(6, 'failed')
  const app = {
    snapshot: at(4, 'working'),
    capture: { phase: 'idle' },
    render: vi.fn(() => {})
  }
  const target = { disabled: false, dataset: {} }
  const done = clickStoryboard(app as never, target as never, 'sb-stop')
  app.snapshot = stopped
  await done
  expect(app.snapshot).toBe(stopped)
  expect(app.render).toHaveBeenCalled()
})
