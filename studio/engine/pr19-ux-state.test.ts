import { expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import { writeRow } from './persistence'
import { changeProject, listNotebooks, loadProject } from './projects'
import { videoView } from '../shared/state'
import { downloadDisposition } from './download-name'
vi.mock('./storyboard/pipeline', () => ({
  scheduleStoryboard: vi.fn(),
  settledStoryboard: vi.fn()
}))
import { remakeStoryboard } from './storyboard/actions'
import { storyboardHeader, storyboardScreen } from '../app/storyboard-view'

const fixture = (id: string): Snapshot =>
  ({
    project: {
      id,
      title: 'A useful episode',
      source: 'Notes',
      slides: [
        {
          id: 'p',
          title: 'Old headline',
          svg: '<svg>Original drawing</svg>',
          narration: 'The explanation'
        }
      ],
      video: {
        settings: {
          presence: 'off',
          voice: { kind: 'record' },
          production: 'storyboard'
        },
        scenes: [],
        transitions: [],
        inputKey: 'v',
        produced: { inputKey: 'v', objectKey: 'movie', duration: 3 },
        storyboard: {
          id: 'sb-old',
          pages: ['p'],
          stage: 'done',
          status: 'done',
          updatedAt: 'now',
          produced: { objectKey: 'movie', duration: 3 },
          plan: {
            message: 'm',
            audience: 'a',
            structure: 'explain',
            hook: 'h',
            scenes: [
              {
                pageId: 'p',
                build: 'faceless',
                buildReason: 'Explain',
                take: { objectKey: 'take', duration: 3 },
                frames: []
              }
            ]
          }
        }
      }
    },
    status: 'ready',
    error: null,
    events: []
  }) as Snapshot

it('a wireframe edit marks an existing storyboard stale and removes export', async () => {
  const original = fixture('stale-ux')
  await writeRow('projects', original.project.id, original)
  expect(videoView(original.project).action).toBe('export')
  const saved = await changeProject(original.project.id, (current) => {
    current.project.slides[0].title = 'New headline'
    current.project.slides[0].svg = '<svg>New drawing</svg>'
  })
  const board = saved.project.video!.storyboard!
  expect(board.stale).toBe(true)
  expect(videoView(saved.project).action).not.toBe('export')
  expect(storyboardHeader(saved, board)).toContain('Remake video')
  const html = storyboardScreen(
    saved,
    null,
    { phase: 'idle', current: 0 } as never,
    null
  )
  expect(html).toContain('Changed since build')
  expect(html).not.toContain('>Built</span>')
  expect(html).toContain('poster="data:image/svg+xml,')
  const remake = await remakeStoryboard(saved.project.id)
  expect(remake.project.video!.storyboard!.id).not.toBe(board.id)
  expect(remake.project.video!.storyboard!.stale).toBeUndefined()
  expect(
    remake.project.video!.storyboard!.plan!.scenes[0].take?.objectKey
  ).toBe('take')
  expect(remake.project.video!.produced).toBeNull()
})

it('archiving and restoring retain all notebook content without invalidating video', async () => {
  await writeRow('projects', 'archive-ux', fixture('archive-ux'))
  await changeProject('archive-ux', (current) => {
    current.project.archived = true
  })
  expect(
    (await listNotebooks()).find((item) => item.id === 'archive-ux')?.archived
  ).toBe(true)
  const archived = (await loadProject('archive-ux'))!
  expect(archived.project.slides[0].svg).toContain('Original drawing')
  expect(archived.project.video!.storyboard!.stale).toBeUndefined()
  await changeProject('archive-ux', (current) => {
    current.project.archived = false
  })
  expect(
    (await listNotebooks()).find((item) => item.id === 'archive-ux')?.archived
  ).toBe(false)
})

it('download filenames preserve Unicode and cannot inject headers or paths', () => {
  const header = downloadDisposition('Résumé / demo\r\n"', 'mp4')
  expect(header).not.toContain('\r')
  expect(header).not.toContain('\n')
  expect(header).toContain("filename*=UTF-8''R%C3%A9sum%C3%A9")
  expect(header).toContain('.mp4')
})
