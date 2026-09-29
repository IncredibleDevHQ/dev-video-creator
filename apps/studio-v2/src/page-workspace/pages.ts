// The pages of a wireframe or a presentation, as the page view shows them
// (the one stage layout): each page's picture, what it explains, its notes,
// the source it rests on and how it was made — read from the same scene
// blocks the notebook shows, never a copy of them.
import { pageIdeaOf } from '../planning/page-objective'

export type PageTone = 'good' | 'busy' | 'warn'
export type PageState = { label: string; tone: PageTone; detail: string }
export type PageEntry = {
  id: string
  index: number
  title: string
  idea: string
  notes: string[]
  passages: string[]
  state: PageState | null
}

type Block = { id: string; node: { type: string; attrs?: Record<string, unknown> | null } }

// The notes spoken over a page: its script without the video's [directions],
// one entry per paragraph — as the notebook shows them.
export const notesOf = (script: unknown) =>
  String(script || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

// How a page was made, when it says: a designed slide, a schematic draft, or
// a schematic draft waiting for its design. A design run designs a deck's
// pages, not necessarily this one at this moment, so a page waits rather
// than claims to be drawn (F03 of the component review).
export const pageStateOf = (attrs: Record<string, unknown>): PageState | null => {
  const origin = attrs.pageOrigin as { kind?: string; by?: unknown; designing?: { by?: unknown } | null } | null | undefined
  if (!origin || typeof origin !== 'object') return null
  if (origin.kind === 'designed') {
    const by = String(origin.by || '').trim()
    return { label: 'Designed', tone: 'good', detail: by ? `A designed slide, drawn by ${by}.` : 'A designed slide.' }
  }
  if (origin.kind === 'schematic') {
    if (origin.designing) {
      const by = String(origin.designing.by || '').trim()
      return { label: 'Waiting for its design', tone: 'busy', detail: `${by || 'The designer'} is designing this presentation's pages. This one shows here when its design lands; its wireframe stands in until then.` }
    }
    return { label: 'Schematic draft', tone: 'warn', detail: 'An instant schematic layout, not the designed presentation page.' }
  }
  return null
}

// A wireframe's pages are schematic by what a wireframe is, so it does not
// say so on each of them (as its notebook does not).
export const pagesOf = (blocks: Block[], { wireframe = false } = {}): PageEntry[] =>
  blocks
    .filter(block => block.node.type === 'scene')
    .map((block, index) => {
      const attrs = (block.node.attrs || {}) as Record<string, unknown>
      return {
        id: block.id,
        index,
        title: String(attrs.title || '').trim() || `Page ${index + 1}`,
        idea: pageIdeaOf(attrs, undefined),
        notes: notesOf(attrs.script),
        passages: (Array.isArray(attrs.sourcePassages) ? attrs.sourcePassages : []).map(String).filter(passage => passage.trim()),
        state: wireframe && (attrs.pageOrigin as { kind?: string } | null | undefined)?.kind === 'schematic' ? null : pageStateOf(attrs),
      }
    })

// The wheel or a trackpad over the stage turns one page per gesture: past a
// small threshold it turns, and not again until the gesture has rested — so
// a flick's momentum never runs through the deck.
export const createWheelPager = ({ threshold = 12, restMs = 90 } = {}) => {
  let travelled = 0
  let lastAt = Number.NEGATIVE_INFINITY
  let turned = false
  return (deltaY: number, deltaX: number, now: number): -1 | 0 | 1 => {
    if (Math.abs(deltaY) <= Math.abs(deltaX)) return 0
    if (now - lastAt > restMs) {
      travelled = 0
      turned = false
    }
    lastAt = now
    if (turned) return 0
    travelled += deltaY
    if (Math.abs(travelled) < threshold) return 0
    turned = true
    return travelled > 0 ? 1 : -1
  }
}
