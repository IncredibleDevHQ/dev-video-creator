// Pages still being designed after their notebook opened (F2 of the fresh
// end-to-end review). Opening the notebook no longer stops the designer: a
// scene opened before the run finished its page carries the run and the
// page it waits for (pageOrigin.designing), and the page the run finishes
// lands on that scene only while the scene still shows the page it was
// opened with. The binding lives on the scene, so a reload resumes it.
import { fingerprintOf, stableJson } from './planning/fingerprint'

export type PageDesignBinding = {
  runId: string
  // The run's page number (its file is NN_*.svg).
  page: number
  // Who designs it, as the pages name it.
  by: string
  // The page the scene shows, as the notebook keeps it: a scene that no
  // longer shows it was changed, and keeps its change.
  placeholder: string
  // The run's own page last taken for it, so the same page never lands
  // twice; a page the run redraws lands again.
  landed?: string
}

export const pageFingerprint = (svg: string) => fingerprintOf(String(svg || ''))

export const bindingOf = (attrs: Record<string, unknown> | null | undefined): PageDesignBinding | null => {
  const origin = attrs?.pageOrigin as { designing?: Partial<PageDesignBinding> } | null | undefined
  const designing = origin?.designing
  if (!designing || typeof designing.runId !== 'string' || !designing.runId || !Number.isInteger(designing.page)) return null
  return { runId: designing.runId, page: Number(designing.page), by: String(designing.by || ''), placeholder: String(designing.placeholder || ''), ...(designing.landed ? { landed: String(designing.landed) } : {}) }
}

// The run's page for a binding, by its file's number.
export const runPageFor = <T extends { name: string }>(pages: T[], page: number) =>
  pages.find(entry => Number(/^(\d{2})/.exec(entry.name)?.[1]) === page)

// What becomes of a bound scene on one pass over its run:
// - wait: nothing new yet, and the run is still working;
// - apply: the run has a page the scene does not show yet;
// - kept: the scene changed since it was bound — it keeps its change;
// - ended: the run ended with nothing more for it — it stays as it is.
export type Landing = 'wait' | 'apply' | 'kept' | 'ended'
export const landingFor = (sceneSvg: string, binding: PageDesignBinding, entry: { svg: string } | undefined, ended: boolean): Landing => {
  if (pageFingerprint(sceneSvg) !== binding.placeholder) return 'kept'
  const page = entry ? pageFingerprint(entry.svg) : ''
  if (page && page !== binding.landed && page !== binding.placeholder) return 'apply'
  return ended ? 'ended' : 'wait'
}

// A scene's page origin once its binding is settled: the binding goes, and
// what the page is stays said.
export const settledOrigin = (origin: unknown) => {
  if (!origin || typeof origin !== 'object') return origin ?? null
  const { designing: _designing, ...rest } = origin as Record<string, unknown>
  return rest
}

// A scene's page, as a landing changes it: the drawing, its program, how it
// was made and the schematic kept beside a designed slide.
export const PAGE_KEYS = ['svg', 'svgSrc', 'program', 'pageOrigin', 'schematic'] as const
type Doc = { notebook: { content: Array<{ type: string; attrs?: Record<string, unknown> | null }> } }

// What the worker changed on a notebook since the copy a window last saved,
// when all it changed are the pages of scenes bound to a design run (B06):
// for each such scene, its page as the worker left it. Anything else that
// differs was edited elsewhere: null, and the window's save says so.
export const landedPageChanges = <T extends Doc>(known: T, stored: T): Map<string, Record<string, unknown>> | null => {
  const bound = new Set(known.notebook.content.flatMap(node => (node.type === 'scene' && bindingOf(node.attrs) ? [String(node.attrs?.id || '')] : [])))
  const withoutPages = (doc: T) => ({
    ...doc,
    notebook: {
      ...doc.notebook,
      content: doc.notebook.content.map(node => {
        if (!bound.has(String(node.attrs?.id || ''))) return node
        const attrs = { ...(node.attrs || {}) }
        for (const key of PAGE_KEYS) delete attrs[key]
        return { ...node, attrs }
      }),
    },
  })
  if (stableJson(withoutPages(known)) !== stableJson(withoutPages(stored))) return null
  const pageOf = (attrs: Record<string, unknown> | null | undefined) => Object.fromEntries(PAGE_KEYS.map(key => [key, attrs?.[key] ?? null]))
  const knownById = new Map(known.notebook.content.map(node => [String(node.attrs?.id || ''), node]))
  const changes = new Map<string, Record<string, unknown>>()
  for (const node of stored.notebook.content) {
    const id = String(node.attrs?.id || '')
    if (!bound.has(id)) continue
    const page = pageOf(node.attrs)
    if (stableJson(page) !== stableJson(pageOf(knownById.get(id)?.attrs))) changes.set(id, page)
  }
  return changes
}

// Whether a scene still shows the page a copy had: a page changed in the
// window since keeps that change over a landing.
export const samePage = (a: Record<string, unknown> | null | undefined, b: Record<string, unknown> | null | undefined) =>
  PAGE_KEYS.every(key => stableJson(a?.[key] ?? null) === stableJson(b?.[key] ?? null))

// What a base's pages are now, before a video is made from it (F1 of the
// Perplexity review): designed slides, schematic drafts, pages still being
// designed by a run, and pages made some other way.
export const pageReadinessOf = (nodes: Array<{ type: string; attrs?: Record<string, unknown> | null }>) => {
  const readiness = { total: 0, designed: 0, schematic: 0, pending: 0, other: 0 }
  for (const node of nodes) {
    if (node.type !== 'scene' || !node.attrs?.id) continue
    readiness.total += 1
    const origin = node.attrs.pageOrigin as { kind?: string; designing?: unknown } | null | undefined
    if (origin?.designing && origin.kind !== 'designed') readiness.pending += 1
    else if (origin?.kind === 'designed') readiness.designed += 1
    else if (origin?.kind === 'schematic') readiness.schematic += 1
    else readiness.other += 1
  }
  return readiness
}
export type PageReadiness = ReturnType<typeof pageReadinessOf>
