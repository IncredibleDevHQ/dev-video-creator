// Pages still being designed after their notebook opened (F2 of the fresh
// end-to-end review). Opening the notebook no longer stops the designer: a
// scene opened before the run finished its page carries the run and the
// page it waits for (pageOrigin.designing), and the page the run finishes
// lands on that scene only while the scene still shows the page it was
// opened with. The binding lives on the scene, so a reload resumes it.
import { fingerprintOf } from './planning/fingerprint'

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
