import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { forkNotebook, type ProjectDocumentV1 } from 'markdown-composition'

// The file backend in a scratch directory, and the real vendored skills.
process.env.STUDIO_PERSISTENCE = 'local'
process.env.STUDIO_DATA_DIR = mkdtempSync(join(tmpdir(), 'planning-'))
process.env.STUDIO_SKILLS_DIR = fileURLToPath(new URL('../../studio-desktop/skills/', import.meta.url))

const persistence = await import('./persistence')
const service = await import('./planning-service')

const ARTICLE = `Rate limiting with a token bucket

A token bucket holds a fixed number of tokens. Each request that is admitted consumes one token.

When a burst arrives, the requests are admitted until the bucket is empty; the next request is rejected.

Tokens are added back at a steady refill rate, so a later request can pass again.`

const scene = (id: string, title: string, script: string, passages: string[]) => ({
  type: 'scene',
  attrs: { id, title, script, sourcePassages: passages, directorNotes: `${title} idea`, svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
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
  continuity: { entry: 'Full bucket', exit: 'One token spent' },
  unresolved: [],
  coverage: [{ unit: 'admission', need: 'Show a token being spent', moments: ['m1'] }],
  rosterProposal: null,
  delivery: { voice: 'undecided', note: '' },
})

beforeAll(async () => {
  await persistence.initializePersistence()
  const source = await persistence.saveSourceRevision({ kind: 'url', url: 'https://example.com/bucket', title: 'Token bucket', site: 'example.com', content: { text: ARTICLE, title: 'Token bucket' } })
  const base: ProjectDocumentV1 = {
    version: 1,
    id: 'base-nb',
    title: 'Rate limiting',
    notebook: { type: 'doc', content: [scene('b1', 'Admission', 'Each request spends one token.', ['Each request that is admitted consumes one token.']), scene('b2', 'Rejection', 'When it is empty, the next one is refused.', ['the next request is rejected'])] },
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { name: 'x' } as unknown as ProjectDocumentV1['brand'],
    source: { kind: 'url', url: 'https://example.com/bucket', site: 'example.com', title: 'Token bucket', readAt: '2026-09-24T00:00:00Z', snapshotId: source.id },
    outline: { title: 'Rate limiting', targetSeconds: 60, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  await persistence.saveProjectArtifact(base)
  const snapshot = await persistence.storeAsset({ body: Buffer.from(JSON.stringify(base)), contentType: 'application/json', kind: 'base-snapshot', extension: '.json' })
  const { project } = forkNotebook(base, { id: 'video-nb', snapshot })
  await persistence.saveProjectArtifact(project)
  videoId = project.id
  baseScenes = ['b1', 'b2']
  videoScenes = (project.notebook.content || []).map(node => String(node.attrs?.id))
})

describe('planning a forked video', () => {
  it('waits for the brief, and queues the same inputs only once', async () => {
    const overview = await service.planningOverview(videoId)
    expect(overview.available).toBe(true)
    expect(overview.bundle?.upstreamCommit).toBe('99221c50a5e5927ca243454b4e4f02f9adf7cfc6')
    expect(overview.scenes.map(scene => scene.view.state)).toEqual(['preparing', 'preparing'])
    const first = await service.queueBrief(videoId)
    const again = await service.queueBrief(videoId)
    expect(first.reused).toBe(false)
    expect(again.reused).toBe(true)
    expect(again.record.id).toBe(first.record.id)
  })

  it('gives the harness the retained source, numbered, and the base pages as reference', async () => {
    const { record } = await service.queueBrief(videoId)
    const packet = await service.loadPacket(record.id)
    expect(packet.route).toBe('Prepare Brief')
    expect(packet.files['packet/SOURCE.md']).toMatch(/¶2 {2}A token bucket holds a fixed number of tokens/)
    const context = JSON.parse(packet.files['packet/CONTEXT.json'])
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
    const context = JSON.parse((await service.loadPacket(record.id)).files['packet/CONTEXT.json'])
    const brief = goodBrief({ sourceRevision: context.sourceRevision, baseNotebook: context.baseNotebook, baseRevision: context.baseRevision, themeRef: context.themeRef, requestedSeconds: context.requestedSeconds })
    const cited = { ...brief, evidence: [...brief.evidence, { id: 'ev-note', kind: 'creator', text: 'Admission idea' }] }
    const refused = await service.submitBrief(record.id, cited)
    expect(refused.accepted).toBe(false)
    expect(JSON.stringify(refused)).toMatch(/ev-note/)
  })

  it('refuses a brief that quotes what the source never said, then keeps a grounded one', async () => {
    const { record } = await service.queueBrief(videoId)
    await service.attachRun(record.id, { runId: 'run-brief-1', adapter: 'kimi', model: 'k3' })
    const context = JSON.parse((await service.loadPacket(record.id)).files['packet/CONTEXT.json'])
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
    expect(Object.keys(packet.files).sort()).toEqual(['packet/BRIEF.md', 'packet/CONTEXT.json', 'packet/EXPLANATION.md', 'packet/SCENE.md'])
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
    const view = (await service.planningOverview(videoId)).scenes.find(entry => entry.id === sceneId)!.view
    expect(view.state).toBe('stale')
    await expect(service.reviewTreatment(queued.record.id)).rejects.toThrow(/stale/)
  })
})
