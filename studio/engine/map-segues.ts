// An episode's own lines: a cold open or "last time", a turn into each page
// from the one before, and "next time" after the last. They belong to the
// episode, never to the map, and are written again when its pages change.
import type { Snapshot } from '../shared/api'
import type { Project, SegueCheck, Slide } from '../shared/model'
import { addEvent } from './activity'
import {
  askOnce,
  claimNote,
  claimProblem,
  limitsFor,
  materialOf,
  overclaims,
  type Overclaim
} from './claims'
import { runValidatedJsonStage } from './creative/stage'
import { detectedHarness } from './notebook-intake'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { reconcileVideo } from './scene-model'
import { loadSeries } from './series'

const origin = () =>
  process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)

/**
 * Scenes a change invalidated wait in the queue: start the video's planning
 * for them, as the studio's own edit routes do.
 */
export const planScenes = async (id: string) => {
  const snapshot = await loadProject(id)
  if (!snapshot?.project.video) return
  const { schedulePlanning } = await import('./video')
  schedulePlanning(id)
}

/** The episode's script for a copy: its line in, the map's script, its line out. */
export const composeNarration = (slide: Slide) =>
  [slide.bridge, slide.base, slide.outro].filter(Boolean).join(' ')

export type Segues = {
  pages: Array<{ id: string; bridge: string }>
  outro: string
}

/** One line into each page, in the episode's order, and one out of the last. */
export const validateSegues = (raw: unknown, ids: string[]) => {
  const value = (raw ?? {}) as { pages?: unknown; outro?: unknown }
  const problems: string[] = []
  const list = Array.isArray(value.pages) ? value.pages : []
  const pages = list.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    return { id: String(item.id ?? ''), bridge: words(item.bridge, 2000) }
  })
  if (pages.map((page) => page.id).join() !== ids.join())
    problems.push(
      'Write one bridge for each page, in the episode’s order, by id'
    )
  if (pages.some((page) => !page.bridge))
    problems.push('Give every page a bridge')
  const outro = words(value.outro, 2000)
  if (!outro) problems.push('Write the outro said after the last page')
  // Spoken lines: a long one is refused, never cut mid-sentence.
  if (
    [...pages.map((page) => page.bridge), outro].some(
      (line) => line.length > 320
    )
  )
    problems.push('Keep every line under 320 characters')
  return {
    ok: !problems.length,
    problems,
    warnings: [],
    value: { pages, outro }
  }
}

const writing = new Map<string, Promise<void>>()
/** The order (its pages' ids) a run is writing lines for, while it waits. */
const writingFor = new Map<string, string>()
const again = new Set<string>()
const forced = new Set<string>()
/**
 * Writes the episode's segues in the background; a later change runs again.
 * Forced, every line is written anew ("Write segues again").
 */
export const scheduleSegues = (id: string, force = false) => {
  if (force) forced.add(id)
  if (writing.has(id)) {
    again.add(id)
    return
  }
  const job = writeSegues(id).finally(() => {
    writing.delete(id)
    writingFor.delete(id)
    if (again.delete(id)) scheduleSegues(id)
  })
  writing.set(id, job)
  void job.catch(() => {})
}
/**
 * The episode's segues, and its neighbours': the one before says "next
 * time" with its title, the one after says "last time" with its pages.
 */
export const scheduleAround = async (id: string) => {
  scheduleSegues(id)
  for (const other of await neighboursOf(id)) scheduleSegues(other)
}
/** The episodes either side of one in its series. */
const neighboursOf = async (id: string) => {
  const snapshot = await loadProject(id)
  const series = snapshot?.project.episode
    ? await loadSeries(snapshot.project.episode.series)
    : null
  const order = series?.episodes || []
  const at = order.findIndex((item) => item.notebookId === id)
  return [order[at - 1], at >= 0 ? order[at + 1] : undefined]
    .filter((item) => item !== undefined)
    .map((item) => item.notebookId)
}
/**
 * After a card is reordered: the lines the episode and its neighbours had
 * for the order they have now are put back at once (an Undo, a card
 * dragged back), so only what is new is written. True while any line still
 * needs writing, so the map says "rewritten" only then (round 2).
 */
export const restoreAround = async (id: string) => {
  let left = await restoreSegues(id)
  for (const other of await neighboursOf(id))
    if (await restoreSegues(other)) left = true
  return left
}

/**
 * The creator's answer to a flagged line: keep it as it is (the flag goes),
 * or have that line alone written again, once more through the check
 * (review 8).
 */
export const answerSegueCheck = async (id: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const slideId = String(value.slide || '')
  const line = value.line === 'outro' ? 'outro' : 'bridge'
  let again = false
  const snapshot = await changeProject(id, (current) => {
    const slide = current.project.slides.find((entry) => entry.id === slideId)
    const checks = current.project.segueChecks?.[slideId]
    const check = checks?.[line]
    if (!slide || !check || check.kept || check.line !== slide[line])
      throw new Refusal('That line is no longer flagged')
    const where = `the line ${line === 'outro' ? 'after' : 'before'} “${slide.title}”`
    if (value.keep === true) {
      check.kept = true
      addEvent(current, 'slide', `Kept ${where} as it is`)
      return
    }
    // Only this line is written again: its key goes, the others stay, and
    // it is not kept to come back for its order.
    delete checks[line]
    if (!checks.bridge && !checks.outro)
      delete current.project.segueChecks![slideId]
    const key = line === 'bridge' ? slide.bridgeFor : slide.outroFor
    if (key) delete current.project.segueLines?.[key]
    if (line === 'bridge') delete slide.bridgeFor
    else delete slide.outroFor
    again = true
    addEvent(current, 'slide', `Writing ${where} again`)
  })
  if (again) scheduleSegues(id)
  return snapshot
}

/** Resolves when no episode's segues are being written (tests and checks). */
export const settledAllSegues = async () => {
  while (writing.size) await Promise.all([...writing.values()])
}
/** Resolves when the episode's segues are written (tests and checks). */
export const settledSegues = async (id: string) => {
  while (writing.has(id)) await writing.get(id)!.catch(() => {})
}

/** What a page's lines depend on: the map page it copies and its script. */
const pageKey = (slide: Slide) =>
  fingerprintOf([
    slide.copyOf?.slide ?? slide.id,
    slide.title,
    slide.base ?? slide.narration ?? ''
  ])
/**
 * A line into a page is written for the page before it (for the first, the
 * episode before) and the page itself; "next time" for the last page and the
 * episode after: its title and the page it opens with, so a "next time"
 * written while that episode was empty is written again once it has pages.
 * Lines whose neighbours did not change are kept, so a scene already made,
 * or being made, keeps its script.
 */
const bridgeKey = (slides: Slide[], index: number, before: string | null) =>
  fingerprintOf({
    before: index ? pageKey(slides[index - 1]) : before,
    page: pageKey(slides[index])
  })
const outroKey = (slides: Slide[], next: string | null) =>
  fingerprintOf({ last: pageKey(slides[slides.length - 1]), next })

type Checks = NonNullable<Project['segueChecks']>
type Line = 'bridge' | 'outro'
/** A line that promises more than the creator wrote, and where. */
type Flag = { slide: Slide; line: Line; text: string; claim: Overclaim }
/**
 * The lines flagged after a write: each found now (written and still past
 * the creator's words after its one rewrite, or kept under a started video
 * and past a new limit), and each line flagged before while it is the same
 * line and wasn't written again. None: undefined.
 */
const flagsAfter = (
  slides: Slide[],
  before: Checks,
  written: (index: number, line: Line) => boolean,
  found: Flag[]
) => {
  const flags: Checks = {}
  slides.forEach((slide, index) => {
    const mark = (line: Line): SegueCheck | undefined => {
      if (line === 'outro' && index !== slides.length - 1) return undefined
      const now = found.find(
        (item) => item.slide.id === slide.id && item.line === line
      )
      if (now) return { line: now.text, note: claimNote(now.claim) }
      if (written(index, line)) return undefined
      const kept = before[slide.id]?.[line]
      return kept && kept.line === slide[line] ? kept : undefined
    }
    const bridge = mark('bridge')
    const outro = mark('outro')
    if (bridge || outro)
      flags[slide.id] = {
        ...(bridge ? { bridge } : {}),
        ...(outro ? { outro } : {})
      }
  })
  return Object.keys(flags).length ? flags : undefined
}
/** What the creator's activity says about a flagged line. */
const checkWords = (flag: Flag) =>
  `Check the line ${flag.line === 'outro' ? 'after' : 'before'} “${flag.slide.title}”. ${claimNote(flag.claim)}`
/**
 * An episode the creator approved or made: its copies wait for their Update,
 * and a line past a new limit is flagged there, not rewritten. One whose
 * storyboard is still a plan follows its cards like one with no video; its
 * plan is then marked to be made again, never stale, and no paid run starts
 * by itself (review 8 F08: any storyboard made every copy wait).
 */
export const waitsForCreator = (snapshot: {
  project: Pick<Project, 'video'>
}) => {
  const video = snapshot.project.video
  const board = video?.storyboard
  const planning = board?.stage === 'plan' || board?.stage === 'review'
  return Boolean(
    video &&
    (video.produced ||
      (board && (board.approved || board.produced || !planning)) ||
      video.scenes.some((scene) => scene.phase !== 'idle' || scene.produced))
  )
}

/** Lines an episode keeps for orders it had, by what each was written for:
 * an Undo history's worth of reorders, never without bound. */
const KEPT_LINES = 80
/** Keeps a line under what it was written for, the newest last. */
const keepLine = (project: Project, key?: string, text?: string) => {
  if (!key || !text) return
  const kept = (project.segueLines ||= {})
  delete kept[key]
  kept[key] = text
  for (const old of Object.keys(kept).slice(0, -KEPT_LINES)) delete kept[old]
}
/** Gives a page a line, the one it replaces kept for the order it had. */
const setLine = (
  project: Project,
  slide: Slide,
  line: Line,
  text: string,
  key: string
) => {
  const forKey = line === 'bridge' ? 'bridgeFor' : 'outroFor'
  keepLine(project, slide[forKey], slide[line])
  slide[line] = text
  slide[forKey] = key
  keepLine(project, key, text)
  slide.narration = composeNarration(slide)
}
/** Takes "next time" off a page no longer last, kept for its order. */
const dropOutro = (project: Project, slide: Slide) => {
  keepLine(project, slide.outroFor, slide.outro)
  delete slide.outro
  delete slide.outroFor
  slide.narration = composeNarration(slide)
}

/** What each of an episode's lines is written for: its pages, the episode
 * before and the one after. */
const keysOf = async (snapshot: Snapshot) => {
  const id = snapshot.project.id
  const slides = snapshot.project.slides
  const series = snapshot.project.episode
    ? await loadSeries(snapshot.project.episode.series)
    : null
  const order = series?.episodes || []
  const at = order.findIndex((item) => item.notebookId === id)
  const before = at > 0 ? await loadProject(order[at - 1].notebookId) : null
  const after =
    at >= 0 && at < order.length - 1
      ? await loadProject(order[at + 1].notebookId)
      : null
  // "Last time" speaks of the episode before: its title and its pages.
  const beforeKey = before
    ? fingerprintOf({
        title: before.project.title,
        pages: before.project.slides.map((s) => s.copyOf?.slide ?? s.id)
      })
    : null
  const keys = slides.map((_, index) => bridgeKey(slides, index, beforeKey))
  const opens = after?.project.slides[0]
  const endKey = outroKey(
    slides,
    after
      ? fingerprintOf({
          title: after.project.title,
          opens: opens ? (opens.copyOf?.slide ?? opens.id) : null
        })
      : null
  )
  return { series, at, before, after, opens, keys, endKey }
}
/** Whether an episode's lines are still written for what a plan was: its
 * pages in that order, and the same episodes either side. */
const stillFor = async (id: string, plan: Plan) => {
  const now = await loadProject(id)
  if (!now?.project.slides.length || !sameOrder(now.project, plan)) return false
  const { keys, endKey } = await keysOf(now)
  return keys.join() === plan.keys.join() && endKey === plan.endKey
}

/**
 * What an episode's lines are written for now (a line into each page, one
 * out of the last), which are stale, and which of those it had already for
 * the very same pages around them and still within the creator's words: an
 * order put back, by Undo or by hand, takes those again with no model call
 * (round 2). Forced, none is taken.
 */
const planLines = async (snapshot: Snapshot, force: boolean) => {
  const slides = snapshot.project.slides
  const { series, at, before, after, opens, keys, endKey } =
    await keysOf(snapshot)
  const last = slides[slides.length - 1]
  const stale = slides.map(
    (slide, index) =>
      slide.base !== undefined &&
      (force || !slide.bridge || slide.bridgeFor !== keys[index])
  )
  let outroStale =
    last.base !== undefined &&
    (force || !last.outro || last.outroFor !== endKey)
  // What the creator wrote for these lines: the map's source with every
  // note, these pages, the episode before, the page the next one opens with.
  const map = await loadProject(snapshot.project.copyOfMap!)
  const original = (slide: Slide) =>
    map?.project.slides.find((page) => page.id === slide.copyOf?.slide)
  const next = opens ? (original(opens) ?? opens) : undefined
  const around = [
    ...slides,
    ...slides.map(original),
    ...(before?.project.slides || []),
    ...(next ? [next] : [])
  ].filter((page): page is Slide => Boolean(page))
  const material = materialOf(
    map?.project.source ?? snapshot.project.source,
    around
  )
  // Lines it had for these very pages around them, still within the
  // creator's words: taken again, not written anew.
  const store = snapshot.project.segueLines || {}
  const holds = (text?: string) =>
    !force && text && !overclaims(text, material).length ? text : undefined
  const kept = slides.map((_, index) =>
    stale[index] ? holds(store[keys[index]]) : undefined
  )
  kept.forEach((text, index) => {
    if (text) stale[index] = false
  })
  const keptOutro = outroStale ? holds(store[endKey]) : undefined
  if (keptOutro) outroStale = false
  // A line kept that now promises more than that (a note brought a limit
  // since) is written again, once, while the video hasn't started; under a
  // started video it is flagged instead. A line flagged already stays.
  const checks = snapshot.project.segueChecks || {}
  const made = waitsForCreator(snapshot)
  const flagNow: Flag[] = []
  const recheck = (slide: Slide, line: Line) => {
    const text = slide[line]
    if (!text || checks[slide.id]?.[line]?.line === text) return false
    const [claim] = overclaims(text, material)
    if (claim && made) flagNow.push({ slide, line, text, claim })
    return Boolean(claim) && !made
  }
  slides.forEach((slide, index) => {
    if (slide.base === undefined || stale[index] || kept[index]) return
    if (recheck(slide, 'bridge')) stale[index] = true
  })
  if (last.base !== undefined && !outroStale && !keptOutro)
    outroStale = recheck(last, 'outro')
  return {
    ids: slides.map((slide) => slide.id),
    // The lines as they were, so one put back meanwhile is told apart.
    was: slides.map((slide) => [slide.bridge, slide.outro]),
    series,
    at,
    before,
    after,
    opens,
    next,
    keys,
    endKey,
    stale,
    outroStale,
    kept,
    keptOutro,
    material,
    around,
    flagNow
  }
}
type Plan = Awaited<ReturnType<typeof planLines>>
/** How many lines a plan takes again, none written. */
const keptCount = (plan: Plan) =>
  plan.kept.filter(Boolean).length + (plan.keptOutro ? 1 : 0)
/** Puts back the lines kept for this order, on pages still in it. */
const putBack = (current: Snapshot, plan: Plan) => {
  const { project } = current
  let count = 0
  project.slides.forEach((slide, index) => {
    const text = plan.kept[index]
    if (!text || slide.bridgeFor === plan.keys[index]) return
    setLine(project, slide, 'bridge', text, plan.keys[index])
    count++
  })
  const last = project.slides[project.slides.length - 1]
  if (plan.keptOutro && last.outroFor !== plan.endKey) {
    setLine(project, last, 'outro', plan.keptOutro, plan.endKey)
    count++
  }
  if (count)
    addEvent(
      current,
      'slide',
      `Put back ${count} segue${count === 1 ? '' : 's'} this order had`
    )
}
const sameOrder = (project: Project, plan: Plan) =>
  project.slides.map((slide) => slide.id).join() === plan.ids.join()

/**
 * Puts back at once the lines an episode had for the order it has now;
 * true while any line still needs writing. A run still writing for
 * another order no longer says this one is being written.
 */
const restoreSegues = async (id: string) => {
  const snapshot = await loadProject(id)
  if (!snapshot?.project.copyOfMap || !snapshot.project.slides.length)
    return false
  const plan = await planLines(snapshot, false)
  const left = plan.stale.some(Boolean) || plan.outroStale
  const settled =
    !left &&
    snapshot.project.segues?.state === 'writing' &&
    writingFor.get(id) !== plan.ids.join()
  const putting = keptCount(plan) > 0
  if (!putting && !settled) return left
  await changeProject(id, (current) => {
    if (!sameOrder(current.project, plan)) return
    if (settled && current.project.segues?.state === 'writing')
      delete current.project.segues
    if (!putting) return
    putBack(current, plan)
    reconcileVideo(current.project, current, new Set())
  })
  if (putting) await planScenes(id)
  return left
}

const writeSegues = async (id: string) => {
  const snapshot = await loadProject(id)
  if (!snapshot?.project.copyOfMap) return
  const slides = snapshot.project.slides
  if (!slides.length) {
    if (snapshot.project.segues)
      await changeProject(id, (current) => {
        delete current.project.segues
      })
    return
  }
  const force = forced.delete(id)
  const plan = await planLines(snapshot, force)
  const { ids, keys, endKey, stale, outroStale, flagNow, material } = plan
  const { series, at, before, after, opens, next, around } = plan
  const last = slides[slides.length - 1]
  const putting = keptCount(plan) > 0
  // Nothing around any page changed, or it had these lines before: only a
  // stray "next time" goes.
  if (!stale.some(Boolean) && !outroStale) {
    if (
      putting ||
      snapshot.project.segues ||
      flagNow.length ||
      slides.slice(0, -1).some((s) => s.outro)
    )
      await changeProject(id, (current) => {
        const now = current.project.slides
        if (!sameOrder(current.project, plan)) return
        putBack(current, plan)
        now.slice(0, -1).forEach((slide) => {
          if (slide.outro) dropOutro(current.project, slide)
        })
        if (flagNow.length) {
          current.project.segueChecks = flagsAfter(
            now,
            current.project.segueChecks || {},
            () => false,
            flagNow
          )
          addEvent(current, 'slide', checkWords(flagNow[0]))
        }
        delete current.project.segues
        reconcileVideo(current.project, current, new Set())
      })
    if (putting) await planScenes(id)
    return
  }
  const pages = slides.map((slide, index) => {
    const keep = plan.kept[index] ?? (stale[index] ? undefined : slide.bridge)
    return {
      id: slide.id,
      title: slide.title,
      idea: slide.idea || '',
      script: slide.base ?? slide.narration ?? '',
      ...(keep ? { keep } : {})
    }
  })
  const keepOutro = plan.keptOutro ?? (outroStale ? undefined : last.outro)
  const brief = {
    series: series?.title || null,
    episode: { number: at + 1 || 1, title: snapshot.project.title },
    previous: before
      ? {
          title: before.project.title,
          pages: before.project.slides.map((slide) => slide.title)
        }
      : null,
    next: after
      ? {
          title: after.project.title,
          opens: opens?.title ?? null,
          // What it opens with says what "next time" may promise.
          ...(next
            ? {
                page: {
                  idea: next.idea || '',
                  script: next.base ?? next.narration ?? ''
                }
              }
            : {})
        }
      : null,
    pages,
    ...(keepOutro ? { keepOutro } : {}),
    // The creator's own limits on what these lines may promise.
    limits: limitsFor(
      material,
      around
        .map(
          (page) =>
            `${page.title} ${page.idea || ''} ${page.base ?? page.narration ?? ''}`
        )
        .join(' ')
    )
  }
  // Each line written now that promises more than the material, where it is.
  const claimsIn = (written: Segues) => [
    ...slides.flatMap((slide, index) => {
      const bridge = written.pages[index]
      return stale[index] && bridge?.id === slide.id
        ? overclaims(bridge.bridge, material).map((claim) => ({
            slide,
            line: 'bridge' as const,
            text: bridge.bridge,
            claim
          }))
        : []
    }),
    ...(outroStale
      ? overclaims(written.outro, material).map((claim) => ({
          slide: last,
          line: 'outro' as const,
          text: written.outro,
          claim
        }))
      : [])
  ]
  const told = (item: ReturnType<typeof claimsIn>[number]) =>
    item.line === 'outro'
      ? 'The outro'
      : item.slide === slides[0]
        ? 'The cold open'
        : `The line into “${item.slide.title}”`
  writingFor.set(id, ids.join())
  await changeProject(id, (current) => {
    current.project.segues = { state: 'writing' }
  })
  try {
    const segues = await runValidatedJsonStage<Segues>({
      projectId: id,
      // Rewrite segues is the creator asking for new lines: a fresh key.
      inputKey: fingerprintOf(force ? { brief, asked: Date.now() } : brief),
      checkpoint: 'episode-segues',
      operation: 'revise-story',
      stage: 'story',
      route: 'Write Segues',
      stageContext: { episode: brief.episode },
      file: 'story/segues.json',
      tool: 'story_submit_segues',
      packet: { 'packet/EPISODE.json': JSON.stringify(brief, null, 1) },
      selection: snapshot.project.harness ?? (await detectedHarness()),
      origin: origin(),
      // A line that promises more than the creator wrote goes back once.
      validate: askOnce(
        (raw) => validateSegues(raw, ids),
        (written) =>
          claimsIn(written).map((item) => claimProblem(told(item), item.claim))
      )
    })
    const left = claimsIn(segues)
    const still = await stillFor(id, plan)
    await changeProject(id, (current) => {
      const now = current.project.slides
      // Its pages, or an episode either side, changed meanwhile (an Undo,
      // another move): what was written is kept for what it was written
      // for, so going back to it needs no model; run again on things as
      // they are now (round 2).
      if (!still || !sameOrder(current.project, plan)) {
        stale.forEach((yes, index) => {
          if (yes)
            keepLine(current.project, keys[index], segues.pages[index].bridge)
        })
        if (outroStale) keepLine(current.project, endKey, segues.outro)
        again.add(id)
        return
      }
      putBack(current, plan)
      now.forEach((slide, index) => {
        // A script the creator wrote is theirs: it keeps no segue.
        if (slide.base === undefined) return
        // A line put back meanwhile for this very order stays.
        const [bridge, outro] = plan.was[index]
        const back = (line: Line, key: string) =>
          !force &&
          slide[line === 'bridge' ? 'bridgeFor' : 'outroFor'] === key &&
          slide[line] !== (line === 'bridge' ? bridge : outro)
        if (stale[index] && !back('bridge', keys[index]))
          setLine(
            current.project,
            slide,
            'bridge',
            segues.pages[index].bridge,
            keys[index]
          )
        if (index === now.length - 1) {
          if (outroStale && !back('outro', endKey))
            setLine(current.project, slide, 'outro', segues.outro, endKey)
        } else dropOutro(current.project, slide)
        slide.narration = composeNarration(slide)
      })
      const checked = flagsAfter(
        now,
        current.project.segueChecks || {},
        (index, line) => (line === 'bridge' ? stale[index] : outroStale),
        [...left, ...flagNow]
      )
      if (checked) current.project.segueChecks = checked
      else delete current.project.segueChecks
      delete current.project.segues
      reconcileVideo(current.project, current, new Set())
      const written = stale.filter(Boolean).length + (outroStale ? 1 : 0)
      addEvent(
        current,
        'slide',
        `Wrote ${written} segue${written === 1 ? '' : 's'} between the pages`
      )
      const flag = left[0] ?? flagNow[0]
      if (flag) addEvent(current, 'slide', checkWords(flag))
    })
    await planScenes(id)
  } catch (error) {
    const still = await stillFor(id, plan).catch(() => true)
    await changeProject(id, (current) => {
      // Changed meanwhile: the run for things as they are now says.
      if (!still || !sameOrder(current.project, plan)) {
        again.add(id)
        return
      }
      current.project.segues = {
        state: 'failed',
        error:
          error instanceof Error && error.message
            ? error.message
            : 'The agent could not write the segues'
      }
    }).catch(() => {})
  }
}
