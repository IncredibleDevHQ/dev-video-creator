import { describe, expect, it } from 'vitest'
import type { ProjectDocumentV1 } from 'markdown-composition'
import { landPages, type LandingDeps, type RunPage } from './page-landing'
import { landedPageChanges, pageFingerprint } from '../src/page-design'

// BoltDB review B06: a base's pages land in the worker, whichever notebook
// is open. These passes run on an in-memory store and run folder.
const schematic = (label: string) => `<svg viewBox="0 0 1280 720"><text>${label} schematic</text></svg>`
const designed = (label: string, take = 1) => `<svg viewBox="0 0 1280 720"><g id="${label}"><text>${label} designed ${take}</text></g></svg>`
// The studio reads a page by atomizing it; here that is a mark on the page.
const atomized = (svg: string) => svg.replace('<svg ', '<svg data-atomized="1" ')

const scene = (id: string, title: string, page: number, extra: Record<string, unknown> = {}) => {
  const svg = schematic(title)
  return { type: 'scene', attrs: { id, title, svg, script: `${title} in words.`, pageOrigin: { kind: 'schematic', designing: { runId: 'run-1', page, by: 'Claude Code', placeholder: pageFingerprint(svg) } }, ...extra } }
}
const notebook = (content: ReturnType<typeof scene>[], extra: Partial<ProjectDocumentV1> = {}) =>
  ({ version: 1, id: 'base-1', title: 'Base', notebook: { type: 'doc', content }, fps: 30, width: 1920, height: 1080, blocks: {}, brand: {}, ...extra }) as unknown as ProjectDocumentV1

const harness = (initial: ProjectDocumentV1, run: { status: string; pages: RunPage[] }, unreadable: string[] = []) => {
  let stored = structuredClone(initial)
  const saves: ProjectDocumentV1[] = []
  const deps: LandingDeps = {
    load: async () => structuredClone(stored),
    save: async (project, expected) => {
      if (JSON.stringify(expected) !== JSON.stringify(stored)) throw Object.assign(new Error('changed'), { statusCode: 409 })
      stored = structuredClone(project)
      saves.push(structuredClone(project))
    },
    run: async () => ({ status: run.status, projectDir: '/runs/run-1' }),
    pages: async () => run.pages,
    check: async svg => (unreadable.some(label => svg.includes(label)) ? { ok: false, reason: 'no parts' } : { ok: true, svg: atomized(svg) }),
  }
  return { deps, saves, stored: () => stored, edit: (change: (doc: ProjectDocumentV1) => void) => change(stored) }
}
const attrsOf = (project: ProjectDocumentV1, id: string) => project.notebook.content.find(node => node.attrs?.id === id)!.attrs as Record<string, any>

describe('landing a design run\'s pages in the worker', () => {
  it('lands a finished page on its untouched scene, bound while the run checks the rest', async () => {
    const page = designed('Leaf')
    const store = harness(notebook([scene('s1', 'Leaf', 1)]), { status: 'running', pages: [{ name: '01_leaf.svg', svg: page, program: { version: 1 } }] })
    const result = await landPages('base-1', store.deps)
    expect(result).toMatchObject({ landed: ['Leaf'], saved: true, conflict: false })
    const attrs = attrsOf(store.stored(), 's1')
    expect(attrs.svg).toBe(atomized(page))
    expect(attrs.program).toEqual({ version: 1 })
    expect(attrs.schematic.svg).toBe(schematic('Leaf'))
    // Its motion is planned again when the notebook next opens.
    expect(attrs.pageOrigin).toMatchObject({ kind: 'designed', by: 'Claude Code', runId: 'run-1', replan: true })
    expect(attrs.pageOrigin.designing).toMatchObject({ placeholder: pageFingerprint(atomized(page)), landed: pageFingerprint(page) })
  })

  it('lands the same page once, and a page the run redraws again', async () => {
    const store = harness(notebook([scene('s1', 'Leaf', 1)]), { status: 'running', pages: [{ name: '01_leaf.svg', svg: designed('Leaf'), program: null }] })
    await landPages('base-1', store.deps)
    const again = await landPages('base-1', store.deps)
    expect(again).toMatchObject({ landed: [], waiting: 1, saved: false })
    expect(store.saves).toHaveLength(1)
    const redrawn = harness(store.stored(), { status: 'running', pages: [{ name: '01_leaf.svg', svg: designed('Leaf', 2), program: null }] })
    expect((await landPages('base-1', redrawn.deps)).landed).toEqual(['Leaf'])
    expect(attrsOf(redrawn.stored(), 's1').svg).toBe(atomized(designed('Leaf', 2)))
  })

  it('never holds a ready page for one the studio cannot read yet', async () => {
    const store = harness(notebook([scene('s1', 'Branch', 1), scene('s2', 'Root', 2)]), { status: 'running', pages: [{ name: '01_branch.svg', svg: designed('Branch'), program: null }, { name: '02_root.svg', svg: designed('Root'), program: null }] }, ['Branch'])
    const result = await landPages('base-1', store.deps)
    expect(result).toMatchObject({ landed: ['Root'], waiting: 1, saved: true })
    expect(attrsOf(store.stored(), 's1').svg).toBe(schematic('Branch'))
  })

  it('lets bindings go when the run ends: an unreadable page stays a schematic draft', async () => {
    const store = harness(notebook([scene('s1', 'Branch', 1), scene('s2', 'Root', 2)]), { status: 'done', pages: [{ name: '01_branch.svg', svg: designed('Branch'), program: null }] }, ['Branch'])
    const result = await landPages('base-1', store.deps)
    expect(result).toMatchObject({ landed: [], stayed: ['Branch', 'Root'], saved: true })
    for (const id of ['s1', 's2']) expect(attrsOf(store.stored(), id).pageOrigin).toEqual({ kind: 'schematic' })
  })

  it('keeps a scene changed since it was bound', async () => {
    const changed = scene('s1', 'Leaf', 1)
    changed.attrs.svg = '<svg viewBox="0 0 1280 720"><text>drawn by hand</text></svg>'
    const store = harness(notebook([changed]), { status: 'running', pages: [{ name: '01_leaf.svg', svg: designed('Leaf'), program: null }] })
    const result = await landPages('base-1', store.deps)
    expect(result).toMatchObject({ kept: ['Leaf'], landed: [], saved: true })
    expect(attrsOf(store.stored(), 's1').svg).toContain('drawn by hand')
    expect(attrsOf(store.stored(), 's1').pageOrigin.designing).toBeUndefined()
  })

  it('stands down when the notebook was edited while it worked, and lands on the next pass', async () => {
    const store = harness(notebook([scene('s1', 'Leaf', 1)]), { status: 'running', pages: [{ name: '01_leaf.svg', svg: designed('Leaf'), program: null }] })
    const load = store.deps.load
    store.deps.load = async id => {
      const copy = await load(id)
      store.edit(doc => (doc.title = 'Base, renamed'))
      return copy
    }
    expect(await landPages('base-1', store.deps)).toMatchObject({ landed: [], conflict: true, saved: false })
    store.deps.load = load
    expect((await landPages('base-1', store.deps)).landed).toEqual(['Leaf'])
    expect(store.stored().title).toBe('Base, renamed')
  })

  it('leaves a video notebook alone: it is pinned to its base', async () => {
    const store = harness(notebook([scene('s1', 'Leaf', 1)], { derivedFrom: { notebook: 'base-0' } }), { status: 'running', pages: [{ name: '01_leaf.svg', svg: designed('Leaf'), program: null }] })
    expect(await landPages('base-1', store.deps)).toMatchObject({ landed: [], saved: false })
  })
})

describe('taking the worker\'s landings into an open window', () => {
  it('takes the pages of bound scenes, and nothing else', async () => {
    const known = notebook([scene('s1', 'Leaf', 1), scene('s2', 'Root', 2)])
    const store = harness(known, { status: 'running', pages: [{ name: '01_leaf.svg', svg: designed('Leaf'), program: null }] })
    await landPages('base-1', store.deps)
    const changes = landedPageChanges(known, store.stored())
    expect([...(changes?.keys() || [])]).toEqual(['s1'])
    expect(changes?.get('s1')?.svg).toBe(atomized(designed('Leaf')))
  })

  it('finds an edit made elsewhere, which is not a landing', async () => {
    const known = notebook([scene('s1', 'Leaf', 1)])
    const stored = structuredClone(known)
    ;(stored.notebook.content[0].attrs as Record<string, unknown>).script = 'Other words.'
    expect(landedPageChanges(known, stored)).toBeNull()
    const retitled = structuredClone(known)
    retitled.title = 'Another title'
    expect(landedPageChanges(known, retitled)).toBeNull()
  })
})
