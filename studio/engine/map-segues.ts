// An episode's own lines: a cold open or "last time", a turn into each page
// from the one before, and "next time" after the last. They belong to the
// episode, never to the map, and are written again when its pages change.
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
  const snapshot = await loadProject(id)
  const series = snapshot?.project.episode
    ? await loadSeries(snapshot.project.episode.series)
    : null
  const order = series?.episodes || []
  const at = order.findIndex((item) => item.notebookId === id)
  if (at > 0) scheduleSegues(order[at - 1].notebookId)
  if (at >= 0 && at < order.length - 1) scheduleSegues(order[at + 1].notebookId)
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
    // Only this line is written again: its key goes, the others stay.
    delete checks[line]
    if (!checks.bridge && !checks.outro)
      delete current.project.segueChecks![slideId]
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
  const last = slides[slides.length - 1]
  const force = forced.delete(id)
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
  const map = await loadProject(snapshot.project.copyOfMap)
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
    if (slide.base === undefined || stale[index]) return
    if (recheck(slide, 'bridge')) stale[index] = true
  })
  if (last.base !== undefined && !outroStale)
    outroStale = recheck(last, 'outro')
  const ids = slides.map((slide) => slide.id)
  // Nothing around any page changed: only a stray "next time" goes.
  if (!stale.some(Boolean) && !outroStale) {
    if (
      snapshot.project.segues ||
      flagNow.length ||
      slides.slice(0, -1).some((s) => s.outro)
    )
      await changeProject(id, (current) => {
        const now = current.project.slides
        if (now.map((s) => s.id).join() !== ids.join()) return
        now.slice(0, -1).forEach((slide) => {
          if (!slide.outro) return
          delete slide.outro
          delete slide.outroFor
          slide.narration = composeNarration(slide)
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
    return
  }
  const pages = slides.map((slide, index) => ({
    id: slide.id,
    title: slide.title,
    idea: slide.idea || '',
    script: slide.base ?? slide.narration ?? '',
    ...(stale[index] || !slide.bridge ? {} : { keep: slide.bridge })
  }))
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
    ...(outroStale || !last.outro ? {} : { keepOutro: last.outro }),
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
    await changeProject(id, (current) => {
      const now = current.project.slides
      // Pages changed meanwhile: run again on the pages as they are now.
      if (now.map((slide) => slide.id).join() !== ids.join()) {
        again.add(id)
        return
      }
      now.forEach((slide, index) => {
        // A script the creator wrote is theirs: it keeps no segue.
        if (slide.base === undefined) return
        if (stale[index]) {
          slide.bridge = segues.pages[index].bridge
          slide.bridgeFor = keys[index]
        }
        if (index === now.length - 1) {
          if (outroStale) {
            slide.outro = segues.outro
            slide.outroFor = endKey
          }
        } else {
          delete slide.outro
          delete slide.outroFor
        }
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
    await changeProject(id, (current) => {
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
