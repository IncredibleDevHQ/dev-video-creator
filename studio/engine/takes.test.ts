import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, it, expect } from 'vitest'
import type { Snapshot } from '../shared/api'
import { normalizeMoments } from './moment-plan'
import { runCommand } from './voice'
const root = await mkdtemp(join(tmpdir(), 'minimal-recording-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow, readRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { saveRecording } = await import('./takes')
const seed = async (id: string, camera = 'full') => {
  const moments = normalizeMoments({ moments: [{ title: 'One', lines: 'One token is spent.', seconds: 4, camera, layout: 'corner', overlay: null, cue: '' }] }, 's', camera === 'none' ? 'off' : 'high', 'body')
  const snapshot: Snapshot = { status: 'ready', error: null, events: [], project: { id, title: 'Tokens', source: 'Text', slides: [{ id: 'a', title: 'One', svg: '<svg/>' }], video: { settings: { presence: 'high', voice: { kind: 'record' } }, scenes: [{ id: 's', slideId: 'a', phase: 'waiting', presence: null, moments, inputKey: 'i', produced: null, error: null }], transitions: [], inputKey: 'v', produced: null } } }
  await writeRow('projects', id, snapshot)
  return { momentId: moments[0].id, recordingKey: moments[0].recordingKey, from: 0, to: 1.8 }
}
afterAll(() => rm(root, { recursive: true, force: true }))
it('normalizes a real camera file and saves its measured clock without invalidating the script', async () => {
  const part = await seed('valid')
  const file = join(root, 'fixture.webm')
  await runCommand('ffmpeg', ['-y','-f','lavfi','-i','color=c=green:s=160x90:r=15','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libvpx','-deadline','realtime','-c:a','libopus',file])
  await saveRecording('valid','s',[part],await readFile(file),'video/webm')
  const saved = (await loadProject('valid'))!
  const moment = saved.project.video!.scenes[0].moments[0]
  expect(moment.take?.duration).toBeGreaterThan(1.7)
  expect(moment.take?.duration).toBeLessThan(2.1)
  expect(moment.end).toBe(moment.take?.duration)
  expect(moment.recordingKey).toBe(part.recordingKey)
  expect(saved.views!.moments[`s/${moment.id}`].state).toBe('recorded')
  const row = await readRow<{ momentId: string }>('takes',moment.take!.id)
  expect(row?.momentId).toBe(moment.id)
}, 15000)
it('refuses an upload for a stale script before it writes media', async () => {
  const part = await seed('stale')
  part.recordingKey = 'old'
  await expect(saveRecording('stale','s',[part],Buffer.from('bytes'),'video/webm')).rejects.toThrow(/script changed/)
  expect((await loadProject('stale'))!.project.video!.scenes[0].moments[0].take).toBeNull()
})
it('a camera moment cannot be completed with an audio-only file', async () => {
  const part = await seed('audio')
  const file = join(root, 'audio.webm')
  await runCommand('ffmpeg', ['-y','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:a','libopus',file])
  await expect(saveRecording('audio','s',[part],await readFile(file),'audio/webm')).rejects.toThrow(/camera recording/)
},15000)
