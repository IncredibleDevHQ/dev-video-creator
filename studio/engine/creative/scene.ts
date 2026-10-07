import type { SceneProgressReporter } from '../../shared/model'
import {
  narrativeBrief,
  plannedPages,
  sceneNarrative
} from '../../shared/narratives'
import { prepareCastPacket } from './cast-packet'
import { sceneOrchestration } from './orchestration'
import { scenePresence } from '../../shared/orchestration'
import { randomUUID } from 'node:crypto'
import type { Project, Scene, Moment } from '../../shared/model'
import { readRow, writeRow } from '../persistence'
import { roleOf } from '../scene-model'
import { prepareCreativeBrief } from './brief'
import { prepareCreativeTreatment } from './treatment'
import { prepareCreativeScript } from './script'
import type { SceneTreatmentV1 } from './scene-treatment'
import type { CreativeSelection } from './stage'
export type CreativeSceneRecord = {
  id: string
  projectId: string
  sceneId: string
  inputKey: string
  selection: CreativeSelection
  treatment: SceneTreatmentV1
  moments: Moment[]
  createdAt: string
}
export const planCreativeScene = async (
  project: Project,
  scene: Scene,
  selection: CreativeSelection,
  origin: string,
  onProgress?: SceneProgressReporter
): Promise<CreativeSceneRecord> => {
  const previous = await readRow<CreativeSceneRecord>(
    'creative-scenes',
    scene.id
  )
  if (previous && previous.inputKey === scene.planKey) return previous
  const video = project.video!
  const index = project.slides.findIndex((slide) => slide.id === scene.slideId),
    slide = project.slides[index]
  if (!slide || !video) throw new Error('Scene has no retained presentation')
  await onProgress?.('Preparing the scene artwork', 'artwork')
  const cast = await prepareCastPacket(project, slide.id)
  await onProgress?.('Preparing the video brief', 'brief')
  const brief = await prepareCreativeBrief(project, selection, origin)
  const units =
    brief.coverage.find((item) => item.scene === slide.id)?.units || []
  const adjacent = video.scenes.flatMap((other, position) =>
    Math.abs(position - index) === 1
      ? [
          {
            position:
              position < index ? ('before' as const) : ('after' as const),
            id: other.id,
            title: project.slides[position].title,
            units:
              brief.coverage.find((item) => item.scene === other.slideId)
                ?.units || [],
            takeaway: null
          }
        ]
      : []
  )
  const neighbors = adjacent.map((other) => ({
    position: other.position,
    scene: other.id,
    reviewed: null
  }))
  // With a narrative, the direction gives the scene its presence, and the
  // orchestrator its shot, its seams and the cast so far.
  const presence = scenePresence(video, scene.id)
  const shape = sceneNarrative(video, scene.id, plannedPages(project))
  const story = shape ? narrativeBrief(shape, presence) : null
  const orchestration = await sceneOrchestration(project, scene.id)
  const retained = await readRow<{ text: string }>('sources', project.id)
  await onProgress?.('Planning the scene', 'planning')
  const treatment = await prepareCreativeTreatment({
    projectId: project.id,
    selection,
    origin,
    editMomentId: scene.editMomentId,
    role: roleOf(index, project.slides.length),
    context: {
      brief,
      scene: scene.id,
      originScenes: [slide.id],
      videoScenes: video.scenes.map((item) => item.id),
      delivery: video.settings.voice.kind === 'record' ? 'human' : 'generated',
      presence,
      intro: index === 0 ? { title: project.title } : null,
      assetKeys: cast.assetKeys,
      neighbors,
      // Absent without a narrative, so those plans keep their fingerprint.
      ...(story ? { story } : {}),
      ...(orchestration
        ? {
            shot: orchestration.shot,
            castSize: orchestration.cast.length
          }
        : {}),
      ...(orchestration ? { shot: orchestration.shot } : {})
    },
    scenePacket: {
      videoTitle: project.title,
      scene: {
        id: scene.id,
        title: slide.title,
        index,
        originScenes: [slide.id]
      },
      presentation: [
        {
          scene: slide.id,
          title: slide.title,
          objective: slide.idea || '',
          layoutGuidance:
            'Presentation reference only. Restage the explanation for video.',
          narration: slide.narration || '',
          sourcePassages: slide.evidence || [],
          ...(slide.answers?.length
            ? {
                creatorEvidence: slide.answers.map(
                  (item) => `${item.what}: ${item.answer}`
                )
              }
            : {}),
          wireframe: null
        }
      ],
      script: '',
      units,
      adjacent,
      direction: {
        video:
          'Explain the retained source with deliberate visual development.',
        scene: JSON.stringify(scene.instructions || [])
      },
      delivery: video.settings.voice.kind === 'record' ? 'human' : 'generated',
      presence: { value: presence, from: scene.presence ? 'scene' : 'video' },
      intro: index === 0,
      ...(story ? { story } : {}),
      reviewed: previous?.treatment || null,
      assets: cast.assets
    },
    theme: { branding: project.branding || null },
    visualCast: cast.visualCast,
    media: cast.media,
    orchestration
  })
  await onProgress?.('Writing the spoken lines', 'script')
  const moments = await prepareCreativeScript({
    projectId: project.id,
    plan: treatment,
    brief,
    presence,
    role: roleOf(index, project.slides.length),
    videoTitle: project.title,
    sourceText: retained?.text || project.source,
    previous: scene.moments,
    instructions: scene.instructions || [],
    editMomentId: scene.editMomentId,
    selection,
    origin
  })
  const record: CreativeSceneRecord = {
    id: randomUUID(),
    projectId: project.id,
    sceneId: scene.id,
    inputKey: scene.planKey!,
    selection,
    treatment,
    moments,
    createdAt: new Date().toISOString()
  }
  await writeRow('creative-scenes', scene.id, record)
  return record
}
