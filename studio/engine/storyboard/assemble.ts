// Assembly and render, as faceless-explainer Steps 5–6 run them: captions
// from the word timings, the index from the storyboard, the transitions
// injected and verified, Hyperframes' check on the whole episode (its
// findings sorted by frame so a frame can be built again), a contact sheet,
// then one render.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { cliTail, runCli, runScript } from './hyperframes'
import {
  checkProject,
  findingLine,
  frameOfFinding,
  snapshotProject
} from './check'

export const assembleEpisode = async (dir: string) => {
  if (existsSync(join(dir, 'audio_meta.json')))
    await runScript(
      'captions',
      [
        'build',
        '--storyboard',
        './STORYBOARD.md',
        '--audio-meta',
        './audio_meta.json',
        '--hyperframes',
        '.',
        '--out',
        './caption_groups.json'
      ],
      dir
    )
  await runScript(
    'assemble-index',
    ['--storyboard', './STORYBOARD.md', '--hyperframes', '.'],
    dir
  )
  await runScript(
    'transitions',
    ['inject', '--storyboard', './STORYBOARD.md', '--hyperframes', '.'],
    dir
  )
  await runScript(
    'transitions',
    ['verify', '--storyboard', './STORYBOARD.md', '--index', './index.html'],
    dir
  )
}

/** The episode checked whole: errors by frame, the rest, and warnings. */
export const checkEpisode = async (dir: string, frameIds: string[]) => {
  const checked = await checkProject(dir, {
    samples: Math.min(40, Math.max(9, frameIds.length * 3)),
    captions: false
  })
  const byFrame: Record<string, string[]> = {}
  const other: string[] = []
  for (const finding of checked.errors) {
    const id = frameOfFinding(finding)
    if (id && frameIds.includes(id))
      (byFrame[id] ||= []).push(findingLine(finding))
    else other.push(findingLine(finding))
  }
  return { byFrame, other, warnings: checked.warnings.map(findingLine) }
}

/** A contact sheet at each frame's middle. */
export const episodeSheet = async (dir: string, middles: number[]) =>
  (await snapshotProject(dir, middles, join(dir, 'snapshots'))).sheet

export const renderEpisode = async (dir: string, signal?: AbortSignal) => {
  const output = join(dir, 'renders', 'video.mp4')
  const result = await runCli(
    ['render', '--quality', 'high', '-o', output, '.'],
    dir,
    90 * 60_000,
    signal
  )
  if (result.code !== 0 || !existsSync(output))
    throw new Error(`The render failed: ${cliTail(result)}`)
  return output
}
