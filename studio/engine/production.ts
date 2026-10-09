import type { SceneStage } from '../shared/model'
import { transitionScene } from './autopilot'
import { ensureVideoCover } from './video-cover'
type SceneAnimation = NonNullable<import('../shared/model').Scene['animation']>
import { prepareSceneAnimation, finishSceneAnimation } from './animation'
import { generationFailure } from './generation-errors'
import { buildCreativeProduction } from './creative/production'
import { ACCEPTED_WITH_WARNING } from './creative/check-words'
import { randomUUID } from 'node:crypto'
import { loadProject, changeProject, addEvent } from './projects'
import { refreshVideoKeys } from './scene-model'
import { momentState } from '../shared/state'
import { prepareMomentAudio } from './scene-audio'
import { readRow, storeAsset, writeRow } from './persistence'
import { buildSceneBundle } from '../render/scene'
import { renderProductionBundle } from '../render/production-render'
import {
  loadStageCheckpoint,
  saveStageCheckpoint,
  archiveFiles,
  restoreFiles
} from './artifacts'
import { Refusal } from './refusal'
const active = new Map<string, Promise<void>>()
/**
 * Accepts a stopped scene's last candidate as it is, when only the soft
 * checks refused it, and produces the scene from it (review 6).
 */
export const acceptCandidate = async (id: string, sceneId: string) => {
  const snapshot = await loadProject(id)
  const scene = snapshot?.project.video?.scenes.find(
    (item) => item.id === sceneId
  )
  if (
    !scene ||
    scene.phase !== 'failed' ||
    scene.failure !== 'production' ||
    !scene.acceptable
  )
    throw new Refusal('This scene has no candidate to accept')
  const candidate = await readRow<{
    sceneId: string
    inputKey: string
    soft?: boolean
    planRecord?: string
    manifest?: unknown
    artifacts: import('./artifacts').ArtifactRef[]
  }>('creative-production-attempts', scene.acceptable)
  if (
    !candidate ||
    candidate.sceneId !== sceneId ||
    candidate.inputKey !== scene.inputKey ||
    !candidate.soft
  )
    throw new Refusal('The candidate no longer fits this scene; try again')
  await saveStageCheckpoint(
    id,
    sceneId,
    'creative-production',
    scene.inputKey,
    null,
    candidate.artifacts
  )
  await writeRow('creative-productions', sceneId, {
    projectId: id,
    sceneId,
    inputKey: scene.inputKey,
    planRecord: candidate.planRecord,
    manifest: candidate.manifest,
    artifacts: candidate.artifacts,
    acceptedAsIs: true
  })
  return produceScene(id, sceneId)
}

export const produceScene = async (id: string, sceneId: string) => {
  const key = `${id}/${sceneId}`
  if (active.has(key)) return (await loadProject(id))!
  let expected = ''
  const snapshot = await changeProject(id, (current) => {
    const video = current.project.video
    const scene = video?.scenes.find((scene) => scene.id === sceneId)
    if (
      !scene ||
      !video ||
      !scene.moments.length ||
      !['waiting', 'produced', 'failed'].includes(scene.phase)
    )
      throw new Refusal('This scene is not ready to produce')
    if (scene.phase === 'failed' && scene.failure !== 'production')
      throw new Refusal('Write this scene first')
    if (
      !scene.creativePlan &&
      scene.moments.some(
        (moment) => momentState(moment, video.settings.voice) === 'to record'
      )
    )
      throw new Refusal('Record the open moments first')
    for (const moment of scene.moments)
      moment.plannedSeconds ??=
        moment.segments?.reduce((n, s) => n + s.estimate, 0) ||
        moment.end - moment.start
    delete scene.lastCheck
    delete scene.acceptable
    delete scene.notice
    transitionScene(scene, 'produce', current)
    refreshVideoKeys(current.project)
    expected = scene.inputKey
  })
  const progress = async (message: string, stage: SceneStage) =>
    changeProject(id, (current) => {
      const target = current.project.video?.scenes.find(
        (scene) => scene.id === sceneId
      )
      if (target?.phase === 'producing' && target.inputKey === expected) {
        addEvent(current, 'scene', message, {
          sceneId,
          activity: 'processing',
          stage
        })
        // A build accepted with a finding keeps it in view on the scene.
        if (message.startsWith(ACCEPTED_WITH_WARNING)) target.notice = message
      }
    })
  const work = (async () => {
    try {
      const frozen = structuredClone(snapshot)
      const scene = frozen.project.video!.scenes.find(
        (scene) => scene.id === sceneId
      )!
      let animation: SceneAnimation | undefined
      if (scene.creativePlan) {
        animation = await prepareSceneAnimation(frozen.project, scene, progress)
        let current = false
        await changeProject(id, (s) => {
          const target = s.project.video?.scenes.find((x) => x.id === sceneId)
          if (target?.phase !== 'producing' || target.inputKey !== expected)
            return
          target.animation = animation
          current = true
          if (
            target.moments.some(
              (m) =>
                momentState(m, s.project.video!.settings.voice) === 'to record'
            )
          ) {
            transitionScene(target, 'animation-ready', s)
          }
        })
        if (
          !current ||
          scene.moments.some(
            (m) =>
              momentState(m, frozen.project.video!.settings.voice) ===
              'to record'
          )
        )
          return
      }
      for (let index = 0; index < scene.moments.length; index++) {
        await progress(
          `Preparing voice · moment ${index + 1} of ${scene.moments.length}`,
          'voice'
        )
        scene.moments[index] = await prepareMomentAudio(
          id,
          sceneId,
          scene.moments[index],
          frozen.project.video!.settings.voice
        )
        let landed = false
        await changeProject(id, (current) => {
          const target = current.project.video?.scenes.find(
            (item) => item.id === sceneId
          )
          if (
            !target ||
            target.phase !== 'producing' ||
            target.inputKey !== expected
          )
            return
          target.moments[index] = scene.moments[index]
          refreshVideoKeys(current.project)
          expected = target.inputKey
          landed = true
        })
        if (!landed) return
      }
      refreshVideoKeys(frozen.project)
      let accepted = false
      await changeProject(id, (current) => {
        const target = current.project.video?.scenes.find(
          (scene) => scene.id === sceneId
        )
        if (
          !target ||
          target.phase !== 'producing' ||
          target.inputKey !== expected
        )
          return
        target.moments = scene.moments
        refreshVideoKeys(current.project)
        expected = target.inputKey
        accepted = true
      })
      if (!accepted) return
      if (!animation) await progress('Building the scene', 'composition')
      const savedBundle = await loadStageCheckpoint<null>(
        id,
        sceneId,
        'composition',
        expected
      )
      const files = animation
        ? null
        : savedBundle
          ? await restoreFiles(savedBundle.artifacts)
          : scene.creativePlan
            ? await buildCreativeProduction(
                frozen.project,
                scene,
                process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
                  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`,
                false,
                (message) => progress(message, 'composition')
              )
            : await buildSceneBundle(frozen.project, scene)
      if (!savedBundle && files)
        await saveStageCheckpoint(
          id,
          sceneId,
          'composition',
          expected,
          null,
          await archiveFiles(id, sceneId, 'composition', files)
        )
      const savedRender = await loadStageCheckpoint<{
        objectKey: string
        posterKey?: string
      }>(id, sceneId, 'render', expected)
      let asset: { objectKey: string; posterKey?: string }
      if (savedRender) {
        await (
          await import('./persistence')
        ).readAsset(savedRender.data.objectKey)
        asset = savedRender.data
      } else {
        await progress('Rendering the scene', 'render')
        const rendered = animation
          ? await finishSceneAnimation(id, scene, animation)
          : await renderProductionBundle(files!, { fps: 30 })
        await progress('Saving the scene', 'save')
        asset = await storeAsset({
          body: rendered,
          contentType: 'video/mp4',
          kind: 'produced-scene',
          extension: '.mp4',
          projectId: id,
          sceneId
        })
        await saveStageCheckpoint(id, sceneId, 'render', expected, {
          objectKey: asset.objectKey
        })
      }
      asset = await ensureVideoCover(
        id,
        sceneId,
        asset,
        Math.min(1, (scene.moments[0].end - scene.moments[0].start) / 2)
      )
      await saveStageCheckpoint(id, sceneId, 'render', expected, asset)
      const renderId = randomUUID()
      await writeRow('renders', renderId, {
        projectId: id,
        sceneId,
        inputKey: expected,
        objectKey: asset.objectKey,
        posterKey: asset.posterKey,
        createdAt: new Date().toISOString()
      })
      await changeProject(id, (current) => {
        const target = current.project.video?.scenes.find(
          (scene) => scene.id === sceneId
        )
        if (
          !target ||
          target.phase !== 'producing' ||
          target.inputKey !== expected
        )
          return
        target.produced = {
          inputKey: expected,
          objectKey: asset.objectKey,
          posterKey: asset.posterKey
        }
        transitionScene(target, 'produced', current)
        // The video stopped for a scene that is now made: once no scene is
        // stopped, neither is the video (review 6: it still said so).
        const video = current.project.video!
        if (
          video.phase === 'failed' &&
          !video.scenes.some((scene) => scene.phase === 'failed')
        ) {
          video.phase = 'idle'
          video.error = null
        }
      })
    } catch (error) {
      await changeProject(id, (current) => {
        const target = current.project.video?.scenes.find(
          (scene) => scene.id === sceneId
        )
        if (
          !target ||
          target.phase !== 'producing' ||
          target.inputKey !== expected
        )
          return
        target.failure = 'production'
        target.error = generationFailure(
          error,
          'Could not produce this scene. Try again.'
        )
        // What the last check found, and whether it can be taken as it is.
        const said = error as { lastCheck?: string; acceptable?: string }
        if (said?.lastCheck) target.lastCheck = said.lastCheck
        if (said?.acceptable) target.acceptable = said.acceptable
        transitionScene(target, 'fail', current)
      })
    }
  })().finally(() => active.delete(key))
  active.set(key, work)
  void work.catch(() => {})
  return snapshot
}

export const waitForSceneProduction = (id: string, sceneId: string) =>
  active.get(`${id}/${sceneId}`) || Promise.resolve()
