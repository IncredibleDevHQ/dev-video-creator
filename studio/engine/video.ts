import type { SceneStage } from '../shared/model'
import { narrativeById, validDirection } from '../shared/narratives'
import { takeTrimRange, trimTake } from './take-trim'
import { scriptEditProblems } from './moment-edit-scope'
import { generationFailure } from './generation-errors'
import type { Snapshot, ReplanPreview, ChatRequest } from '../shared/api'
import type { VideoSettings, Presence, Scene } from '../shared/model'
import { loadProject, changeProject, addEvent } from './projects'
import { listNotebookRows, readRow, storeAsset, writeRow } from './persistence'
import { cancelEngineRun, type EngineRun } from './harness/runtime'
import { resolveVoice } from './voice-library'
import { modelFetch } from './model-gateway'
import { momentPlanSchema, normalizeMoments } from './moment-plan'
import {
  scenePlanKey,
  reconcileVideo,
  refreshVideoKeys,
  roleOf
} from './scene-model'
import { fingerprintOf } from './planning/fingerprint'
import { loadStageCheckpoint, saveStageCheckpoint } from './artifacts'
import { validateHarnessSelection } from './harness/preference'
import { planCreativeScene } from './creative/scene'
import { transitionScene } from './autopilot'
const running = new Map<string, Promise<void>>()
const isPresence = (value: unknown): value is Presence =>
  ['off', 'low', 'high'].includes(String(value))
export const validateVideoSettings = (value: unknown): VideoSettings => {
  const raw = value as VideoSettings
  if (!raw || !isPresence(raw.presence))
    throw new Error('Choose your on-camera setting')
  if (!raw.voice || !['record', 'ai', 'clone'].includes(raw.voice.kind))
    throw new Error('Choose a voice')
  if (
    raw.voice.kind !== 'record' &&
    (typeof raw.voice.id !== 'string' ||
      !raw.voice.id.trim() ||
      raw.voice.id.length > 200)
  )
    throw new Error('Choose a voice')
  const narrative = raw.narrative ? narrativeById(raw.narrative) : undefined
  if (raw.narrative && !narrative)
    throw new Error('Choose one of the templates, or none')
  return {
    ...(raw.harness ? { harness: validateHarnessSelection(raw.harness) } : {}),
    ...(narrative
      ? {
          narrative: narrative.id,
          direction: validDirection(
            narrative,
            raw.direction ?? { preset: narrative.preset }
          )
        }
      : {}),
    presence: raw.presence,
    voice:
      raw.voice.kind === 'record'
        ? { kind: 'record' }
        : { kind: raw.voice.kind, id: raw.voice.id }
  }
}
/** The wireframes whose scenes to make, when the creator chose only some. */
const chosenScenes = (body: unknown, slideIds: string[]) => {
  const raw = (body as { scenes?: unknown } | null)?.scenes
  if (raw === undefined || raw === null) return undefined
  if (
    !Array.isArray(raw) ||
    !raw.length ||
    raw.some((id) => typeof id !== 'string' || !slideIds.includes(id))
  )
    throw new Error('Choose at least one wireframe to make')
  return new Set(raw as string[])
}
export const makeVideo = async (id: string, settings: unknown) => {
  const valid = validateVideoSettings(settings)
  await resolveVoice(valid.voice)
  const snapshot = await changeProject(id, (current) => {
    if (
      current.status !== 'ready' ||
      !current.project.slides.length ||
      current.project.slides.some((slide) => !slide.svg)
    )
      throw new Error('Finish your slides first')
    if (current.project.video)
      throw new Error('This project already has a video')
    current.project.video = {
      settings: {
        ...valid,
        ...(!valid.harness && current.project.harness
          ? { harness: current.project.harness }
          : {})
      },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: null
    }
    const make = chosenScenes(
      settings,
      current.project.slides.map((slide) => slide.id)
    )
    reconcileVideo(current.project, current, make)
    addEvent(
      current,
      'video',
      make && make.size < current.project.slides.length
        ? `Writing ${make.size} of ${current.project.slides.length} video scenes`
        : 'Writing your video scenes'
    )
  })
  schedulePlanning(id)
  return snapshot
}
/** Make a scene the creator left out: it joins the queue to be written. */
export const makeScene = async (id: string, sceneId: string) => {
  const snapshot = await changeProject(id, (current) => {
    const scene = current.project.video?.scenes.find(
      (scene) => scene.id === sceneId
    )
    if (!scene) throw new Error('Scene not found')
    if (scene.phase !== 'idle') throw new Error('This scene is already made')
    transitionScene(scene, 'make', current)
    refreshVideoKeys(current.project)
  })
  schedulePlanning(id)
  return snapshot
}
/**
 * Leave a scene out of the video. An agent writing it is stopped; what the
 * scene already has is kept for when it is made again.
 */
export const leaveOutScene = async (id: string, sceneId: string) => {
  const snapshot = await changeProject(id, (current) => {
    const video = current.project.video
    const scene = video?.scenes.find((scene) => scene.id === sceneId)
    if (!video || !scene) throw new Error('Scene not found')
    if (['preparing', 'joining'].includes(video.phase || ''))
      throw new Error('Wait for the video to finish this step')
    if (scene.phase === 'producing')
      throw new Error('Wait for this scene to finish rendering')
    transitionScene(scene, 'leave-out', current)
    refreshVideoKeys(current.project)
  })
  for (const runId of await listNotebookRows('engine-runs', id)) {
    const run = await readRow<EngineRun>('engine-runs', runId)
    if (
      run?.sceneId === sceneId &&
      ['preparing', 'running'].includes(run.status)
    )
      cancelEngineRun(run.id)
  }
  return snapshot
}
export const schedulePlanning = (id: string) => {
  if (running.has(id)) return
  const work = planQueuedScenes(id).finally(async () => {
    running.delete(id)
    const snapshot = await loadProject(id)
    if (
      snapshot?.project.video?.scenes.some((scene) =>
        ['queued', 'replanning', 'changing'].includes(scene.phase)
      )
    )
      schedulePlanning(id)
  })
  running.set(id, work)
  void work.catch(() => {})
}
const planQueuedScenes = async (id: string) => {
  const snapshot = await loadProject(id)
  const scenes =
    snapshot?.project.video?.scenes.filter((scene) =>
      ['queued', 'replanning', 'changing'].includes(scene.phase)
    ) || []
  let cursor = 0
  const lane = async () => {
    while (cursor < scenes.length) await planScene(id, scenes[cursor++].id)
  }
  await Promise.all([lane(), lane()])
}
export const planScene = async (id: string, sceneId: string) => {
  let expected = ''
  let retained: Snapshot | null = null
  await changeProject(id, (snapshot) => {
    const scene = snapshot.project.video?.scenes.find(
      (scene) => scene.id === sceneId
    )
    if (!scene || !['queued', 'replanning', 'changing'].includes(scene.phase))
      return
    expected = scene.planKey || scenePlanKey(snapshot.project, scene)
    if (scene.phase === 'queued') transitionScene(scene, 'start', snapshot)
    retained = snapshot
    if (scene.phase !== 'writing')
      addEvent(snapshot, 'scene', 'Writing the scene', {
        sceneId,
        activity: 'processing',
        stage: 'artwork'
      })
  })
  if (!retained || !expected) return
  const snapshot = retained as Snapshot
  const video = snapshot.project.video!
  const scene = video.scenes.find((scene) => scene.id === sceneId)!
  const index = snapshot.project.slides.findIndex(
    (slide) => slide.id === scene.slideId
  )
  const slide = snapshot.project.slides[index]
  const presence = scene.presence || video.settings.presence
  const role = roleOf(index, snapshot.project.slides.length)
  const retainedSource = await readRow<{ source: { text: string } }>(
    'outlines',
    id
  )
  const sourceText = retainedSource?.source.text || snapshot.project.source
  const progress = async (message: string, stage: SceneStage) => {
    await changeProject(id, (current) => {
      const target = current.project.video?.scenes.find(
        (item) => item.id === sceneId
      )
      if (
        target?.planKey === expected &&
        ['writing', 'replanning', 'changing'].includes(target.phase)
      )
        addEvent(current, 'scene', message, {
          sceneId,
          activity: 'processing',
          stage
        })
    })
  }
  let problem = ''
  const failureMessage = 'Could not write this scene. Try again.'
  try {
    const checkpoint = await loadStageCheckpoint<{
      moments: Scene['moments']
      creativePlan?: Scene['creativePlan']
      preview?: Scene['preview']
    }>(id, sceneId, 'planning', expected)
    let creativePlan: Scene['creativePlan'] = checkpoint?.data.creativePlan
    let preview: Scene['preview'] = checkpoint?.data.preview
    let moments: Scene['moments'] | null = checkpoint?.data.moments || null
    if (moments)
      for (const moment of moments) {
        const previous = scene.moments.find(
          (item) =>
            item.id === moment.id && item.recordingKey === moment.recordingKey
        )
        if (previous) {
          moment.take = previous.take
          moment.audio = previous.audio
          moment.media = previous.media
        }
      }
    if (!moments && video.settings.harness) {
      const record = await planCreativeScene(
        snapshot.project,
        scene,
        video.settings.harness,
        process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
          `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`,
        progress
      )
      moments = record.moments
      creativePlan = { recordId: record.id, inputKey: expected }
    }
    if (!moments && !video.settings.harness)
      await progress('Writing the spoken lines', 'script')
    for (let attempt = 0; attempt < 3 && !moments; attempt++) {
      const response = await modelFetch('writing', {
        body: JSON.stringify({
          input: `Plan a video scene as timed moments. Scene ${index + 1}/${
            video.scenes.length
          }, role ${role}, video title ${snapshot.project.title}.
Each moment needs a title, exact spoken lines, seconds (2–90), and spoken segments with their own lines, camera boolean and seconds.
Segments must concatenate to the exact moment lines in order and their seconds add up to the moment seconds.
Full means every segment on camera, none means every segment off camera, start means a camera prefix then off-camera, end means off-camera then a camera suffix, both means camera at each end with off-camera segments between, camera (none/full/start/end/both), layout (full-screen/corner/beside-slide), overlay (title-card/lower-third/end-card/null) and a recording cue.
Use only facts from the source.
Write natural speech.
On camera ${presence}: Off means none anywhere; Low means camera only in the closing moment; High means camera in the first and last and where it helps explain, without a presenter cut between every small animation.
The title scene starts with title-card and, at High, camera full and layout full-screen.
The ending scene, if camera is allowed, closes camera full, layout full-screen, overlay end-card.
There is one off-camera voice; camera moments are always recorded.
Slide: ${slide.title}. Idea: ${slide.idea || ''}. Draft narration: ${
            slide.narration || ''
          }. Evidence: ${(slide.evidence || []).join(
            '\n'
          )}. Source: ${sourceText}. Previous moments: ${JSON.stringify(
            scene.moments.map((moment) => ({
              id: moment.id,
              title: moment.title,
              cue: moment.cue,
              lines: moment.lines,
              seconds: moment.plannedSeconds ?? moment.end - moment.start,
              camera: moment.camera,
              layout: moment.layout,
              overlay: moment.overlay,
              segments: moment.segments?.map((segment) => ({
                lines: segment.lines,
                camera: segment.camera,
                seconds: segment.estimate
              }))
            }))
          )}. Creator changes, anchored to their moments and seconds: ${JSON.stringify(
            scene.instructions || []
          )}. Keep unrelated words and timings unchanged. This edit is limited to moment ${
            scene.editMomentId || 'none (initial planning or scene settings)'
          }; retain every moment ID and order during a moment edit. ${
            problem ? `Fix these problems: ${problem}` : ''
          }`,
          text: {
            format: {
              type: 'json_schema',
              name: 'scene_moments',
              strict: true,
              schema: momentPlanSchema
            }
          }
        })
      })
      if (!response.ok) throw new Error('Could not write this scene')
      const result = await response.json()
      const text =
        result.output
          ?.flatMap((item) => item.content || [])
          .filter((item) => item.type === 'output_text')
          .map((item) => item.text || '')
          .join('') || ''
      const candidate = await storeAsset({
        body: Buffer.from(text),
        contentType: 'application/json',
        projectId: id,
        sceneId,
        kind: 'planning-candidate',
        extension: '.json'
      })
      try {
        const candidateMoments = normalizeMoments(
          JSON.parse(text),
          sceneId,
          presence,
          role,
          scene.moments
        )
        const scopeProblems = scriptEditProblems(
          scene.moments,
          candidateMoments,
          scene.editMomentId
        )
        if (scopeProblems.length) throw new Error(scopeProblems.join('; '))
        moments = candidateMoments
      } catch (error) {
        problem = error instanceof Error ? error.message : 'Invalid scene'
      }
      await writeRow('planning-attempts', candidate.id, {
        projectId: id,
        sceneId,
        inputKey: expected,
        attempt,
        artifactId: candidate.id,
        objectKey: candidate.objectKey,
        accepted: Boolean(moments),
        problem: moments ? null : problem
      })
    }
    if (!moments) throw new Error('Could not write this scene')
    await saveStageCheckpoint(id, sceneId, 'planning', expected, {
      moments,
      creativePlan,
      preview
    })
    await changeProject(id, (current) => {
      const target = current.project.video?.scenes.find(
        (scene) => scene.id === sceneId
      )
      if (
        !target ||
        target.planKey !== expected ||
        !['writing', 'replanning', 'changing'].includes(target.phase)
      )
        return
      if (creativePlan) target.creativePlan = creativePlan
      target.preview = preview
      target.moments = moments!
      delete target.editMomentId
      target.moments.forEach((moment) => {
        moment.audioKey = fingerprintOf({
          voice: current.project.video!.settings.voice,
          lines: moment.lines,
          segments: moment.segments,
          take: moment.take?.id
        })
      })
      transitionScene(target, 'plan-ready', current)
      refreshVideoKeys(current.project)
      const last = target.instructions?.at(-1)
      if (last)
        addEvent(current, 'chat', 'Updated this scene.', {
          sceneId,
          anchor: {
            stage: 'video',
            sceneId,
            momentId: last.momentId,
            second: last.second
          }
        })
    })
  } catch (reason) {
    await changeProject(id, (current) => {
      const target = current.project.video?.scenes.find(
        (scene) => scene.id === sceneId
      )
      if (
        !target ||
        target.planKey !== expected ||
        !['writing', 'replanning', 'changing'].includes(target.phase)
      )
        return
      target.failure = 'planning'
      target.error = generationFailure(reason, failureMessage)
      transitionScene(target, 'fail', current)
    })
  }
}
export const retryScene = async (id: string, sceneId: string) => {
  const snapshot = await changeProject(id, (current) => {
    const scene = current.project.video?.scenes.find(
      (scene) => scene.id === sceneId
    )
    if (!scene || scene.phase !== 'failed')
      throw new Error('This scene does not need a retry')
    transitionScene(scene, 'retry', current)
  })
  schedulePlanning(id)
  return snapshot
}
export const previewPresence = async (
  id: string,
  sceneId: string,
  presence: unknown
): Promise<ReplanPreview> => {
  if (presence !== null && !isPresence(presence))
    throw new Error('Choose your on-camera setting')
  const snapshot = await loadProject(id)
  const video = snapshot?.project.video
  const scene = video?.scenes.find((scene) => scene.id === sceneId)
  if (!scene || !video) throw new Error('Scene not found')
  return {
    sceneId,
    from: scene.presence || video.settings.presence,
    to: presence,
    recordings: scene.moments.filter((moment) => moment.take).length,
    message: `This scene will be written again with on camera ${
      presence ?? video.settings.presence
    } (${
      presence === null ? 'notebook default' : 'scene override'
    }). Recordings with matching words and timing will be kept.`
  }
}
export const replanPresence = async (
  id: string,
  sceneId: string,
  presence: unknown
) => {
  if (presence !== null && !isPresence(presence))
    throw new Error('Choose your on-camera setting')
  const snapshot = await changeProject(id, (current) => {
    const scene = current.project.video?.scenes.find(
      (scene) => scene.id === sceneId
    )
    if (!scene) throw new Error('Scene not found')
    if (
      ['writing', 'replanning', 'changing', 'producing'].includes(scene.phase)
    )
      throw new Error(
        'Wait for this scene to finish before changing its camera setting'
      )
    delete scene.editMomentId
    scene.presence = presence
    scene.planKey = scenePlanKey(current.project, scene)
    transitionScene(scene, 'replan', current)
    scene.produced = null
    refreshVideoKeys(current.project)
  })
  void planScene(id, sceneId).catch(() => {})
  return snapshot
}

/**
 * The beats a scene carries: the creator's choice, or null to take its
 * share in order again. The scene is planned again for its new beats.
 */
export const setSceneBeats = async (
  id: string,
  sceneId: string,
  beats: unknown
) => {
  const snapshot = await changeProject(id, (current) => {
    const video = current.project.video
    const scene = video?.scenes.find((item) => item.id === sceneId)
    if (!video || !scene) throw new Error('Scene not found')
    const narrative = narrativeById(video.settings.narrative)
    if (!narrative) throw new Error('Choose a template for the video first')
    if (
      beats !== null &&
      (!Array.isArray(beats) ||
        !beats.length ||
        new Set(beats).size !== beats.length ||
        beats.some((beat) => !narrative.beats.some((item) => item.id === beat)))
    )
      throw new Error('Choose beats of the video’s template')
    if (
      ['writing', 'replanning', 'changing', 'producing'].includes(scene.phase)
    )
      throw new Error('Wait for this scene to finish before changing its beats')
    delete scene.editMomentId
    scene.beats = beats as string[] | null
    scene.planKey = scenePlanKey(current.project, scene)
    transitionScene(scene, 'replan', current)
    scene.produced = null
    refreshVideoKeys(current.project)
  })
  void planScene(id, sceneId).catch(() => {})
  return snapshot
}

export const chatVideo = async (id: string, request: ChatRequest) => {
  if (
    !request ||
    request.anchor?.stage !== 'video' ||
    !request.instruction?.trim()
  )
    throw new Error('Choose a moment and add an instruction')
  const anchor = request.anchor
  const trim = takeTrimRange(request.instruction)
  if (trim) return trimTake(id, anchor, trim, request.instruction.trim())
  if (
    /^(?:please\s+)?trim\s+(?:(?:this|my|the)\s+)?take\b/i.test(
      request.instruction.trim()
    )
  )
    throw new Error(
      'Give the seconds to keep, for example: “trim take from 1 to 5 seconds”. The take is unchanged.'
    )
  const snapshot = await changeProject(id, (current) => {
    const scene = current.project.video?.scenes.find(
      (scene) => scene.id === anchor.sceneId
    )
    const moment = scene?.moments.find(
      (moment) => moment.id === anchor.momentId
    )
    if (
      !scene ||
      !moment ||
      !Number.isFinite(anchor.second) ||
      anchor.second < moment.start ||
      anchor.second > moment.end
    )
      throw new Error('Choose a moment in this scene')
    if (!['waiting', 'produced', 'failed'].includes(scene.phase))
      throw new Error('Wait for this scene to finish changing')
    scene.editMomentId = moment.id
    scene.instructions = [
      ...(scene.instructions || []),
      {
        momentId: anchor.momentId,
        second: anchor.second,
        instruction: request.instruction.trim().slice(0, 4000)
      }
    ]
    reconcileVideo(current.project, current)
    transitionScene(scene, 'change', current)
    addEvent(current, 'chat', request.instruction.trim().slice(0, 4000), {
      sceneId: scene.id,
      anchor
    })
  })
  schedulePlanning(id)
  return snapshot
}

export const updateVideoSettings = async (id: string, settings: unknown) => {
  const valid = validateVideoSettings(settings)
  await resolveVoice(valid.voice)
  const snapshot = await changeProject(id, (current) => {
    const video = current.project.video
    if (!video) throw new Error('Make the video first')
    if (
      ['preparing', 'joining'].includes(video.phase || '') ||
      video.scenes.some((scene) =>
        ['writing', 'replanning', 'changing', 'producing'].includes(scene.phase)
      )
    )
      throw new Error(
        'Wait for the active scene work to finish before changing notebook settings. Saved work is kept.'
      )
    const oldPresence = video.settings.presence
    // Beats are chosen within one narrative; a new one starts in order.
    if ((video.settings.narrative || '') !== (valid.narrative || ''))
      for (const scene of video.scenes) delete scene.beats
    video.settings = {
      ...valid,
      ...(!valid.harness && video.settings.harness
        ? { harness: video.settings.harness }
        : {})
    }
    reconcileVideo(current.project, current)
    if (oldPresence !== valid.presence)
      for (const scene of video.scenes)
        if (!scene.presence && scene.phase === 'queued') {
          delete scene.editMomentId
          transitionScene(scene, 'replan', current)
        }
    for (const scene of video.scenes)
      for (const moment of scene.moments)
        moment.audioKey = fingerprintOf({
          voice: video.settings.voice,
          lines: moment.lines,
          segments: moment.segments,
          take: moment.take?.id
        })
    refreshVideoKeys(current.project)
    addEvent(current, 'video', 'Video settings updated')
  })
  schedulePlanning(id)
  return snapshot
}

export const waitForPlanning = (id: string) =>
  running.get(id) || Promise.resolve()
