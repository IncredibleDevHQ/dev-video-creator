import { scheduleSource } from './notebook-intake'
import { addEvent } from './activity'
export { addEvent } from './activity'
import { sumUsage } from '../shared/usage'
import { cancelEngineRun, type EngineRun } from './harness/runtime'
import {
  generationStops,
  generationFailure,
  stopReason,
  PageDrawingError
} from './generation-errors'
import { harnessName } from './harness/provider-errors'
import { prepareCreativeBrief } from './creative/brief'
import {
  loadHarnessPreference,
  validateHarnessSelection
} from './harness/preference'
import { prepareCreativeStory } from './creative/story'
import { prepareCreativePages } from './creative/pages'
import { prepareCreativeSlideRevision } from './creative/slide-revision'
import { fingerprintOf } from './planning/fingerprint'
import { STORY_SCENES, type HarnessSelection } from '../shared/model'
import { legacyNarrative } from '../shared/narratives'
import { randomUUID } from 'node:crypto'
import type { Snapshot, SlideEdit, ChatRequest } from '../shared/api'
import type { ProjectEvent } from '../shared/model'
import {
  readRow,
  writeRow,
  storeAsset,
  listRows,
  listNotebookRows
} from './persistence'
import { reconcileVideo, refreshVideoKeys } from './scene-model'
import {
  projectViews,
  videoDisplay,
  presentationDisplay
} from '../shared/state'
import { modelFetch } from './model-gateway'
import { SourceReadError } from './source-fetch'
import { readSourceNarrative } from './source-document'
import { readSourceUrl } from './source-reader'
import { outlineSchema, outlinePrompt, sanitizeOutline } from './source-outline'
import { pageBrandFrom, renderPage } from './source-page'
import { identityOf } from './branding'
import { startingLook, withLook } from './looks'
const queues = new Map<string, Promise<unknown>>()
/**
 * A video saved before narratives (October 2026) named a template, and its
 * scenes a slot: it opens on the narrative that template told, in order.
 */
const fromTemplate = (project: Snapshot['project']) => {
  const video = project.video
  const old = video?.settings as { template?: string } | undefined
  if (!video || !old?.template) return
  const narrative = legacyNarrative(old.template)
  delete old.template
  if (narrative) video.settings.narrative = narrative
  for (const scene of video.scenes) delete (scene as { slot?: unknown }).slot
}
export const loadProject = async (id: string) => {
  const snapshot = await readRow<Snapshot>('projects', id)
  if (snapshot) {
    fromTemplate(snapshot.project)
    snapshot.views = projectViews(snapshot.project, snapshot.events)
    snapshot.views.video.display = videoDisplay(snapshot)
    snapshot.views.presentation = presentationDisplay(snapshot)
    const runs = await Promise.all(
      (await listNotebookRows('engine-runs', id)).map((runId) =>
        readRow<EngineRun>('engine-runs', runId)
      )
    )
    snapshot.tokenUsage = sumUsage(
      runs.filter((run): run is EngineRun => Boolean(run))
    )
  }
  return snapshot
}
export const changeProject = async (
  id: string,
  update: (snapshot: Snapshot) => void | Promise<void>
) => {
  const previous = queues.get(id) || Promise.resolve()
  const next = previous
    .catch(() => {})
    .then(async () => {
      const snapshot = await loadProject(id)
      if (!snapshot) throw new Error('Project not found')
      await update(snapshot)
      snapshot.views = projectViews(snapshot.project, snapshot.events)
      snapshot.views.video.display = videoDisplay(snapshot)
      snapshot.views.presentation = presentationDisplay(snapshot)
      await writeRow('projects', id, snapshot)
      return snapshot
    })
  queues.set(id, next)
  try {
    return await next
  } finally {
    if (queues.get(id) === next) queues.delete(id)
  }
}
export const createProject = async (
  input: string,
  harness?: HarnessSelection,
  sourceOnly = false
): Promise<Snapshot> => {
  if (!input.trim()) throw new Error('Add a link or some text')
  harness = harness
    ? validateHarnessSelection(harness)
    : (await loadHarnessPreference()) || undefined
  const id = randomUUID()
  // Only the creator's identity carries into a new notebook; its look is
  // chosen when its source is read.
  const branding = identityOf(
    await readRow<import('../shared/settings').Branding>('settings', 'branding')
  )
  const snapshot: Snapshot = {
    project: {
      id,
      branding,
      harness,
      title: sourceOnly ? 'Untitled notebook' : 'Untitled video',
      source: input.trim(),
      slides: [],
      video: null
    },
    status: sourceOnly ? 'reading' : 'building',
    ...(sourceOnly ? { sourceOnly: true } : {}),
    error: null,
    events: []
  }
  addEvent(snapshot, 'slide', 'Reading your source')
  await writeRow('projects', id, snapshot)
  if (sourceOnly) scheduleSource(id)
  else scheduleSlides(id)
  return snapshot
}
const building = new Map<string, Promise<void>>()
export const scheduleSlides = (id: string) => {
  if (building.has(id)) return
  const work = buildSlides(id)
    .catch(async (reason) => {
      await changeProject(id, (current) => {
        current.status = 'failed'
        delete current.drawing
        current.error = current.stopping
          ? generationStops.user
          : reason instanceof SourceReadError
            ? reason.message
            : drawingStop(reason, current) ||
              generationFailure(
                reason,
                'Could not make the wireframes. Check your agent, then try again.'
              )
        if (reason instanceof SourceReadError) current.sourceFailure = 'blocked'
        addEvent(current, 'slide', current.error)
      })
    })
    .finally(() => {
      building.delete(id)
      // Changes queued while drawing run once the deck is ready.
      void import('./slide-changes').then(({ scheduleChanges }) =>
        scheduleChanges(id)
      )
    })
  building.set(id, work)
  void work.catch(() => {})
}
/**
 * Where drawing stopped, in the creator's words: who stopped, after how
 * many wireframes, and what Try again does (review 5).
 */
const drawingStop = (reason: unknown, snapshot: Snapshot) => {
  if (!(reason instanceof PageDrawingError)) return null
  const why =
    stopReason(reason.failure?.message) ||
    (['interrupted', 'other'].includes(reason.failure?.category || 'other')
      ? 'could not finish it'
      : null)
  if (!why) return null
  const agent = harnessName(snapshot.project.harness?.adapter)
  const total = snapshot.plannedSlides || reason.total
  const drawn = snapshot.project.slides.filter((slide) => slide.svg).length
  return `${agent} ${why} on wireframe ${reason.page} of ${total}, after three tries. ${drawn} ${drawn === 1 ? 'is' : 'are'} drawn; Try again continues from wireframe ${reason.page}.`
}
export const stopSlides = async (id: string) => {
  await changeProject(id, (current) => {
    if (current.status !== 'building')
      throw new Error('These wireframes are not being drawn')
    current.stopping = true
    addEvent(current, 'slide', 'Stopping. Drawn wireframes are kept.')
  })
  for (const runId of await listNotebookRows('engine-runs', id)) {
    const run = await readRow<EngineRun>('engine-runs', runId)
    if (run && !run.sceneId && ['preparing', 'running'].includes(run.status))
      cancelEngineRun(run.id)
  }
  if (!building.has(id))
    await changeProject(id, (current) => {
      current.status = 'failed'
      current.error = generationStops.user
    })
  return (await loadProject(id))!
}
export const retrySlides = async (id: string) => {
  const snapshot = await changeProject(id, (current) => {
    if (building.has(id))
      throw new Error('Wait for generation to stop before continuing')
    if (current.status !== 'failed')
      throw new Error('Your wireframes do not need a retry')
    current.stopping = false
    current.status = 'building'
    current.error = null
    const drawn = current.project.slides.filter((slide) => slide.svg).length
    addEvent(
      current,
      'slide',
      current.plannedSlides && drawn
        ? `Trying again from wireframe ${Math.min(drawn + 1, current.plannedSlides)}`
        : 'Trying again'
    )
  })
  scheduleSlides(id)
  return snapshot
}
export const replaceBlockedSource = async (id: string, text: unknown) => {
  if (
    typeof text !== 'string' ||
    text.trim().length < 40 ||
    text.length > 500000
  )
    throw new Error('Paste the article text, rather than only its link')
  const snapshot = await changeProject(id, async (current) => {
    if (
      current.status !== 'failed' ||
      !current.sourceFailure ||
      current.project.slides.length ||
      current.project.video
    )
      throw new Error('This notebook does not need replacement source text')
    const sourceUrl = current.project.sourceUrl || current.project.source
    const url = new URL(sourceUrl)
    if (!['https:', 'http:'].includes(url.protocol))
      throw new Error('The original source link is invalid')
    const source = {
      ...readSourceNarrative(text.trim()),
      url: sourceUrl,
      site: url.hostname
    }
    source.warnings.push(
      'Article text supplied by the creator after automatic reading was blocked.'
    )
    await writeRow('sources', id, source)
    if (!current.project.branding?.look)
      current.project.branding = withLook(
        current.project.branding,
        await startingLook(source)
      )
    current.project.sourceUrl = sourceUrl
    current.project.source = text.trim()
    current.status = current.sourceOnly ? 'draft' : 'building'
    current.project.title = source.title || 'Untitled notebook'
    current.error = null
    delete current.sourceFailure
    addEvent(current, 'slide', 'Using your pasted article text')
  })
  if (!snapshot.sourceOnly) scheduleSlides(id)
  return snapshot
}
type SlideCheckpoint = {
  source: ReturnType<typeof readSourceNarrative>
  outline: ReturnType<typeof sanitizeOutline>
  brand: ReturnType<typeof pageBrandFrom>
  slideIds?: string[]
}
const requireSlidesRunning = async (id: string) => {
  if ((await loadProject(id))?.stopping) throw new Error(generationStops.user)
}
const buildSlides = async (id: string) => {
  const snapshot = await loadProject(id)
  if (!snapshot || snapshot.status !== 'building') return
  if (!snapshot.project.harness) {
    snapshot.project.harness = (await loadHarnessPreference())!
    await changeProject(id, (current) => {
      current.project.harness = snapshot.project.harness
    })
  }
  let checkpoint = await readRow<SlideCheckpoint>('outlines', id)
  if (!checkpoint) {
    let source = await readRow<ReturnType<typeof readSourceNarrative>>(
      'sources',
      id
    )
    if (!source) {
      const input = snapshot.project.source
      source = /^https?:\/\//i.test(input)
        ? await readSourceUrl(input, { projectId: id })
        : readSourceNarrative(input)
      await writeRow('sources', id, source)
    }
    await requireSlidesRunning(id)
    await changeProject(id, (current) => {
      current.project.title = source!.title || 'Untitled video'
      current.project.source = source!.text
      if (source!.url) current.project.sourceUrl = source!.url
      addEvent(current, 'slide', 'Source ready')
    })
    let outline: ReturnType<typeof sanitizeOutline>
    {
      const origin =
        process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
        `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
      await changeProject(id, (current) =>
        addEvent(current, 'slide', 'Understanding the source')
      )
      const brief = await prepareCreativeBrief(
        { ...snapshot.project, source: source.text },
        snapshot.project.harness,
        origin,
        undefined,
        'source'
      )
      await requireSlidesRunning(id)
      await changeProject(id, (current) =>
        addEvent(current, 'slide', 'Planning the story')
      )
      outline = await prepareCreativeStory(
        id,
        source,
        snapshot.project.harness,
        origin,
        brief,
        STORY_SCENES[snapshot.project.length || 'medium']
      )
    }
    if (!outline.scenes.length) throw new Error('No slides generated')
    checkpoint = {
      source,
      outline,
      brand: pageBrandFrom(source.palette, source.fonts),
      slideIds: outline.scenes.map(() => randomUUID())
    }
    // Commit identities before any slide, so an interrupted build resumes the same outline.
    await writeRow('outlines', id, checkpoint)
  }
  if (!checkpoint.slideIds) {
    checkpoint.slideIds = checkpoint.outline.scenes.map(
      (_scene, index) => snapshot.project.slides[index]?.id || randomUUID()
    )
    await writeRow('outlines', id, checkpoint)
  }
  const { source, outline, brand, slideIds } = checkpoint
  const currentBrand = (await loadProject(id))!.project.branding
  const designBrand = {
    ...brand,
    ...(currentBrand?.palette || {}),
    ...(currentBrand?.fonts || {}),
    ...(currentBrand?.useAccent ? { accent: currentBrand.accent } : {})
  }
  const sourceBrief = await readRow<{
    brief: import('./creative/explanation-brief').ExplanationBriefV1
  }>('source-briefs', id)
  await changeProject(id, (current) => {
    current.plannedSlides = outline.scenes.length
    // The outline is the story: show its titles and script before any
    // picture exists (review 5).
    current.plan = outline.scenes.map((scene, index) => ({
      id: slideIds[index],
      title: scene.title,
      narration: scene.narration
    }))
    addEvent(current, 'slide', `Drawing ${outline.scenes.length} wireframes`)
  })
  const onDraft = async (index: number, svg: string) =>
    changeProject(id, async (current) => {
      const slideId = slideIds[index],
        scene = outline.scenes[index]
      if (
        current.project.slides.some(
          (slide) => slide.id === slideId && !slide.draft
        )
      )
        return
      const asset = await storeAsset({
        body: Buffer.from(svg),
        contentType: 'image/svg+xml',
        extension: '.svg',
        kind: 'slide-draft',
        projectId: id
      })
      await writeRow('slide-drafts', slideId, {
        projectId: id,
        slideId,
        index,
        artifactId: asset.id,
        objectKey: asset.objectKey
      })
      const draft = {
        draft: true,
        id: slideId,
        title: scene.title,
        svg,
        narration: scene.narration,
        idea: scene.idea,
        evidence: scene.source
      }
      const existing = current.project.slides.findIndex(
        (slide) => slide.id === slideId
      )
      if (existing >= 0) current.project.slides[existing] = draft
      else current.project.slides.push(draft)
      current.project.slides.sort(
        (a, b) => slideIds.indexOf(a.id) - slideIds.indexOf(b.id)
      )
      // A retry restores drawn pages; only a page drawn for the first time
      // is news.
      if (existing < 0)
        addEvent(
          current,
          'slide',
          `Wireframe ${index + 1} of ${outline.scenes.length} drawn`
        )
    }).then(() => {})
  await requireSlidesRunning(id)
  const designed = await prepareCreativePages({
    projectId: id,
    source,
    outline,
    onDraft,
    onDrawing: (indexes) =>
      changeProject(id, (current) => {
        current.drawing = indexes
      }).then(() => {}),
    brief: sourceBrief?.brief,
    brand: designBrand,
    selection: snapshot.project.harness,
    origin:
      process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
      `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
  })
  for (const [index, scene] of outline.scenes.entries()) {
    const slideId = slideIds[index]
    await changeProject(id, async (current) => {
      if (
        current.project.slides.some(
          (slide) => slide.id === slideId && !slide.draft
        )
      )
        return
      const svg = designed[index]
      if (!svg)
        throw new Error('The creative drawing stage did not return this page')
      const asset = await storeAsset({
        body: Buffer.from(svg),
        contentType: 'image/svg+xml',
        extension: '.svg',
        kind: 'slide-artwork',
        projectId: id
      })
      await writeRow('slide-artifacts', slideId, {
        projectId: id,
        slideId,
        artifactId: asset.id,
        objectKey: asset.objectKey
      })
      current.project.title = outline.title
      const accepted = {
        id: slideId,
        title: scene.title,
        svg,
        narration: scene.narration,
        idea: scene.idea,
        evidence: scene.source
      }
      const existing = current.project.slides.findIndex(
        (slide) => slide.id === slideId
      )
      if (existing >= 0) current.project.slides[existing] = accepted
      else current.project.slides.push(accepted)
    })
  }
  await changeProject(id, (current) => {
    if (current.stopping) throw new Error(generationStops.user)
    current.status = 'ready'
    current.error = null
    delete current.plan
    delete current.drawing
    addEvent(current, 'slide', 'Wireframes ready')
  })
}
export const editSlide = (id: string, edit: SlideEdit) =>
  changeProject(id, (snapshot) => {
    if (edit.action === 'script') {
      // The script under a wireframe (review 5): the narration the video
      // will speak, edited beside the picture.
      const slide = snapshot.project.slides.find(
        (item) => item.id === edit.slideId
      )
      if (!slide) throw new Error('Wireframe not found')
      if (snapshot.status !== 'ready')
        throw new Error('Edit the script once the wireframes are ready')
      if (typeof edit.narration !== 'string')
        throw new Error('Add the script for this wireframe')
      slide.narration = edit.narration.trim()
      reconcileVideo(snapshot.project, snapshot)
      return
    }
    if (snapshot.status === 'building')
      throw new Error('Wait for the wireframes to finish')
    const slides = snapshot.project.slides
    const index = slides.findIndex((slide) => slide.id === edit.slideId)
    const restored = snapshot.deletedSlide
    if (edit.action === 'undo-delete') {
      if (!snapshot.deletedSlide) throw new Error('No slide to restore')
      slides.splice(
        Math.min(snapshot.deletedSlide.index, slides.length),
        0,
        snapshot.deletedSlide.slide
      )
      if (snapshot.deletedSlide.scene && snapshot.project.video)
        snapshot.project.video.scenes.push(snapshot.deletedSlide.scene)
      delete snapshot.deletedSlide
    } else if (edit.action === 'add')
      slides.push({ id: randomUUID(), title: '', svg: null })
    else {
      if (index < 0) throw new Error('Slide not found')
      if (edit.action === 'delete') {
        const video = snapshot.project.video
        snapshot.deletedSlide = {
          index,
          slide: slides.splice(index, 1)[0],
          scene: video?.scenes.find((scene) => scene.slideId === edit.slideId),
          seams: video?.scenes.slice(0, -1).flatMap((scene, i) =>
            scene.slideId === edit.slideId ||
            video.scenes[i + 1].slideId === edit.slideId
              ? [
                  {
                    left: scene.slideId,
                    right: video.scenes[i + 1].slideId,
                    transition: video.transitions[i]
                  }
                ]
              : []
          )
        }
      }
      if (edit.action === 'duplicate')
        slides.splice(index + 1, 0, { ...slides[index], id: randomUUID() })
      if (edit.action === 'move') {
        if (
          !Number.isInteger(edit.index) ||
          edit.index! < 0 ||
          edit.index! >= slides.length
        )
          throw new Error('Invalid position')
        slides.splice(edit.index!, 0, slides.splice(index, 1)[0])
      }
    }
    reconcileVideo(snapshot.project, snapshot)
    if (
      edit.action === 'undo-delete' &&
      restored?.seams &&
      snapshot.project.video
    ) {
      const video = snapshot.project.video
      video.scenes.slice(0, -1).forEach((scene, index) => {
        const seam = restored!.seams!.find(
          (seam) =>
            seam.left === scene.slideId &&
            seam.right === video.scenes[index + 1].slideId
        )
        if (seam) video.transitions[index] = seam.transition
      })
      refreshVideoKeys(snapshot.project)
    }
    addEvent(snapshot, 'slide', 'Wireframes updated')
  })

/** A slide picture with something in it: an empty <svg/> placeholder is not one. */
const drawn = (svg: string | null | undefined) =>
  Boolean(svg && !/^<svg[^>]*(\/>|>\s*<\/svg>)\s*$/i.test(svg.trim()))
const siteOf = (url?: string) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : null
  } catch {
    return null
  }
}
export const listNotebooks = async (): Promise<
  import('../shared/api').NotebookSummary[]
> => {
  const result = []
  for (const id of await listRows('projects')) {
    const saved = await loadProject(id)
    if (saved)
      result.push({
        id,
        title: saved.project.title,
        status: saved.status,
        hasVideo: Boolean(saved.project.video),
        updatedAt: saved.events.at(-1)?.time || null,
        site: siteOf(saved.project.sourceUrl),
        preview:
          saved.project.slides.find((slide) => drawn(slide.svg))?.svg ?? null,
        slides: saved.project.slides.length
      })
  }
  return result
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 50)
}
