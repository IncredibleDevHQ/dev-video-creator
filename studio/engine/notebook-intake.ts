import type { HarnessSelection, StoryLength } from '../shared/model'
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

export const editNotebookSource = async (
  id: string,
  text: unknown,
  title: unknown
) => {
  if (typeof text !== 'string' || !text.trim() || text.length > 24_000)
    throw new Error('Add notes up to 24,000 characters')
  if (typeof title !== 'string' || !title.trim() || title.length > 160)
    throw new Error('Add a notebook title up to 160 characters')
  return changeProject(id, async (current) => {
    if (
      !['draft', 'failed'].includes(current.status) ||
      current.project.slides.length ||
      current.project.video
    )
      throw new Error('Edit the notes before creating slides')
    const runs = await Promise.all(
      (await listNotebookRows('engine-runs', id)).map((runId) =>
        readRow<EngineRun>('engine-runs', runId)
      )
    )
    if (
      runs.some((run) => run && ['preparing', 'running'].includes(run.status))
    )
      throw new Error('Wait for generation to finish before editing the notes')
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
    current.status = 'draft'
    current.sourceOnly = true
    current.error = null
    current.stopping = false
    delete current.sourceFailure
    delete current.progress
    delete current.plannedSlides
    addEvent(current, 'slide', 'Notebook notes edited')
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
      throw new Error('Refresh the article before creating slides')
    const url = current.project.sourceUrl || current.project.source
    if (!/^https?:\/\//i.test(url))
      throw new Error('This notebook has no article link to refresh')
    const runs = await Promise.all(
      (await listNotebookRows('engine-runs', id)).map((runId) =>
        readRow<EngineRun>('engine-runs', runId)
      )
    )
    if (
      runs.some((run) => run && ['preparing', 'running'].includes(run.status))
    )
      throw new Error(
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
    throw new Error(
      'This local agent is unavailable. Detect agents again in Settings.'
    )
  if (
    choice.models?.options.some(
      (model) => model.id === harness.model && model.unavailable
    )
  )
    throw new Error('Choose an available model for this agent')
  return harness
}

export const setNotebookLength = (id: string, raw: unknown) => {
  if (!['short', 'medium', 'long'].includes(String(raw)))
    throw new Error('Choose a short, medium or long story')
  return changeProject(id, (current) => {
    if (
      !['draft', 'failed'].includes(current.status) ||
      current.project.slides.length
    )
      throw new Error('Choose the length before the wireframes are drawn')
    current.project.length = raw as StoryLength
  })
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
    throw new Error(
      'No agent was found on this computer. Install Claude Code, Codex or Kimi and sign in, then choose it from the agent menu.'
    )
  return { adapter }
}

export const startPresentation = async (id: string, raw?: unknown) => {
  const saved = await loadProject(id)
  if (!saved) throw new Error('Notebook not found')
  const harness = await availableHarness(
    raw ?? saved.project.harness ?? (await detectedHarness())
  )
  const look = saved.project.branding?.look
    ? null
    : await startingLook(await readRow<SourceRead>('sources', id))
  const snapshot = await changeProject(id, (current) => {
    if (current.status !== 'draft' || current.project.slides.length)
      throw new Error('This notebook is not ready to start a presentation')
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
      throw new Error(
        'Wait for the current generation to finish before changing agents'
      )
    current.project.harness = harness
    if (current.project.video) current.project.video.settings.harness = harness
  })
