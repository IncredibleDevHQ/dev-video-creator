import { CONTEXT_POLICY, contextTokens, contextTurn } from './research-context'
import { createHash, randomUUID } from 'node:crypto'
import type { ResearchNode } from '../shared/research'
import type { EngineRun } from './harness/runtime'
import { readRow, writeRow, withOperationLock } from './persistence'
type Session = {
  projectId: string
  chatId: string
  sessionKey?: string
  workspaceId: string
  context: string
  lastNodeId: string | null
  pendingNodeId?: string
  resumeId?: string
  startedAfterId?: string | null
}
const table = 'research-agent-sessions'
const sessionKey = (projectId: string, node: ResearchNode) =>
  createHash('sha256')
    .update(
      JSON.stringify([
        projectId,
        node.chatId,
        node.conversationId || node.contextDocumentId || 'legacy'
      ])
    )
    .digest('hex')
export const researchSessionContext = (node: ResearchNode) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        policy: CONTEXT_POLICY,
        harness: {
          adapter: node.harness.adapter,
          ...(node.harness.model ? { model: node.harness.model } : {}),
          ...(node.harness.label ? { label: node.harness.label } : {})
        },
        repos: node.repos
      })
    )
    .digest('hex')
/** A native session is linear. A sibling question or changed context gets a
 * fresh native session seeded with only the selected branch's ancestor packet. */
export const researchSessionPlan = (
  projectId: string,
  node: ResearchNode,
  previous: Session | null,
  history: ResearchNode[] = []
) => {
  const context = researchSessionContext(node)
  const boundary = history.findIndex((n) => n.id === previous?.startedAfterId)
  const sinceStart = history.slice(boundary + 1)
  const needsCheckpoint =
    contextTokens(JSON.stringify(sinceStart.map(contextTurn))) > 12000
  const continued = Boolean(
    !needsCheckpoint &&
    !node.anchor &&
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
    sessionKey: sessionKey(projectId, node),
    context,
    workspaceId: continued ? previous!.workspaceId : randomUUID(),
    ...(continued ? { resumeId: previous!.resumeId } : {}),
    startedAfterId: continued ? previous!.startedAfterId : node.parentId,
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
  node: ResearchNode,
  history: ResearchNode[] = []
) =>
  withOperationLock(
    `research-session:${projectId}:${node.chatId}`,
    async () => {
      const key = sessionKey(projectId, node)
      const previous = await readRow<Session>(table, key)
      const plan = researchSessionPlan(projectId, node, previous, history)
      // A failed or stopped native turn may already have advanced its history.
      // Invalidate the cursor before launching; only an accepted turn restores it.
      await writeRow(table, key, {
        ...plan,
        pendingNodeId: node.id,
        resumeId: undefined
      })
      return plan
    }
  )
export const finishResearchSession = async (
  plan: ReturnType<typeof researchSessionPlan>,
  nodeId: string,
  run: EngineRun
) => {
  if (run.status !== 'done' || !run.resumeId) return
  await withOperationLock(
    `research-session:${plan.projectId}:${plan.chatId}`,
    async () => {
      const current = await readRow<Session>(table, plan.sessionKey)
      if (
        current?.pendingNodeId !== nodeId ||
        current.workspaceId !== plan.workspaceId
      )
        return
      await writeRow(table, plan.sessionKey, {
        ...plan,
        lastNodeId: nodeId,
        resumeId: run.resumeId
      })
    }
  )
}
