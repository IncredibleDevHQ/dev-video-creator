import type { ResearchNode } from './research'

/** Research documents are generated artifacts, separate from curated notebooks.
 * Legacy histories expose their roots and selected-passage branches as documents. */
export const isResearchDocument = (node: ResearchNode) =>
  node.artifact !== false &&
  (Boolean(node.artifact) || !node.parentId || Boolean(node.anchor))
export const researchDocumentFor = (
  nodes: ResearchNode[],
  id: string | null
): ResearchNode | undefined => {
  const seen = new Set<string>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const node = nodes.find((n) => n.id === id)
    if (!node) return
    if (isResearchDocument(node)) return node
    id = node.contextDocumentId || node.parentId
  }
}
export const researchDocumentGraph = (nodes: ResearchNode[]) =>
  nodes.filter(isResearchDocument).map((node) => ({
    ...node,
    parentId: node.artifact
      ? node.artifact.parentId
      : researchDocumentFor(nodes, node.parentId)?.id || null
  }))
