import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { forkNotebook, type ProjectDocumentV1 } from 'markdown-composition'

// The file backend in a scratch directory, and the real vendored skills.
process.env.STUDIO_PERSISTENCE = 'postgres'
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


describe('independent review reproductions', () => {
  it('establishes a valid brief using the existing service fixture', async () => {
    const {record} = await service.queueBrief(videoId)
    const c = JSON.parse((await service.loadPacket(record.id)).files['packet/CONTEXT.json'])
    const result = await service.submitBrief(record.id, goodBrief({sourceRevision:c.sourceRevision, baseNotebook:c.baseNotebook, baseRevision:c.baseRevision, themeRef:c.themeRef, requestedSeconds:c.requestedSeconds}))
    expect(result.accepted).toBe(true)
  })
  it('reproduces duplicate active records for concurrent identical requests', async () => {
    const rows = await Promise.all(Array.from({length:4}, () => service.queueTreatment(videoId, videoScenes[0])))
    const distinct = new Set(rows.map(x => x.record.id))
    console.log('REVIEW concurrent queue:', JSON.stringify({requests:4, distinct:distinct.size, revisions:rows.map(x=>x.record.revision)}))
    expect(distinct.size).toBeGreaterThan(1)
    for(const id of distinct) await service.failRecord(id,{message:'Review fixture cleanup'})
  })
  it('reproduces an active record being claimed by a second run', async () => {
    const {record} = await service.queueTreatment(videoId, videoScenes[0])
    await service.attachRun(record.id,{runId:'review-owner-a',adapter:'claude-code'})
    const second = await service.attachRun(record.id,{runId:'review-owner-b',adapter:'claude-code'})
    console.log('REVIEW run ownership:', JSON.stringify({first:'review-owner-a',stored:second.runId}))
    expect(second.runId).toBe('review-owner-b')
    await service.failRecord(record.id,{message:'Review fixture cleanup'})
  })
  it('reproduces a current and reviewable plan after its source changes', async () => {
    const {record} = await service.queueTreatment(videoId, videoScenes[0])
    const result = await service.submitTreatment(record.id,treatmentFor(videoScenes[0],baseScenes[0]))
    expect(result.accepted).toBe(true)
    const project = (await persistence.loadProjectArtifact(videoId))!
    const changed = await persistence.saveSourceRevision({kind:'url',url:'https://example.com/bucket-v2', title:'Changed source',site:'example.com',content:{text:ARTICLE+'\n\nThis is a revised article.'}})
    project.source!.snapshotId = changed.id
    await persistence.saveProjectArtifact(project)
    const overview = await service.planningOverview(videoId)
    const reviewed = await service.reviewTreatment(record.id)
    console.log('REVIEW stale ancestry:', JSON.stringify({briefStale:overview.brief.stale,sceneState:overview.scenes[0].view.state,reviewStatus:reviewed.status}))
    expect(overview.brief.stale).toBe(true)
    expect(overview.scenes[0].view.state).toBe('candidate')
    expect(reviewed.status).toBe('reviewed')
  })
  it('reproduces the fragment-only source path rejecting retained page evidence', async () => {
    const project = (await persistence.loadProjectArtifact(videoId))!
    project.source!.snapshotId = undefined
    await persistence.saveProjectArtifact(project)
    const {record} = await service.queueBrief(videoId)
    const packet = await service.loadPacket(record.id)
    const c = JSON.parse(packet.files['packet/CONTEXT.json'])
    const raw = goodBrief({sourceRevision:c.sourceRevision,baseNotebook:c.baseNotebook,baseRevision:c.baseRevision,themeRef:c.themeRef,requestedSeconds:c.requestedSeconds})
    raw.source.coverage = 'fragments'
    raw.source.limitations = ['Only the retained page passages are available.']
    const result = await service.submitBrief(record.id,raw)
    console.log('REVIEW retained fragments:',JSON.stringify({passageInPacket:packet.files['packet/PRESENTATION.md'].includes(raw.evidence[0].text),accepted:result.accepted,problems:'problems' in result?result.problems:[]}))
    expect(packet.files['packet/PRESENTATION.md']).toContain(raw.evidence[0].text)
    expect(result.accepted).toBe(false)
  })

})
