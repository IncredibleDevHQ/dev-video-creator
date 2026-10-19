import type { ResearchNode } from '../shared/research'
import { readRow, writeRow, withOperationLock } from './persistence'
import { runValidatedJsonStage } from './creative/stage'
import {
  CONTEXT_POLICY,
  contextDigest,
  contextTokens,
  contextTurn
} from './research-context'

/** Cache immutable prefix checkpoints. Originals remain available through scoped retrieval. */
export const summarizeResearchAncestors = async (
  history: ResearchNode[],
  node: ResearchNode,
  notebookId: string,
  origin: string
) => {
  let summary = ''
  let previousKey = CONTEXT_POLICY
  const source = history.map((n) => JSON.stringify(contextTurn(n))).join('\n')
  const spans = history.map((n) => ({
    id: n.id,
    length: JSON.stringify(contextTurn(n)).length + 1
  }))
  for (let offset = 0; offset < source.length; offset += 9000) {
    const chunk = source.slice(offset, offset + 9000)
    let cursor = 0
    const sourceTurnIds = spans
      .filter((span) => {
        const start = cursor
        cursor += span.length
        return start < offset + chunk.length && cursor > offset
      })
      .map((span) => span.id)
    const key = contextDigest([previousKey, offset, chunk])
    const previous = summary
    summary = await withOperationLock(`research-summary:${key}`, async () => {
      const saved = await readRow<{ summary: string }>(
        'research-context-summaries',
        key
      )
      if (saved) return saved.summary
      const result = await runValidatedJsonStage<{ summary: string }>({
        projectId: notebookId,
        sceneId: node.id,
        inputKey: key,
        checkpoint: 'research-context-summary',
        stage: 'story',
        route: 'Research Context Summary',
        operation: 'research',
        file: 'story/context-summary.json',
        tool: 'story_submit_context_summary',
        selection: node.harness,
        origin,
        skillFiles: ['SKILL.md', 'workflows/research-context-summary.md'],
        packet: {
          'packet/SUMMARY_INPUT.json': JSON.stringify({
            previousSummary: previous,
            sourceTurnIds,
            offset,
            continuedChunk: offset > 0,
            sourceChunk: chunk
          })
        },
        validate: (raw) => {
          const value = (raw as { summary?: unknown })?.summary
          const ok =
            typeof value === 'string' &&
            value.trim().length > 0 &&
            contextTokens(value) <= 2500
          return {
            ok,
            value: { summary: typeof value === 'string' ? value : '' },
            problems: ok
              ? []
              : [
                  'Return a nonempty summary no larger than 2500 estimated tokens. Preserve source IDs and uncertainties.'
                ],
            warnings: []
          }
        }
      })
      await writeRow('research-context-summaries', key, {
        summary: result.summary,
        notebookId,
        sourceTurnIds,
        previousKey,
        offset,
        policy: CONTEXT_POLICY
      })
      return result.summary
    })
    previousKey = key
  }
  return summary
}
