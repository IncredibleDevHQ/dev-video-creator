import { vi as mocker } from 'vitest'
mocker.mock('./cast-packet', () => ({
  prepareCastPacket: mocker.fn(async () => ({
    visualCast: { status: 'synthetic-fixture' },
    media: {},
    assets: [],
    assetKeys: []
  }))
}))
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, expect, it } from 'vitest'
import {
  collectProduction,
  draftSeed,
  keepDraft,
  mediaBindingInstructions,
  retainedContentSeed
} from './production'
import { archiveFiles } from '../artifacts'
import { writeRow } from '../persistence'
const root = await mkdtemp(join(tmpdir(), 'studio-production-input-'))
afterAll(() => rm(root, { recursive: true, force: true }))
const supplied = {
  'media/scene-audio.wav': Buffer.from('labelled synthetic audio fixture')
}
const fixture = async (name: string) => {
  const dir = join(root, name)
  await mkdir(join(dir, 'production', 'media'), { recursive: true })
  await writeFile(
    join(dir, 'production', 'index.html'),
    '<!doctype html><html></html>'
  )
  await writeFile(join(dir, 'production', 'manifest.json'), '{}')
  await writeFile(
    join(dir, 'production', 'media', 'scene-audio.wav'),
    supplied['media/scene-audio.wav']
  )
  return dir
}
it('collects production output and keeps supplied audio bytes unchanged', async () => {
  const files = await collectProduction(await fixture('accepted'), supplied)
  expect(files['index.html']).toContain('<!doctype html>')
  expect(files['media/scene-audio.wav']).toEqual({
    base64: supplied['media/scene-audio.wav'].toString('base64'),
    contentType: 'application/octet-stream'
  })
})
it('refuses modified or missing product clock media', async () => {
  const dir = await fixture('tampered')
  await writeFile(
    join(dir, 'production', 'media', 'scene-audio.wav'),
    'changed'
  )
  await expect(collectProduction(dir, supplied)).rejects.toThrow('unchanged')
  await rm(join(dir, 'production', 'media', 'scene-audio.wav'))
  await expect(collectProduction(dir, supplied)).rejects.toThrow(
    'Copy the product-supplied media'
  )
})
it('refuses symlink output that could escape the run', async () => {
  const dir = await fixture('symlink')
  await writeFile(join(root, 'outside.txt'), 'outside fixture')
  await symlink(
    join(root, 'outside.txt'),
    join(dir, 'production', 'outside.txt')
  )
  await expect(collectProduction(dir, supplied)).rejects.toThrow(
    'inside this run'
  )
})

it('keeps camera assembly out of animation-only generation instructions', () => {
  expect(mediaBindingInstructions(true)).toContain('do not implement them')
  expect(mediaBindingInstructions(true)).not.toContain('show it only inside')
  expect(mediaBindingInstructions(false)).toContain('show it only inside')
})

it('reuses accepted code and artwork without loading previous presenter or sound bytes', async () => {
  const load = mocker.fn(async (key: string) => Buffer.from(key))
  const names = [
    'index.html',
    'assets/marker.svg',
    'manifest.json',
    'media/scene-camera.mp4',
    'media/scene-audio.wav'
  ]
  const refs = names.map((name, i) => ({
    id: String(i),
    objectKey: `object-${i}`,
    name,
    contentType: 'application/octet-stream'
  }))
  const seed = await retainedContentSeed(refs, load)
  expect(Object.keys(seed)).toEqual([
    'production/index.html',
    'production/assets/marker.svg'
  ])
  expect(load.mock.calls.map((call) => call[0])).toEqual([
    'object-0',
    'object-1'
  ])
})

it('continues a stopped build from its own files, not from the start', async () => {
  // A synthetic stopped run: the files its workspace held when it stopped.
  const artifacts = await archiveFiles('notebook-draft', 'scene-1', 'run', {
    'production/index.html': '<p>Synthetic draft</p>',
    'production/manifest.json': '{}',
    'production/assets/marker.svg': '<svg/>',
    'production/media/scene-audio.wav': 'synthetic sound',
    'packet/PLAN.json': '{}'
  })
  await writeRow('engine-artifacts', 'run-1', { artifacts })
  const scene = { id: 'scene-1', inputKey: 'animation-1' }
  const found = ['the title is cut by the left edge']
  await keepDraft('notebook-draft', scene, 'run-1', 'plan-1', found)
  const resumed = await draftSeed('notebook-draft', scene, 'plan-1')
  // The page, its manifest and its artwork come back; the app's own media
  // and the packet are supplied fresh by the next run.
  expect(Object.keys(resumed!.seed).sort()).toEqual([
    'production/assets/marker.svg',
    'production/index.html',
    'production/manifest.json'
  ])
  expect(resumed!.seed['production/index.html'].toString()).toBe(
    '<p>Synthetic draft</p>'
  )
  expect(JSON.parse(resumed!.note).lastCheck).toEqual(found)
  // A new plan or new inputs start again.
  expect(await draftSeed('notebook-draft', scene, 'plan-2')).toBeNull()
  expect(
    await draftSeed(
      'notebook-draft',
      { id: 'scene-1', inputKey: 'animation-2' },
      'plan-1'
    )
  ).toBeNull()
  // A run that stopped before writing a page leaves nothing to continue.
  await writeRow('engine-artifacts', 'run-2', {
    artifacts: artifacts.filter((file) => !file.name.endsWith('index.html'))
  })
  const other = { id: 'scene-2', inputKey: 'animation-1' }
  await keepDraft('notebook-draft', other, 'run-2', 'plan-1', [])
  expect(await draftSeed('notebook-draft', other, 'plan-1')).toBeNull()
})
