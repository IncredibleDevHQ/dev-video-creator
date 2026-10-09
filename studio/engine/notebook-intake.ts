import type { HarnessSelection, StoryLength } from '../shared/model'
import { narrativeById, validDirection } from '../shared/narratives'
import { suggestQuietly } from './template-suggest'
import {
  changeProject,
  loadProject,
  scheduleSlides,
  addEvent
} from './projects'
import { readRow, writeRow, deleteRow, listNotebookRows } from './persistence'
import { readSourceNarrative } from './source-document'
import { readSourceUrl } from './source-reader'
import {
  validateHarnessSelection,
  loadHarnessPreference
} from './harness/preference'
import { inspectHarnesses, type EngineRun } from './harness/runtime'
import { creativeContext } from './creative/stage'
import type { SourceRead } from './source-document'
import { startingLook, withLook } from './looks'
import { loadHarnessPreference as savedHarness } from './harness/preference'
import { Refusal, asRefusal } from './refusal'
import { NOTE_LIMIT, notesLength } from '../shared/notes'

// Edits save as the creator types; the suggestion is asked for once they
// stop for a while.
const settling = new Map<string, ReturnType<typeof setTimeout>>()
const suggestAfterEdits = (id: string, wait = 15_000) => {
  clearTimeout(settling.get(id))
  const timer = setTimeout(() => {
    settling.delete(id)
    suggestQuietly(id)
  }, wait)
  timer.unref?.()
  settling.set(id, timer)
}

export const editNotebookSource = async (
  id: string,
  text: unknown,
  title: unknown
) => {
  if (typeof text !== 'string' || !text.trim())
    throw new Refusal('Add some notes to save')
  if (notesLength(text) > NOTE_LIMIT)
    throw new Refusal(
      `Shorten the notes to ${NOTE_LIMIT.toLocaleString('en')} characters; they have ${notesLength(text).toLocaleString('en')}`
    )
  if (typeof title !== 'string' || !title.trim() || title.length > 160)
    throw new Refusal('Add a notebook title up to 160 characters')
  return changeProject(id, async (current) => {
    if (
      !['draft', 'failed'].includes(current.status) ||
      current.project.slides.length ||
      current.project.video
    )
      throw new Refusal('Edit the notes before creating slides')
    const runs = await Promise.all(
      (await listNotebookRows('engine-runs', id)).map((runId) =>
        readRow<EngineRun>('engine-runs', runId)
      )
    )
    if (
      runs.some((run) => run && ['preparing', 'running'].includes(run.status))
    )
      throw new Refusal(
        'Wait for generation to finish before editing the notes'
      )
    const retained = await readRow<SourceRead>('sources', id)
    const revised = readSourceNarrative(text, title.trim())
    const source: SourceRead = {
      ...(retained || revised),
      title: revised.title,
      text: revised.text,
      words: revised.words,
      headings: revised.headings,
      extraction: revised.extraction,
      warnings: ['The source text was edited by the creator.']
    }
    await deleteRow('outlines', id)
    await writeRow('sources', id, source)
    current.project.source = source.text
    current.project.title = source.title
    // The suggestion stays, marked as made before these edits; Jev is asked
    // again once the edits settle (review 6).
    if (current.suggestion) current.suggestion.stale = true
    current.status = 'draft'
    current.sourceOnly = true
    current.error = null
    current.stopping = false
    delete current.sourceFailure
    delete current.progress
    delete current.plannedSlides
    // The story planned from the notes before goes with its outline.
    delete current.plan
    addEvent(current, 'slide', 'Notebook notes edited')
  }).then((saved) => {
    suggestAfterEdits(id)
    return saved
  })
}

const reading = new Set<string>()
export const scheduleSource = (id: string) => {
  if (reading.has(id)) return
  reading.add(id)
  void readNotebookSource(id).finally(() => reading.delete(id))
}

export const readNotebookSource = async (id: string) => {
  try {
    const snapshot = await loadProject(id)
    if (!snapshot || snapshot.status !== 'reading') return
    const input = snapshot.project.sourceUrl || snapshot.project.source
    const source = /^https?:\/\//i.test(input)
      ? await readSourceUrl(input, { projectId: id })
      : readSourceNarrative(input)
    await writeRow('sources', id, source)
    const look = await startingLook(source)
    await changeProject(id, (current) => {
      current.project.source = source.text
      current.project.title = source.title || 'Untitled notebook'
      if (source.url) current.project.sourceUrl = source.url
      // A notebook starts with a look; the creator changes it later, beside
      // the wireframes. No brand dialog stands before the first wireframe.
      if (!current.project.branding?.look)
        current.project.branding = withLook(current.project.branding, look)
      current.status = 'draft'
      current.error = null
      delete current.sourceFailure
      addEvent(
        current,
        'slide',
        'Source ready. Create a presentation when you’re ready.'
      )
    })
    // Jev, when set up, suggests the template the source tells.
    suggestQuietly(id)
  } catch (reason) {
    await changeProject(id, (current) => {
      current.status = 'failed'
      current.error =
        reason instanceof Error ? reason.message : 'Could not read the source'
      if (
        /^https?:\/\//i.test(
          current.project.sourceUrl || current.project.source
        )
      )
        current.sourceFailure = 'blocked'
      addEvent(current, 'slide', current.error)
    }).catch(() => {})
  }
}

// Re-read an imported URL before any slides exist. Keep the saved text visible
// while fetching; a failed refresh must not erase the creator's source.
export const refreshNotebookSource = async (id: string) => {
  const snapshot = await changeProject(id, async (current) => {
    if (
      !['draft', 'failed'].includes(current.status) ||
      current.project.slides.length ||
      current.project.video
    )
      throw new Refusal('Refresh the article before creating slides')
    const url = current.project.sourceUrl || current.project.source
    if (!/^https?:\/\//i.test(url))
      throw new Refusal('This notebook has no article link to refresh')
    const runs = await Promise.all(
      (await listNotebookRows('engine-runs', id)).map((runId) =>
        readRow<EngineRun>('engine-runs', runId)
      )
    )
    if (
      runs.some((run) => run && ['preparing', 'running'].includes(run.status))
    )
      throw new Refusal(
        'Wait for the current generation to finish before refreshing the article'
      )
    // An interrupted build may have planned, but not drawn, its slides.
    // Its outline cannot be reused with a newly extracted source.
    await deleteRow('outlines', id)
    current.project.sourceUrl = url
    current.status = 'reading'
    current.sourceOnly = true
    current.stopping = false
    current.error = null
    delete current.sourceFailure
    delete current.plannedSlides
    // The story planned from the notes before goes with its outline.
    delete current.plan
    delete current.progress
    addEvent(current, 'slide', 'Refreshing the article from its original link')
  })
  scheduleSource(id)
  return snapshot
}

export const availableHarness = async (raw: unknown) => {
  const harness = validateHarnessSelection(raw)
  const [choice] = await inspectHarnesses(
    creativeContext('http://127.0.0.1'),
    harness.adapter
  )
  if (!choice?.ok)
    throw new Refusal(
      'This local agent is unavailable. Detect agents again in Settings.'
    )
  // When the agent lists its models, only a listed, available one is kept,
  // with the name the list gives it, as the picker shows it (review 6: the
  // notebook said the raw id).
  const options = choice.models?.options || []
  const listed = options.find((model) => model.id === harness.model)
  if (harness.model && options.length && (!listed || listed.unavailable))
    throw new Refusal('Choose an available model for this agent')
  return listed && listed.label !== listed.id
    ? { ...harness, label: listed.label }
    : harness
}

export const setNotebookLength = (id: string, raw: unknown) => {
  if (!['short', 'medium', 'long'].includes(String(raw)))
    throw new Refusal('Choose a short, medium or long story')
  return changeProject(id, (current) => {
    if (
      !['draft', 'failed'].includes(current.status) ||
      current.project.slides.length
    )
      throw new Refusal('Choose the length before the wireframes are drawn')
    current.project.length = raw as StoryLength
  })
}

/**
 * The template the wireframes are planned from, and how it is told: chosen,
 * like the length, before any wireframe is drawn. An outline planned for
 * another story is dropped, so the next attempt plans from the new beats.
 */
export const setNotebookTemplate = async (id: string, raw: unknown) => {
  const value = (raw ?? {}) as { narrative?: unknown; direction?: unknown }
  const narrative = value.narrative
    ? narrativeById(String(value.narrative))
    : undefined
  if (value.narrative && !narrative)
    throw new Refusal('Choose one of the templates, or none')
  const direction = narrative
    ? asRefusal(() =>
        validDirection(
          narrative,
          value.direction ?? { preset: narrative.preset }
        )
      )
    : undefined
  const snapshot = await changeProject(id, (current) => {
    if (
      !['draft', 'failed'].includes(current.status) ||
      current.project.slides.length
    )
      throw new Refusal('Choose the template before the wireframes are drawn')
    if (narrative) {
      current.project.narrative = narrative.id
      current.project.direction = direction
    } else {
      delete current.project.narrative
      delete current.project.direction
    }
    current.project.templateChosen = true
  })
  await deleteRow('outlines', id)
  return snapshot
}

/**
 * The agent a notebook uses when the creator has not chosen one: the saved
 * choice, else the first agent found on this computer (review 5: ask nothing
 * before the first wireframe).
 */
export const detectedHarness = async (): Promise<HarnessSelection> => {
  const saved = await savedHarness()
  if (saved) return saved
  const found = (await inspectHarnesses(creativeContext('http://127.0.0.1')))
    .filter((choice) => choice.ok)
    .map((choice) => choice.id)
  const adapter = (['claude-code', 'codex', 'kimi'] as const).find((id) =>
    found.includes(id)
  )
  if (!adapter)
    throw new Refusal(
      'No agent was found on this computer. Install Claude Code, Codex or Kimi and sign in, then choose it from the agent menu.'
    )
  return { adapter }
}

export const startPresentation = async (id: string, raw?: unknown) => {
  const saved = await loadProject(id)
  if (!saved) throw new Refusal('Notebook not found')
  const harness = await availableHarness(
    raw ?? saved.project.harness ?? (await detectedHarness())
  )
  const look = saved.project.branding?.look
    ? null
    : await startingLook(await readRow<SourceRead>('sources', id))
  const snapshot = await changeProject(id, (current) => {
    if (current.status !== 'draft' || current.project.slides.length)
      throw new Refusal('This notebook is not ready to start a presentation')
    if (look && !current.project.branding?.look)
      current.project.branding = withLook(current.project.branding, look)
    current.project.harness = harness
    current.sourceOnly = false
    current.status = 'building'
    current.error = null
    addEvent(current, 'slide', 'Creating your wireframes')
  })
  scheduleSlides(id)
  return snapshot
}

export const setNotebookHarness = async (
  id: string,
  harness: HarnessSelection
) =>
  changeProject(id, async (current) => {
    const runs = await Promise.all(
      (await listNotebookRows('engine-runs', id)).map((runId) =>
        readRow<EngineRun>('engine-runs', runId)
      )
    )
    if (
      current.status === 'building' ||
      runs.some(
        (run) => run && ['preparing', 'running'].includes(run.status)
      ) ||
      current.project.video?.scenes.some((scene) =>
        ['queued', 'writing', 'changing', 'replanning', 'producing'].includes(
          scene.phase
        )
      )
    )
      throw new Refusal(
        'Wait for the current generation to finish before changing agents'
      )
    current.project.harness = harness
    if (current.project.video) current.project.video.settings.harness = harness
  })
