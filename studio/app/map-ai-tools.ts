// What Studio AI's tools do on the canvas. Each moves its cursor to what it
// works on and acts as the creator would, through the same requests the
// creator's clicks make (so Undo and the Queue treat it the same), then
// says back what happened. A missing id or a refused request comes back as
// an error the AI can say in a line.
import type { Direction } from '../shared/series'
import type { CommentTarget, ToolOutcome, VoiceToolName } from '../shared/voice'
import { api } from './api'
import { Aliases, targetWords } from './map-ai-canvas'
import { AiCursor, type Point } from './map-ai'
import type { MapCanvas } from './map-canvas'
import { mapApi } from './map-api'
import { addChoices, showAdd } from './map-flow-input'
import { DH, DW, LH, type Box } from './map-layout'

type Ctx = {
  map: MapCanvas
  cursor: AiCursor
  aliases: Aliases
  args: Record<string, unknown>
}

const words = (value: unknown, limit = 600) =>
  String(value ?? '')
    .trim()
    .slice(0, limit)
const quote = (text: string, limit = 80) =>
  `“${text.length > limit ? `${text.slice(0, limit - 1)}…` : text}”`
const corner = (box: Box): Point => ({
  x: box.x + Math.min(40, box.w / 3),
  y: box.y + Math.min(30, box.h / 3)
})
const handle = (box: Box, lane = false): Point => ({
  x: box.x + box.w,
  y: lane ? box.y + LH / 2 : box.y + box.h / 2
})

const seriesOf = (map: MapCanvas) => {
  const series = map.view?.series
  if (!series) throw new Error('There is no series yet: plan_series starts one')
  return series
}
const episodeOf = (map: MapCanvas, notebook: string) =>
  map.view?.episodes.find((e) => e.notebook === notebook)
const episodeWords = (map: MapCanvas, notebook: string) => {
  const episode = episodeOf(map, notebook)
  return episode
    ? `Ep ${episode.number} ${quote(episode.title)}`
    : 'the episode'
}
const cardTitle = (map: MapCanvas, id: string) =>
  map.snapshot?.project.slides.find((slide) => slide.id === id)?.title || ''

/** Shows the canvas as it is after a change, and says what happened. */
const done = async (map: MapCanvas, did: string): Promise<ToolOutcome> => {
  map.snapshot = await api.load(map.mapId)
  await map.refresh()
  map.toast(`Studio AI: ${did}`)
  return { ok: true, did }
}

/** Opens the Add menu where it is and picks a choice, as the creator does
 * with a double-click. Left out while the creator is typing somewhere. */
const pickFromAdd = async (ctx: Ctx, at: Point, choice: string) => {
  await ctx.cursor.glide(at)
  const before = document.activeElement as HTMLElement | null
  if (before?.closest?.('input, textarea, select')) return ctx.cursor.press()
  await ctx.cursor.press()
  const stage = ctx.map.root
    .querySelector('.map-stage')
    ?.getBoundingClientRect()
  const screen = ctx.cursor.screenOf(at)
  showAdd(
    ctx.map,
    {
      clientX: (stage?.left ?? 0) + screen.x + 8,
      clientY: (stage?.top ?? 0) + screen.y + 8
    },
    at,
    addChoices(ctx.map)
  )
  const menu = ctx.map.slot('menu')
  const option = menu?.querySelector<HTMLElement>(`[data-map="${choice}"]`)
  if (option) {
    await ctx.cursor.glideTo(option)
    option.classList.add('is-ai-pick')
    await ctx.cursor.press()
  }
  if (menu) menu.hidden = true
  // The menu took focus to be keyed; it goes back where it was.
  if (before && before !== document.body) before.focus({ preventScroll: true })
  else (document.activeElement as HTMLElement | null)?.blur?.()
}

/** A free place for a new direction, in the strip above the series. */
const directionSpot = (map: MapCanvas): Point => {
  const series = map.layout?.series
  const taken = Object.values(map.layout?.directions || {})
  const y = (series?.y ?? 120) - DH - 48
  for (let i = 0; i < 12; i++) {
    const x = (series?.x ?? 400) + 20 + i * (DW + 24)
    if (
      !taken.some((box) => Math.abs(box.x - x) < DW && Math.abs(box.y - y) < DH)
    )
      return { x, y }
  }
  return { x: (series?.x ?? 400) + 20, y: y - DH - 24 }
}

/** What a direction would guide, where it is, and what it says. */
const guideOf = (ctx: Ctx, raw: unknown, current?: Direction) => {
  const layout = ctx.map.layout
  const alias = words(raw, 40).toLowerCase()
  if (!alias || alias === 'series')
    return {
      to: null,
      box: layout?.head || layout?.series || null,
      said: 'the whole series'
    }
  const found = ctx.aliases.find(alias)
  if (found?.kind === 'e')
    return {
      to: { episode: found.id },
      box: layout?.lanes[found.id] || null,
      said: episodeWords(ctx.map, found.id)
    }
  if (found?.kind === 'c')
    return {
      to: { pages: [...new Set([...(current?.to?.pages || []), found.id])] },
      box: layout?.cards[found.id] || null,
      said: `the card ${quote(cardTitle(ctx.map, found.id))}`
    }
  throw new Error(
    `A direction guides an episode, a card or the series, not ${alias || 'nothing'}`
  )
}

/** What a comment would be pinned to, and where that is. */
const pinOf = (
  ctx: Ctx,
  raw: unknown
): { target: CommentTarget; box: Box | null } => {
  const layout = ctx.map.layout
  const alias = words(raw, 40).toLowerCase()
  if (!alias || alias === 'series')
    return {
      target: { kind: 'series' },
      box: layout?.head || layout?.series || null
    }
  const found = ctx.aliases.find(alias)
  if (!found || found.kind === 'k')
    throw new Error(`There is nothing called ${alias} to comment on`)
  const kind = ({ c: 'page', e: 'lane', d: 'direction', g: 'gap' } as const)[
    found.kind
  ]
  const box =
    found.kind === 'c'
      ? layout?.cards[found.id]
      : found.kind === 'e'
        ? layout?.lanes[found.id]
        : found.kind === 'd'
          ? layout?.directions[found.id]
          : layout?.gaps.find((gap) => gap.id === found.id)
  return { target: { kind, id: found.id }, box: box || null }
}

const look = async (ctx: Ctx): Promise<ToolOutcome> => {
  const { map, cursor, aliases } = ctx
  const layout = map.layout
  const target = words(ctx.args.target, 40).toLowerCase()
  const series = map.view?.series
  if (target === 'series' || target === 'cards' || target === 'socials') {
    const box =
      target === 'series'
        ? layout?.head || layout?.series
        : target === 'cards'
          ? layout?.map
          : layout?.socials
    if (!box) throw new Error(`There is no ${target} on the canvas yet`)
    await cursor.glide(corner(box))
    cursor.mark(
      target === 'series'
        ? 'B:series'
        : target === 'cards'
          ? 'B:map'
          : 'S:socials'
    )
    return {
      ok: true,
      did: `Pointing at the ${target}`,
      details:
        target === 'series' && series
          ? `${series.title}. ${series.through || ''}`.trim()
          : undefined
    }
  }
  const found = aliases.find(target)
  if (!found) throw new Error(`There is nothing called ${target} on the canvas`)
  if (found.kind === 'c') {
    const box = layout?.cards[found.id]
    const page = map.snapshot?.project.slides.find((s) => s.id === found.id)
    if (box) await cursor.glide(corner(box))
    cursor.mark(`m:${found.id}`)
    return {
      ok: true,
      did: `Pointing at ${quote(page?.title || 'the card')}`,
      details: [page?.idea, page?.narration?.slice(0, 700)]
        .filter(Boolean)
        .join(' · ')
    }
  }
  if (found.kind === 'e') {
    const box = layout?.lanes[found.id]
    const episode = episodeOf(map, found.id)
    if (box) await cursor.glide(corner(box))
    cursor.mark(`L:${found.id}`)
    const outline = episode?.outline
    return {
      ok: true,
      did: `Pointing at ${episodeWords(map, found.id)}`,
      details: outline
        ? `Teaches: ${outline.teaches.join('; ')}. Needs: ${outline.needs.map((n) => n.what).join('; ') || 'nothing earlier'}.`
        : undefined
    }
  }
  if (found.kind === 'd' || found.kind === 'g') {
    const box =
      found.kind === 'd'
        ? layout?.directions[found.id]
        : layout?.gaps.find((gap) => gap.id === found.id)
    if (box) await cursor.glide(corner(box))
    cursor.mark(`${found.kind}:${found.id}`)
    const gap = series?.gaps.find((g) => g.id === found.id)
    return {
      ok: true,
      did: `Pointing at the ${found.kind === 'd' ? 'direction' : 'gap'}`,
      details: gap
        ? `Missing ${gap.missing}: ${gap.why} Ask: ${gap.ask}`
        : undefined
    }
  }
  const comment = map.view?.comments?.find((c) => c.id === found.id)
  const pin = map.root.querySelector(`[data-pin="${found.id}"]`)
  if (pin) await cursor.glideTo(pin)
  return {
    ok: true,
    did: 'Pointing at the comment',
    details: comment
      ? [
          comment.text,
          ...comment.replies.map(
            (r) => `${r.by === 'ai' ? 'You' : 'Creator'}: ${r.text}`
          )
        ].join(' / ')
      : undefined
  }
}

const TOOLS: Record<VoiceToolName, (ctx: Ctx) => Promise<ToolOutcome>> = {
  look,
  async add_direction(ctx) {
    const series = seriesOf(ctx.map)
    const text = words(ctx.args.text)
    if (!text) throw new Error('Say what the direction is')
    const guide = ctx.args.guides ? guideOf(ctx, ctx.args.guides) : null
    const spot = directionSpot(ctx.map)
    ctx.cursor.doing('Adding a direction')
    await pickFromAdd(ctx, spot, 'flow-direction')
    await ctx.cursor.type(text)
    const saved = await mapApi.direction(series.id, { text, spot })
    const made = saved.directions?.at(-1)?.id || ''
    ctx.cursor.typed()
    await done(ctx.map, `Added the direction ${quote(text)}`)
    const box = made ? ctx.map.layout?.directions[made] : undefined
    if (!guide || !made || !box)
      return { ok: true, did: `Added the direction ${quote(text)}` }
    if (guide.box) await ctx.cursor.drag(handle(box), corner(guide.box))
    await mapApi.direction(series.id, { id: made, to: guide.to })
    return done(
      ctx.map,
      `Added the direction ${quote(text)}, guiding ${guide.said}`
    )
  },
  async wire_direction(ctx) {
    const series = seriesOf(ctx.map)
    const id = ctx.aliases.need(ctx.args.direction, 'd')
    const direction = series.directions.find((d) => d.id === id)
    const box = ctx.map.layout?.directions[id]
    if (!direction || !box) throw new Error('That direction is gone')
    const guide = guideOf(ctx, ctx.args.guides, direction)
    ctx.cursor.doing('Wiring a direction')
    if (guide.box) await ctx.cursor.drag(handle(box), corner(guide.box))
    await mapApi.direction(series.id, { id, to: guide.to })
    return done(ctx.map, `Wired ${quote(direction.text)} to ${guide.said}`)
  },
  async remove_direction(ctx) {
    const series = seriesOf(ctx.map)
    const id = ctx.aliases.need(ctx.args.direction, 'd')
    const direction = series.directions.find((d) => d.id === id)
    const box = ctx.map.layout?.directions[id]
    if (box) await ctx.cursor.glide(corner(box))
    ctx.cursor.mark(`d:${id}`)
    await ctx.cursor.press()
    await mapApi.removeDirection(series.id, id)
    return done(
      ctx.map,
      `Removed the direction ${quote(direction?.text || '')}`
    )
  },
  async add_note(ctx) {
    const text = words(ctx.args.text, 4000)
    if (!text) throw new Error('Say what the note holds')
    const gap = ctx.args.gap ? ctx.aliases.need(ctx.args.gap, 'g') : ''
    const map = ctx.map.layout?.map
    const gapBox = gap
      ? ctx.map.layout?.gaps.find((g) => g.id === gap)
      : undefined
    const at = gapBox
      ? corner(gapBox)
      : map
        ? { x: map.x + map.w - 60, y: map.y + 40 }
        : { x: 80, y: 80 }
    ctx.cursor.doing('Adding a note')
    await pickFromAdd(ctx, at, 'flow-note')
    await ctx.cursor.type(text)
    await mapApi.note(ctx.map.mapId, text)
    ctx.cursor.typed()
    return done(
      ctx.map,
      gap
        ? 'Added a note: it becomes a card where the gap is'
        : 'Added a note: it is being sorted into cards'
    )
  },
  async copy_card(ctx) {
    const card = ctx.aliases.need(ctx.args.card, 'c')
    const episode = ctx.aliases.need(ctx.args.episode, 'e')
    const lane = ctx.map.layout?.lanes[episode]
    const from = ctx.map.layout?.cards[card]
    const ep = episodeOf(ctx.map, episode)
    let index: number | undefined
    if (ctx.args.after) {
      const after = ctx.aliases.need(ctx.args.after, 'c')
      const at = ep?.copies.findIndex((c) => c.copyOf?.slide === after) ?? -1
      if (at < 0)
        throw new Error('That card is not in the episode to put it after')
      index = at + 1
    }
    ctx.cursor.doing('Copying a card')
    if (from && lane) {
      ctx.cursor.mark(`m:${card}`)
      await ctx.cursor.drag(handle(from), {
        x: lane.x + 40,
        y: lane.y + LH / 2
      })
      ctx.map.fly[`pending:${episode}`] ||= { x: from.x, y: from.y }
    }
    await mapApi.copies(episode, { action: 'add', slide: card, index })
    return done(
      ctx.map,
      `Copied ${quote(cardTitle(ctx.map, card))} into ${episodeWords(ctx.map, episode)}`
    )
  },
  async move_episode(ctx) {
    const series = seriesOf(ctx.map)
    const episode = ctx.aliases.need(ctx.args.episode, 'e')
    const first = words(ctx.args.after, 20).toLowerCase() === 'first'
    const after = first ? null : ctx.aliases.need(ctx.args.after, 'e')
    if (after === episode)
      throw new Error('An episode cannot come after itself')
    const lanes = ctx.map.layout?.lanes
    const moving = lanes?.[episode]
    const before = after ? lanes?.[after] : ctx.map.layout?.head
    ctx.cursor.doing('Reordering')
    if (moving && before)
      await ctx.cursor.drag(
        after ? handle(before, true) : corner(before),
        corner(moving)
      )
    await mapApi.placeAfter(series.id, episode, after)
    return done(
      ctx.map,
      after
        ? `${episodeWords(ctx.map, episode)} now comes after ${episodeWords(ctx.map, after)}`
        : `${episodeWords(ctx.map, episode)} now comes first`
    )
  },
  async new_episode(ctx) {
    const series = seriesOf(ctx.map)
    const cards = Array.isArray(ctx.args.cards)
      ? ctx.args.cards.map((card) => ctx.aliases.need(card, 'c'))
      : []
    const about = words(ctx.args.about, 300)
    const title = words(ctx.args.title, 120)
    const lanes = Object.values(ctx.map.layout?.lanes || {})
    const last = lanes.at(-1)
    const at = last
      ? { x: last.x + 40, y: last.y + last.h + 40 }
      : directionSpot(ctx.map)
    ctx.cursor.doing('Starting an episode')
    await pickFromAdd(ctx, at, 'new-episode')
    if (about || title) await ctx.cursor.type(about || title)
    await mapApi.addEpisode(series.id, {
      ...(about && !cards.length
        ? { about }
        : { title: title || about || undefined }),
      slides: cards
    })
    ctx.cursor.typed()
    return done(
      ctx.map,
      about && !cards.length
        ? `Started an episode about ${quote(about)}: the studio is picking its cards`
        : `Started the episode ${quote(title || about || 'new')}`
    )
  },
  async set_brief(ctx) {
    const series = seriesOf(ctx.map)
    const outcome = words(ctx.args.outcome, 300)
    const audience = words(ctx.args.audience, 300)
    if (!outcome && !audience)
      throw new Error('Say the outcome or the audience')
    const head = ctx.map.layout?.head
    ctx.cursor.doing('Writing the brief')
    if (head) await ctx.cursor.glide(corner(head))
    ctx.cursor.mark('B:series')
    await ctx.cursor.press()
    await ctx.cursor.type(outcome || audience)
    await mapApi.brief(series.id, {
      ...(outcome ? { outcome } : {}),
      ...(audience ? { audience } : {})
    })
    ctx.cursor.typed()
    return done(
      ctx.map,
      outcome
        ? `Set the outcome: ${quote(outcome)}`
        : `Set the audience: ${quote(audience)}`
    )
  },
  async plan_series(ctx) {
    const ideas = words(ctx.args.ideas, 600)
    const head = ctx.map.layout?.head || ctx.map.layout?.map
    ctx.cursor.doing('Planning the series')
    if (head) await ctx.cursor.glide(corner(head))
    await ctx.cursor.press()
    const series =
      ctx.map.view?.series || (await mapApi.startSeries(ctx.map.mapId))
    await mapApi.planSeries(series.id, ideas ? { ideas } : {})
    return done(
      ctx.map,
      'Planning the series: it reads every card, then the episodes take shape'
    )
  },
  async gap_action(ctx) {
    const series = seriesOf(ctx.map)
    const id = ctx.aliases.need(ctx.args.gap, 'g')
    const gap = series.gaps.find((g) => g.id === id)
    const box = ctx.map.layout?.gaps.find((g) => g.id === id)
    const explain = ctx.args.action !== 'set_aside'
    if (box) await ctx.cursor.glide(corner(box))
    ctx.cursor.mark(`g:${id}`)
    await ctx.cursor.press()
    await mapApi.gap(series.id, id, explain ? 'explained' : 'ignored')
    return done(
      ctx.map,
      explain
        ? `The episode now explains ${quote(gap?.missing || 'it')} in a line`
        : `Set aside the gap ${quote(gap?.missing || '')}`
    )
  },
  async undo_organize(ctx) {
    const series = seriesOf(ctx.map)
    const run = series.organized
    if (!run) throw new Error('There is no organising run to undo')
    const head = ctx.map.layout?.head
    if (head) await ctx.cursor.glide(corner(head))
    await ctx.cursor.press()
    await mapApi.undoOrganize(series.id, run.id)
    return done(ctx.map, 'Took those cards out again: they wait to be placed')
  },
  async add_comment(ctx) {
    const text = words(ctx.args.text, 2000)
    if (!text) throw new Error('Say what the comment says')
    const pin = pinOf(ctx, ctx.args.on)
    if (pin.box) await ctx.cursor.glide(corner(pin.box))
    await ctx.cursor.press()
    await ctx.cursor.type(text)
    await mapApi.comments(ctx.map.mapId, {
      action: 'add',
      target: pin.target,
      text,
      by: 'ai'
    })
    ctx.cursor.typed()
    return done(
      ctx.map,
      `Left a comment on ${targetWords(pin.target, ctx.map.snapshot, ctx.map.view)}`
    )
  },
  async reply_comment(ctx) {
    const id = ctx.aliases.need(ctx.args.comment, 'k')
    const text = words(ctx.args.text, 2000)
    if (!text) throw new Error('Say what the reply says')
    const pin = ctx.map.root.querySelector(`[data-pin="${id}"]`)
    if (pin) await ctx.cursor.glideTo(pin)
    await ctx.cursor.press()
    await ctx.cursor.type(text)
    await mapApi.comments(ctx.map.mapId, {
      action: 'reply',
      id,
      text,
      by: 'ai'
    })
    ctx.cursor.typed()
    return done(ctx.map, 'Replied to the comment')
  },
  async resolve_comment(ctx) {
    const id = ctx.aliases.need(ctx.args.comment, 'k')
    const pin = ctx.map.root.querySelector(`[data-pin="${id}"]`)
    if (pin) await ctx.cursor.glideTo(pin)
    await ctx.cursor.press()
    await mapApi.comments(ctx.map.mapId, {
      action: 'resolve',
      id,
      outcome: 'Resolved by Studio AI'
    })
    return done(ctx.map, 'Resolved the comment')
  }
}

/** Runs one of Studio AI's tools; what went wrong comes back as words. */
export const runAiTool = async (
  map: MapCanvas,
  cursor: AiCursor,
  aliases: Aliases,
  name: string,
  args: Record<string, unknown>
): Promise<ToolOutcome> => {
  const tool = TOOLS[name as VoiceToolName]
  if (!tool) return { ok: false, error: `There is no tool called ${name}` }
  try {
    return await tool({ map, cursor, aliases, args })
  } catch (error) {
    cursor.typed()
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  } finally {
    cursor.doing(null)
  }
}
