import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import type { StudioThemeV1 } from 'markdown-composition'

// The visual cast of three pages the page-master skill drew for the Stripe
// rate-limiting article (the independent review's rich deck), extracted in a
// real headless browser into a scratch file store.
process.env.STUDIO_PERSISTENCE = process.env.PLANNING_TEST_BACKEND === 'postgres' ? 'postgres' : 'local'
process.env.STUDIO_DATA_DIR = mkdtempSync(join(tmpdir(), 'visual-cast-'))
process.env.STUDIO_SKILLS_DIR = fileURLToPath(new URL('../../studio-desktop/skills/', import.meta.url))
const RUN = Date.now().toString(36)

const persistence = await import('./persistence')
const cast = await import('./visual-cast')
const library = await import('./appearance-library')
const { validateTreatment } = await import('../src/planning/scene-treatment')

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/visual-cast/${name}`, import.meta.url)), 'utf8')
const RATE = fixture('05_request_rate_limiter.svg')
const CONCURRENCY = fixture('06_concurrent_requests_limiter.svg')
const BUCKET = fixture('10_the_token_bucket.svg')
const theme = { brand: { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' } } as unknown as StudioThemeV1

let revision: Awaited<ReturnType<typeof cast.ensureVisualCast>>
const pages = [
  { scene: 'b05', title: 'Request rate limiter', svg: RATE, sourcePassages: ['The first limiter is the request rate limiter.'] },
  { scene: 'b06', title: 'Concurrent requests limiter', svg: CONCURRENCY, sourcePassages: ['Only 20 requests may be in progress at once.'] },
  { scene: 'b10', title: 'The token bucket', svg: BUCKET, sourcePassages: [] },
]

beforeAll(async () => {
  await persistence.initializePersistence()
  revision = await cast.ensureVisualCast({ notebook: `base-cast-${RUN}`, revision: 'rev-1', pages, theme })
}, 120_000)

const entriesOf = (node: string) => revision.entries.filter(entry => entry.identity.base.node === node)

describe('the visual cast of a rich base', () => {
  it('extracts every page, with its preview, contact sheet and classified furniture', () => {
    expect(revision.status).toBe('ready')
    expect(revision.pages.map(page => page.scene)).toEqual(['b05', 'b06', 'b10'])
    for (const page of revision.pages) {
      expect(page.preview.contentType).toBe('image/png')
      expect(page.preview.bytes).toBeGreaterThan(5000)
      expect(page.contactSheet?.bytes).toBeGreaterThan(2000)
      expect(page.furniture.map(item => item.role)).toEqual(expect.arrayContaining(['background', 'header', 'footer', 'connector', 'card']))
    }
    // Text-only nodes are labels, not cast.
    expect(entriesOf('s06-node-queue-model')).toEqual([])
  })

  it('lifts the twenty-slot pool whole, with its countable parts, and verifies it against the page', async () => {
    const [pool] = entriesOf('s06-node-concurrency-cap')
    expect(pool).toMatchObject({ kind: 'object', identity: { object: 'slot-pool', entityKind: 'service', objectId: 'obj-concurrency-cap-22' }, confidence: { grouping: 'declared', entity: 'declared' }, verification: { status: 'verified', differingRatio: 0 } })
    const part = (name: string) => pool.parts.find(entry => entry.name === name)
    expect(part('slots')).toMatchObject({ named: 'declared', element: 'g', count: 20 })
    expect(part('occupied')).toMatchObject({ named: 'declared', count: 14, animations: ['blink'] })
    expect(pool.rig).toMatchObject({ object: 'slot-pool', status: 'verified' })
    expect(pool.rig.pieces.map(piece => piece.id)).toEqual(['shell', 'slots', 'occupied', 'gate'])
    expect(pool.meaning).toMatchObject({ label: 'Concurrency cap', evidence: ['Only 20 requests may be in progress at once.'] })
    expect(pool.meaning.interactions).toEqual(expect.arrayContaining([{ verb: 'sends to', direction: 'in', with: 's06-node-api-user', withLabel: 'API user' }, { verb: 'sends to', direction: 'out', with: 's06-node-expensive-endpoint', withLabel: 'Expensive endpoint' }]))
    // The lifted artwork stands alone: ids namespaced, the slots all there,
    // nothing it points at outside itself.
    const svg = (await cast.readObject(pool.artwork.svg.objectKey)).toString('utf8')
    expect(svg).toMatch(/^<svg[^>]*viewBox="0 0 \d+ \d+"/)
    expect(svg).not.toMatch(/\bid="s06-/)
    expect((/<g[^>]*data-part="slots"[^>]*>([\s\S]*?)<\/g>/.exec(svg)?.[1].match(/<rect/g) || []).length).toBe(20)
    expect(svg).not.toMatch(/href="(?!#)/)
    // The untouched original keeps the page's own ids and geometry.
    const original = (await cast.readObject(pool.artwork.original.objectKey)).toString('utf8')
    expect(original).toContain('id="s06-pool-slots"')
    expect(pool.artwork.themeBindings).toEqual(expect.arrayContaining([{ color: '#635bff', token: 'primary' }, { color: '#ef61ef', token: 'accent' }]))
  })

  it('splits a gauge from the chart that shares its artwork group, and says the split is a proposal', () => {
    const [gauge, chart] = entriesOf('s05-node-per-user-cap')
    expect(gauge).toMatchObject({ kind: 'icon', confidence: { grouping: 'inferred' }, verification: { status: 'verified' } })
    expect(gauge.parts.find(part => part.animations.includes('spin'))).toBeTruthy()
    expect(gauge.artwork.viewBox.width).toBeLessThanOrEqual(48)
    expect(chart).toMatchObject({ kind: 'chart', verification: { status: 'verified' } })
    expect(chart.parts.map(part => part.name)).toEqual(expect.arrayContaining(['cap-line', 'burst-line']))
    expect(gauge.confidence.checks.join(' ')).toMatch(/part 1 of 2 .* the split is proposed/)
    expect(chart.confidence.checks.join(' ')).toMatch(/keep it native/)
  })

  it('verifies the token bucket against its rig', () => {
    const [bucket] = entriesOf('s10-node-per-user-bucket')
    expect(bucket).toMatchObject({ kind: 'object', identity: { object: 'token-bucket' }, verification: { status: 'verified' } })
    expect(bucket.parts.find(part => part.name === 'tokens')).toMatchObject({ named: 'declared', count: 3 })
    expect(['verified', 'partial']).toContain(bucket.rig.status)
  })

  it('puts verified ingredients in the library, where a plan can reuse them by key', async () => {
    const [icon] = entriesOf('s05-node-user-script')
    const [pool] = entriesOf('s06-node-concurrency-cap')
    const [gauge] = entriesOf('s05-node-per-user-cap')
    expect(icon).toMatchObject({ kind: 'icon', verification: { status: 'verified' } })
    const artwork = await library.listArtwork()
    for (const entry of [icon, pool, gauge]) {
      const record = artwork.find(asset => asset.key === entry.libraryKey)
      expect(record).toMatchObject({ accepted: true, operation: 'extract', provenance: { provider: 'base-extraction' }, origin: { page: entry.identity.base.page, node: entry.identity.base.node, castEntry: entry.id } })
      expect(record!.parts.map(part => part.as)).toEqual(entry.parts.map(part => part.name))
    }
    // A plan that reuses the pool by its key passes the reuse check.
    const brief = { units: [{ id: 'u1', communicationNeeds: [] }], evidence: [], entities: [{ id: 'pool' }], coverage: [], purpose: { requestedSeconds: null } }
    const report = validateTreatment(
      {
        schemaVersion: 1, scene: 'v1', originScenes: ['b06'], units: ['u1'], question: 'q', takeaway: 't', evidenceRefs: [], development: 'd', demonstration: null, ledger: null,
        moments: [{ id: 'm1', title: 'Pool', purpose: 'p', observation: 'o', narration: null, objects: { change: 'slots fill', actors: ['pool'] }, text: null, presenter: null, camera: null, audio: null, attention: 'the pool', recipes: [], evidenceRefs: [], estimateSeconds: 4 }],
        objects: [{ entity: 'pool', role: 'Holds the calls in progress', appearance: 'The page\'s own pool', performance: 'Slots fill one by one', asset: { status: 'reuse', ref: pool.libraryKey } }],
        treatments: { presenter: '', text: '', camera: '' }, skills: [], requirements: { assets: [], takes: [], decisions: [] },
        continuity: { entry: '', exit: '', incoming: { kind: 'self-contained' }, outgoing: { kind: 'self-contained' } }, unresolved: [], coverage: [], rosterProposal: null, delivery: { voice: 'undecided', note: '' },
      },
      { brief: brief as never, scene: 'v1', originScenes: ['b06'], videoScenes: ['v1'], catalog: { entries: [] }, bundleSkills: [], bundleReferences: [], delivery: null, assetKeys: artwork.map(asset => asset.key) },
    )
    expect(report.problems.filter(problem => /asset/.test(problem))).toEqual([])
  })

  it('extracts a base revision once, and leaves the base pages as they were', async () => {
    const again = await cast.ensureVisualCast({ notebook: `base-cast-${RUN}`, revision: 'rev-1', pages, theme })
    expect(again.createdAt).toBe(revision.createdAt)
    expect(pages[1].svg).toBe(CONCURRENCY)
    const [first, second] = await Promise.all([
      cast.ensureVisualCast({ notebook: `base-once-${RUN}`, revision: 'r', pages: pages.slice(0, 1), theme }),
      cast.ensureVisualCast({ notebook: `base-once-${RUN}`, revision: 'r', pages: pages.slice(0, 1), theme }),
    ])
    expect(first).toBe(second)
  })

  it('keeps an ingredient that does not match its original as a reference, never as equivalent', async () => {
    // Styled by the page's stylesheet: lifted alone, the rule no longer reaches it.
    const styled = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300"><style>.hot{fill:#ff2020}</style><g id="s01-node-thing" data-role="node" data-kind="box" data-entity="server"><g id="s01-node-thing-art" data-appearance-for="s01-node-thing"><rect class="hot" x="40" y="40" width="120" height="80"/></g><text x="40" y="160">Thing</text></g></svg>'
    const styledCast = await cast.ensureVisualCast({ notebook: `base-styled-${RUN}`, revision: 'r', pages: [{ scene: 'b01', title: 'Styled', svg: styled, sourcePassages: [] }], theme })
    const [thing] = styledCast.entries
    expect(thing.verification.status).toBe('mismatch')
    expect(thing.libraryKey).toBeNull()
    expect(thing.verification.notes.join(' ')).toMatch(/kept as a reference, not offered as equivalent/)
    expect(styledCast.pages[0].notes.join(' ')).toMatch(/stylesheet/)
  })
})
