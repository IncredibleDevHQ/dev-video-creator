import type { Snapshot } from '../shared/api'
import type { ProjectEvent } from '../shared/model'
export type ActivityLedger = {
  project: Pick<Snapshot['project'], 'id'>
  events: ProjectEvent[]
}
export const addEvent = (
  snapshot: ActivityLedger,
  kind: ProjectEvent['kind'],
  message: string,
  extras: Partial<ProjectEvent> = {}
) => {
  snapshot.events.push({
    ...extras,
    sequence: (snapshot.events.at(-1)?.sequence || 0) + 1,
    projectId: snapshot.project.id,
    time: new Date().toISOString(),
    kind,
    message
  })
}
