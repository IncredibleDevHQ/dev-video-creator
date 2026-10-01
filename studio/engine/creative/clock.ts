import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Scene } from '../../shared/model'
import { readAsset, storeAsset } from '../persistence'
import { runCommand } from '../voice'
import { loadStageCheckpoint, saveStageCheckpoint } from '../artifacts'
import type { ProductionClock } from './production-bundle'
export type CreativeClock = {
  clock: ProductionClock
  audioKey: string
  videoKey: string | null
}
export const prepareCreativeClock = async (
  projectId: string,
  scene: Scene
): Promise<CreativeClock> => {
  const checkpoint = await loadStageCheckpoint<CreativeClock>(
    projectId,
    scene.id,
    'creative-clock',
    scene.inputKey
  )
  if (checkpoint) return checkpoint.data
  if (
    !scene.moments.length ||
    scene.moments.some(
      (moment) =>
        moment.audio?.inputKey !== moment.audioKey ||
        moment.media?.inputKey !== moment.audioKey
    )
  )
    throw new Error('Prepare current scene audio before composition')
  const dir = await mkdtemp(join(tmpdir(), 'studio-creative-clock-'))
  try {
    const args: string[] = ['-y'],
      filters: string[] = []
    for (const [index, moment] of scene.moments.entries()) {
      const file = join(dir, `audio-${index}`)
      await writeFile(file, await readAsset(moment.audio!.objectKey))
      args.push('-i', file)
      filters.push(
        `[${index}:a]aresample=48000,apad,atrim=duration=${moment.end - moment.start},asetpts=PTS-STARTPTS[a${index}]`
      )
    }
    const duration = scene.moments.at(-1)!.end
    filters.push(
      `${scene.moments.map((_, index) => `[a${index}]`).join('')}concat=n=${scene.moments.length}:v=0:a=1[sound]`
    )
    const sound = join(dir, 'sound.wav')
    await runCommand('ffmpeg', [
      ...args,
      '-filter_complex',
      filters.join(';'),
      '-map',
      '[sound]',
      '-ac',
      '2',
      '-c:a',
      'pcm_s16le',
      sound
    ])
    const audio = await storeAsset({
      body: await readFile(sound),
      contentType: 'audio/wav',
      extension: '.wav',
      kind: 'scene-clock-audio',
      projectId,
      sceneId: scene.id
    })
    const clips = scene.moments.flatMap((moment) =>
      (moment.media?.clips || [])
        .filter((clip) => clip.camera && clip.videoKey)
        .map((clip) => ({
          ...clip,
          start: moment.start + clip.start,
          end: moment.start + clip.end
        }))
    )
    let videoKey: string | null = null
    if (clips.length) {
      const videoArgs = [
          '-y',
          '-f',
          'lavfi',
          '-i',
          `color=c=black:s=1280x720:r=30:d=${duration}`
        ],
        videoFilters: string[] = []
      for (const [index, clip] of clips.entries()) {
        const file = join(dir, `picture-${index}`)
        await writeFile(file, await readAsset(clip.videoKey!))
        videoArgs.push('-i', file)
        videoFilters.push(
          `[${index + 1}:v]trim=start=${clip.videoFrom || 0}:duration=${clip.end - clip.start},setpts=PTS-STARTPTS+${clip.start}/TB,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[p${index}]`
        )
        videoFilters.push(
          `[${index === 0 ? '0:v' : `v${index - 1}`}][p${index}]overlay=eof_action=pass:enable='gte(t,${clip.start})*lt(t,${clip.end})'[v${index}]`
        )
      }
      const picture = join(dir, 'picture.mp4')
      await runCommand(
        'ffmpeg',
        [
          ...videoArgs,
          '-filter_complex',
          videoFilters.join(';'),
          '-map',
          `[v${clips.length - 1}]`,
          '-an',
          '-t',
          String(duration),
          '-r',
          '30',
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-pix_fmt',
          'yuv420p',
          picture
        ],
        240_000
      )
      videoKey = (
        await storeAsset({
          body: await readFile(picture),
          contentType: 'video/mp4',
          extension: '.mp4',
          kind: 'scene-clock-camera',
          projectId,
          sceneId: scene.id
        })
      ).objectKey
    }
    const result: CreativeClock = {
      clock: {
        kind:
          videoKey || scene.moments.some((moment) => moment.take)
            ? 'take'
            : 'generated-voice',
        audio: 'media/scene-audio.wav',
        video: videoKey ? 'media/scene-camera.mp4' : null,
        duration,
        moments: scene.moments.map((moment) => ({
          id: moment.id,
          start: moment.start,
          end: moment.end
        }))
      },
      audioKey: audio.objectKey,
      videoKey
    }
    await saveStageCheckpoint(
      projectId,
      scene.id,
      'creative-clock',
      scene.inputKey,
      result
    )
    return result
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
