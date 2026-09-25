import { describe, expect, it } from 'vitest'
import { bindingOf, landingFor, pageFingerprint, pageReadinessOf, runPageFor, settledOrigin } from './page-design'

// F2 of the fresh end-to-end review: opening the notebook stopped the pages
// still being designed. They now land on their scene, bound to the page the
// scene was opened with.
const draft = '<svg><text>schematic draft</text></svg>'
const designed = '<svg><text>designed page</text></svg>'
const redrawn = '<svg><text>designed page, checked and redrawn</text></svg>'
const binding = { runId: 'run-1', page: 3, by: 'Claude Code · Claude Opus 5.5', placeholder: pageFingerprint(draft) }

describe('a page designed after its notebook opened', () => {
  it('reads the binding a scene carries, and nothing from a scene without one', () => {
    expect(bindingOf({ pageOrigin: { kind: 'schematic', designing: binding } })).toEqual(binding)
    expect(bindingOf({ pageOrigin: { kind: 'designed', designing: { ...binding, landed: 'abc' } } })).toEqual({ ...binding, landed: 'abc' })
    expect(bindingOf({ pageOrigin: { kind: 'schematic' } })).toBeNull()
    expect(bindingOf({ pageOrigin: { kind: 'schematic', designing: { runId: '', page: 3 } } })).toBeNull()
    expect(bindingOf({})).toBeNull()
  })

  it('finds the run\'s page by its number', () => {
    const pages = [{ name: '01_title.svg' }, { name: '03_recovery.svg' }, { name: 'receipt.json' }]
    expect(runPageFor(pages, 3)?.name).toBe('03_recovery.svg')
    expect(runPageFor(pages, 2)).toBeUndefined()
  })

  it('lands a finished page only on the scene that still shows its draft', () => {
    // Nothing yet: wait while the run works, stay as it is once it ended.
    expect(landingFor(draft, binding, undefined, false)).toBe('wait')
    expect(landingFor(draft, binding, undefined, true)).toBe('ended')
    // The run's page arrives: it lands.
    expect(landingFor(draft, binding, { svg: designed }, false)).toBe('apply')
    // Landed and planned, the scene keeps the page with its parts' ids: the
    // binding follows that page and remembers the run's own. The same run
    // page does not land twice; one the run redraws while it checks does.
    const planned = `${designed}<!-- ids -->`
    const landed = { ...binding, placeholder: pageFingerprint(planned), landed: pageFingerprint(designed) }
    expect(landingFor(planned, landed, { svg: designed }, false)).toBe('wait')
    expect(landingFor(planned, landed, { svg: redrawn }, false)).toBe('apply')
    expect(landingFor(planned, landed, { svg: designed }, true)).toBe('ended')
  })

  it('never overwrites a scene changed since it was bound', () => {
    const changed = '<svg><text>a page the creator put here</text></svg>'
    expect(landingFor(changed, binding, { svg: designed }, false)).toBe('kept')
    expect(landingFor(changed, binding, undefined, true)).toBe('kept')
  })

  it('settles a scene\'s origin without its binding, keeping what the page is', () => {
    expect(settledOrigin({ kind: 'designed', by: 'Kimi', runId: 'run-1', designing: binding })).toEqual({ kind: 'designed', by: 'Kimi', runId: 'run-1' })
    expect(settledOrigin({ kind: 'schematic', designing: binding })).toEqual({ kind: 'schematic' })
    expect(settledOrigin(null)).toBeNull()
  })

  // F1 of the Perplexity review: a video made while pages were still being
  // designed kept their schematics, and nothing said so before the fork.
  it('counts what the base\'s pages are before a video is made from them', () => {
    const page = (id: string, pageOrigin: unknown) => ({ type: 'scene', attrs: { id, pageOrigin } })
    expect(pageReadinessOf([
      page('a', { kind: 'designed', by: 'Kimi' }),
      page('b', { kind: 'designed', by: 'Kimi', designing: binding }),
      page('c', { kind: 'schematic', designing: binding }),
      page('d', { kind: 'schematic' }),
      page('e', null),
      { type: 'paragraph', attrs: { id: 'p' } },
    ])).toEqual({ total: 5, designed: 2, schematic: 1, pending: 1, other: 1 })
  })
})
