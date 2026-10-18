import { createHash, randomUUID } from 'node:crypto'
import type { ResearchNode } from '../shared/research'
import type { EngineRun } from './harness/runtime'
import { readRow, writeRow, withOperationLock } from './persistence'
type Session = {
  projectId: string
  chatId: string
  workspaceId: string
  context: string
  lastNodeId: string | null
  pendingNodeId?: string
  resumeId?: string
}
const table = 'research-agent-sessions'
export const researchSessionContext = (node: ResearchNode) =>
  createHash('sha256')
    .update(JSON.stringify({ harness: node.harness, repos: node.repos }))
    .digest('hex')
/** A native session is linear. A sibling question or changed context gets a
 * fresh native session seeded with only the selected branch's ancestor packet. */
export const researchSessionPlan = (
  projectId: string,
  node: ResearchNode,
  previous: Session | null
) => {
  const context = researchSessionContext(node)
  const continued = Boolean(
    previous?.resumeId &&
    previous.projectId === projectId &&
    previous.chatId === node.chatId &&
    previous.lastNodeId === node.parentId &&
    previous.context === context &&
    node.parentId
  )
  return {
    projectId,
    chatId: node.chatId!,
    context,
    workspaceId: continued ? previous!.workspaceId : randomUUID(),
    ...(continued ? { resumeId: previous!.resumeId } : {}),
    lastNodeId: null,
    mode: continued
      ? ('continued' as const)
      : node.parentId
        ? ('branched' as const)
        : ('new' as const)
  }
}
export const prepareResearchSession = async (
  projectId: string,
  node: ResearchNode
) =>
  withOperationLock(`research-session:${node.chatId}`, async () => {
    const previous = await readRow<Session>(table, node.chatId!)
    const plan = researchSessionPlan(projectId, node, previous)
    // A failed or stopped native turn may already have advanced its history.
    // Invalidate the cursor before launching; only an accepted turn restores it.
    await writeRow(table, node.chatId!, {
      ...plan,
      pendingNodeId: node.id,
      resumeId: undefined
    })
    return plan
  })
export const finishResearchSession = async (
  plan: ReturnType<typeof researchSessionPlan>,
  nodeId: string,
  run: EngineRun
) => {
  if (run.status !== 'done' || !run.resumeId) return
  await withOperationLock(`research-session:${plan.chatId}`, async () => {
    const current = await readRow<Session>(table, plan.chatId)
    if (
      current?.pendingNodeId !== nodeId ||
      current.workspaceId !== plan.workspaceId
    )
      return
    await writeRow(table, plan.chatId, {
      ...plan,
      lastNodeId: nodeId,
      resumeId: run.resumeId
    })
  })
}
