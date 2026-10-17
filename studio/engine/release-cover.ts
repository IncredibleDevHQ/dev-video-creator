// The thumbnail's picture, as YouTube takes one: 1280×720, JPEG, the frame
// whole. A storyboard frame's still is read from its production; a second
// of the made video is taken from it. Kept for a while, so the dialog's
// choices and the bundle never make the same picture twice.
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Project } from '../shared/model'
import {
  chosenCover,
  coverChoices,
  frameHeld,
  type CoverChoice
} from '../shared/release-cover'
import { frameId } from '../shared/storyboard'
import { readAsset } from './persistence'
import { Refusal } from './refusal'
import { stillFile } from './storyboard/board'
import { productionDir } from './storyboard/workspace'
import { runCommand } from './voice'

const made = new Map<string, Buffer>()
const keep = (key: string, bytes: Buffer) => {
  made.delete(key)
  made.set(key, bytes)
  // The oldest go first: a few dozen pictures of 50–150 KB each.
  while (made.size > 48) made.delete(made.keys().next().value!)
  return bytes
}

/** A picture fitted to 1280×720 on black, from an image or a video's second. */
const fitted = async (source: Buffer, name: string, at?: number) => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-cover-'))
  try {
    await writeFile(join(dir, name), source)
    await runCommand('ffmpeg', [
      '-y',
      '-v',
      'error',
      ...(at === undefined ? [] : ['-ss', String(at)]),
      '-i',
      join(dir, name),
      '-frames:v',
      '1',
      '-vf',
      'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1',
      '-q:v',
      '3',
      join(dir, 'cover.jpg')
    ])
    return await readFile(join(dir, 'cover.jpg'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** One choice's picture. */
export const coverPicture = async (project: Project, choice: CoverChoice) => {
  const video = project.video
  if (choice.frame !== undefined) {
    const storyboard = video?.storyboard
    const frame = storyboard?.plan?.scenes
      .flatMap((scene) => scene.frames)
      .find((item) => item.number === choice.frame)
    const path =
      storyboard && frame?.still
        ? join(
            productionDir(project.id, storyboard.id),
            stillFile(frameId(frame))
          )
        : ''
    if (!path || !existsSync(path)) throw new Refusal('That frame has no still')
    const key = `${path}:${(await stat(path)).mtimeMs}`
    return (
      made.get(key) ||
      keep(key, await fitted(await readFile(path), 'still.png'))
    )
  }
  const produced = video?.produced
  if (!produced || choice.at === undefined)
    throw new Refusal('Produce the video first')
  const key = `${produced.objectKey}:${choice.at}`
  return (
    made.get(key) ||
    keep(
      key,
      await fitted(await readAsset(produced.objectKey), 'video.mp4', choice.at)
    )
  )
}

/** A choice's picture, settled: a still gone from disk gives way to that
 * frame's last picture in the video. */
const settledPicture = async (project: Project, choice: CoverChoice) => {
  try {
    return await coverPicture(project, choice)
  } catch (error) {
    if (choice.frame === undefined) throw error
    return coverPicture(project, {
      ...choice,
      frame: undefined,
      at: frameHeld(project, choice.frame)
    })
  }
}

/**
 * The thumbnail the bundle and the upload carry: the creator's choice, else
 * the hook's still, settled as above; with neither, the video's own poster.
 */
export const coverImage = async (project: Project) => {
  const chosen = chosenCover(project)
  if (chosen)
    try {
      return await settledPicture(project, chosen)
    } catch {
      /* The poster is the last way to a picture. */
    }
  const poster = project.video?.produced?.posterKey
  if (poster) return readAsset(poster)
  throw new Refusal('The video has no picture for a thumbnail yet')
}

/** A choice's picture for the dialog, when it is one of the choices: the
 * same picture the bundle would carry for it (review 8, round 1: a still
 * gone from disk showed a broken image while the bundle used the video). */
export const coverFor = (project: Project, query: URLSearchParams) => {
  if (!query.has('frame') && !query.has('at')) return coverImage(project)
  const frame = query.has('frame') ? Number(query.get('frame')) : undefined
  const at = query.has('at') ? Number(query.get('at')) : undefined
  const choice = coverChoices(project).find(
    (item) =>
      (frame !== undefined && item.frame === frame) ||
      (at !== undefined && item.at === at)
  )
  if (!choice) throw new Refusal('That is not one of the thumbnails')
  return settledPicture(project, choice)
}
