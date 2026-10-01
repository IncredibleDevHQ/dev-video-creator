import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { RecordedPart } from '../shared/api'
import type { Moment } from '../shared/model'
import type { Snapshot } from '../shared/api'
import { loadProject, changeProject, addEvent } from './projects'
import { normalizeTake, composeTakes, pictureSize } from './take-clock'
import { storeAsset, writeRow } from './persistence'
import { refreshVideoKeys, synchronizeClock } from './scene-model'
import { momentNeedsRecording } from './state'
const checkParts = (snapshot: Snapshot, sceneId: string, parts: RecordedPart[]) => {
  const video = snapshot.project.video
  const scene = video?.scenes.find(scene => scene.id === sceneId)
  if (!scene || !video || !['waiting','produced'].includes(scene.phase)) throw new Error('Wait for this scene to finish changing')
  if (!Array.isArray(parts) || !parts.length || parts.length > 16 || new Set(parts.map(part => part.momentId)).size !== parts.length) throw new Error('Invalid recording moments')
  let last = 0
  for (const part of parts) {
    const moment = scene.moments.find(moment => moment.id === part.momentId)
    if (!moment || moment.recordingKey !== part.recordingKey) throw new Error('This script changed. Record the updated moment.')
    if (!momentNeedsRecording(moment, video.settings.voice)) throw new Error('This moment is voiced automatically')
    if (!Number.isFinite(part.from) || !Number.isFinite(part.to) || part.from < last || part.to-part.from < 0.4 || part.to > 1800) throw new Error('Invalid recording boundaries')
    last = part.to
  }
  return scene
}
export const saveRecording = async (id: string, sceneId: string, parts: RecordedPart[], body: Buffer, contentType: string, uploadId?:string) => {
  if(uploadId && !/^[a-zA-Z0-9-]{16,64}$/.test(uploadId))throw new Error('Invalid recording upload identifier')
  const before = await loadProject(id)
  if (!before) throw new Error('Project not found')
  const scene = checkParts(before, sceneId, parts)
  const mime = contentType.split(';')[0]
  if (!['video/webm','audio/webm','video/mp4','audio/mp4','audio/wav'].includes(mime) || !body.length || body.length > 150_000_000) throw new Error('Use a camera or microphone recording')
  const temporary = await mkdtemp(join(tmpdir(), 'minimal-take-'))
  try {
    const input = join(temporary, 'input'); const normalized = join(temporary, 'normalized.webm')
    await writeFile(input, new Uint8Array(body))
    const made = await normalizeTake(input, normalized)
    if (parts.at(-1)!.to > made.duration+0.3) throw new Error('Recording is shorter than its moment boundaries')
    if (scene.moments.some(moment => parts.some(part => part.momentId === moment.id) && moment.camera !== 'none') && !made.picture) throw new Error('This moment needs a camera recording')
    const size = made.picture ? await pictureSize(normalized) : null
    const raw=await storeAsset({body,contentType:mime,projectId:id,sceneId,kind:'recording-original',extension:mime.endsWith('mp4')?'.mp4':mime.endsWith('wav')?'.wav':'.webm'})
    const normal=await storeAsset({body:await readFile(normalized),contentType:made.picture?'video/webm':'audio/webm',projectId:id,sceneId,kind:'recording-normalized',extension:'.webm'})
    await writeRow('recording-sessions',raw.id,{projectId:id,sceneId,original:raw.objectKey,normalized:normal.objectKey,parts,duration:made.duration,picture:made.picture})
    const takes: Array<{ part: RecordedPart; take: NonNullable<Moment['take']> }> = []
    for (const part of parts) {
      const path = join(temporary, `${takes.length}.webm`)
      const duration = await composeTakes([{ path: normalized, from: part.from, to: Math.min(part.to,made.duration) }], path, size)
      const asset = await storeAsset({ body: await readFile(path), contentType: made.picture ? 'video/webm' : 'audio/webm', projectId: id, sceneId, momentId: part.momentId, kind: 'moment-take', extension: '.webm' })
      const take = { id: randomUUID(), ...(uploadId?{uploadId}:{}), recordingKey: part.recordingKey, objectKey: asset.objectKey, duration }
      await writeRow('takes', take.id, { ...take, recordingSessionId:raw.id,projectId: id, sceneId, momentId: part.momentId, recordedAt: new Date().toISOString() })
      takes.push({ part, take })
    }
    return await changeProject(id, current => {
      const target = checkParts(current, sceneId, parts)
      for (const { part, take } of takes) target.moments.find(moment => moment.id === part.momentId)!.take = take
      synchronizeClock(target); refreshVideoKeys(current.project)
      target.phase = 'waiting'
      addEvent(current, 'scene', `${takes.length} moment${takes.length === 1 ? '' : 's'} recorded`, { sceneId })
    })
  } finally { await rm(temporary, { recursive: true, force: true }) }
}
