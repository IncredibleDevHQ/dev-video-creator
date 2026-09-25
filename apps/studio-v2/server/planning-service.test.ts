import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { forkNotebook, type ProjectDocumentV1 } from 'markdown-composition'

// The file backend in a scratch directory, and the real vendored skills. With
// PLANNING_TEST_BACKEND=postgres the same tests run against the PostgreSQL and
// MinIO the STUDIO_DATABASE_URL / STUDIO_MINIO_* variables name — an isolated
// test instance, never real studio data. Fixture ids are unique per run.
process.env.STUDIO_PERSISTENCE = process.env.PLANNING_TEST_BACKEND === 'postgres' ? 'postgres' : 'local'
process.env.STUDIO_DATA_DIR = mkdtempSync(join(tmpdir(), 'planning-'))
const RUN = Date.now().toString(36)
process.env.STUDIO_SKILLS_DIR = fileURLToPath(new URL('../../studio-desktop/skills/', import.meta.url))

const persistence = await import('./persistence')
const service = await import('./planning-service')
// A packet's text file (binary files — previews — are base64 objects).
const text = (file: unknown) => {
  if (typeof file !== 'string') throw new Error('not a text file of the packet')
  return file
}

const ARTICLE = `Rate limiting with a token bucket

A token bucket holds a fixed number of tokens. Each request that is admitted consumes one token.

When a burst arrives, the requests are admitted until the bucket is empty; the next request is rejected.

Tokens are added back at a steady refill rate, so a later request can pass again.`

// A base notebook with two pages and its video fork. `fragmentsOnly`: the
// full source was never retained, only the passages kept on the pages.
const makeVideo = async (tag: string, options: { fragmentsOnly?: boolean; pages?: ReturnType<typeof scene>[]; theme?: ProjectDocumentV1['theme'] } = {}) => {
  const source = await persistence.saveSourceRevision({ kind: 'url', url: `https://example.com/bucket-${tag}`, title: 'Token bucket', site: 'example.com', content: { text: ARTICLE, title: 'Token bucket' } })
  const base: ProjectDocumentV1 = {
    version: 1,
    id: `base-${tag}-${RUN}`,
    title: 'Rate limiting',
    notebook: { type: 'doc', content: options.pages || [scene('b1', 'Admission', 'Each request spends one token.', ['Each request that is admitted consumes one token.']), scene('b2', 'Rejection', 'When it is empty, the next one is refused.', ['the next request is rejected'])] },
    ...(options.theme ? { theme: options.theme } : {}),
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { name: 'x' } as unknown as ProjectDocumentV1['brand'],
    source: { kind: 'url', url: `https://example.com/bucket-${tag}`, site: 'example.com', title: 'Token bucket', readAt: '2026-09-24T00:00:00Z', ...(options.fragmentsOnly ? {} : { snapshotId: source.id }) },
    outline: { title: 'Rate limiting', targetSeconds: 60, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  await persistence.saveProjectArtifact(base)
  const snapshot = await persistence.storeAsset({ body: Buffer.from(JSON.stringify(base)), contentType: 'application/json', kind: 'base-snapshot', extension: '.json' })
  const { project } = forkNotebook(base, { id: `video-${tag}-${RUN}`, snapshot })
  await persistence.saveProjectArtifact(project)
  return { videoId: project.id, videoScenes: (project.notebook.content || []).map(node => String(node.attrs?.id)) }
}

// Queues, runs and lands a grounded brief for a video.
const readyBrief = async (id: string, runId: string) => {
  const { record } = await service.queueBrief(id)
  await service.attachRun(record.id, { runId, adapter: 'claude-code' })
  const context = JSON.parse(text((await service.loadPacket(record.id)).files['packet/CONTEXT.json']))
  const landed = await service.submitBrief(record.id, goodBrief({ sourceRevision: context.sourceRevision, baseNotebook: context.baseNotebook, baseRevision: context.baseRevision, themeRef: context.themeRef, requestedSeconds: context.requestedSeconds }), runId)
  expect(landed).toMatchObject({ accepted: true, status: 'ready' })
  return record
}

const scene = (id: string, title: string, script: string, passages: string[], svg = '<svg xmlns="http://www.w3.org/2000/svg"/>') => ({
  type: 'scene',
  attrs: { id, title, script, sourcePassages: passages, directorNotes: `${title} idea`, svg },
})

let videoId = ''
let baseScenes: string[] = []
let videoScenes: string[] = []

const goodBrief = (context: { sourceRevision: string; baseNotebook: string; baseRevision: string; themeRef: string | null; requestedSeconds: number | null }) => ({
  schemaVersion: 1,
  purpose: { deliverable: 'Narrated technical explainer', audience: 'Developers', message: 'Tokens decide admission; exhaustion rejects until refill.', language: 'en', requestedSeconds: context.requestedSeconds, styleConstraints: [] },
  source: { revisionRef: context.sourceRevision, narrativeRef: null, wordingPolicy: 'draft', coverage: 'full', limitations: [] },
  evidence: [
    { id: 'ev-consume', kind: 'source', text: 'Each request that is admitted consumes one token.' },
    { id: 'ev-burst', kind: 'source', text: 'the next request is rejected' },
  ],
  entities: [{ id: 'bucket', name: 'Token bucket', role: 'Stores admission capacity', interactions: [], evidenceRefs: ['ev-consume'], legacyObjectIds: [] }],
  units: [
    { id: 'admission', question: 'Why does a request pass?', explain: 'It consumes a token.', evidenceRefs: ['ev-consume'], entities: ['bucket'], conditions: [], demonstration: null, observations: [], communicationNeeds: [{ need: 'Show a token being spent', why: 'It is the mechanism', basis: 'suggestion' }], preserve: [], originScenes: [baseScenes[0]], dependsOn: [] },
    { id: 'rejection', question: 'Why is the next one rejected?', explain: 'The bucket is empty.', evidenceRefs: ['ev-burst'], entities: ['bucket'], conditions: [], demonstration: null, observations: [], communicationNeeds: [{ need: 'Tie rejection to the empty bucket', why: 'Cause before consequence', basis: 'suggestion' }], preserve: [], originScenes: [baseScenes[1]], dependsOn: ['admission'] },
  ],
  progression: [{ unit: 'admission', note: 'first', ordering: 'causal' }, { unit: 'rejection', note: 'then', ordering: 'causal' }],
  narrative: { approvedLines: [], terminology: [], omissions: [] },
  material: { themeRef: context.themeRef, baseNotebookRef: context.baseNotebook, baseRevision: context.baseRevision, assetRefs: [], takeRefs: [] },
  delivery: { sceneDecisions: [], unresolved: 'Per scene.' },
  creativeGuidance: [],
  openDecisions: ['Demonstration'],
  uncertainty: [],
  route: { workflow: 'general-video', reason: 'Narrated explainer, per-scene delivery' },
  coverage: [{ scene: baseScenes[0], units: ['admission'] }, { scene: baseScenes[1], units: ['rejection'] }],
})

const treatmentFor = (scene: string, origin: string) => ({
  schemaVersion: 1,
  scene,
  originScenes: [origin],
  units: ['admission'],
  question: 'Why does a request pass?',
  takeaway: 'It spends a token.',
  evidenceRefs: ['ev-consume'],
  development: 'Show the store, then one request spending from it.',
  demonstration: null,
  moments: [{
    id: 'm1', title: 'Spend', purpose: 'Make the cost visible', observation: 'A token leaves',
    narration: { job: 'Explain', guide: 'Each request consumes one token.' }, objects: { change: 'A token leaves the bucket', actors: ['bucket'] }, text: null, presenter: null,
    camera: { treatment: 'hold', subject: 'bucket', reason: 'Keep the map' }, audio: null, attention: 'the token',
    recipes: [{ id: 'coordinate-target-zoom', catalog: 'rule', purpose: 'Look closer at the bucket', channel: 'camera', controls: ['world'] }],
    evidenceRefs: ['ev-consume'], estimateSeconds: 6,
  }],
  objects: [],
  treatments: { presenter: 'Undecided', text: 'None', camera: 'Hold' },
  skills: [{ skill: 'hyperframes-creative', references: ['skills/hyperframes-creative/references/beat-direction.md'], why: 'Rhythm' }, { skill: 'hyperframes-animation', references: ['skills/hyperframes-animation/rules-index.md'], why: 'Recipes' }],
  requirements: { assets: [], takes: [], decisions: [] },
  continuity: { entry: 'Full bucket', exit: 'One token spent', incoming: { kind: 'self-contained' }, outgoing: { kind: 'self-contained' } },
  unresolved: [],
  coverage: [{ unit: 'admission', need: 'Show a token being spent', moments: ['m1'] }],
  rosterProposal: null,
  delivery: { voice: 'undecided', note: '' },
})

beforeAll(async () => {
  await persistence.initializePersistence()
  baseScenes = ['b1', 'b2']
  ;({ videoId, videoScenes } = await makeVideo('main'))
})

describe('planning a forked video', () => {
  it('waits for the brief, and queues the same inputs only once', async () => {
    const overview = await service.planningOverview(videoId)
    expect(overview.available).toBe(true)
    expect(overview.bundle?.upstreamCommit).toBe('99221c50a5e5927ca243454b4e4f02f9adf7cfc6')
    expect(overview.scenes.map(scene => scene.view.state)).toEqual(['needs-brief', 'needs-brief'])
    const first = await service.queueBrief(videoId)
    const again = await service.queueBrief(videoId)
    expect((await service.planningOverview(videoId)).scenes.map(scene => scene.view.state)).toEqual(['preparing', 'preparing'])
    expect(first.reused).toBe(false)
    expect(again.reused).toBe(true)
    expect(again.record.id).toBe(first.record.id)
  })

  it('gives the harness the retained source, numbered, and the base pages as reference', async () => {
    const { record } = await service.queueBrief(videoId)
    const packet = await service.loadPacket(record.id)
    expect(packet.route).toBe('Prepare Brief')
    expect(packet.files['packet/SOURCE.md']).toMatch(/¶2 {2}A token bucket holds a fixed number of tokens/)
    const context = JSON.parse(text(packet.files['packet/CONTEXT.json']))
    expect(context.basePages.map((page: { scene: string }) => page.scene)).toEqual(baseScenes)
    expect(context.requestedSeconds).toBe(60)
    expect(packet.files['packet/PRESENTATION.md']).toMatch(/not the video's scenes, layouts or durations/)
    // A slide's page notes are layout reference, not the creator's words.
    expect(packet.files['packet/PRESENTATION.md']).toMatch(/Page notes \(slide layout, reference only\): Admission idea/)
    expect(packet.files['packet/NARRATIVE.md']).not.toMatch(/Admission idea/)
  })

  it('will not take a slide\'s page notes as the creator\'s words', async () => {
    const { record } = await service.queueBrief(videoId)
    await service.attachRun(record.id, { runId: 'run-brief-notes', adapter: 'claude-code' })
    const context = JSON.parse(text((await service.loadPacket(record.id)).files['packet/CONTEXT.json']))
    const brief = goodBrief({ sourceRevision: context.sourceRevision, baseNotebook: context.baseNotebook, baseRevision: context.baseRevision, themeRef: context.themeRef, requestedSeconds: context.requestedSeconds })
    const cited = { ...brief, evidence: [...brief.evidence, { id: 'ev-note', kind: 'creator', text: 'Admission idea' }] }
    const refused = await service.submitBrief(record.id, cited)
    expect(refused.accepted).toBe(false)
    expect(JSON.stringify(refused)).toMatch(/ev-note/)
    // The run gives up; its record is no longer anyone's to take over.
    await service.runFinished('run-brief-notes', { status: 'error', exitCode: 1 })
  })

  it('refuses a brief that quotes what the source never said, then keeps a grounded one', async () => {
    const { record } = await service.queueBrief(videoId)
    await service.attachRun(record.id, { runId: 'run-brief-1', adapter: 'kimi', model: 'k3' })
    const context = JSON.parse(text((await service.loadPacket(record.id)).files['packet/CONTEXT.json']))
    const brief = goodBrief({ sourceRevision: context.sourceRevision, baseNotebook: context.baseNotebook, baseRevision: context.baseRevision, themeRef: context.themeRef, requestedSeconds: context.requestedSeconds })
    const invented = { ...brief, evidence: [{ id: 'ev-consume', kind: 'source', text: 'Each request that is admitted consumes two tokens.' }, brief.evidence[1]] }
    const refused = await service.submitBrief(record.id, invented)
    expect(refused.accepted).toBe(false)
    const accepted = await service.submitBrief(record.id, brief)
    expect(accepted).toMatchObject({ accepted: true, status: 'ready' })
    const overview = await service.planningOverview(videoId)
    expect(overview.brief.current?.id).toBe(record.id)
    expect(overview.brief.current?.adapter).toBe('kimi')
    expect(overview.scenes.map(scene => scene.view.state)).toEqual(['ready-to-plan', 'ready-to-plan'])
  })

  it('never lands a plan whose inputs changed while it ran, and keeps the reviewed one', async () => {
    const [sceneId] = videoScenes
    const first = await service.queueTreatment(videoId, sceneId)
    const packet = await service.loadPacket(first.record.id)
    expect(Object.keys(packet.files).sort()).toEqual(['packet/BRIEF.md', 'packet/CONTEXT.json', 'packet/EXPLANATION.md', 'packet/NEIGHBORS.json', 'packet/PREVIOUS_PLAN.json', 'packet/SCENE.md', 'packet/THEME.json', 'packet/VISUAL_CAST.json', 'packet/references/page.png', 'packet/references/page.svg', 'packet/references/visual-cast.png'])
    // The packet carries the theme's actual tokens and a usable page preview.
    expect(JSON.parse(text(packet.files['packet/THEME.json']))).toMatchObject({ colors: {}, typography: { fallbacks: { body: expect.stringMatching(/Inter/) }, note: expect.stringMatching(/no type families/) } })
    expect(JSON.parse(text(packet.files['packet/VISUAL_CAST.json']))).toMatchObject({ status: 'ready', pages: [{ reference: 'references/page.svg', preview: 'references/page.png' }] })
    const preview = packet.files['packet/references/page.png'] as { base64: string; contentType: string }
    expect(preview.contentType).toBe('image/png')
    expect(Buffer.from(preview.base64, 'base64').subarray(1, 4).toString()).toBe('PNG')
    expect(packet.files['packet/BRIEF.md']).toMatch(/^---\nworkflow: general-video/)
    await service.attachRun(first.record.id, { runId: 'run-plan-1' })
    // The creator adds direction while the plan is being made.
    await service.saveDirection(videoId, { subject: sceneId, direction: 'Keep the camera still' })
    const late = await service.submitTreatment(first.record.id, treatmentFor(sceneId, 'b1'))
    expect(late).toMatchObject({ accepted: true, status: 'superseded' })
    // A new run with the new direction lands, and can be reviewed.
    const second = await service.queueTreatment(videoId, sceneId)
    expect(second.record.revision).toBe(2)
    expect((await service.loadPacket(second.record.id)).files['packet/SCENE.md']).toMatch(/For this scene: Keep the camera still/)
    await service.attachRun(second.record.id, { runId: 'run-plan-2' })
    const landed = await service.submitTreatment(second.record.id, treatmentFor(sceneId, 'b1'))
    expect(landed).toMatchObject({ accepted: true, status: 'candidate' })
    expect((landed as { constructionRisks: string[] }).constructionRisks.join(' ')).toMatch(/coordinate-target-zoom/)
    const reviewed = await service.reviewTreatment(second.record.id)
    expect(reviewed.status).toBe('reviewed')
    // A third run dies without submitting; the reviewed plan stays.
    await service.saveDirection(videoId, { subject: sceneId, direction: 'Keep the camera still; show two requests' })
    const third = await service.queueTreatment(videoId, sceneId)
    await service.attachRun(third.record.id, { runId: 'run-plan-3' })
    const failed = await service.runFinished('run-plan-3', { status: 'error', exitCode: 1, error: 'Kimi: rate limited' })
    expect(failed.map(record => record.id)).toEqual([third.record.id])
    const view = (await service.planningOverview(videoId)).scenes.find(entry => entry.id === sceneId)!.view
    expect(view.state).toBe('failed')
    expect(view.latest?.error?.providerStatus).toBe('Kimi: rate limited')
    expect(view.reviewed?.id).toBe(second.record.id)
  })

  it('marks a reviewed plan stale when its inputs move, and will not review a stale candidate', async () => {
    const [, sceneId] = videoScenes
    const queued = await service.queueTreatment(videoId, sceneId)
    await service.attachRun(queued.record.id, { runId: 'run-plan-4' })
    const plan = { ...treatmentFor(sceneId, 'b2'), units: ['rejection'], evidenceRefs: ['ev-burst'], coverage: [{ unit: 'rejection', need: 'Tie rejection to the empty bucket', moments: ['m1'] }] }
    await service.submitTreatment(queued.record.id, plan)
    await service.saveDirection(videoId, { subject: sceneId, delivery: 'generated' })
    const overview = await service.planningOverview(videoId)
    const view = overview.scenes.find(entry => entry.id === sceneId)!.view
    expect(view.state).toBe('stale')
    expect(view.staleBecause).toBe('the scene\'s delivery changed since this plan was made')
    // One scene's delivery is that scene's input, not the brief's.
    expect(overview.brief.stale).toBe(false)
    await expect(service.reviewTreatment(queued.record.id)).rejects.toThrow(/stale/)
  })
})

// The independent M0 review's probes (R1, R2), with the defect expectations
// inverted: each now describes the repaired behaviour.
describe('planning integrity', () => {
  it('starts one record for simultaneous identical requests', async () => {
    const { videoId: id, videoScenes: scenes } = await makeVideo('claim')
    const briefs = await Promise.all(Array.from({ length: 4 }, () => service.queueBrief(id)))
    expect(new Set(briefs.map(entry => entry.record.id)).size).toBe(1)
    expect(briefs.filter(entry => !entry.reused)).toHaveLength(1)
    const brief = briefs[0].record
    await service.attachRun(brief.id, { runId: 'run-claim-brief', adapter: 'claude-code' })
    const context = JSON.parse(text((await service.loadPacket(brief.id)).files['packet/CONTEXT.json']))
    await service.submitBrief(brief.id, goodBrief({ sourceRevision: context.sourceRevision, baseNotebook: context.baseNotebook, baseRevision: context.baseRevision, themeRef: context.themeRef, requestedSeconds: context.requestedSeconds }), 'run-claim-brief')
    const plans = await Promise.all(Array.from({ length: 4 }, () => service.queueTreatment(id, scenes[0])))
    expect(new Set(plans.map(entry => entry.record.id)).size).toBe(1)
    expect(plans.map(entry => entry.record.revision)).toEqual([1, 1, 1, 1])
  })

  it('lets one run own a record: the same run may ask again, no other run may take it', async () => {
    const { videoId: id } = await makeVideo('owner')
    const { record } = await service.queueBrief(id)
    const first = await service.attachRun(record.id, { runId: 'run-owner-a', adapter: 'claude-code', model: 'claude-opus-5-5' })
    expect(first).toMatchObject({ status: 'running', runId: 'run-owner-a', model: 'claude-opus-5-5' })
    // A retry after a lost response is the same owner.
    expect((await service.attachRun(record.id, { runId: 'run-owner-a', adapter: 'claude-code' })).runId).toBe('run-owner-a')
    await expect(service.attachRun(record.id, { runId: 'run-owner-b', adapter: 'claude-code' })).rejects.toThrow(/already running as run-owner-a/)
    // Only the owner reports the model its session runs; nothing else moves.
    await expect(service.recordReportedModel(record.id, { runId: 'run-owner-b', model: 'x' })).rejects.toThrow(/Only the run that owns/)
    const reported = await service.recordReportedModel(record.id, { runId: 'run-owner-a', model: 'claude-opus-5-5' })
    expect(reported).toMatchObject({ runId: 'run-owner-a', status: 'running', model: 'claude-opus-5-5', reportedModel: 'claude-opus-5-5' })
    // Nor can another run submit to it.
    await expect(service.submitBrief(record.id, {}, 'run-owner-b')).rejects.toThrow(/does not own/)
  })

  it('keeps a plan from a stale brief readable but never current, reviewable or plannable', async () => {
    const { videoId: id, videoScenes: scenes } = await makeVideo('ancestry')
    await readyBrief(id, 'run-ancestry-brief')
    const { record } = await service.queueTreatment(id, scenes[0])
    await service.attachRun(record.id, { runId: 'run-ancestry-plan' })
    expect(await service.submitTreatment(record.id, treatmentFor(scenes[0], 'b1'), 'run-ancestry-plan')).toMatchObject({ accepted: true, status: 'candidate' })
    // A plan still running when the source moves.
    const { record: running } = await service.queueTreatment(id, scenes[1])
    await service.attachRun(running.id, { runId: 'run-ancestry-late' })
    // The video's retained source changes; scene scripts, theme and direction do not.
    const project = (await persistence.loadProjectArtifact(id))!
    const changed = await persistence.saveSourceRevision({ kind: 'url', url: 'https://example.com/bucket-v2', title: 'Changed source', site: 'example.com', content: { text: `${ARTICLE}\n\nThis is a revised article.` } })
    project.source!.snapshotId = changed.id
    await persistence.saveProjectArtifact(project)
    const overview = await service.planningOverview(id)
    expect(overview.brief).toMatchObject({ stale: true, staleBecause: 'the retained source changed since it was made' })
    expect(overview.scenes[0].view).toMatchObject({ state: 'stale', staleBecause: 'its explanation brief is stale: the retained source changed since it was made' })
    expect(overview.scenes[0].view.current?.id).toBe(record.id)
    await expect(service.reviewTreatment(record.id)).rejects.toThrow(/stale/)
    await expect(service.queueTreatment(id, scenes[0])).rejects.toThrow(/brief is stale/)
    const plan = { ...treatmentFor(scenes[1], 'b2'), units: ['rejection'], evidenceRefs: ['ev-burst'], coverage: [{ unit: 'rejection', need: 'Tie rejection to the empty bucket', moments: ['m1'] }] }
    expect(await service.submitTreatment(running.id, plan, 'run-ancestry-late')).toMatchObject({ accepted: true, status: 'superseded' })
  })

  // The review's R3 probe, corrected: the packet offers the passages kept on
  // the pages, and a brief quoting one exactly is accepted with its page.
  it('checks source quotations against the kept passages when only fragments survive', async () => {
    const { videoId: id } = await makeVideo('fragments', { fragmentsOnly: true })
    const { record } = await service.queueBrief(id)
    await service.attachRun(record.id, { runId: 'run-fragments' })
    const packet = (await service.loadPacket(record.id)).files
    const context = JSON.parse(text(packet['packet/CONTEXT.json']))
    expect(context.sourcePool).toEqual({ coverage: 'fragments', passages: 2, pagesWithPassages: 2, pages: 2 })
    expect(packet['packet/SOURCE.md']).toContain('- "Each request that is admitted consumes one token."')
    expect(packet['packet/SOURCE.md']).toMatch(/## b1: Admission/)
    const brief = goodBrief({ sourceRevision: context.sourceRevision, baseNotebook: context.baseNotebook, baseRevision: context.baseRevision, themeRef: context.themeRef, requestedSeconds: context.requestedSeconds })
    // A quotation the pages never kept is refused — even labelled the creator's.
    const invented = { ...brief, source: { ...brief.source, coverage: 'fragments', limitations: ['Only page passages survive.'] }, evidence: [{ id: 'ev-consume', kind: 'source', text: 'A token bucket holds a fixed number of tokens.' }, brief.evidence[1]] }
    expect(await service.submitBrief(record.id, invented, 'run-fragments')).toMatchObject({ accepted: false, problems: [expect.stringMatching(/not one of the source passages kept on the base pages/)] })
    const relabelled = { ...invented, evidence: [{ id: 'ev-consume', kind: 'creator', text: 'A token bucket holds a fixed number of tokens.' }, brief.evidence[1]] }
    expect((await service.submitBrief(record.id, relabelled, 'run-fragments')).accepted).toBe(false)
    const grounded = { ...brief, source: { ...brief.source, coverage: 'fragments', limitations: ['Only page passages survive.'] } }
    const landed = await service.submitBrief(record.id, grounded, 'run-fragments')
    expect(landed).toMatchObject({ accepted: true, status: 'ready' })
    const stored = (await persistence.loadPlanningRecord(record.id))!.content as { evidence: Array<{ id: string; lineage?: unknown }> }
    expect(stored.evidence.map(entry => entry.lineage)).toEqual([{ pool: 'fragments', pages: ['b1'] }, { pool: 'fragments', pages: ['b2'] }])
  })

  // R8: a scene may open on its neighbour's image only when the neighbour's
  // reviewed plan promises it; the agreement breaks when that plan changes.
  it('agrees a seam only with a reviewed neighbour, and breaks it when that plan changes', async () => {
    const { videoId: id, videoScenes: scenes } = await makeVideo('seam')
    await readyBrief(id, 'run-seam-brief')
    const rejectionPlan = (runScene: string) => ({ ...treatmentFor(runScene, 'b2'), units: ['rejection'], evidenceRefs: ['ev-burst'], coverage: [{ unit: 'rejection', need: 'Tie rejection to the empty bucket', moments: ['m1'] }] })
    const agreed = (runScene: string) => ({ ...rejectionPlan(runScene), continuity: { entry: 'One token spent', exit: 'Empty bucket', incoming: { kind: 'agreed' }, outgoing: { kind: 'self-contained' } } })
    const planFor = async (sceneId: string, runId: string, plan: unknown) => {
      const { record } = await service.queueTreatment(id, sceneId)
      await service.attachRun(record.id, { runId })
      return { record, packet: (await service.loadPacket(record.id)).files, result: await service.submitTreatment(record.id, plan, runId) }
    }
    // Scene 2 cannot agree with a scene 1 that has no reviewed plan.
    const early = await planFor(scenes[1], 'run-seam-early', agreed(scenes[1]))
    expect(JSON.parse(text(early.packet['packet/NEIGHBORS.json'])).neighbors[0]).toMatchObject({ position: 'before', scene: scenes[0], plan: 'none' })
    expect(early.result).toMatchObject({ accepted: false, problems: [expect.stringMatching(/continuity.incoming is agreed, but .* has no reviewed plan/)] })
    await service.runFinished('run-seam-early', { status: 'error', exitCode: 1 })
    // Scene 1 is planned and reviewed.
    const first = await planFor(scenes[0], 'run-seam-first', treatmentFor(scenes[0], 'b1'))
    expect(first.result).toMatchObject({ accepted: true, status: 'candidate' })
    await service.reviewTreatment(first.record.id)
    // Now the seam can be agreed, and the product records what it rests on.
    const second = await planFor(scenes[1], 'run-seam-second', agreed(scenes[1]))
    expect(JSON.parse(text(second.packet['packet/NEIGHBORS.json'])).neighbors[0]).toMatchObject({ plan: 'reviewed', reviewed: { revision: first.record.revision, exit: 'One token spent' } })
    expect(second.packet['packet/SCENE.md']).toMatch(/Seam: its reviewed plan \(revision \d+\) ends: "One token spent" — you may agree a seam with it/)
    expect(second.result).toMatchObject({ accepted: true, status: 'candidate' })
    const stored = (await persistence.loadPlanningRecord(second.record.id))!.content as { continuity: { incoming: unknown } }
    expect(stored.continuity.incoming).toEqual({ kind: 'agreed', scene: scenes[0], record: first.record.id, revision: first.record.revision })
    let overview = await service.planningOverview(id)
    expect(overview.scenes[1].continuity?.[0]).toMatchObject({ side: 'incoming', state: 'agreed', scene: scenes[0] })
    // Scene 1 is re-planned and the new plan reviewed: the seam breaks.
    const revised = await planFor(scenes[0], 'run-seam-revised', { ...treatmentFor(scenes[0], 'b1'), continuity: { entry: 'Full bucket', exit: 'Two tokens spent', incoming: { kind: 'self-contained' }, outgoing: { kind: 'self-contained' } } })
    await service.reviewTreatment(revised.record.id)
    overview = await service.planningOverview(id)
    expect(overview.scenes[1].continuity?.[0]).toMatchObject({ state: 'broken', reason: expect.stringMatching(/reviewed plan changed since this seam was agreed/) })
    // The plan itself is not stale: only its seam needs a new agreement.
    expect(overview.scenes[1].view.state).toBe('candidate')
  })

  // P1: the scene's packet carries its page and its cast — the actual
  // artwork, previews, parts and rigs — and a plan can reuse them by key.
  it('ships the rich page, its verified cast and the actual theme in the scene packet', async () => {
    const rich = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/visual-cast/${name}`, import.meta.url)), 'utf8')
    const theme = { id: 'stripe-theme', name: 'Stripe', brand: { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }, fonts: { display: 'sohne-var', body: 'sohne-var', mono: 'Consolas' } } as unknown as ProjectDocumentV1['theme']
    const { videoId: id, videoScenes: scenes } = await makeVideo('cast', {
      theme,
      pages: [
        scene('b1', 'Admission', 'Each request spends one token.', ['Each request that is admitted consumes one token.'], rich('05_request_rate_limiter.svg')),
        scene('b2', 'Rejection', 'Only so many run at once.', ['the next request is rejected'], rich('06_concurrent_requests_limiter.svg')),
      ],
    })
    await readyBrief(id, 'run-cast-brief')
    const { record } = await service.queueTreatment(id, scenes[1])
    await service.attachRun(record.id, { runId: 'run-cast-plan' })
    const files = (await service.loadPacket(record.id)).files
    const theme_ = JSON.parse(text(files['packet/THEME.json']))
    expect(theme_).toMatchObject({ colors: { primary: '#635bff', accent: '#ef61ef' }, meanings: { accent: expect.stringMatching(/emphasis/) }, typography: { display: 'sohne-var' } })
    const cast = JSON.parse(text(files['packet/VISUAL_CAST.json']))
    expect(cast.status).toBe('ready')
    const pool = cast.entries.find((entry: { object: string | null }) => entry.object === 'slot-pool')
    expect(pool).toMatchObject({ kind: 'object', label: 'Concurrency cap', rig: { status: 'verified', missing: [] }, verification: { status: 'verified' } })
    expect(pool.parts.find((part: { name: string }) => part.name === 'slots')).toMatchObject({ count: 20 })
    // Every declared file is in the packet, as real artwork and a real preview.
    for (const path of Object.values(pool.files) as string[]) expect(files).toHaveProperty([`packet/${path}`])
    expect(text(files[`packet/${pool.files.svg}`])).toMatch(/data-part="slots"/)
    expect((files[`packet/${pool.files.preview}`] as { contentType: string }).contentType).toBe('image/png')
    expect(files).toHaveProperty(['packet/references/page.png'])
    expect(JSON.parse(text(files['packet/CONTEXT.json'])).images).toEqual(['references/page.png', 'references/visual-cast.png'])
    // The gauge and the icon from the other page are reusable by key too.
    expect(cast.elsewhere.map((entry: { label: string; kind: string }) => `${entry.kind}:${entry.label}`)).toEqual(expect.arrayContaining(['icon:User script', 'icon:Per-user cap']))
    // A plan that reuses the pool by its library key lands — and so does
    // one piece of artwork drawn on the other page.
    const script = cast.elsewhere.find((entry: { label: string }) => entry.label === 'User script')
    expect(script?.libraryKey).toBeTruthy()
    const plan = { ...treatmentFor(scenes[1], 'b2'), units: ['rejection'], evidenceRefs: ['ev-burst'], coverage: [{ unit: 'rejection', need: 'Tie rejection to the empty bucket', moments: ['m1'] }], objects: [
      { entity: 'bucket', role: 'The calls in progress', appearance: 'The page\'s own twenty-slot pool', performance: 'Slots fill one by one until none is free', asset: { status: 'reuse', ref: pool.libraryKey, reason: 'Twenty countable slots are the limit the viewer must see' } },
      { entity: 'script', role: 'The client sending too much', appearance: 'The script icon from the rate limiter page', performance: 'It keeps firing requests', asset: { status: 'reuse', ref: script.libraryKey, reason: 'The same runaway client the video already showed' } },
    ] }
    expect(await service.submitTreatment(record.id, plan, 'run-cast-plan')).toMatchObject({ accepted: true, status: 'candidate' })
    // Its sketch carries the artwork the plan reuses from elsewhere in the
    // base, not only its own page — or it could only draw placeholders.
    const sketch = (await service.loadPacket((await service.queuePreview(id, scenes[1])).record.id)).files
    const sketchCast = JSON.parse(text(sketch['packet/VISUAL_CAST.json']))
    const carried = sketchCast.entries.find((entry: { libraryKey: string }) => entry.libraryKey === script.libraryKey)
    expect(carried).toMatchObject({ label: 'User script', verification: { status: 'verified' } })
    for (const path of Object.values(carried.files) as string[]) expect(sketch).toHaveProperty([`packet/${path}`])
    expect(sketchCast.elsewhere.map((entry: { libraryKey: string }) => entry.libraryKey)).not.toContain(script.libraryKey)
    // The plan's own packet still lists it by key only.
    expect(cast.entries.map((entry: { libraryKey: string }) => entry.libraryKey)).not.toContain(script.libraryKey)
    // The overview shows the cast, with previews.
    const overview = await service.planningOverview(id)
    expect(overview.visualCast.status).toBe('ready')
    expect(overview.visualCast.entries.find(entry => entry.object === 'slot-pool')).toMatchObject({ thumbnail: expect.stringMatching(/^\/objects\//), rig: 'verified' })
  }, 120_000)

  // P3: a rough, seekable preview of one plan revision, built by a run,
  // checked against the plan and the pinned engine, kept and served.
  it('previews a plan: a checked, stored sketch the Studio can play, out of date once the plan moves', async () => {
    const { videoId: id, videoScenes: scenes } = await makeVideo('preview')
    await readyBrief(id, 'run-preview-brief')
    const { record: plan } = await service.queueTreatment(id, scenes[0])
    await service.attachRun(plan.id, { runId: 'run-preview-plan' })
    expect(await service.submitTreatment(plan.id, treatmentFor(scenes[0], 'b1'), 'run-preview-plan')).toMatchObject({ accepted: true })
    const queued = await service.queuePreview(id, scenes[0])
    expect(queued).toMatchObject({ reused: false, record: { kind: 'preview', status: 'queued', subject: scenes[0] } })
    const packet = await service.loadPacket(queued.record.id)
    expect(packet.route).toBe('Sketch Scene')
    const context = JSON.parse(text(packet.files['packet/CONTEXT.json']))
    expect(context).toMatchObject({ route: 'Sketch Scene', plan: { record: plan.id, revision: plan.revision }, runtime: { hyperframes: '0.7.106' } })
    expect(JSON.parse(text(packet.files['packet/PLAN.json']))).toMatchObject({ record: plan.id, plan: { moments: [{ id: 'm1' }] } })
    expect(text(packet.files['packet/SKETCH.md'])).toMatch(/Composition id: `sketch-/)
    await service.attachRun(queued.record.id, { runId: 'run-preview-sketch' })
    const compositionId = context.composition.id
    const html = `<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>#root{position:relative;width:100%;height:100%;overflow:hidden}.clip{position:absolute;inset:0}</style></head><body>
<div id="root" data-composition-id="${compositionId}" data-start="0" data-width="1920" data-height="1080" data-duration="6">
<div id="m1" class="clip" data-start="0" data-duration="6" data-track-index="0"><div class="title">Spend</div></div>
</div><script>window.__timelines = window.__timelines || {}
const tl = gsap.timeline({ paused: true })
tl.fromTo('#m1 .title', { opacity: 0 }, { opacity: 1, duration: 1 }, 0)
window.__timelines["${compositionId}"] = tl</script></body></html>`
    const manifest = { version: 1, scene: scenes[0], plan: { record: plan.id, revision: plan.revision }, composition: { id: compositionId, width: 1920, height: 1080, fps: 30, duration: 6 }, runtime: { hyperframes: '0.7.106' }, moments: [{ id: 'm1', title: 'Spend', start: 0, end: 6, estimated: true }], layers: [{ id: 'title', kind: 'text', label: 'Spend', moments: ['m1'] }], provisional: ['Timing is estimated from the plan'] }
    // Refused: nothing to play.
    expect(await service.submitSketch(queued.record.id, { 'manifest.json': JSON.stringify(manifest) }, 'run-preview-sketch')).toMatchObject({ accepted: false, problems: expect.arrayContaining(['index.html is missing']) })
    // Refused by the pinned engine's lint: no timeline registry initialised.
    const unlinted = await service.submitSketch(queued.record.id, { 'index.html': html.replace('window.__timelines = window.__timelines || {}', ''), 'manifest.json': JSON.stringify(manifest) }, 'run-preview-sketch')
    expect(unlinted).toMatchObject({ accepted: false, problems: [expect.stringMatching(/hyperframes lint timeline_registry_missing_init/)] })
    const landed = await service.submitSketch(queued.record.id, { 'index.html': html, 'manifest.json': JSON.stringify(manifest) }, 'run-preview-sketch')
    expect(landed).toMatchObject({ accepted: true, status: 'ready' })
    // Served as accepted, for the player.
    const index = await service.loadPreviewFile(queued.record.id, 'index.html')
    expect(index.contentType).toMatch(/text\/html/)
    expect(index.body.toString('utf8')).toContain(`data-composition-id="${compositionId}"`)
    await expect(service.loadPreviewFile(queued.record.id, '../secret')).rejects.toThrow(/No such file/)
    let overview = await service.planningOverview(id)
    expect(overview.scenes[0].preview?.ready).toMatchObject({ current: true, of: { record: plan.id }, url: expect.stringMatching(/^\/api\/planning\/previews\/.+\/index\.html$/), summary: { duration: 6, moments: [{ id: 'm1', start: 0, end: 6 }] } })
    // The same plan is shown again, not sketched again — unless asked.
    expect(await service.queuePreview(id, scenes[0])).toMatchObject({ reused: true, record: { id: queued.record.id } })
    expect((await service.queuePreview(id, scenes[0], { again: true })).reused).toBe(false)
    // A new candidate: the preview is of the old plan, and says so.
    await service.saveDirection(id, { subject: scenes[0], direction: 'Slower' })
    const { record: next } = await service.queueTreatment(id, scenes[0])
    await service.attachRun(next.id, { runId: 'run-preview-plan-2' })
    await service.submitTreatment(next.id, treatmentFor(scenes[0], 'b1'), 'run-preview-plan-2')
    overview = await service.planningOverview(id)
    expect(overview.scenes[0].preview?.ready).toMatchObject({ current: false, of: { record: plan.id } })
  }, 60_000)

  // R1/R2 of the scene-review review: a preview belongs to one plan revision
  // and is current only while nothing it was sketched from has moved.
  it('keeps each revision\'s own preview, and never lets a late or moved one read as current', async () => {
    const { videoId: id, videoScenes: scenes } = await makeVideo('honest-preview')
    await readyBrief(id, 'run-honest-brief')
    const planned = async (runId: string) => {
      const { record } = await service.queueTreatment(id, scenes[0])
      await service.attachRun(record.id, { runId })
      expect(await service.submitTreatment(record.id, treatmentFor(scenes[0], 'b1'), runId)).toMatchObject({ accepted: true })
      return record
    }
    const sketch = async (recordId: string, runId: string) => {
      await service.attachRun(recordId, { runId })
      const context = JSON.parse(text((await service.loadPacket(recordId)).files['packet/CONTEXT.json']))
      const compositionId = context.composition.id
      const html = `<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>#root{position:relative;width:100%;height:100%;overflow:hidden}.clip{position:absolute;inset:0}</style></head><body>
<div id="root" data-composition-id="${compositionId}" data-start="0" data-width="1920" data-height="1080" data-duration="6">
<div id="m1" class="clip" data-start="0" data-duration="6" data-track-index="0"><div class="title">Spend</div></div>
</div><script>window.__timelines = window.__timelines || {}
const tl = gsap.timeline({ paused: true })
tl.fromTo('#m1 .title', { opacity: 0 }, { opacity: 1, duration: 1 }, 0)
window.__timelines["${compositionId}"] = tl</script></body></html>`
      const manifest = { version: 1, scene: scenes[0], plan: context.plan, composition: { id: compositionId, width: 1920, height: 1080, fps: 30, duration: 6 }, runtime: { hyperframes: '0.7.106' }, moments: [{ id: 'm1', title: 'Spend', start: 0, end: 6, estimated: true }], layers: [{ id: 'title', kind: 'text', label: 'Spend', moments: ['m1'] }], provisional: ['Timing is estimated from the plan'] }
      return service.submitSketch(recordId, { 'index.html': html, 'manifest.json': JSON.stringify(manifest) }, runId)
    }
    const r1 = await planned('run-honest-plan-1')
    const first = await service.queuePreview(id, scenes[0])
    // A newer plan arrives, and is sketched, before r1's sketch lands.
    await service.saveDirection(id, { subject: scenes[0], direction: 'Slower' })
    const r2 = await planned('run-honest-plan-2')
    const second = await service.queuePreview(id, scenes[0])
    expect(second.record.inputs.treatmentId).toBe(r2.id)
    expect(await sketch(second.record.id, 'run-honest-sketch-2')).toMatchObject({ accepted: true })
    expect(await sketch(first.record.id, 'run-honest-sketch-1')).toMatchObject({ accepted: true })
    let preview = (await service.planningOverview(id)).scenes[0].preview!
    // The late sketch of r1 is kept as r1's, and never becomes the current one.
    expect(preview.ready).toMatchObject({ id: second.record.id, of: { record: r2.id }, current: true, staleBecause: null })
    expect(preview.byTreatment[r2.id]).toMatchObject({ id: second.record.id, current: true })
    expect(preview.byTreatment[r1.id]).toMatchObject({ id: first.record.id, current: false, staleBecause: expect.stringMatching(/sketches r1; the scene's current plan is r2/) })
    // A sketch whose inputs move while it is made lands, as history.
    const third = await service.queuePreview(id, scenes[0], { again: true })
    const video = await persistence.loadProjectArtifact(id)
    await persistence.saveProjectArtifact({ ...video!, theme: { version: 1, id: 'night', name: 'Night', description: '', source: 'custom', brand: { background: '#000000' }, fonts: {} } as unknown as ProjectDocumentV1['theme'] })
    const late = await sketch(third.record.id, 'run-honest-sketch-3')
    expect(late).toMatchObject({ accepted: true, warnings: expect.arrayContaining([expect.stringMatching(/While this sketch was made, the theme changed — it is kept, as out of date/)]) })
    preview = (await service.planningOverview(id)).scenes[0].preview!
    expect(preview.byTreatment[r2.id]).toMatchObject({ id: third.record.id, current: false, staleBecause: expect.stringMatching(/its plan is stale/) })
    expect(Object.values(preview.byTreatment).some(view => view.current)).toBe(false)
  }, 60_000)

  // R4: taking a plan's own narration as the scene's script does not make
  // that plan stale; any other change to the words still does.
  it('keeps a plan fresh when the scene takes its lines, and stale when the words change otherwise', async () => {
    const { videoId: id, videoScenes: scenes } = await makeVideo('adopt-script')
    await readyBrief(id, 'run-adopt-brief')
    const { record } = await service.queueTreatment(id, scenes[0])
    await service.attachRun(record.id, { runId: 'run-adopt-plan' })
    expect(await service.submitTreatment(record.id, treatmentFor(scenes[0], 'b1'), 'run-adopt-plan')).toMatchObject({ accepted: true })
    const setScript = async (script: string, scriptSource: unknown) => {
      const video = await persistence.loadProjectArtifact(id)
      const content = (video!.notebook.content || []).map(node => (node.attrs?.id === scenes[0] ? { ...node, attrs: { ...node.attrs, script, scriptSource } } : node))
      await persistence.saveProjectArtifact({ ...video!, notebook: { ...video!.notebook, content } })
    }
    const lineage = { treatment: record.id, revision: record.revision, at: '2026-09-25T00:00:00.000Z', previous: 'Each request spends one token.' }
    await setScript('Each request consumes one token.', lineage)
    expect((await service.planningOverview(id)).scenes[0].view).toMatchObject({ state: 'candidate', staleBecause: null })
    await setScript('Each request consumes one token.\n\nAnd then some words the plan never said.', lineage)
    const view = (await service.planningOverview(id)).scenes[0].view
    expect(view.state).toBe('stale')
    expect(view.staleBecause).toMatch(/script|words/)
  }, 60_000)

  it('fails the records of a run interrupted by a restart, with a way on', async () => {
    const { videoId: id } = await makeVideo('interrupt')
    const { record } = await service.queueBrief(id)
    await service.attachRun(record.id, { runId: 'run-interrupted' })
    const failed = await service.runFinished('run-interrupted', { status: 'interrupted', exitCode: null })
    expect(failed).toHaveLength(1)
    expect(failed[0]).toMatchObject({ status: 'failed', error: { message: expect.stringMatching(/^Interrupted: the app closed while this run was working\. Retry it/) } })
    // A retry queues afresh.
    expect((await service.queueBrief(id)).reused).toBe(false)
  })
})
