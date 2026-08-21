import type { ProjectDocumentV1, TiptapNode } from './types'

// A comfortable on-camera speaking pace.
export const SPOKEN_WORDS_PER_MINUTE = 140

const nodeText = (node: TiptapNode): string =>
  node.type === 'text'
    ? node.text || ''
    : (node.content || []).map(nodeText).join(' ').replace(/\s+/g, ' ').trim()

export const estimateSpokenSeconds = (notes: string): number => {
  const words = notes.trim().split(/\s+/).filter(Boolean).length
  return Math.round((words / SPOKEN_WORDS_PER_MINUTE) * 60)
}

const listItems = (node: TiptapNode): string[] =>
  (node.content || [])
    .filter(child => child.type === 'listItem')
    .map(nodeText)
    .filter(Boolean)

const codeLines = (node: TiptapNode): string[] =>
  nodeText(node)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

/**
 * Keyless fallback for /api/notes: builds a structured speaking scaffold from
 * the block's own content plus the surrounding notebook. It never invents
 * facts — deeper targets add more elaboration prompts per point.
 */
export const generateSpeakerNotes = (
  project: ProjectDocumentV1,
  blockId: string,
  targetMinutes: number,
): string => {
  const nodes = project.notebook.content
  const index = nodes.findIndex(node => node.attrs?.id === blockId)
  if (index === -1) throw new Error('The block to narrate no longer exists')
  const node = nodes[index]
  const minutes = Math.min(15, Math.max(0.5, targetMinutes || 1))
  const deep = minutes >= 2
  const previous = index > 0 ? nodeText(nodes[index - 1]).slice(0, 90) : ''
  const next =
    index < nodes.length - 1 ? nodeText(nodes[index + 1]).slice(0, 90) : ''
  const lines: string[] = []

  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const points = listItems(node)
    lines.push(
      `Open by framing why these ${points.length} points matter in "${project.title}".`,
    )
    points.forEach((point, pointIndex) => {
      lines.push(`Point ${pointIndex + 1} — reveal, then say: ${point}.`)
      lines.push('  Back it with one concrete example from your own work.')
      if (deep) {
        lines.push('  Name the mistake people make when they skip this.')
      }
    })
  } else if (node.type === 'codeBlock') {
    const code = codeLines(node)
    lines.push('Set the scene: what problem is this code about to solve?')
    code.forEach((line, lineIndex) => {
      lines.push(`Line ${lineIndex + 1} — reveal and explain: ${line}`)
      if (deep) lines.push('  Say what would break if this line were missing.')
    })
    lines.push('Close with where this code runs in the real project.')
  } else {
    const text = nodeText(node)
    lines.push(`Deliver the idea in your own words: ${text || 'this block'}.`)
    lines.push('Give one story or example that makes it concrete.')
    if (deep) {
      lines.push('Contrast it with the obvious-but-wrong alternative.')
      lines.push('Spell out what the viewer should do differently tomorrow.')
    }
  }

  if (previous) lines.push(`Link back: this builds on “${previous}”.`)
  if (next) lines.push(`Hand off: tease what comes next — “${next}”.`)
  lines.push(
    `Pace for about ${minutes} minute${minutes === 1 ? '' : 's'} (~${Math.round(minutes * SPOKEN_WORDS_PER_MINUTE)} words).`,
  )
  return lines.join('\n')
}
