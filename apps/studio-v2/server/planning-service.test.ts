import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { forkNotebook, type ProjectDocumentV1 } from 'markdown-composition'
import type { SketchManifest } from '../src/planning/sketch-bundle'

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
const { systemVoiceAvailable, runCommand, probeSeconds } = await import('./voice')
const systemVoice = await systemVoiceAvailable()
const aligner = systemVoice && (await runCommand('uv', ['--version'], 10_000).then(() => true, () => false))
const { lineFingerprints, scriptFingerprint } = await import('../src/planning/recording-guide')

// A produced scene's composition (P4): the bucket appears and grows in m1,
// playing the clock's sound when it has one.
const productionHtml = (compositionId: string, duration: number, audio: string | null, reveal = '0') => `<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>#root{position:relative;width:100%;height:100%;overflow:hidden;background:#101018}.clip{position:absolute;inset:0}.bucket{position:absolute;left:760px;top:340px;width:400px;height:400px;border-radius:40px;background:#635bff}</style></head><body>
<div id="root" data-composition-id="${compositionId}" data-start="0" data-width="1920" data-height="1080" data-duration="${duration}">
<div id="m1" class="clip" data-start="0" data-duration="${duration}" data-track-index="0"><div class="bucket" data-sketch-layer="bucket"></div></div>
${audio ? `<audio id="voice" src="${audio}" data-start="0" data-duration="${duration}" data-track-index="20"></audio>` : ''}
</div><script>window.__timelines = window.__timelines || {}
const tl = gsap.timeline({ paused: true })
tl.fromTo('#m1 .bucket', { opacity: 0.2, scale: 0.8 }, { opacity: 1, scale: 1, duration: 1.2 }, ${reveal})
window.__timelines["${compositionId}"] = tl</script></body></html>`
const library = await import('./appearance-library')
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
const makeVideo = async (tag: string, options: { fragmentsOnly?: boolean; pages?: Array<{ type: string; attrs: Record<string, unknown> }>; theme?: ProjectDocumentV1['theme']; outline?: NonNullable<ProjectDocumentV1['outline']>['scenes'] } = {}) => {
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
    outline: { title: 'Rate limiting', targetSeconds: 60, scenes: options.outline || [], glossary: [] },
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

  // F4 of the fresh end-to-end review: animating a base page rewrote the
  // notes its idea had been kept in, and the presentation record showed the
  // director's staging as the page's idea.
  it('pins what each base page teaches from its outline, with the director\'s staging apart', async () => {
    const staging = 'Open on you. The page needs the whole frame — you become a chip.'
    const objective = 'A request is admitted only by spending a token'
    const animated = { ...scene('a1', 'Admission', 'Each request spends one token.', ['Each request that is admitted consumes one token.']), attrs: { ...scene('a1', 'Admission', 'Each request spends one token.', ['Each request that is admitted consumes one token.']).attrs, pageOrigin: { kind: 'designed' }, directorNotes: staging, directorAuto: { directorNotes: staging }, directorSeed: { directorNotes: objective } } }
    const { videoId: animatedVideo } = await makeVideo('objective', {
      pages: [animated, scene('a2', 'Rejection', 'When it is empty, the next one is refused.', ['the next request is rejected'])],
      outline: [{ nodeId: 'a1', title: 'Admission', kind: 'diagram', seconds: 20, idea: objective }, { nodeId: 'a2', title: 'Rejection', kind: 'diagram', seconds: 20, idea: 'An empty bucket refuses the next request' }],
    })
    const overview = await service.planningOverview(animatedVideo)
    expect(overview.basePages.map(page => [page.objective, page.layoutGuidance])).toEqual([
      [objective, staging],
      ['An empty bucket refuses the next request', 'Rejection idea'],
    ])
    const { record } = await service.queueBrief(animatedVideo)
    const presentation = text((await service.loadPacket(record.id)).files['packet/PRESENTATION.md'])
    expect(presentation).toContain(`Teaching objective (from the source outline): ${objective}`)
    expect(presentation).toContain(`Page notes (slide layout, reference only): ${staging}`)
    expect(presentation).not.toMatch(/Teaching objective[^\n]*chip/)
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

  // U3 of the scene workspace plan: what a run confirmed, and the sections it
  // published, kept on its record — checked, only from its own run, and only
  // while it runs.
  it('keeps a run\'s milestones and checked drafts on its record, from that run only', async () => {
    const { videoId: id, videoScenes: scenes } = await makeVideo('progress')
    await readyBrief(id, 'run-progress-brief')
    const milestones = async (recordId: string) => ((await persistence.loadPlanningRecord(recordId))?.progress?.events || []).map(event => event.milestone)
    const { record } = await service.queueTreatment(id, scenes[0])
    await service.attachRun(record.id, { runId: 'run-progress-plan', adapter: 'claude-code' })
    await service.noteProgress(record.id, { milestone: 'context' }, { runId: 'run-progress-plan' })
    // Another run's note is ignored; its draft is refused.
    expect(await service.noteProgress(record.id, { milestone: 'context' }, { runId: 'run-someone-else' })).toBeNull()
    await expect(service.publishDraft(record.id, 'run-someone-else', 'explanation', { question: 'q', takeaway: 't' })).rejects.toThrow(/does not own/)
    // A section is checked before it is kept.
    expect(await service.publishDraft(record.id, 'run-progress-plan', 'explanation', { question: 'Why refuse?' })).toEqual({ accepted: false, problems: ['takeaway is required'] })
    expect(await service.publishDraft(record.id, 'run-progress-plan', 'explanation', { question: 'Why refuse the excess?', takeaway: 'It keeps the API alive.' })).toEqual({ accepted: true })
    expect(await service.publishDraft(record.id, 'run-progress-plan', 'moments', { moments: [{ id: 'm1', title: 'Tokens drain' }] })).toEqual({ accepted: true })
    const drafting = await persistence.loadPlanningRecord(record.id)
    expect(drafting?.progress?.draft).toMatchObject({ question: 'Why refuse the excess?', takeaway: 'It keeps the API alive.', moments: [{ id: 'm1', title: 'Tokens drain', summary: '' }] })
    expect(drafting?.progress?.events.map(event => [event.milestone, event.section ?? null, event.count ?? null])).toEqual([['started', null, null], ['context', null, null], ['draft', 'explanation', null], ['draft', 'moments', 1]])
    // A refused plan is noted with how many problems; the run keeps its record.
    const refused = await service.submitTreatment(record.id, { ...treatmentFor(scenes[0], 'b1'), moments: [] }, 'run-progress-plan')
    expect(refused).toMatchObject({ accepted: false })
    await vi.waitFor(async () => expect((await milestones(record.id)).slice(-2)).toEqual(['submitted', 'refused']))
    expect((await persistence.loadPlanningRecord(record.id))?.progress?.events.at(-1)?.count).toBeGreaterThan(0)
    expect(await service.submitTreatment(record.id, treatmentFor(scenes[0], 'b1'), 'run-progress-plan')).toMatchObject({ accepted: true, status: 'candidate' })
    await vi.waitFor(async () => expect((await milestones(record.id)).at(-1)).toBe('accepted'))
    // Finished, nothing more is noted or kept.
    expect(await service.noteProgress(record.id, { milestone: 'context' }, { runId: 'run-progress-plan' })).toBeNull()
    await expect(service.publishDraft(record.id, 'run-progress-plan', 'explanation', { question: 'Late?', takeaway: 'Late.' })).rejects.toThrow(/already finished as candidate/)

    // A run stopped by the creator ends as stopped, with its last draft kept.
    const { record: second } = await service.queueTreatment(id, scenes[1])
    await service.attachRun(second.id, { runId: 'run-progress-stop' })
    await service.publishDraft(second.id, 'run-progress-stop', 'explanation', { question: 'What is refused?', takeaway: 'The excess.' })
    expect(await service.failRecord(second.id, { message: 'The run was cancelled before it submitted a result.' })).toMatchObject({ status: 'failed' })
    const stopped = await persistence.loadPlanningRecord(second.id)
    expect(stopped?.progress?.events.map(event => event.milestone)).toEqual(['started', 'draft', 'stopped'])
    expect(stopped?.progress?.draft).toMatchObject({ question: 'What is refused?' })
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

  // R10: a packet hands a container's inside with its artwork — the level
  // clipped to the shell, where to set it, and the states it was drawn in.
  it('hands over a container\'s inside with its artwork', async () => {
    const rich = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/visual-cast/${name}`, import.meta.url)), 'utf8')
    const { videoId: id, videoScenes: scenes } = await makeVideo('inside', {
      pages: [
        scene('b1', 'Admission', 'Each request spends one token.', ['Each request that is admitted consumes one token.'], rich('10_the_token_bucket.svg')),
        scene('b2', 'Rejection', 'Only so many run at once.', ['the next request is rejected'], rich('06_concurrent_requests_limiter.svg')),
      ],
    })
    await readyBrief(id, 'run-inside-brief')
    const { record } = await service.queueTreatment(id, scenes[0])
    const files = (await service.loadPacket(record.id)).files
    const cast = JSON.parse(text(files['packet/VISUAL_CAST.json']))
    const bucket = cast.entries.find((entry: { object: string | null }) => entry.object === 'token-bucket')
    expect(bucket.rig.inside).toMatchObject({ level: expect.stringMatching(/bucket-level$/), clipPath: expect.stringMatching(/-inside$/), extent: { left: 510, top: 180, right: 690, bottom: 316 } })
    expect(text(files[`packet/${bucket.files.svg}`])).toContain(`clip-path="url(#${bucket.rig.inside.clipPath})"`)
    const parts = JSON.parse(text(files[`packet/${bucket.files.parts}`]))
    expect(parts.rig.inside).toMatchObject({ contained: true, states: expect.arrayContaining([expect.objectContaining({ fill: 1, scale: 1.5, outside: 0 })]) })
  }, 60_000)

  // Extracting again (version 2's inside clip) gave the live bucket a new
  // library key; a plan still naming the old one got no artwork in its
  // sketch packet, and the harness drew a placeholder. The old key names the
  // same drawn thing, so the packet carries the current entry for it.
  it('carries the artwork a plan names by a key an earlier extraction gave', async () => {
    const rich = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/visual-cast/${name}`, import.meta.url)), 'utf8')
    const { videoId: id, videoScenes: scenes } = await makeVideo('earlier-key', {
      pages: [
        scene('b1', 'Admission', 'Each request spends one token.', ['Each request that is admitted consumes one token.'], rich('10_the_token_bucket.svg')),
        scene('b2', 'Rejection', 'Only so many run at once.', ['the next request is rejected'], rich('06_concurrent_requests_limiter.svg')),
      ],
    })
    await readyBrief(id, 'run-earlier-brief')
    const { record } = await service.queueTreatment(id, scenes[1])
    await service.attachRun(record.id, { runId: 'run-earlier-plan' })
    const castId = JSON.parse(text((await service.loadPacket(record.id)).files['packet/VISUAL_CAST.json'])).cast as string
    const stored = (await persistence.loadSetting(castId)) as { base: unknown; entries: Array<{ id: string; libraryKey: string | null; identity: { object: string | null; contentHash: string } }> }
    const bucket = stored.entries.find(entry => entry.identity.object === 'token-bucket')!
    // The same bucket as an earlier extractor version lifted it, in the library under its own key.
    const earlier = { ...bucket, id: `cast-earlier-${RUN}`, libraryKey: null, identity: { ...bucket.identity, contentHash: `e${RUN}`.padEnd(64, '0') } }
    const v1 = castId.replace(/:v\d+$/, ':v1')
    await persistence.saveSetting(v1, { ...stored, id: v1, version: 1, entries: [earlier] })
    const oldKey = (await library.registerExtractedArtwork({ entry: earlier as never, svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', castId: v1 })).key
    expect(oldKey).not.toBe(bucket.libraryKey)
    const plan = { ...treatmentFor(scenes[1], 'b2'), units: ['rejection'], evidenceRefs: ['ev-burst'], coverage: [{ unit: 'rejection', need: 'Tie rejection to the empty bucket', moments: ['m1'] }], objects: [
      { entity: 'bucket', role: 'Holds the tokens', appearance: 'The page\'s own bucket', performance: 'Its level falls as tokens are spent', asset: { status: 'reuse', ref: oldKey, reason: 'The bucket the video already showed' } },
    ] }
    expect(await service.submitTreatment(record.id, plan, 'run-earlier-plan')).toMatchObject({ accepted: true, status: 'candidate' })
    const sketch = (await service.loadPacket((await service.queuePreview(id, scenes[1])).record.id)).files
    const sketchCast = JSON.parse(text(sketch['packet/VISUAL_CAST.json']))
    const carried = sketchCast.entries.find((entry: { object: string | null }) => entry.object === 'token-bucket')
    expect(carried).toMatchObject({ libraryKey: bucket.libraryKey, formerKeys: [oldKey], rig: { inside: { clipPath: expect.stringMatching(/-inside$/) } } })
    for (const path of Object.values(carried.files) as string[]) expect(sketch).toHaveProperty([`packet/${path}`])
  }, 60_000)

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

  // F1 of the Perplexity review: a video forked while its base was still
  // being designed kept the schematic, and its planner was handed
  // rectangle-only artwork after the base had designed the slide. The base's
  // newer page is offered to its scene; adopting it re-plans that scene only.
  it('offers a scene its base\'s newer designed page, and plans that scene alone from it once adopted', async () => {
    const rich = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/visual-cast/${name}`, import.meta.url)), 'utf8')
    const schematicPage = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#ffffff"/><g id="s1-node-script" data-role="node"><rect x="100" y="300" width="240" height="90" fill="#eeeeee" stroke="#999999"/><text x="130" y="352" font-size="24">User script</text></g></svg>'
    const withOrigin = (page: ReturnType<typeof scene>, pageOrigin: Record<string, unknown>) => ({ ...page, attrs: { ...page.attrs, pageOrigin } })
    const { videoId: id, videoScenes: scenes } = await makeVideo('adopt', {
      pages: [
        withOrigin(scene('b1', 'Admission', 'Each request spends one token.', ['Each request that is admitted consumes one token.'], schematicPage), { kind: 'schematic' }),
        withOrigin(scene('b2', 'Rejection', 'Only so many run at once.', ['the next request is rejected'], rich('06_concurrent_requests_limiter.svg')), { kind: 'designed', by: 'Kimi' }),
      ],
    })
    await readyBrief(id, 'run-adopt-brief')
    let overview = await service.planningOverview(id)
    expect(overview.scenes[0].reference).toMatchObject({ baseScene: 'b1', kind: 'schematic', adopted: null, newer: null })
    expect(overview.scenes[1].reference).toMatchObject({ baseScene: 'b2', kind: 'designed', newer: null })

    // The second scene is planned with its page's slot pool, approved and sketched.
    const { record: second } = await service.queueTreatment(id, scenes[1])
    await service.attachRun(second.id, { runId: 'run-adopt-plan-2' })
    const secondCast = JSON.parse(text((await service.loadPacket(second.id)).files['packet/VISUAL_CAST.json']))
    const pool = secondCast.entries.find((entry: { object: string | null }) => entry.object === 'slot-pool')
    const bucket = { entity: 'bucket', role: 'The calls in progress', appearance: 'The page\'s own twenty-slot pool', performance: 'Slots fill one by one', asset: { status: 'reuse', ref: pool.libraryKey, reason: 'The limit the viewer must see' } }
    const secondPlan = { ...treatmentFor(scenes[1], 'b2'), units: ['rejection'], evidenceRefs: ['ev-burst'], coverage: [{ unit: 'rejection', need: 'Tie rejection to the empty bucket', moments: ['m1'] }], objects: [bucket] }
    // A designed slide's objects are each decided: using only the pool is not enough.
    const others = secondCast.entries.filter((entry: { page: string; libraryKey: string; verification: { status: string } }) => entry.page === 'b2' && entry.verification.status === 'verified' && entry.libraryKey !== pool.libraryKey)
    expect(others.length).toBeGreaterThan(0)
    const undecided = await service.submitTreatment(second.id, secondPlan, 'run-adopt-plan-2')
    expect(undecided).toMatchObject({ accepted: false, problems: [expect.stringMatching(new RegExp(`^the designed slide's .*\\(${others[0].libraryKey}\\).* no decision: in objects, use, adapt or replace`))] })
    const omitted = others.map((entry: { id: string; label: string; libraryKey: string }) => ({ entity: `page-${entry.id}`, role: entry.label, appearance: 'Not shown', performance: 'None', asset: { status: 'omit', ref: entry.libraryKey, reason: 'The limit is carried by the pool alone' } }))
    expect(await service.submitTreatment(second.id, { ...secondPlan, objects: [bucket, ...omitted] }, 'run-adopt-plan-2')).toMatchObject({ accepted: true, status: 'candidate' })
    expect((await service.reviewTreatment(second.id)).status).toBe('reviewed')
    const { record: sketchRecord } = await service.queuePreview(id, scenes[1])
    await service.attachRun(sketchRecord.id, { runId: 'run-adopt-sketch' })
    const compositionId = JSON.parse(text((await service.loadPacket(sketchRecord.id)).files['packet/CONTEXT.json'])).composition.id
    const html = `<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>#root{position:relative;width:100%;height:100%;overflow:hidden;background:#101018}.clip{position:absolute;inset:0}.title{position:absolute;left:120px;top:90px;color:#fff;font:600 64px system-ui}</style></head><body>
<div id="root" data-composition-id="${compositionId}" data-start="0" data-width="1920" data-height="1080" data-duration="6">
<div id="m1" class="clip" data-start="0" data-duration="6" data-track-index="0"><div class="title" data-sketch-layer="title">Spend</div></div>
</div><script>window.__timelines = window.__timelines || {}
const tl = gsap.timeline({ paused: true })
tl.fromTo('#m1 .title', { opacity: 0 }, { opacity: 1, duration: 1 }, 0)
window.__timelines["${compositionId}"] = tl</script></body></html>`
    const manifest = { version: 1, scene: scenes[1], plan: { record: second.id, revision: second.revision }, composition: { id: compositionId, width: 1920, height: 1080, fps: 30, duration: 6 }, runtime: { hyperframes: '0.7.106' }, moments: [{ id: 'm1', title: 'Spend', start: 0, end: 6, estimated: true }], layers: [{ id: 'title', kind: 'text', label: 'Spend', moments: ['m1'] }], provisional: ['Timing is estimated from the plan'] }
    expect(await service.submitSketch(sketchRecord.id, { 'index.html': html, 'manifest.json': JSON.stringify(manifest) }, 'run-adopt-sketch')).toMatchObject({ accepted: true, status: 'ready' })

    // The first scene is planned from its schematic.
    const { record: first } = await service.queueTreatment(id, scenes[0])
    await service.attachRun(first.id, { runId: 'run-adopt-plan-1' })
    expect(await service.submitTreatment(first.id, treatmentFor(scenes[0], 'b1'), 'run-adopt-plan-1')).toMatchObject({ accepted: true, status: 'candidate' })

    // The base designs the first page after the fork: offered, not taken.
    const base = (await persistence.loadProjectArtifact(`base-adopt-${RUN}`))!
    const designedPage = rich('05_request_rate_limiter.svg').trim()
    // Designed, the base keeps the schematic beside the slide.
    base.notebook.content[0].attrs = { ...base.notebook.content[0].attrs, svg: designedPage, pageOrigin: { kind: 'designed', by: 'Kimi', runId: 'run-design' }, schematic: { svg: schematicPage, program: null } }
    await persistence.saveProjectArtifact(base)
    overview = await service.planningOverview(id)
    const newer = overview.scenes[0].reference!.newer!
    expect(newer).toMatchObject({ baseScene: 'b1', kind: 'designed', by: 'Kimi', designing: false, schematic: schematicPage })
    expect(newer.svg).toBe(designedPage)
    expect(newer.revision).not.toBe(overview.scenes[0].reference!.revision)
    expect(overview.scenes[1].reference!.newer).toBeNull()
    expect(overview.scenes[0].view.state).toBe('candidate')
    // BoltDB review B06: a page landed while its run goes on checking the
    // rest of the batch is offered at once; a scene still waiting for its
    // first designed page says the base is designing it.
    const binding = { runId: 'run-design', page: 1, by: 'Kimi', placeholder: 'placeholder', landed: 'landed' }
    const unbound = structuredClone(base)
    base.notebook.content[0].attrs = { ...base.notebook.content[0].attrs, pageOrigin: { kind: 'designed', by: 'Kimi', runId: 'run-design', designing: binding } }
    base.notebook.content[1].attrs = { ...base.notebook.content[1].attrs, pageOrigin: { kind: 'schematic', designing: { ...binding, page: 2 } } }
    await persistence.saveProjectArtifact(base)
    const bound = await service.planningOverview(id)
    expect(bound.scenes[0].reference).toMatchObject({ baseDesigning: false, newer: { kind: 'designed', designing: false, svg: designedPage } })
    expect(bound.scenes[1].reference).toMatchObject({ baseDesigning: true, newer: null })
    await persistence.saveProjectArtifact(unbound)

    // The creator adopts it for the first scene: the scene takes the page and
    // says which revision of the base's page it took.
    const video = (await persistence.loadProjectArtifact(id))!
    const firstNode = video.notebook.content.find(node => node.attrs?.id === scenes[0])!
    firstNode.attrs = { ...firstNode.attrs, svg: newer.svg, pageOrigin: { kind: 'designed', by: 'Kimi' }, reference: { baseScene: 'b1', revision: newer.revision, kind: 'designed', adoptedAt: '2026-09-25T12:00:00.000Z' }, schematic: { svg: newer.schematic, program: null } }
    await persistence.saveProjectArtifact(video)
    overview = await service.planningOverview(id)
    expect(overview.scenes[0].reference).toMatchObject({ kind: 'designed', revision: newer.revision, adopted: { revision: newer.revision }, newer: null })
    // That scene's plan is stale, and says why; the other scene's approved
    // plan and its sketch are untouched — the artwork it uses is unchanged.
    expect(overview.scenes[0].view).toMatchObject({ state: 'stale', staleBecause: 'the scene\'s page reference changed since this plan was made' })
    expect(overview.scenes[1].view).toMatchObject({ reviewed: { id: second.id }, current: { id: second.id } })
    expect(overview.scenes[1].view.staleBecause).toBeFalsy()
    // While the cast is extracted again from the adopted page, and once it is.
    expect(overview.scenes[1].preview?.ready).toMatchObject({ id: sketchRecord.id, current: true })
    expect((await service.visualCastFor(await service.loadVideoPlanning(id))).status).toBe('ready')
    overview = await service.planningOverview(id)
    expect(overview.visualCast.status).toBe('ready')
    expect(overview.scenes[1].preview?.ready).toMatchObject({ id: sketchRecord.id, current: true })
    // A new plan of the first scene is handed the designed page and its artwork.
    const { record: again } = await service.queueTreatment(id, scenes[0])
    expect(again.inputs).toMatchObject({ reference: newer.revision })
    const files = (await service.loadPacket(again.id)).files
    expect(text(files['packet/references/page.svg'])).toBe(designedPage)
    // Both references: the designed slide, and the schematic it was designed from.
    expect(text(files['packet/references/schematic.svg'])).toBe(schematicPage)
    expect(JSON.parse(text(files['packet/CONTEXT.json'])).references).toMatchObject({ designed: 'references/page.svg', schematic: 'references/schematic.svg' })
    expect(JSON.parse(text(files['packet/VISUAL_CAST.json'])).decide).toMatch(/^Decide every verified entry of this scene's own page/)
    const cast = JSON.parse(text(files['packet/VISUAL_CAST.json']))
    expect(cast.status).toBe('ready')
    const script = cast.entries.find((entry: { label: string }) => entry.label === 'User script')
    expect(script).toMatchObject({ kind: 'icon', verification: { status: 'verified' } })
    // The pinned base revision itself never moved: the brief stays fresh.
    expect(overview.brief.stale).toBe(false)
  }, 180_000)

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
    const html = `<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>#root{position:relative;width:100%;height:100%;overflow:hidden;background:#101018}.clip{position:absolute;inset:0}.title{position:absolute;left:120px;top:90px;color:#fff;font:600 64px system-ui}</style></head><body>
<div id="root" data-composition-id="${compositionId}" data-start="0" data-width="1920" data-height="1080" data-duration="6">
<div id="m1" class="clip" data-start="0" data-duration="6" data-track-index="0"><div class="title" data-sketch-layer="title">Spend</div></div>
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
    // Refused once played (R3): well formed, but the title never shows.
    const unseen = await service.submitSketch(queued.record.id, { 'index.html': html.replace('</style>', '.title{display:none}</style>'), 'manifest.json': JSON.stringify(manifest) }, 'run-preview-sketch')
    expect(unseen).toMatchObject({ accepted: false, problems: expect.arrayContaining([expect.stringMatching(/^Layer "title" takes part in m1 \(0s–6s\), but nothing marked data-sketch-layer="title" shows then/), expect.stringMatching(/^m1 "Spend": the plan changes objects here \("A token leaves the bucket"\), but the frame stays the same/)]) })
    // Back to the run, to fix and submit again.
    expect((await persistence.loadPlanningRecord(queued.record.id))!.status).toBe('running')
    const landed = await service.submitSketch(queued.record.id, { 'index.html': html, 'manifest.json': JSON.stringify(manifest) }, 'run-preview-sketch')
    expect(landed).toMatchObject({ accepted: true, status: 'ready' })
    // Ready only once played; the proof names the bundle it played.
    const proof = landed.accepted ? landed.record.report?.verification : undefined
    expect(proof).toMatchObject({ bundle: expect.stringMatching(/^[0-9a-f]{64}$/), runtime: '0.7.106', duration: 6, layers: [{ id: 'title', moments: ['m1'] }], changes: [{ moment: 'm1', within: 'frame' }] })
    expect(proof!.reseeks.every(item => item.same)).toBe(true)
    // Served as accepted, for the player.
    const index = await service.loadPreviewFile(queued.record.id, 'index.html')
    expect(index.contentType).toMatch(/text\/html/)
    expect(index.body.toString('utf8')).toContain(`data-composition-id="${compositionId}"`)
    await expect(service.loadPreviewFile(queued.record.id, '../secret')).rejects.toThrow(/No such file/)
    let overview = await service.planningOverview(id)
    expect(overview.scenes[0].preview?.ready).toMatchObject({ current: true, of: { record: plan.id }, url: expect.stringMatching(/^\/api\/planning\/previews\/.+\/index\.html$/), summary: { duration: 6, moments: [{ id: 'm1', start: 0, end: 6 }] }, checked: { bundle: proof!.bundle, runtime: '0.7.106', layers: 1, changes: 1 } })
    // A sketch made for another pinned runtime is history, and says why (R2).
    const accepted = (await persistence.loadPlanningRecord(queued.record.id))!
    const manifestOf = accepted.content as SketchManifest
    await persistence.updatePlanningRecord(queued.record.id, { content: { ...manifestOf, runtime: { hyperframes: '0.7.105' } } })
    expect((await service.planningOverview(id)).scenes[0].preview?.ready).toMatchObject({ current: false, staleBecause: 'the pinned Hyperframes runtime changed (0.7.105 → 0.7.106)' })
    await persistence.updatePlanningRecord(queued.record.id, { content: manifestOf })
    expect((await service.planningOverview(id)).scenes[0].preview?.ready).toMatchObject({ current: true })
    // The same plan is shown again, not sketched again — unless asked.
    expect(await service.queuePreview(id, scenes[0])).toMatchObject({ reused: true, record: { id: queued.record.id } })
    const again = await service.queuePreview(id, scenes[0], { again: true })
    expect(again.reused).toBe(false)
    // The app closes while a sketch is being played to check it: on
    // restart it reads interrupted, with a retry, and the checked one stays.
    await service.attachRun(again.record.id, { runId: 'run-preview-again' })
    await persistence.updatePlanningRecord(again.record.id, { status: 'verifying' }, ['running'])
    expect(await service.queuePreview(id, scenes[0], { again: true })).toMatchObject({ reused: true, record: { id: again.record.id, status: 'verifying' } })
    const interrupted = await service.runFinished('run-preview-again', { status: 'interrupted', exitCode: null })
    expect(interrupted).toMatchObject([{ id: again.record.id, status: 'failed', error: { message: expect.stringMatching(/^Interrupted/), recovery: ['Retry'] } }])
    expect((await service.planningOverview(id)).scenes[0].preview?.ready).toMatchObject({ id: queued.record.id, current: true })
    // A new candidate: the preview is of the old plan, and says so.
    await service.saveDirection(id, { subject: scenes[0], direction: 'Slower' })
    const { record: next } = await service.queueTreatment(id, scenes[0])
    await service.attachRun(next.id, { runId: 'run-preview-plan-2' })
    await service.submitTreatment(next.id, treatmentFor(scenes[0], 'b1'), 'run-preview-plan-2')
    overview = await service.planningOverview(id)
    expect(overview.scenes[0].preview?.ready).toMatchObject({ current: false, of: { record: plan.id } })
  }, 60_000)

  // P4: a scene produced from its approved plan on its real clock — checked
  // against the plan and the clock, played in the pinned engine, served to
  // the stage, and accepted into the render the notebook plays and exports.
  it('produces an approved plan on its clock: checked, served, accepted into one render', async () => {
    // A scene whose delivery is undecided has no clock to produce on; its
    // plan is made for its delivery, so it is chosen first.
    const undecided = await makeVideo('production-undecided')
    await readyBrief(undecided.videoId, 'run-undecided-brief')
    const { record: open } = await service.queueTreatment(undecided.videoId, undecided.videoScenes[0])
    await service.attachRun(open.id, { runId: 'run-undecided-plan' })
    await service.submitTreatment(open.id, treatmentFor(undecided.videoScenes[0], 'b1'), 'run-undecided-plan')
    await service.reviewTreatment(open.id)
    await expect(service.queueProduction(undecided.videoId, undecided.videoScenes[0])).rejects.toThrow(/Choose how this scene is delivered .* plan and approve the scene again/)

    const { videoId: id, videoScenes: scenes } = await makeVideo('production')
    await service.saveDirection(id, { subject: scenes[0], delivery: 'silent' })
    await readyBrief(id, 'run-production-brief')
    const { record: plan } = await service.queueTreatment(id, scenes[0])
    await service.attachRun(plan.id, { runId: 'run-production-plan' })
    expect(await service.submitTreatment(plan.id, { ...treatmentFor(scenes[0], 'b1'), delivery: { voice: 'silent', note: '' } }, 'run-production-plan')).toMatchObject({ accepted: true })
    // Nothing is produced before the plan is approved.
    await expect(service.queueProduction(id, scenes[0])).rejects.toThrow(/Approve this scene's plan/)
    await service.reviewTreatment(plan.id)
    const queued = await service.queueProduction(id, scenes[0])
    expect(queued).toMatchObject({ reused: false, record: { kind: 'production', status: 'queued', subject: scenes[0], skillBundle: { name: 'scene-producer' } } })
    const packet = await service.loadPacket(queued.record.id)
    expect(packet.route).toBe('Produce Scene')
    const context = JSON.parse(text(packet.files['packet/CONTEXT.json']))
    expect(context).toMatchObject({ route: 'Produce Scene', plan: { record: plan.id, revision: plan.revision }, clock: { kind: 'silent', duration: 6 }, composition: { width: 1920, height: 1080, fps: 30, duration: 6 }, runtime: { hyperframes: '0.7.106' } })
    expect(JSON.parse(text(packet.files['packet/CLOCK.json']))).toMatchObject({ kind: 'silent', audio: null, duration: 6, moments: [{ id: 'm1', start: 0, end: 6 }] })
    expect(JSON.parse(text(packet.files['packet/PLAN.json']))).toMatchObject({ record: plan.id, approvedAt: expect.any(String) })
    expect(text(packet.files['packet/PRODUCTION.md'])).toMatch(/silent by the creator's choice/)
    await service.attachRun(queued.record.id, { runId: 'run-production' })
    const compositionId = context.composition.id
    expect(compositionId).toMatch(/^production-/)
    const html = productionHtml(compositionId, 6, null)
    const manifest = { version: 1, kind: 'production', scene: scenes[0], plan: context.plan, composition: { id: compositionId, width: 1920, height: 1080, fps: 30, duration: 6 }, runtime: { hyperframes: '0.7.106' }, clock: { kind: 'silent', audio: null }, moments: [{ id: 'm1', title: 'Spend', start: 0, end: 6 }], layers: [{ id: 'bucket', kind: 'object', label: 'Token bucket', moments: ['m1'] }], unmet: [] }
    // Refused: off the clock, and a stand-in where the scene needs the thing.
    const off = await service.submitProduction(queued.record.id, { 'index.html': html, 'manifest.json': JSON.stringify({ ...manifest, moments: [{ id: 'm1', title: 'Spend', start: 0, end: 4 }], layers: [{ ...manifest.layers[0], placeholder: 'A box for now' }] }) }, 'run-production')
    expect(off).toMatchObject({ accepted: false, problems: expect.arrayContaining([expect.stringMatching(/^moment m1 must keep the clock: 0–6s/), expect.stringMatching(/^layer bucket is a placeholder/)]) })
    // Refused: a presenter with no take to show.
    const presenter = await service.submitProduction(queued.record.id, { 'index.html': html, 'manifest.json': JSON.stringify({ ...manifest, layers: [...manifest.layers, { id: 'presenter', kind: 'presenter', label: 'Presenter', moments: ['m1'] }] }) }, 'run-production')
    expect(presenter).toMatchObject({ accepted: false, problems: expect.arrayContaining([expect.stringMatching(/no take to show/)]) })
    const landed = await service.submitProduction(queued.record.id, { 'index.html': html, 'manifest.json': JSON.stringify(manifest) }, 'run-production')
    expect(landed).toMatchObject({ accepted: true, status: 'ready' })
    const proof = landed.accepted ? landed.record.report?.verification : undefined
    expect(proof).toMatchObject({ bundle: expect.stringMatching(/^[0-9a-f]{64}$/), runtime: '0.7.106', duration: 6, layers: [{ id: 'bucket', moments: ['m1'] }] })
    // Served as accepted, for the stage.
    const index = await service.loadProductionFile(queued.record.id, 'index.html')
    expect(index.body.toString('utf8')).toContain(`data-composition-id="${compositionId}"`)
    let overview = await service.planningOverview(id)
    expect(overview.scenes[0].production).toMatchObject({ ready: { current: true, of: { record: plan.id }, url: expect.stringMatching(/^\/api\/planning\/productions\/.+\/index\.html$/), summary: { duration: 6, clock: 'silent', unmet: [] } }, accepted: null })
    // Accepted: rendered once, by the pinned producer, into the scene's output.
    const accepted = await service.acceptProduction(queued.record.id)
    expect(accepted).toMatchObject({ status: 'reviewed', approval: { render: { durationMs: 6000, bundle: proof!.bundle, objectKey: expect.stringMatching(/\.mp4$/) } } })
    const render = await new Promise<Buffer>(async (resolve, reject) => {
      const chunks: Buffer[] = []
      const { stream } = await persistence.getObject(accepted.approval!.render!.objectKey)
      stream.on('data', chunk => chunks.push(chunk as Buffer)).on('end', () => resolve(Buffer.concat(chunks))).on('error', reject)
    })
    expect(render.subarray(4, 8).toString('latin1')).toBe('ftyp')
    overview = await service.planningOverview(id)
    expect(overview.scenes[0].production?.accepted).toMatchObject({ id: queued.record.id, accepted: { url: expect.stringMatching(/^\/objects\//), durationMs: 6000 } })
    await expect(service.acceptProduction(queued.record.id)).rejects.toThrow(/already accepted, with these edits/)
    // The same approved plan on the same clock is not produced again, unless asked.
    expect(await service.queueProduction(id, scenes[0])).toMatchObject({ reused: true, record: { id: queued.record.id } })
    // A newly approved plan leaves the production, and its acceptance, as history.
    await service.saveDirection(id, { subject: scenes[0], direction: 'Slower' })
    const { record: next } = await service.queueTreatment(id, scenes[0])
    await service.attachRun(next.id, { runId: 'run-production-plan-2' })
    await service.submitTreatment(next.id, { ...treatmentFor(scenes[0], 'b1'), delivery: { voice: 'silent', note: '' } }, 'run-production-plan-2')
    await service.reviewTreatment(next.id)
    overview = await service.planningOverview(id)
    expect(overview.scenes[0].production?.accepted).toMatchObject({ current: false, staleBecause: expect.stringMatching(/^it produces r1; the scene's approved plan is r2/) })
  }, 240_000)

  // P6: the creator nudges a production through the controls its code
  // reads. Edits are saved against a revision, stay inside their ranges,
  // play on the stage and render into the output — and a new production of
  // the scene takes them where they still fit.
  it('edits a produced scene through its controls, renders the edits and carries them on', async () => {
    const { videoId: id, videoScenes: scenes } = await makeVideo('production-edits')
    await service.saveDirection(id, { subject: scenes[0], delivery: 'silent' })
    await readyBrief(id, 'run-edits-brief')
    const { record: plan } = await service.queueTreatment(id, scenes[0])
    await service.attachRun(plan.id, { runId: 'run-edits-plan' })
    await service.submitTreatment(plan.id, { ...treatmentFor(scenes[0], 'b1'), delivery: { voice: 'silent', note: '' } }, 'run-edits-plan')
    await service.reviewTreatment(plan.id)
    const produce = async (runId: string, controls: unknown[], again = false) => {
      const queued = await service.queueProduction(id, scenes[0], { again })
      const context = JSON.parse(text((await service.loadPacket(queued.record.id)).files['packet/CONTEXT.json']))
      await service.attachRun(queued.record.id, { runId })
      const compositionId = context.composition.id
      const reads = controls.length ? '(window.__controls?.["m1-reveal"] ?? 0)' : '0'
      const manifest = { version: 1, kind: 'production', scene: scenes[0], plan: context.plan, composition: { id: compositionId, width: 1920, height: 1080, fps: 30, duration: 6 }, runtime: { hyperframes: '0.7.106' }, clock: { kind: 'silent', audio: null }, moments: [{ id: 'm1', title: 'Spend', start: 0, end: 6 }], layers: [{ id: 'bucket', kind: 'object', label: 'Token bucket', moments: ['m1'] }], unmet: [], controls }
      expect(await service.submitProduction(queued.record.id, { 'index.html': productionHtml(compositionId, 6, null, reads), 'manifest.json': JSON.stringify(manifest) }, runId)).toMatchObject({ accepted: true })
      return queued.record.id
    }
    const reveal = { id: 'm1-reveal', label: 'When the bucket appears', kind: 'offset', moment: 'm1', default: 0, min: 0, max: 5 }
    const first = await produce('run-edits-1', [reveal])
    expect(await service.productionEdits(first)).toMatchObject({ revision: 0, values: {} })
    // Saved against the revision it was made on, inside its range.
    expect(await service.saveProductionEdits(first, { revision: 0, values: { 'm1-reveal': 2 } })).toMatchObject({ revision: 1, values: { 'm1-reveal': 2 } })
    await expect(service.saveProductionEdits(first, { revision: 0, values: { 'm1-reveal': 3 } })).rejects.toThrow(/made on edit 0; the scene is at edit 1 now/)
    await expect(service.saveProductionEdits(first, { revision: 1, values: { 'm1-reveal': 9 } })).rejects.toThrow(/between 0s and 5s — 9s would move it out of its moment/)
    await expect(service.saveProductionEdits(first, { revision: 1, values: { other: 1 } })).rejects.toThrow(/"other" is not a control/)
    // The stage plays it with the edit.
    const served = (await service.loadProductionFile(first, 'index.html')).body.toString('utf8')
    expect(served).toContain('window.__controls = {"m1-reveal":2}')
    let overview = await service.planningOverview(id)
    expect(overview.scenes[0].production?.ready).toMatchObject({ id: first, edits: { revision: 1, values: { 'm1-reveal': 2 } }, summary: { controls: [reveal] } })
    // Accepting renders the edit; the same edits are not rendered twice.
    const accepted = await service.acceptProduction(first)
    expect(accepted.approval?.render?.edits).toEqual({ revision: 1, values: { 'm1-reveal': 2 } })
    await expect(service.acceptProduction(first)).rejects.toThrow(/already accepted, with these edits/)
    // A newer edit is accepted again: a new render, with it.
    await service.saveProductionEdits(first, { revision: 1, values: { 'm1-reveal': 2.5 } })
    const again = await service.acceptProduction(first)
    expect(again.approval?.render).toMatchObject({ edits: { revision: 2, values: { 'm1-reveal': 2.5 } } })
    expect(again.approval?.render?.objectKey).not.toBe(accepted.approval?.render?.objectKey)
    overview = await service.planningOverview(id)
    expect(overview.scenes[0].production?.accepted).toMatchObject({ id: first, accepted: { edits: 2 }, edits: { revision: 2 } })
    // Produced again: the edit is carried where it still fits.
    const second = await produce('run-edits-2', [reveal], true)
    expect(await service.productionEdits(second)).toMatchObject({ revision: 1, values: { 'm1-reveal': 2.5 }, carried: { from: first, applied: ['m1-reveal'], conflicts: [] } })
    // A production without that control keeps the edit as a conflict, applied nowhere.
    const third = await produce('run-edits-3', [], true)
    expect(await service.productionEdits(third)).toMatchObject({ values: {}, carried: { from: second, applied: [], conflicts: [{ id: 'm1-reveal', value: 2.5, reason: 'the new production has no control “When the bucket appears”' }] } })
    await expect(service.saveProductionEdits(third, { revision: 1, values: {} })).rejects.toThrow(/exposes no controls/)
  }, 240_000)

  // P5: a scene the creator presents is produced on their take. The take is
  // aligned to the approved plan's lines by the pinned aligner and sets the
  // clock; the production plays its voice whole and its picture muted and in
  // step, and a new take makes the production out of date.
  it.runIf(aligner)('produces a scene you present on your take\'s clock, with your voice and picture', async () => {
    const { videoId: id, videoScenes: scenes } = await makeVideo('production-take')
    await service.saveDirection(id, { subject: scenes[0], delivery: 'human' })
    await readyBrief(id, 'run-take-brief')
    const { record: plan } = await service.queueTreatment(id, scenes[0])
    await service.attachRun(plan.id, { runId: 'run-take-plan' })
    const base = treatmentFor(scenes[0], 'b1')
    const presented = {
      ...base,
      moments: [
        { ...base.moments[0], objects: null, recipes: [], presenter: { visibility: 'full', reason: 'Introduce the cost on camera' } },
        { ...base.moments[0], id: 'm2', title: 'Refill', observation: 'Tokens come back', narration: { job: 'Explain', guide: 'Tokens are added back at a steady refill rate.' }, presenter: { visibility: 'hidden', reason: 'The bucket carries it' } },
      ],
      delivery: { voice: 'human', note: '' },
    }
    expect(await service.submitTreatment(plan.id, presented, 'run-take-plan')).toMatchObject({ accepted: true })
    await service.reviewTreatment(plan.id)
    const waits = async () => (await service.planningOverview(id)).scenes[0].productionWaits
    expect(await waits()).toMatch(/^Record and select a take of this scene first/)
    await expect(service.queueProduction(id, scenes[0])).rejects.toThrow(/Record and select a take/)
    // A spoken take of the plan's lines: the camera's picture and voice.
    const dir = mkdtempSync(join(tmpdir(), 'take-production-'))
    await runCommand('/usr/bin/say', ['-o', join(dir, 'voice.aiff'), 'Each request consumes one token. [[slnc 900]] Tokens are added back at a steady refill rate.'])
    await runCommand('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=24', '-i', join(dir, 'voice.aiff'), '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', join(dir, 'take.mp4')])
    const seconds = await probeSeconds(join(dir, 'take.mp4'))
    const stored = await persistence.storeAsset({ body: readFileSync(join(dir, 'take.mp4')), contentType: 'video/mp4', projectId: id, blockId: scenes[0], kind: 'camera-take', extension: '.mp4' })
    const selectTake = async (recordingId: string, script: string) => {
      const project = (await persistence.loadProjectArtifact(id))!
      project.recordedBlocks = { [scenes[0]]: { blockId: scenes[0], recordingId, videoUrl: `http://127.0.0.1:1/objects/${stored.objectKey}`, durationMs: Math.round(seconds * 1000), recordedAt: new Date().toISOString(), storage: 'local', role: 'presenter', script: { hash: scriptFingerprint(script), lines: lineFingerprints(script) } } }
      await persistence.saveProjectArtifact(project)
    }
    const lines = 'Each request consumes one token.\n\nTokens are added back at a steady refill rate.'
    await selectTake('take-other', 'Something else entirely.')
    expect(await waits()).toMatch(/^Your take was not recorded against the approved plan's lines/)
    await selectTake('take-1', lines)
    expect(await waits()).toBeNull()
    const queued = await service.queueProduction(id, scenes[0])
    const packet = await service.loadPacket(queued.record.id)
    const clock = JSON.parse(text(packet.files['packet/CLOCK.json']))
    // The take set the clock: m1 from the start, m2 where its words are heard.
    expect(clock).toMatchObject({ kind: 'take', audio: 'media/take.webm', video: 'media/take.webm', provider: 'Your take', media: ['media/take.webm'], presenter: [{ id: 'm1', visibility: 'full' }, { id: 'm2', visibility: 'hidden' }] })
    expect(clock.moments[0].start).toBe(0)
    expect(clock.moments[1].start).toBeGreaterThan(clock.spoken[0].spokenEnd + 0.5)
    expect(clock.moments[1].end).toBe(clock.duration)
    expect(Math.abs(clock.duration - seconds)).toBeLessThan(0.15)
    expect(packet.files['packet/references/take-frame.jpg']).toMatchObject({ contentType: 'image/jpeg' })
    expect(packet.files['packet/audio/narration.mp3']).toBeUndefined()
    expect(text(packet.files['packet/PRODUCTION.md'])).toMatch(/the creator's own take, at `media\/take.webm`/)
    const context = JSON.parse(text(packet.files['packet/CONTEXT.json']))
    await service.attachRun(queued.record.id, { runId: 'run-take' })
    const compositionId = context.composition.id
    const duration = clock.duration
    const page = (picture: string) => `<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>#root{position:relative;width:100%;height:100%;overflow:hidden;background:#101018}.clip{position:absolute;inset:0}#frame{position:absolute;inset:0}#frame video{width:100%;height:100%;object-fit:cover}.bucket{position:absolute;left:760px;top:340px;width:400px;height:400px;border-radius:40px;background:#635bff}</style></head><body>
<div id="root" data-composition-id="${compositionId}" data-start="0" data-width="1920" data-height="1080" data-duration="${duration}">
<div id="m2" class="clip" data-start="${clock.moments[1].start}" data-duration="${Number((clock.moments[1].end - clock.moments[1].start).toFixed(3))}" data-track-index="0"><div class="bucket" data-sketch-layer="bucket"></div></div>
<div id="frame" data-sketch-layer="presenter">${picture}</div>
<audio id="voice" src="media/take.webm" data-start="0" data-duration="${duration}" data-track-index="20"></audio>
</div><script>window.__timelines = window.__timelines || {}
const tl = gsap.timeline({ paused: true })
tl.fromTo('#frame', { opacity: 1 }, { opacity: 0, duration: 0.4 }, ${clock.moments[1].start})
tl.fromTo('#m2 .bucket', { scale: 0.8 }, { scale: 1, duration: 1 }, ${clock.moments[1].start})
window.__timelines["${compositionId}"] = tl</script></body></html>`
    const picture = `<video id="take" src="media/take.webm" muted playsinline data-start="0" data-duration="${duration}" data-track-index="10"></video>`
    const manifest = { version: 1, kind: 'production', scene: scenes[0], plan: context.plan, composition: { id: compositionId, width: 1920, height: 1080, fps: 30, duration }, runtime: { hyperframes: '0.7.106' }, clock: { kind: 'take', audio: 'media/take.webm' }, moments: [{ id: 'm1', title: 'Spend', start: clock.moments[0].start, end: clock.moments[0].end }, { id: 'm2', title: 'Refill', start: clock.moments[1].start, end: clock.moments[1].end }], layers: [{ id: 'presenter', kind: 'presenter', label: 'You', moments: ['m1'] }, { id: 'bucket', kind: 'object', label: 'Token bucket', moments: ['m2'] }], unmet: [] }
    // Refused: the picture carries its own sound — the voice would play twice.
    const loud = await service.submitProduction(queued.record.id, { 'index.html': page(picture.replace(' muted', '')), 'manifest.json': JSON.stringify(manifest) }, 'run-take')
    expect(loud).toMatchObject({ accepted: false, problems: expect.arrayContaining([expect.stringMatching(/must be muted/)]) })
    // A submission's own media/ is never taken: the product supplies the take.
    const landed = await service.submitProduction(queued.record.id, { 'index.html': page(picture), 'manifest.json': JSON.stringify(manifest), 'media/take.webm': { base64: 'bm90IGEgdGFrZQ==', contentType: 'video/webm' } }, 'run-take')
    if (!landed.accepted) console.log('TAKE PRODUCTION REFUSED', JSON.stringify(landed, null, 1))
    expect(landed).toMatchObject({ accepted: true, status: 'ready' })
    const proof = landed.accepted ? landed.record.report?.verification : undefined
    expect(proof?.loaded).toEqual(expect.arrayContaining(['media/take.webm']))
    const served = await service.loadProductionFile(queued.record.id, 'media/take.webm')
    expect(served.contentType).toBe('video/webm')
    expect(served.body.subarray(0, 4).toString('hex')).toBe('1a45dfa3')
    // Accepted: rendered with the take's voice and picture.
    const accepted = await service.acceptProduction(queued.record.id)
    const render = join(dir, 'render.mp4')
    const { stream } = await persistence.getObject(accepted.approval!.render!.objectKey)
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    await (await import('node:fs/promises')).writeFile(render, Buffer.concat(chunks))
    const streams = await runCommand('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', render])
    expect(streams).toMatch(/video/)
    expect(streams).toMatch(/audio/)
    expect(Math.abs((await probeSeconds(render)) - duration)).toBeLessThan(0.3)
    // A new take makes the production out of date.
    await selectTake('take-2', lines)
    const overview = await service.planningOverview(id)
    expect(overview.scenes[0].production?.accepted).toMatchObject({ current: false, staleBecause: 'the scene\'s take changed' })
  }, 300_000)

  // Only the changed lines are recorded again: a pickup of the line a newer
  // plan changed fills in for the take, which stays; the scene's clock is
  // the take's runs and the pickup's, joined in the pauses between lines.
  it.runIf(aligner)('produces a scene from your take and a pickup of the one line the plan changed', async () => {
    const { videoId: id, videoScenes: scenes } = await makeVideo('production-pickup')
    await service.saveDirection(id, { subject: scenes[0], delivery: 'human' })
    await readyBrief(id, 'run-pickup-brief')
    const base = treatmentFor(scenes[0], 'b1')
    const planWith = (second: string) => ({
      ...base,
      moments: [
        { ...base.moments[0], objects: null, recipes: [], presenter: { visibility: 'full', reason: 'On camera' } },
        { ...base.moments[0], id: 'm2', title: 'Refill', observation: 'Tokens come back', objects: null, recipes: [], narration: { job: 'Explain', guide: second }, presenter: { visibility: 'full', reason: 'On camera' } },
      ],
      delivery: { voice: 'human', note: '' },
    })
    const approve = async (runId: string, second: string) => {
      const { record } = await service.queueTreatment(id, scenes[0])
      await service.attachRun(record.id, { runId })
      expect(await service.submitTreatment(record.id, planWith(second), runId)).toMatchObject({ accepted: true })
      await service.reviewTreatment(record.id)
      return record
    }
    await approve('run-pickup-plan-1', 'Tokens are added back at a steady refill rate.')
    const dir = mkdtempSync(join(tmpdir(), 'pickup-production-'))
    const record = async (name: string, colour: string, words: string) => {
      await runCommand('/usr/bin/say', ['-o', join(dir, `${name}.aiff`), words])
      await runCommand('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=c=${colour}:size=640x360:rate=24`, '-i', join(dir, `${name}.aiff`), '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', join(dir, `${name}.mp4`)])
      const seconds = await probeSeconds(join(dir, `${name}.mp4`))
      const stored = await persistence.storeAsset({ body: readFileSync(join(dir, `${name}.mp4`)), contentType: 'video/mp4', projectId: id, blockId: scenes[0], kind: 'camera-take', extension: '.mp4' })
      return { seconds, url: `http://127.0.0.1:1/objects/${stored.objectKey}`, assetId: stored.assetId }
    }
    // The take, red, of the first plan's two lines.
    const take = await record('take', '0xe11d48', 'Each request consumes one token. [[slnc 700]] Tokens are added back at a steady refill rate.')
    const first = 'Each request consumes one token.\n\nTokens are added back at a steady refill rate.'
    const project = (await persistence.loadProjectArtifact(id))!
    project.recordedBlocks = { [scenes[0]]: { blockId: scenes[0], recordingId: 'take-1', videoUrl: take.url, durationMs: Math.round(take.seconds * 1000), recordedAt: new Date().toISOString(), storage: 'local', role: 'presenter', script: { hash: scriptFingerprint(first), lines: lineFingerprints(first) } } }
    await persistence.saveProjectArtifact(project)
    // A newer plan changes the second line: only it is asked for again.
    await service.saveDirection(id, { subject: scenes[0], direction: 'Say the refill plainly' })
    await approve('run-pickup-plan-2', 'Tokens return at a steady rate.')
    const waits = async () => (await service.planningOverview(id)).scenes[0].productionWaits
    expect(await waits()).toBe('Your take does not say the plan\'s line “Tokens return at a steady rate.”. Record only that line — a pickup — or the whole scene again.')
    // The pickup, blue, of that line alone — the take stays selected.
    const pickup = await record('pickup', '0x1d4ed8', 'Tokens return at a steady rate.')
    const recorded = await persistence.savePickupTake({ projectId: id, blockId: scenes[0], assetId: pickup.assetId, mediaUrl: pickup.url, durationMs: Math.round(pickup.seconds * 1000), script: { hash: scriptFingerprint('Tokens return at a steady rate.'), lines: lineFingerprints('Tokens return at a steady rate.') } })
    expect(recorded).toMatchObject({ pickup: true, role: 'presenter' })
    expect((await persistence.loadProjectArtifact(id))!.recordedBlocks![scenes[0]].recordingId).toBe('take-1')
    expect(await waits()).toBeNull()
    const queued = await service.queueProduction(id, scenes[0])
    const packet = await service.loadPacket(queued.record.id)
    const clock = JSON.parse(text(packet.files['packet/CLOCK.json']))
    expect(clock).toMatchObject({ kind: 'take', provider: 'Your take, with a pickup', spoken: [{ id: 'm1', words: 'Each request consumes one token.' }, { id: 'm2', words: 'Tokens return at a steady rate.' }] })
    // The joined take: the take's first line, then the pickup's line.
    const media = (await service.loadProductionFile(queued.record.id, 'media/take.webm').catch(() => null))
    expect(media).toBeNull()
    const composed = join(dir, 'composed.webm')
    const { stream } = await persistence.getObject((queued.record.inputs.media as Record<string, string>)['media/take.webm'])
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    await (await import('node:fs/promises')).writeFile(composed, Buffer.concat(chunks))
    expect(Math.abs((await probeSeconds(composed)) - clock.duration)).toBeLessThan(0.15)
    // Shorter than the take and the pickup together: only runs, cut in pauses.
    expect(clock.duration).toBeLessThan(take.seconds + pickup.seconds)
    const colourAt = async (seconds: number) => {
      const raw = await new Promise<Buffer>((resolve, reject) => {
        const chunks2: Buffer[] = []
        const child = spawn('ffmpeg', ['-v', 'error', '-ss', String(seconds), '-i', composed, '-frames:v', '1', '-vf', 'scale=1:1:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
        child.stdout.on('data', chunk => chunks2.push(chunk as Buffer))
        child.on('close', code => (code === 0 ? resolve(Buffer.concat(chunks2)) : reject(new Error(`ffmpeg ${code}`))))
      })
      return [...raw.subarray(0, 3)]
    }
    const inTake = await colourAt(clock.moments[0].start + 0.5)
    const inPickup = await colourAt(clock.moments[1].start + 0.6)
    expect(inTake[0]).toBeGreaterThan(150)
    expect(inPickup[2]).toBeGreaterThan(150)
    expect(inPickup[0]).toBeLessThan(90)
  }, 300_000)

  it.runIf(systemVoice)('produces a generated-voice scene on the voice\'s clock, playing its sound', async () => {
    const { videoId: id, videoScenes: scenes } = await makeVideo('production-voice')
    await service.saveDirection(id, { subject: scenes[0], delivery: 'generated' })
    await readyBrief(id, 'run-voice-brief')
    const { record: plan } = await service.queueTreatment(id, scenes[0])
    await service.attachRun(plan.id, { runId: 'run-voice-plan' })
    await service.submitTreatment(plan.id, { ...treatmentFor(scenes[0], 'b1'), delivery: { voice: 'generated', note: '' } }, 'run-voice-plan')
    await service.reviewTreatment(plan.id)
    const queued = await service.queueProduction(id, scenes[0])
    const packet = await service.loadPacket(queued.record.id)
    const clock = JSON.parse(text(packet.files['packet/CLOCK.json']))
    // The approved words were spoken and measured before the run.
    expect(clock).toMatchObject({ kind: 'generated-voice', audio: 'audio/narration.mp3', provider: 'Local system voice', spoken: [{ id: 'm1', words: 'Each request consumes one token.' }] })
    expect(clock.moments[0].end).toBeGreaterThan(1)
    // A token leaving the bucket needs three quarters of the moment's 6s
    // estimate to be seen (Q02 of the BoltDB review): the voice pauses after
    // its words to give it that, and the output says so.
    expect(clock.moments[0].end - clock.moments[0].start).toBeCloseTo(4.5, 1)
    expect(clock.spoken[0].spokenEnd).toBeLessThan(clock.moments[0].end - 0.5)
    expect((await service.planningOverview(id)).records.find(record => record.id === queued.record.id)?.inputs.clockReview).toEqual([expect.stringMatching(/^moment m1 is held [\d.]+s after its words, so what changes in it can be seen — 4\.5s in all$/)])
    const sound = packet.files['packet/audio/narration.mp3'] as { base64: string; contentType: string }
    expect(sound).toMatchObject({ contentType: 'audio/mpeg', base64: expect.any(String) })
    await service.attachRun(queued.record.id, { runId: 'run-voice' })
    const context = JSON.parse(text(packet.files['packet/CONTEXT.json']))
    const duration = clock.duration
    const manifest = { version: 1, kind: 'production', scene: scenes[0], plan: context.plan, composition: { id: context.composition.id, width: 1920, height: 1080, fps: 30, duration }, runtime: { hyperframes: '0.7.106' }, clock: { kind: 'generated-voice', audio: 'audio/narration.mp3' }, moments: [{ id: 'm1', title: 'Spend', start: clock.moments[0].start, end: clock.moments[0].end }], layers: [{ id: 'bucket', kind: 'object', label: 'Token bucket', moments: ['m1'] }], unmet: [] }
    // Refused: the voice is not played.
    const unvoiced = await service.submitProduction(queued.record.id, { 'index.html': productionHtml(context.composition.id, duration, null), 'manifest.json': JSON.stringify(manifest), 'audio/narration.mp3': sound }, 'run-voice')
    expect(unvoiced).toMatchObject({ accepted: false, problems: expect.arrayContaining([expect.stringMatching(/must play the clock's sound/)]) })
    const landed = await service.submitProduction(queued.record.id, { 'index.html': productionHtml(context.composition.id, duration, 'audio/narration.mp3'), 'manifest.json': JSON.stringify(manifest), 'audio/narration.mp3': sound }, 'run-voice')
    expect(landed).toMatchObject({ accepted: true, status: 'ready' })
    const proof = landed.accepted ? landed.record.report?.verification : undefined
    expect(proof?.loaded.some(path => path.endsWith('audio/narration.mp3'))).toBe(true)
  }, 240_000)

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
      const html = `<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>#root{position:relative;width:100%;height:100%;overflow:hidden;background:#101018}.clip{position:absolute;inset:0}.title{position:absolute;left:120px;top:90px;color:#fff;font:600 64px system-ui}</style></head><body>
<div id="root" data-composition-id="${compositionId}" data-start="0" data-width="1920" data-height="1080" data-duration="6">
<div id="m1" class="clip" data-start="0" data-duration="6" data-track-index="0"><div class="title" data-sketch-layer="title">Spend</div></div>
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
