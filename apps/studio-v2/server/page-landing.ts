// Pages a design run finishes land on their base notebook here, in the app's
// worker, whichever notebook the creator has open — the base, its video, or
// none (BoltDB review B06). The notebook window used to land them, and only
// while the base itself was open: a video made early went on waiting for
// pages its base had already been given.
//
// A scene opened before the run finished its page carries the run and the
// page it waits for (pageOrigin.designing). Each pass reads the run's pages
// and applies the same rules the window did: a page the scene does not show
// yet lands, once the studio can read it; a scene changed since it was
// bound keeps its change; a run that has ended lets its bindings go. A page
// lands in the form the studio reads it (atomized), and is marked for its
// motion to be planned again from its words when the notebook next opens —
// planning is the notebook window's. Every write is a compare-and-swap on
// the copy it read, so an edit made meanwhile is never overwritten: that
// pass stands down and the next one reads again. Passes are idempotent, so
// a pass repeated — after a restart, or asked twice — changes nothing more.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProjectDocumentV1 } from 'markdown-composition'
import { bindingOf, landingFor, pageFingerprint, runPageFor, settledOrigin } from '../src/page-design'

export type RunPage = { name: string; svg: string; program: unknown | null }
// Whether the studio can read a page, and the page as it reads it.
export type PageCheck = (svg: string) => Promise<{ ok: true; svg: string } | { ok: false; reason: string }>
export type LandingDeps = {
  load: (notebookId: string) => Promise<ProjectDocumentV1 | null>
  // Throws with statusCode 409 when the stored notebook is no longer `expected`.
  save: (project: ProjectDocumentV1, expected: ProjectDocumentV1) => Promise<void>
  run: (runId: string) => Promise<{ status: string; projectDir: string } | null>
  pages: (projectDir: string) => Promise<RunPage[]>
  check: PageCheck
}
export type LandingResult = {
  notebook: string
  // Scene titles: pages landed, scenes that kept their own change, and
  // schematic drafts the run ended without designing.
  landed: string[]
  kept: string[]
  stayed: string[]
  // Scenes still waiting on a run that is working.
  waiting: number
  // Whether the pass wrote the notebook, or stood down for an edit made meanwhile.
  saved: boolean
  conflict: boolean
}

const ENDED = new Set(['done', 'error', 'cancelled', 'interrupted'])

// The pages a page-master run has drawn: every pages/*.svg beside its program.
export const runPagesIn = async (projectDir: string): Promise<RunPage[]> => {
  const pagesDir = join(projectDir, 'pages')
  const names = await readdir(pagesDir).catch(() => [] as string[])
  const pages: RunPage[] = []
  for (const name of names.filter(entry => entry.toLowerCase().endsWith('.svg')).sort()) {
    const svg = await readFile(join(pagesDir, name), 'utf8').catch(() => '')
    if (!svg.trim()) continue
    const program = await readFile(join(pagesDir, name.replace(/\.svg$/i, '.program.json')), 'utf8')
      .then(text => JSON.parse(text) as unknown)
      .catch(() => null)
    pages.push({ name, svg, program })
  }
  return pages
}

// A scene's page as its schematic, when it is one: what a designed slide
// keeps beside it once the slide replaces it.
const schematicOf = (attrs: Record<string, unknown>) =>
  (attrs.pageOrigin as { kind?: string } | null | undefined)?.kind !== 'designed' && typeof attrs.svg === 'string' && attrs.svg ? { svg: attrs.svg, program: attrs.program ?? null } : null

export const landPages = async (notebookId: string, deps: LandingDeps): Promise<LandingResult> => {
  const result: LandingResult = { notebook: notebookId, landed: [], kept: [], stayed: [], waiting: 0, saved: false, conflict: false }
  const stored = await deps.load(notebookId)
  // A video notebook is pinned to its base as it was: it never takes pages.
  if (!stored || stored.derivedFrom?.notebook) return result
  const next = structuredClone(stored)
  const content = next.notebook.content
  const bound = content.flatMap((node, index) => {
    const binding = node.type === 'scene' ? bindingOf(node.attrs as Record<string, unknown>) : null
    return binding ? [{ index, binding }] : []
  })
  if (!bound.length) return result
  let changed = false
  for (const runId of [...new Set(bound.map(entry => entry.binding.runId))]) {
    const run = await deps.run(runId)
    // A run the store no longer knows has nothing more to give.
    const ended = !run || ENDED.has(run.status)
    const pages = run ? await deps.pages(run.projectDir) : []
    for (const { index, binding } of bound.filter(entry => entry.binding.runId === runId)) {
      const node = content[index]
      const attrs = (node.attrs || {}) as Record<string, unknown>
      const title = String(attrs.title || 'Untitled scene')
      const page = runPageFor(pages, binding.page)
      const landing = landingFor(String(attrs.svg || ''), binding, page, ended)
      if (landing === 'wait') {
        result.waiting += 1
        continue
      }
      if (landing === 'apply' && page) {
        const verdict = await deps.check(page.svg).catch(error => ({ ok: false as const, reason: error instanceof Error ? error.message : String(error) }))
        if (!verdict.ok) {
          // A page still being written reads on a later pass; once the run
          // has ended it failed the page check and the scene stays as it is.
          if (!ended) {
            result.waiting += 1
            continue
          }
          node.attrs = { ...attrs, pageOrigin: settledOrigin(attrs.pageOrigin) }
          changed = true
          if ((attrs.pageOrigin as { kind?: string } | null | undefined)?.kind !== 'designed') result.stayed.push(title)
          continue
        }
        const origin = { kind: 'designed', by: binding.by, runId, replan: true }
        node.attrs = {
          ...attrs,
          svg: verdict.svg,
          svgSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(verdict.svg)}`,
          program: page.program || null,
          // Still bound while the run checks the rest: to the page as it
          // landed, and to the run's page it came from, so a page the run
          // redraws lands again and the same one never twice.
          pageOrigin: ended ? origin : { ...origin, designing: { ...binding, placeholder: pageFingerprint(verdict.svg), landed: pageFingerprint(page.svg) } },
          // The schematic it was designed from stays beside the slide.
          schematic: attrs.schematic ?? schematicOf(attrs),
        }
        changed = true
        result.landed.push(title)
        continue
      }
      // Changed since it was bound, or the run is over: the binding goes.
      const wasSchematic = (attrs.pageOrigin as { kind?: string } | null | undefined)?.kind !== 'designed'
      node.attrs = { ...attrs, pageOrigin: settledOrigin(attrs.pageOrigin) }
      changed = true
      if (landing === 'kept') result.kept.push(title)
      else if (wasSchematic) result.stayed.push(title)
    }
  }
  if (!changed) return result
  try {
    await deps.save(next, stored)
    result.saved = true
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 409) throw error
    // Edited meanwhile: nothing landed on this pass; the next reads again.
    return { ...result, landed: [], kept: [], stayed: [], conflict: true }
  }
  return result
}

// One pass at a time per notebook: a sweep and a request for the same
// notebook share the pass already running.
const passes = new Map<string, Promise<LandingResult>>()
export const landPagesOnce = (notebookId: string, deps: LandingDeps) => {
  const running = passes.get(notebookId)
  if (running) return running
  const pass = landPages(notebookId, deps).finally(() => passes.delete(notebookId))
  passes.set(notebookId, pass)
  return pass
}
