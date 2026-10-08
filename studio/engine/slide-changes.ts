// Wireframe changes run in the background, one at a time per notebook. A
// change then survives a reload, shows in every tab, and can be queued for a
// drawn wireframe while the rest of the deck is still being drawn (review 5).
import { randomUUID } from 'node:crypto'
import type { ChatRequest, Snapshot } from '../shared/api'
import type { Slide, SlideChange } from '../shared/model'
import { addEvent } from './activity'
import { prepareCreativePages } from './creative/pages'
import { prepareCreativeSlideRevision } from './creative/slide-revision'
import {
  HarnessStageError,
  generationFailure,
  stopReason
} from './generation-errors'
import { harnessName } from './harness/provider-errors'
import { modelFetch } from './model-gateway'
import { readRow, storeAsset, writeRow } from './persistence'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import { reconcileVideo } from './scene-model'
import { composeNarration, planScenes, scheduleSegues } from './map-segues'
import type { readSourceNarrative } from './source-document'
import {
  outlineSchema,
  sanitizeOutline,
  type Outline,
  type OutlineScene
} from './source-outline'
import { renderPage, type pageBrandFrom } from './source-page'

type Retained = {
  source: ReturnType<typeof readSourceNarrative>
  brand: ReturnType<typeof pageBrandFrom>
  outline?: Outline
  slideIds?: string[]
}
const CHANGED = 'This wireframe changed while it was being changed.'

export const chatSlide = async (id: string, request: ChatRequest) => {
  if (request?.anchor?.stage !== 'presentation')
    throw new Error('Select a wireframe first')
  if (
    typeof request.instruction !== 'string' ||
    !request.instruction.trim() ||
    request.instruction.length > 4000
  )
    throw new Error('Add an instruction of up to 4000 characters')
  const slideId = request.anchor.slideId
  const changed = await changeProject(id, (current) => {
    const slide = current.project.slides.find((item) => item.id === slideId)
    if (!slide) throw new Error('Select a wireframe first')
    // A blank wireframe is drawn from what the creator says it is about,
    // once the others are drawn.
    if (
      !['ready', 'building', 'failed'].includes(current.status) ||
      (!slide.svg && current.status !== 'ready')
    )
      throw new Error('Wait for this wireframe to be drawn')
    const change: SlideChange = {
      id: randomUUID(),
      slideId,
      instruction: request.instruction.trim(),
      ...(request.target ? { target: request.target } : {}),
      state: 'queued',
      at: new Date().toISOString()
    }
    // A new request for a wireframe replaces its last failed one.
    current.changes = [
      ...(current.changes || []).filter(
        (item) => !(item.slideId === slideId && item.state === 'failed')
      ),
      change
    ]
    addEvent(current, 'chat', change.instruction, { anchor: request.anchor })
  })
  scheduleChanges(id)
  return changed
}

/**
 * The creator's answer to evidence a wireframe needs and the source did not
 * hold. It is kept with the page, for the video's planner, and the page is
 * redrawn to show it.
 */
export const answerEvidence = async (id: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const slideId = String(value.slideId || '')
  const what = String(value.what || '').trim()
  const answer = String(value.answer || '').trim()
  if (!answer || answer.length > 2000)
    throw new Error('Add an answer of up to 2000 characters')
  await changeProject(id, (current) => {
    const slide = current.project.slides.find((item) => item.id === slideId)
    if (!slide?.needs?.some((need) => need.what === what && !need.source))
      throw new Error('This wireframe does not ask for that')
    slide.answers = [
      ...(slide.answers || []).filter((item) => item.what !== what),
      { what, answer }
    ]
  })
  return chatSlide(id, {
    anchor: { stage: 'presentation', slideId },
    instruction: `Show the evidence the creator supplied for this page. ${what}: ${answer}. It is the creator's own, not the article's: put it in the narration and the parts, never in source.`
  })
}

const decks = new Map<string, Promise<void>>()
/**
 * One deck-changing step at a time per notebook: a page being redrawn, or a
 * note's new pages going in. A note waits for the redraw instead of moving
 * the pages under it, which would fail that change.
 */
export const withDeck = async <T>(id: string, work: () => Promise<T>) => {
  const before = decks.get(id) || Promise.resolve()
  let release!: () => void
  const mine = new Promise<void>((done) => {
    release = done
  })
  const chained = before.then(() => mine)
  decks.set(id, chained)
  await before
  try {
    return await work()
  } finally {
    release()
    if (decks.get(id) === chained) decks.delete(id)
  }
}

const working = new Map<string, Promise<void>>()
/** Start the notebook's queue unless it is running; drawing must finish first. */
export const scheduleChanges = (id: string) => {
  if (working.has(id)) return
  const work = processChanges(id).finally(() => working.delete(id))
  working.set(id, work)
  void work.catch(() => {})
}
/** Resolves when the notebook's queued changes have run (tests and checks). */
export const settledChanges = async (id: string) => {
  while (working.has(id)) await working.get(id)!.catch(() => {})
}

const processChanges = async (id: string) => {
  for (;;) {
    const snapshot = await loadProject(id)
    if (!snapshot || snapshot.status !== 'ready') return
    const next = snapshot.changes?.find((item) => item.state === 'queued')
    if (!next) return
    await changeProject(id, (current) => {
      const change = current.changes?.find((item) => item.id === next.id)
      if (change) {
        change.state = 'working'
        change.startedAt = new Date().toISOString()
      }
    })
    try {
      await withDeck(id, () => reviseSlide(id, next))
    } catch (error) {
      await changeProject(id, (current) => {
        const message = changeFailure(error, current)
        current.changes = (current.changes || []).map((item) =>
          item.id === next.id ? { ...item, state: 'failed', message } : item
        )
        addEvent(current, 'chat', message, {
          anchor: { stage: 'presentation', slideId: next.slideId },
          activity: 'failed'
        })
      })
    }
  }
}

/** Why a change failed, naming the agent and the real cause (review 5). */
const changeFailure = (error: unknown, snapshot: Snapshot) => {
  const agent = harnessName(snapshot.project.harness?.adapter)
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith(CHANGED)) return `${CHANGED} Send your request again.`
  if (message === 'This wireframe was deleted') return message
  const why = stopReason(
    error instanceof HarnessStageError ? error.failure?.message : message
  )
  if (why) return `${agent} ${why} while changing this wireframe. Try again.`
  return generationFailure(
    error,
    `${agent} could not change this wireframe. Try again.`
  )
}

/** Restart never silently repeats a change that may have spent credits. */
export const recoverChanges = (snapshot: Snapshot) => {
  for (const change of snapshot.changes || [])
    if (change.state === 'working') {
      change.state = 'failed'
      change.message =
        'The studio restarted before this change finished. Send it again.'
    }
}

/**
 * What a change redraws from: the page without the map's notes on it (its
 * topic, set aside, cut into an episode), which grouping the map or using a
 * page in an episode may change meanwhile without changing the page.
 */
const drawingOf = (slide: Slide | undefined) => {
  if (!slide) return slide
  const { topic, aside, onlyIn, fromNote, ...drawing } = slide
  void [topic, aside, onlyIn, fromNote]
  return drawing
}

const origin = () =>
  process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`

const reviseSlide = async (id: string, change: SlideChange) => {
  const snapshot = await loadProject(id)
  if (!snapshot) throw new Error('Notebook not found')
  const index = snapshot.project.slides.findIndex(
    (slide) => slide.id === change.slideId
  )
  if (index < 0) throw new Error('This wireframe was deleted')
  const slide = snapshot.project.slides[index]
  const retained = await readRow<Retained>('outlines', id)
  if (!retained) throw new Error('Source not found')
  const revisionKey = (project: Snapshot['project']) =>
    fingerprintOf({
      slide: drawingOf(
        project.slides.find((item) => item.id === change.slideId)
      ),
      order: project.slides.map((item) => item.id),
      branding: project.branding
    })
  const expected = revisionKey(snapshot.project)
  const harness = snapshot.project.harness
  // A change pinned to one part of the page is a drawing change: the story
  // step is skipped and the page is redrawn from the scene it already has.
  const original =
    retained.outline?.scenes[retained.slideIds?.indexOf(change.slideId) ?? -1]
  let revised: OutlineScene | undefined
  if (harness && change.target && original)
    revised = {
      ...original,
      title: slide.title || original.title,
      narration: slide.narration || original.narration
    }
  else if (harness)
    revised = (
      await prepareCreativeSlideRevision({
        projectId: id,
        slide,
        index,
        instruction: change.instruction,
        target: change.target,
        source: retained.source,
        selection: harness,
        origin: origin()
      })
    ).scenes[0]
  else revised = await reviseWithoutAgent(id, change, slide.title, retained)
  if (!revised) throw new Error('No revised wireframe')
  // The page is redrawn in the notebook's current look.
  const look = snapshot.project.branding
  const pageBrand = look?.palette
    ? {
        ...retained.brand,
        ...look.palette,
        accent: look.accent,
        ...(look.fonts || {})
      }
    : retained.brand
  const svg = harness
    ? (
        await prepareCreativePages({
          projectId: id,
          source: retained.source,
          outline: {
            title: snapshot.project.title,
            scenes: [revised],
            targetSeconds: revised.seconds,
            glossary: []
          },
          brand: pageBrand,
          selection: harness,
          origin: origin(),
          pageOffset: index,
          reuseStyle: true,
          // Another page of the deck, for the redrawn page to match.
          style:
            snapshot.project.slides.find(
              (other, at) => at !== index && other.svg
            )?.svg || undefined,
          // A blank wireframe is drawn fresh; a drawn one is changed.
          ...(slide.svg
            ? {
                edit: {
                  instruction: change.instruction,
                  target: change.target,
                  svg: slide.svg
                }
              }
            : {})
        })
      )[0]
    : renderPage(revised, index, snapshot.project.slides.length, pageBrand, {
        title: snapshot.project.title,
        site: retained.source.site
      })
  await changeProject(id, async (current) => {
    if (current.status !== 'ready' || revisionKey(current.project) !== expected)
      throw new Error(CHANGED)
    const currentIndex = current.project.slides.findIndex(
      (item) => item.id === change.slideId
    )
    const asset = await storeAsset({
      body: Buffer.from(svg),
      contentType: 'image/svg+xml',
      extension: '.svg',
      projectId: id,
      sceneId: `scene-${change.slideId}`,
      kind: 'slide-artwork'
    })
    await writeRow('slide-artifacts', change.slideId, {
      projectId: id,
      slideId: change.slideId,
      artifactId: asset.id,
      objectKey: asset.objectKey
    })
    // The page keeps the beats it carries and the creator's answers.
    current.project.slides[currentIndex] = {
      ...current.project.slides[currentIndex],
      id: change.slideId,
      title: revised.title,
      svg,
      narration: revised.narration,
      idea: revised.idea,
      evidence: revised.source,
      // A page planned from beats keeps what it now is.
      ...(current.project.slides[currentIndex].beats?.length
        ? {
            pageKind: revised.kind,
            parts: revised.parts.map((part) => part.label)
          }
        : {})
    }
    delete current.project.slides[currentIndex].draft
    // An episode's copy keeps its segues around the revised script.
    const now = current.project.slides[currentIndex]
    if (now.base !== undefined) {
      now.base = revised.narration
      now.narration = composeNarration(now)
    }
    current.changes = (current.changes || []).filter(
      (item) => item.id !== change.id
    )
    reconcileVideo(current.project, current)
    addEvent(current, 'chat', `Changed wireframe ${currentIndex + 1}.`, {
      anchor: { stage: 'presentation', slideId: change.slideId },
      activity: 'complete'
    })
  })
  // A redrawn page invalidated its scene: plan it again, if there is a video.
  await planScenes(id)
  if (snapshot.project.copyOfMap) scheduleSegues(id)
}

/** Without an agent, the writing model revises the scene and the studio draws it. */
const reviseWithoutAgent = async (
  id: string,
  change: SlideChange,
  title: string,
  retained: Retained
) => {
  const response = await modelFetch('writing', {
    body: JSON.stringify({
      input: `Revise one slide of this presentation. Return a complete outline containing exactly ONE scene. Use the provided source as evidence. Current slide title: ${title}. Creator instruction: ${change.instruction}. Source: ${retained.source.text}`,
      text: {
        format: {
          type: 'json_schema',
          name: 'slide_revision',
          strict: true,
          schema: outlineSchema()
        }
      }
    })
  })
  if (!response.ok) throw new Error('Could not revise the wireframe')
  const result = await response.json()
  const text =
    result.output
      ?.flatMap((item) => item.content || [])
      .filter((item) => item.type === 'output_text')
      .map((item) => item.text || '')
      .join('') || ''
  const candidate = await storeAsset({
    body: Buffer.from(text),
    contentType: 'application/json',
    extension: '.json',
    projectId: id,
    sceneId: `scene-${change.slideId}`,
    kind: 'slide-revision-candidate'
  })
  await writeRow('slide-revision-attempts', candidate.id, {
    projectId: id,
    slideId: change.slideId,
    artifactId: candidate.id,
    objectKey: candidate.objectKey,
    instruction: change.instruction
  })
  return sanitizeOutline(JSON.parse(text), title, retained.source.text)
    .scenes[0]
}
