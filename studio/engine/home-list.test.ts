import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
import { sourceLink } from '../shared/source-link'
const root = await mkdtemp(join(tmpdir(), 'minimal-home-list-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow } = await import('./persistence')
const { listNotebooks } = await import('./projects')
afterAll(() => rm(root, { recursive: true, force: true }))

it('reads a www. address and a bare domain as links, as the hint says', () => {
  expect(sourceLink('www.example.com/post')).toBe(
    'https://www.example.com/post'
  )
  expect(
    sourceLink('anthropic.com/engineering/building-effective-agents')
  ).toBe('https://anthropic.com/engineering/building-effective-agents')
  expect(sourceLink('https://example.com/a')).toBe('https://example.com/a')
  expect(sourceLink('Some notes about agents')).toBeNull()
  expect(sourceLink('v1.2')).toBeNull()
})

it('lists every notebook, and says which videos are ready', async () => {
  const at = (n: number) => new Date(Date.UTC(2026, 9, 1, 0, n)).toISOString()
  for (let n = 0; n < 55; n++) {
    const snapshot: Snapshot = {
      project: {
        id: `n${n}`,
        title: `Notebook ${n}`,
        source: 'Text',
        slides: [],
        video: null
      },
      status: 'ready',
      error: null,
      events: [
        {
          kind: 'slide',
          message: 'Ready',
          time: at(n),
          sequence: 1,
          projectId: `n${n}`
        }
      ]
    }
    await writeRow('projects', `n${n}`, snapshot)
  }
  const list = await listNotebooks()
  expect(list).toHaveLength(55)
  expect(list[0].id).toBe('n54')
  expect(list.every((item) => item.videoReady === false)).toBe(true)
})
