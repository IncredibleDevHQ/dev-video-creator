import { createHash } from 'node:crypto'
import type { ResearchNode } from '../shared/research'
import type { EngineTool } from './harness/submissions'

export const CONTEXT_POLICY = 'ancestor-context-v1'
/** Conservative estimate for planning, not provider-reported token usage. */
export const contextTokens = (text: string) =>
  Math.ceil(Buffer.byteLength(text, 'utf8') / 3)
export const contextTurn = (n: ResearchNode) => ({
  id: n.id,
  question: n.question,
  answer: n.answer
})
export const contextDigest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const splitContext = (history: ResearchNode[], continued: boolean) => {
  if (continued) return { recent: [], older: [] }
  const recent: ResearchNode[] = []
  let tokens = 0
  for (const turn of [...history].reverse()) {
    const size = contextTokens(JSON.stringify(contextTurn(turn)))
    if (tokens + size > 6000 || recent.length === 8) break
    tokens += size
    recent.unshift(turn)
  }
  return { recent, older: history.slice(0, history.length - recent.length) }
}
/** Closure over the immutable authorized ancestor path, never all project nodes. */
export const researchContextTools = (history: ResearchNode[]): EngineTool[] => [
  {
    name: 'research_read_ancestor',
    description:
      'Retrieve original ancestor evidence by turn ID and character range. Without an ID, list ancestor turns, oldest first. Siblings and later parent replies are inaccessible.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        offset: { type: 'integer', minimum: 0 },
        limit: { type: 'integer', minimum: 1, maximum: 12000 }
      },
      additionalProperties: false
    },
    call: async (args) => {
      const offset = Math.max(0, Math.floor(Number(args.offset) || 0))
      if (!args.id)
        return {
          turns: history
            .slice(offset, offset + 30)
            .map((n) => ({ id: n.id, question: n.question.slice(0, 160) })),
          nextOffset: offset + 30 < history.length ? offset + 30 : null
        }
      const node = history.find((n) => n.id === args.id)
      if (!node)
        throw new Error('This turn is outside the authorized ancestor path')
      const text = JSON.stringify(contextTurn(node))
      const limit = Math.max(
        1,
        Math.min(12000, Math.floor(Number(args.limit) || 6000))
      )
      return {
        id: node.id,
        provenance: { repos: node.repos, selection: node.anchor || null },
        offset,
        text: text.slice(offset, offset + limit),
        totalCharacters: text.length,
        nextOffset: offset + limit < text.length ? offset + limit : null
      }
    }
  }
]
export const researchContextPacket = (
  node: ResearchNode,
  history: ResearchNode[],
  continued: boolean,
  summary: string,
  recent: ResearchNode[]
) => {
  const packet = {
    'packet/QUESTION.json': JSON.stringify({
      question: node.question,
      selection: node.anchor || null
    }),
    'packet/CONVERSATION.json': JSON.stringify(recent.map(contextTurn)),
    'packet/CONTEXT.json': JSON.stringify({
      policy: CONTEXT_POLICY,
      mode: continued ? 'session-delta' : 'ancestor-seed',
      summary: summary || null,
      ancestorCount: history.length,
      recentTurnIds: recent.map((n) => n.id),
      source:
        'Use research_read_ancestor to retrieve original evidence. Summaries are navigation aids, not replacement evidence. No sibling branches or implicit notebook context.'
    }),
    'packet/REPOSITORIES.json': JSON.stringify(
      continued
        ? []
        : node.repos.map((repo, i) => ({
            ...repo,
            toolsPrefix: `context_${i + 1}_`
          }))
    ),
    'packet/NOTEBOOKS.json': '[]'
  }
  return {
    packet,
    contextInfo: {
      policy: CONTEXT_POLICY,
      mode: continued ? ('session-delta' as const) : ('ancestor-seed' as const),
      ancestorIds: history.map((n) => n.id),
      recentIds: recent.map((n) => n.id),
      summarizedTurns: continued ? 0 : history.length - recent.length,
      estimatedTokens: contextTokens(Object.values(packet).join('\n')),
      digest: contextDigest(history.map(contextTurn))
    }
  }
}
