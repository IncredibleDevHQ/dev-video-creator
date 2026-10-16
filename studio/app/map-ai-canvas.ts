// The content map as Studio AI reads it: plain text with a short id for
// each thing it can point at or change (c3 for a card, e2 for an episode,
// d1 a direction, g1 a gap, k1 a comment). An id, once given, stays with
// its thing for the whole call, so what the AI saw is what it acts on.
import type { Snapshot } from '../shared/api'
import type { MapView } from '../shared/content-map'
import type { CommentTarget } from '../shared/voice'

export type AliasKind = 'c' | 'e' | 'd' | 'g' | 'k'
const KIND_OF: Record<AliasKind, string> = {
  c: 'card',
  e: 'episode',
  d: 'direction',
  g: 'gap',
  k: 'comment'
}

export class Aliases {
  private byId = new Map<string, string>()
  private byAlias = new Map<string, { kind: AliasKind; id: string }>()
  private counts: Record<string, number> = {}
  /** The short id of a thing, given on first sight. */
  of(kind: AliasKind, id: string) {
    const key = `${kind}:${id}`
    let alias = this.byId.get(key)
    if (!alias) {
      alias = `${kind}${(this.counts[kind] = (this.counts[kind] || 0) + 1)}`
      this.byId.set(key, alias)
      this.byAlias.set(alias, { kind, id })
    }
    return alias
  }
  /** The thing a short id stands for, of the kind asked for. */
  find(alias: unknown, kind?: AliasKind) {
    const found = this.byAlias.get(
      String(alias ?? '')
        .trim()
        .toLowerCase()
    )
    return found && (!kind || found.kind === kind) ? found : null
  }
  /** As find, but says what is wrong when it is not there. */
  need(alias: unknown, kind: AliasKind) {
    const found = this.find(alias, kind)
    if (!found)
      throw new Error(
        `There is no ${KIND_OF[kind]} ${String(alias ?? '') || '(none given)'} on the canvas`
      )
    return found.id
  }
}

const quote = (text: string, limit = 140) => {
  const line = text.replace(/\s+/g, ' ').trim()
  return `“${line.length > limit ? `${line.slice(0, limit - 1)}…` : line}”`
}

/** What a comment is pinned to, in words. */
export const targetWords = (
  target: CommentTarget,
  snapshot: Snapshot | null,
  view: MapView | null
) => {
  if (target.kind === 'series') return 'the series'
  if (target.kind === 'spot') return 'the canvas'
  const id = target.id
  if (target.kind === 'page') {
    const page = snapshot?.project.slides.find((slide) => slide.id === id)
    return page ? `card ${quote(page.title, 60)}` : 'a card'
  }
  if (target.kind === 'lane') {
    const episode = view?.episodes.find((e) => e.notebook === id)
    return episode
      ? `Ep ${episode.number} ${quote(episode.title, 60)}`
      : 'an episode'
  }
  if (target.kind === 'copy') {
    const episode = view?.episodes.find((e) =>
      e.copies.some((c) => c.id === id)
    )
    const copy = episode?.copies.find((c) => c.id === id)
    return copy && episode
      ? `${quote(copy.title, 60)} in Ep ${episode.number}`
      : 'a page of an episode'
  }
  if (target.kind === 'direction') {
    const direction = view?.series?.directions.find((d) => d.id === id)
    return direction
      ? `the direction ${quote(direction.text, 60)}`
      : 'a direction'
  }
  const gap = view?.series?.gaps.find((g) => g.id === id)
  return gap ? `the gap ${quote(gap.missing, 60)}` : 'a gap'
}

/** The canvas as text, for Studio AI's instructions. */
export const canvasText = (
  snapshot: Snapshot | null,
  view: MapView | null,
  aliases: Aliases,
  selected = ''
) => {
  if (!snapshot) return 'The map is loading.'
  const lines: string[] = []
  const pages = snapshot.project.slides
  const episodes = view?.episodes || []
  const number = (notebook: string) =>
    episodes.find((e) => e.notebook === notebook)?.number
  lines.push(
    `Map ${quote(snapshot.project.title, 80)}: ${pages.length} card${pages.length === 1 ? '' : 's'}${snapshot.status === 'ready' ? '' : ` (still being drawn: ${snapshot.status})`}.`
  )
  if (pages.length) lines.push('', 'Cards:')
  for (const page of pages) {
    const used = (view?.usage[page.id] || [])
      .map((ep) => `Ep ${number(ep)}`)
      .join(', ')
    lines.push(
      `${aliases.of('c', page.id)} ${quote(page.title, 90)}${used ? ` — in ${used}` : page.aside ? ' — set aside' : view?.series ? ' — unused' : ''}${page.fromNote ? ' (from a note)' : ''}`
    )
  }
  const series = view?.series
  if (!series) {
    lines.push('', 'No series yet: plan_series starts one from the cards.')
    return lines.join('\n')
  }
  lines.push('', `Series ${quote(series.title, 80)}.`)
  const brief = (key: 'outcome' | 'audience', label: string) =>
    lines.push(
      `${label}: ${series[key] ? `${quote(series[key]!, 200)}${series.suggested?.includes(key) ? ' (suggested by the plan)' : ''}` : 'not set'}`
    )
  brief('outcome', 'By the end a viewer can')
  brief('audience', 'For')
  if (series.planning?.state === 'planning') lines.push('Planning now.')
  if (series.organizing?.state === 'organizing')
    lines.push('Organising new cards now.')
  lines.push(
    `New cards ${series.organize ? 'organise themselves into the episodes' : 'wait to be placed'}.`
  )
  if (series.organized)
    lines.push(
      `The last organising run placed ${series.organized.moves.filter((m) => m.kind !== 'left').length} card(s); undo_organize takes them out.`
    )
  lines.push('', episodes.length ? 'Episodes, in order:' : 'No episodes yet.')
  for (const episode of episodes) {
    const cards = episode.copies
      .map((copy) =>
        copy.copyOf?.slide
          ? `${aliases.of('c', copy.copyOf.slide)} ${quote(copy.title, 50)}`
          : quote(copy.title, 50)
      )
      .join(', ')
    lines.push(
      `${aliases.of('e', episode.notebook)} = Ep ${episode.number} ${quote(episode.title, 80)}${episode.made ? ' (video started: the plan keeps it)' : ''}${episode.picking?.state === 'picking' ? ' (picking its cards)' : ''}`
    )
    if (episode.outline?.win)
      lines.push(`  A viewer can then: ${quote(episode.outline.win, 160)}`)
    lines.push(`  Cards: ${cards || 'none yet'}`)
  }
  const directions = series.directions
  if (directions.length) lines.push('', 'Directions:')
  for (const direction of directions) {
    const to = direction.to
    const guides = to?.episode
      ? `Ep ${number(to.episode)}`
      : to?.pages?.length
        ? to.pages.map((page) => aliases.of('c', page)).join(', ')
        : 'the whole series'
    lines.push(
      `${aliases.of('d', direction.id)} ${quote(direction.text, 200)} — guides ${guides}${direction.answer ? `; the last plan ${direction.answer.state === 'followed' ? 'followed it' : direction.answer.state === 'partly' ? 'partly followed it' : 'did not follow it'}: ${quote(direction.answer.why, 120)}` : ''}`
    )
  }
  const gaps = series.gaps.filter((gap) => gap.state === 'open')
  if (gaps.length) lines.push('', 'Open gaps:')
  for (const gap of gaps)
    lines.push(
      `${aliases.of('g', gap.id)} missing ${quote(gap.missing, 120)}${gap.episode ? ` in Ep ${number(gap.episode)}` : ''}: ${quote(gap.why, 140)}`
    )
  const comments = (view?.comments || []).filter((c) => c.state === 'open')
  if (comments.length) lines.push('', 'Open comments:')
  for (const comment of comments)
    lines.push(
      `${aliases.of('k', comment.id)} on ${targetWords(comment.target, snapshot, view)}, by ${comment.by === 'ai' ? 'you' : 'the creator'}: ${comment.text ? quote(comment.text, 200) : '(a recording not yet written down)'}${comment.kind ? ` [${comment.kind}]` : ''}${comment.replies.length ? ` · ${comment.replies.length} repl${comment.replies.length === 1 ? 'y' : 'ies'}, last: ${quote(comment.replies.at(-1)!.text, 100)}` : ''}`
    )
  if (selected) lines.push('', `The creator has selected ${selected}.`)
  return lines.join('\n')
}

/** Why a change was held, for the creator: their words are in the
 * caption above, so the reason starts from how Jev heard them. */
export const heldWords = (why: string) =>
  why.replace(/^Jev read “.*?” as /s, 'Heard as ').split(/\. /)[0]
