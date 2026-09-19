// The scene-by-scene coach (D6): where the recording journey stands for a
// notebook — which scenes have an accepted take, which is next — and each
// scene's recording brief, persisted with the director's plan. The coach
// reads records, never guesses: a scene is done when it has an accepted
// take, and the journey resumes at the first unfinished scene.
import type { ProjectDocumentV1 } from 'markdown-composition'

export type CoachBrief = {
  objective?: string
  next?: string
  shots?: Array<{ id: string; view?: string; look: string; record: string }>
}

export type CoachScene = {
  id: string
  index: number
  title: string
  recorded: boolean
  brief?: CoachBrief
}

export const coachStateFor = (project: ProjectDocumentV1): { scenes: CoachScene[]; done: number; total: number; nextId: string | null } => {
  const scenes = (project.notebook?.content || [])
    .filter(node => (node.type === 'scene' || node.type === 'slide') && typeof node.attrs?.id === 'string' && node.attrs.id)
    .map((node, index) => {
      const id = String(node.attrs!.id)
      const brief = (node.attrs?.directorAuto as { recordingBrief?: CoachBrief } | undefined)?.recordingBrief
      return {
        id,
        index,
        title: String(node.attrs?.title || `Scene ${index + 1}`),
        recorded: Boolean(project.recordedBlocks?.[id]),
        ...(brief ? { brief } : {}),
      }
    })
  return {
    scenes,
    done: scenes.filter(scene => scene.recorded).length,
    total: scenes.length,
    nextId: scenes.find(scene => !scene.recorded)?.id || null,
  }
}
