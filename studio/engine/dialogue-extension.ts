import { transitionScene } from './autopilot'
import { changeProject, loadProject, addEvent } from './projects'
import { refreshVideoKeys, recordingKeyOf } from './scene-model'
import { estimateSpeech } from '../shared/dialogue'
import { runValidatedJsonStage } from './creative/stage'
import { fingerprintOf } from './planning/fingerprint'
import { validateSourceReply } from './notebook-chat'
import type { SourceRead } from './source'
import { readRow } from './persistence'
export const saveDialogueExtension = (
  id: string,
  sceneId: string,
  momentId: string,
  body: { text: string; recordingKey: string }
) =>
  changeProject(id, snapshot => {
    const scene = snapshot.project.video?.scenes.find(s => s.id === sceneId),
      moment = scene?.moments.find(m => m.id === momentId)
    if (!scene || !moment || !snapshot.project.video)
      throw new Error('This moment no longer exists')
    if (!['waiting', 'produced', 'failed'].includes(scene.phase))
      throw new Error('Wait for this scene to finish before changing dialogue')
    if (moment.camera === 'none')
      throw new Error('Extra dialogue needs an on-camera moment')
    if (typeof body.text !== 'string' || body.text.length > 4000)
      throw new Error('Keep the extension under 4000 characters')
    if (body.recordingKey !== moment.recordingKey)
      throw new Error('The dialogue changed. Reopen this moment before saving.')
    const text = body.text.trim(),
      previous = moment.extension
    if (text === (previous?.text || '')) return
    const baseLines = previous?.baseLines ?? moment.lines,
      baseSeconds =
        previous?.baseSeconds ??
        moment.plannedSeconds ??
        moment.end - moment.start,
      baseSegments = previous ? previous.baseSegments : moment.segments
    const baseCamera = previous?.baseCamera ?? moment.camera
    const seconds = estimateSpeech(text)
    moment.lines = [baseLines, text].filter(Boolean).join(' ')
    moment.plannedSeconds = baseSeconds + seconds
    moment.segments = text
      ? [
          ...(baseSegments || [
            {
              id: `${moment.id}-base`,
              lines: baseLines,
              camera: true,
              estimate: baseSeconds
            }
          ]),
          {
            id: `${moment.id}-extension`,
            lines: text,
            camera: true,
            estimate: seconds
          }
        ]
      : baseSegments
    moment.camera = text && baseCamera === 'start' ? 'both' : baseCamera
    if (text)
      moment.extension = {
        baseLines,
        baseSeconds,
        baseCamera,
        baseSegments,
        text,
        seconds
      }
    else delete moment.extension
    moment.recordingKey = recordingKeyOf(moment)
    // Retain the old take for history; its key prevents accidental reuse with new words.
    moment.audio = null
    delete moment.media
    scene.produced = null
    transitionScene(scene, 'recording-saved')
    snapshot.project.video.produced = null
    refreshVideoKeys(snapshot.project)
    addEvent(
      snapshot,
      'scene',
      text
        ? 'Extra dialogue saved. Record this moment again; its animation is unchanged.'
        : 'Extra dialogue removed.',
      { sceneId }
    )
  })
const pending = new Set<string>()
export async function suggestDialogueExtension(
  id: string,
  sceneId: string,
  momentId: string,
  body: { text: string; seconds: number; recordingKey: string }
) {
  const snapshot = await loadProject(id),
    scene = snapshot?.project.video?.scenes.find(s => s.id === sceneId),
    moment = scene?.moments.find(m => m.id === momentId)
  if (!snapshot || !moment || moment.recordingKey !== body.recordingKey)
    throw new Error('The dialogue changed. Reopen this moment.')
  if (
    typeof body.text !== 'string' ||
    body.text.length > 4000 ||
    !Number.isFinite(body.seconds) ||
    body.seconds < 5 ||
    body.seconds > 180
  )
    throw new Error('Choose an extension of 5–180 seconds')
  const selection = snapshot.project.harness
  if (!selection)
    throw new Error(
      'Choose an AI in notebook settings to get suggestions. You can still write your own dialogue.'
    )
  const key = `${id}/${sceneId}/${momentId}`
  if (pending.has(key)) throw new Error('A suggestion is already being written')
  pending.add(key)
  try {
    const source =
      (await readRow<SourceRead>('sources', id)) ||
      ({ text: snapshot.project.source } as SourceRead)
    const question = `Continue the speaker's dialogue after the animation ends. The animation holds its final frame. Return ONLY the continuation suffix in reply, never repeat or rewrite the typed prefix. Keep a conversational voice. Original dialogue: ${
      moment.extension?.baseLines ?? moment.lines
    }\nTyped extension prefix: ${
      body.text
    }\nTarget total extension: about ${Math.round(
      body.seconds * 2.5
    )} words, including the typed prefix. Use only the source for factual claims; do not invent examples that imply unsupported facts. Return evidence from the source for factual claims.`
    const result = await runValidatedJsonStage({
      projectId: id,
      inputKey: fingerprintOf({ question, source: source.text }),
      checkpoint: 'dialogue-extension',
      stage: 'story',
      route: 'Discuss Source',
      file: 'story/reply.json',
      tool: 'story_submit_reply',
      selection,
      origin:
        process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
        `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`,
      stageContext: { source, question },
      packet: {
        'packet/SOURCE.md': source.text,
        'packet/QUESTION.txt': question
      },
      validate: raw => validateSourceReply(raw, source),
      timeoutMs: 60000,
      idleTimeoutMs: 30000,
      maxToolCalls: 12
    })
    return { text: result.reply }
  } finally {
    pending.delete(key)
  }
}
