import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
const { cover } = vi.hoisted(() => ({
  cover: vi.fn(async () => Buffer.from('Synthetic cover fixture'))
}))
vi.mock('../render/video-cover', () => ({ videoCover: cover }))
const root = await mkdtemp(join(tmpdir(), 'studio-cover-cache-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow, storeAsset, readAsset, deleteAsset, listNotebookRows } =
  await import('./persistence')
const { loadProject } = await import('./projects')
const { sceneCover } = await import('./video-cover')
afterAll(() => rm(root, { recursive: true, force: true }))
async function seed(id: string) {
  const asset = await storeAsset({
    body: Buffer.from('Synthetic video fixture'),
    contentType: 'video/mp4',
    projectId: id,
    sceneId: 'scene',
    kind: 'produced-scene',
    extension: '.mp4'
  })
  await writeRow('projects', id, {
    project: {
      id,
      title: 'Fixture',
      slides: [],
      video: {
        settings: { voice: { kind: 'ai', id: 'default' }, presence: 'off' },
        scenes: [
          {
            id: 'scene',
            inputKey: 'inputs',
            produced: { inputKey: 'inputs', objectKey: asset.objectKey },
            moments: [{ start: 0, end: 5 }]
          }
        ]
      }
    },
    status: 'ready',
    events: []
  })
}
it('caches a notebook-scoped cover for an older video once without regenerating the scene', async () => {
  await seed('cover')
  cover.mockClear()
  const [first, second] = await Promise.all([
    sceneCover('cover', 'scene'),
    sceneCover('cover', 'scene')
  ])
  expect(first.equals(second)).toBe(true)
  expect(cover).toHaveBeenCalledOnce()
  const snapshot = (await loadProject('cover'))!,
    poster = snapshot.project.video!.scenes[0].produced!.posterKey!
  expect(await readAsset(poster)).toEqual(first)
  const assets = await listNotebookRows('assets', 'cover')
  expect(assets).toHaveLength(2)
  await sceneCover('cover', 'scene')
  expect(cover).toHaveBeenCalledOnce()
  await deleteAsset(poster)
  await sceneCover('cover', 'scene')
  expect(cover).toHaveBeenCalledTimes(2)
  expect(
    (await loadProject('cover'))!.project.video!.scenes[0].produced!.posterKey
  ).not.toBe(poster)
})
it('renders saved-review covers without changing their notebook or saving derived objects', async () => {
  await seed('review-cover')
  await sceneCover('review-cover', 'scene', false)
  expect(
    (await loadProject('review-cover'))!.project.video!.scenes[0].produced!
      .posterKey
  ).toBeUndefined()
  expect(await listNotebookRows('assets', 'review-cover')).toHaveLength(1)
})
it('does not read another notebook’s scene or use an obsolete render', async () => {
  await expect(sceneCover('cover', 'another-scene')).rejects.toThrow(
    'no video yet'
  )
  const snapshot = (await loadProject('cover'))!
  snapshot.project.video!.scenes[0].inputKey = 'changed'
  await writeRow('projects', 'cover', snapshot)
  await expect(sceneCover('cover', 'scene')).rejects.toThrow('no video yet')
})
