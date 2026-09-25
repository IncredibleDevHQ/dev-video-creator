// The preview hand-off (U4 of the scene workspace plan). A requested preview
// is remembered as an explicit intent — which project, scene, plan revision
// and preview job, and which stage choice the creator had made when asking.
// When the job ends, the stage takes the preview only if all of these still
// hold; otherwise the preview is offered, or waits for its scene, or is kept
// only as history. Nothing here plays, loads or navigates: it decides.
//
// The creator's explicit stage choices are kept per scene with a generation
// that every choice advances, so a completion can tell whether the creator
// chose another view since asking. Both are local preferences: the preview
// job itself is a durable planning record, never recovered from here.

export type StageView = 'reference' | 'schematic' | 'base' | 'preview' | 'output'
export type PreviewWait = {
  projectId: string
  sceneId: string
  // The plan revision the preview is of, its number, and the preview job.
  planRecordId: string
  revision: number
  previewJobId: string
  // The scene's stage-choice generation when the preview was asked for.
  generation: number
  // A completion that found the creator recording or playing: offered, not loaded.
  interrupted?: boolean
}
// What became of the job: still building, ready (and whether it is still
// what the plan asks for), failed, or gone (superseded, cancelled, replaced).
export type PreviewJob = { status: 'building' } | { status: 'ready'; current: boolean } | { status: 'failed' } | { status: 'gone' }
export type StageNow = {
  projectId: string
  selectedScene: string
  // The plan revision the creator is looking at in that scene.
  shownPlanRecord: string
  // The scene's stage-choice generation now.
  generation: number
  // Recording, or another playback going on.
  busy: boolean
}
// load: the stage takes it now. offer: it waits under the stage with a way
// to play it. elsewhere: another scene is on show — its scene says it is
// ready, and it loads when the creator comes back to it. hold: the creator
// is recording or playing — keep going, and say so after. wait: not done.
// drop: failed, out of date or replaced — history only.
export type HandOff = 'load' | 'offer' | 'elsewhere' | 'hold' | 'wait' | 'drop'

export const handOffFor = (wait: PreviewWait, job: PreviewJob, now: StageNow): HandOff => {
  if (job.status === 'building') return 'wait'
  if (job.status !== 'ready' || !job.current) return 'drop'
  if (now.projectId !== wait.projectId) return 'wait'
  if (now.selectedScene !== wait.sceneId) return 'elsewhere'
  if (now.busy) return 'hold'
  if (wait.interrupted || now.shownPlanRecord !== wait.planRecordId || now.generation !== wait.generation) return 'offer'
  return 'load'
}

type Saved = { waits: Record<string, PreviewWait>; chosen: Record<string, { view: StageView; generation: number }> }
type Store = Pick<Storage, 'getItem' | 'setItem'>
const KEY = 'incredible-studio-v2-stage-'

// The creator's stage choices and waiting previews, per project.
export const createStageChoices = (storage: () => Store | null, projectId: () => string) => {
  const read = (): Saved => {
    try {
      const raw = storage()?.getItem(`${KEY}${projectId()}`)
      const parsed = raw ? (JSON.parse(raw) as Partial<Saved>) : {}
      return { waits: parsed.waits || {}, chosen: parsed.chosen || {} }
    } catch {
      return { waits: {}, chosen: {} }
    }
  }
  const write = (saved: Saved) => {
    try {
      storage()?.setItem(`${KEY}${projectId()}`, JSON.stringify(saved))
    } catch {
      // Kept for this session only.
    }
  }
  return {
    generation: (sceneId: string) => read().chosen[sceneId]?.generation ?? 0,
    chosen: (sceneId: string): StageView | null => read().chosen[sceneId]?.view ?? null,
    // An explicit choice of what the stage shows for a scene.
    choose: (sceneId: string, view: StageView) => {
      const saved = read()
      saved.chosen[sceneId] = { view, generation: (saved.chosen[sceneId]?.generation ?? 0) + 1 }
      write(saved)
    },
    // A preview asked for replaces any the scene was waiting for.
    wait: (wait: PreviewWait) => {
      const saved = read()
      saved.waits[wait.sceneId] = wait
      write(saved)
    },
    waiting: (sceneId: string): PreviewWait | null => read().waits[sceneId] ?? null,
    waits: (): PreviewWait[] => Object.values(read().waits).filter(wait => wait.projectId === projectId()),
    update: (sceneId: string, change: Partial<PreviewWait>) => {
      const saved = read()
      if (!saved.waits[sceneId]) return
      saved.waits[sceneId] = { ...saved.waits[sceneId], ...change }
      write(saved)
    },
    clear: (sceneId: string) => {
      const saved = read()
      if (!saved.waits[sceneId]) return
      delete saved.waits[sceneId]
      write(saved)
    },
  }
}

// What a scene's stage opens on when the creator has not chosen: the scene
// produced from the revision on show, else its preview, else the reference —
// only ones that are still what the plan asks for.
export const defaultStageView = (available: { produced: boolean; preview: boolean }): StageView =>
  available.produced ? 'output' : available.preview ? 'preview' : 'reference'
