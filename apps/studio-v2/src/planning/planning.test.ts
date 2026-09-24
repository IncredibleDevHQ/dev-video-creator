import { describe, expect, it } from 'vitest'
import { quotedIn, fingerprintOf } from './fingerprint'
import { buildCapabilityCatalog, parseBlueprintsIndex, parseRulesIndex, parseTechniques } from './capability-catalog'
import { validateBrief, type BriefContext, type ExplanationBriefV1 } from './explanation-brief'
import { validateTreatment, type SceneTreatmentV1, type TreatmentContext } from './scene-treatment'
import { renderExplanation, renderNativeBrief, renderScenePacket } from './brief-adapter'
import { landingFor, scenePlanningView, type PlanningRecord } from './planning-records'

// A retained article, short enough to read in a test.
const SOURCE = `Rate limiting with a token bucket

A token bucket holds a fixed number of tokens. Each request that is admitted consumes one token.
When a burst arrives, the requests are admitted until the bucket is empty; the next request is rejected.
Tokens are added back at a steady refill rate, so a later request can pass again.`

const context = (overrides: Partial<BriefContext> = {}): BriefContext => ({
  baseSceneIds: ['base-1', 'base-2'],
  sourceRevision: 'src-7',
  sourceText: SOURCE,
  creatorText: 'Keep it calm and concrete. A bucket holds three tokens, and the calls that arrive spend them.',
  wordingPolicy: 'draft',
  scripts: [],
  baseNotebookRef: 'nb-base',
  baseRevision: 'rev-1',
  themeRef: 'theme-a:0011',
  sceneDecisions: [],
  ...overrides,
})

const goodBrief = (): ExplanationBriefV1 => ({
  schemaVersion: 1,
  purpose: { deliverable: 'Narrated technical explainer', audience: 'Developers learning request admission', message: 'Available tokens decide whether a request passes; exhaustion causes rejection until refill.', language: 'en', requestedSeconds: 60, styleConstraints: [] },
  source: { revisionRef: 'src-7', narrativeRef: null, wordingPolicy: 'draft', coverage: 'full', limitations: [] },
  evidence: [
    { id: 'ev-consume', kind: 'source', text: 'Each request that is admitted consumes one token.' },
    { id: 'ev-burst', kind: 'source', text: 'When a burst arrives, the requests are admitted until the bucket is empty; the next request is rejected.' },
    { id: 'ev-refill', kind: 'source', text: 'Tokens are added back at a steady refill rate…a later request can pass again' },
  ],
  entities: [
    { id: 'request', name: 'Request', role: 'One call that asks to be admitted', interactions: ['consumes a token from the bucket'], evidenceRefs: ['ev-consume'], legacyObjectIds: [] },
    { id: 'bucket', name: 'Token bucket', role: 'Stores admission capacity and refills it over time', interactions: ['admits a request while it holds a token'], evidenceRefs: ['ev-consume', 'ev-refill'], legacyObjectIds: ['obj-token-bucket-1'] },
  ],
  units: [
    {
      id: 'admission', question: 'Why does a request pass?', explain: 'An admitted request consumes one token of stored capacity.', evidenceRefs: ['ev-consume'], entities: ['request', 'bucket'],
      conditions: [{ text: 'An accepted request consumes exactly one token.', basis: 'source' }, { text: 'The bucket starts with three tokens.', basis: 'illustrative' }],
      demonstration: null, observations: [], communicationNeeds: [{ need: 'Make the link between a token and admission perceptible', why: 'The mechanism is the point', basis: 'suggestion' }], preserve: ['Mark invented counts as illustrative'], originScenes: ['base-1'], dependsOn: [],
    },
    {
      id: 'exhaustion', question: 'Why is the next request rejected?', explain: 'A burst empties the bucket; with no token left, the next request is rejected until refill.', evidenceRefs: ['ev-burst', 'ev-refill'], entities: ['request', 'bucket'],
      conditions: [{ text: 'Rejection does not consume a token.', basis: 'suggestion' }], demonstration: null, observations: [],
      communicationNeeds: [{ need: 'Connect the empty bucket to the rejection', why: 'The consequence must follow its cause', basis: 'suggestion' }], preserve: ['Explain rejection only after the bucket is empty'], originScenes: ['base-2'], dependsOn: ['admission'],
    },
  ],
  progression: [
    { unit: 'admission', note: 'The normal case first', ordering: 'causal' },
    { unit: 'exhaustion', note: 'Then what a burst does', ordering: 'causal' },
  ],
  narrative: { approvedLines: [], terminology: [{ term: 'token bucket', meaning: 'a store of admission capacity' }], omissions: [] },
  material: { themeRef: 'theme-a:0011', baseNotebookRef: 'nb-base', baseRevision: 'rev-1', assetRefs: [], takeRefs: [] },
  delivery: { sceneDecisions: [], unresolved: 'Voice source and presenter visibility are decided per scene.' },
  creativeGuidance: [{ text: 'Keep it calm and concrete.', basis: 'creator' }, { text: 'Rich controllable objects suit the mechanism.', basis: 'suggestion' }],
  openDecisions: ['Demonstration details, scene boundaries, visual treatment and capabilities'],
  uncertainty: [],
  route: { workflow: 'general-video', reason: 'A narrated explanation with per-scene delivery; one owning workflow' },
  coverage: [{ scene: 'base-1', units: ['admission'] }, { scene: 'base-2', units: ['exhaustion'] }],
})

describe('quotations are checked against what was actually read', () => {
  it('finds an exact passage despite typography and spacing', () => {
    expect(quotedIn('Each request that is admitted consumes one token', SOURCE)).toBe(true)
    expect(quotedIn('“A token bucket holds a fixed   number of tokens.”', SOURCE)).toBe(true)
  })
  it('lets an ellipsis join fragments, in order only', () => {
    expect(quotedIn('Tokens are added back … a later request can pass again', SOURCE)).toBe(true)
    expect(quotedIn('a later request can pass again … Tokens are added back', SOURCE)).toBe(false)
  })
  it('refuses a plausible sentence the article never said', () => {
    expect(quotedIn('Each request that is admitted consumes two tokens.', SOURCE)).toBe(false)
  })
})

describe('the Explanation Brief', () => {
  it('accepts a grounded reduction that leaves the creative choices open', () => {
    const report = validateBrief(goodBrief(), context())
    expect(report.problems).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('refuses a quotation the retained source does not contain', () => {
    const brief = goodBrief()
    brief.evidence[0].text = 'Every request always consumes exactly two tokens from the bucket.'
    const report = validateBrief(brief, context())
    expect(report.ok).toBe(false)
    expect(report.problems.join('\n')).toMatch(/ev-consume is not a passage of the retained source/)
  })

  it('refuses presentation structure but not its own fields that share a name', () => {
    const raw = { ...goodBrief(), units: goodBrief().units.map((unit, index) => (index === 0 ? { ...unit, kind: 'diagram', seconds: 12 } : unit)) }
    const report = validateBrief(raw, context())
    expect(report.problems.some(problem => problem.startsWith('units[0].kind'))).toBe(true)
    expect(report.problems.some(problem => problem.startsWith('units[0].seconds'))).toBe(true)
    // evidence[].kind (source/creator) is the brief's own field.
    expect(report.problems.some(problem => problem.startsWith('evidence'))).toBe(false)
  })

  it('accounts for every inherited page, or says why one is left out', () => {
    const brief = goodBrief()
    brief.coverage = [{ scene: 'base-1', units: ['admission'] }]
    expect(validateBrief(brief, context()).problems.join('\n')).toMatch(/does not account for base scene "base-2"/)
    brief.coverage.push({ scene: 'base-2', units: [], omittedReason: 'A closing slide with no new idea' })
    expect(validateBrief(brief, context()).problems.join('\n')).not.toMatch(/base-2/)
  })

  it('does not decide a delivery the creator has not chosen', () => {
    const brief = goodBrief()
    brief.delivery.sceneDecisions = [{ scene: 'base-1', voice: 'generated' }]
    expect(validateBrief(brief, context()).problems.join('\n')).toMatch(/has not made/)
  })

  it('keeps a proposed demonstration out of the brief', () => {
    const raw = goodBrief() as unknown as Record<string, unknown>
    ;(raw.units as Array<Record<string, unknown>>)[0].demonstration = { text: 'Three tokens, requests A–D', basis: 'suggestion' }
    expect(validateBrief(raw, context()).problems.join('\n')).toMatch(/leave the choice open for the creative plan/)
  })

  it('carries a preserved script verbatim', () => {
    const scripts = [{ scene: 'base-1', text: 'A bucket holds three tokens, and the calls that arrive spend them.' }]
    const brief = goodBrief()
    brief.source.wordingPolicy = 'preserve'
    brief.narrative.approvedLines = [{ scene: 'base-1', text: 'A bucket holds three tokens, and every call spends one.' }]
    expect(validateBrief(brief, context({ wordingPolicy: 'preserve', scripts })).problems.join('\n')).toMatch(/changes scene "base-1"'s approved wording/)
    brief.narrative.approvedLines = [{ scene: 'base-1', text: scripts[0].text }]
    expect(validateBrief(brief, context({ wordingPolicy: 'preserve', scripts })).ok).toBe(true)
  })

  it('names exactly the revisions its fork pinned, and finds circular dependencies', () => {
    const brief = goodBrief()
    brief.source.revisionRef = 'src-6'
    brief.units[0].dependsOn = ['exhaustion']
    const problems = validateBrief(brief, context()).problems.join('\n')
    expect(problems).toMatch(/pinned source revision "src-7"/)
    expect(problems).toMatch(/depend on each other in a circle/)
  })

  it('does not claim a full reading of a source that survives only in fragments', () => {
    expect(validateBrief(goodBrief(), context({ sourceText: '' })).problems.join('\n')).toMatch(/only fragments of it were retained/)
  })
})

const catalog = buildCapabilityCatalog({
  upstreamCommit: 'abc',
  runtime: { '@hyperframes/player': '0.7.106' },
  rulesIndex: '<rules>\n<coordinate-target-zoom path="rules/coordinate-target-zoom.md">Zoom into non-centered elements. Tags: camera, zoom</coordinate-target-zoom>\n<svg-path-draw path="rules/svg-path-draw.md">Draw a path. Tags: svg, path</svg-path-draw>\n</rules>',
  blueprintsIndex: '<blueprint id="camera-journey" roles="Benefits" duration="5–11s">\nThe camera is the storyteller.\n</blueprint>',
  techniques: '# Visual Techniques\n\n## Contents\n\n- SVG path drawing\n- Lottie animation\n- When to use what\n\n## SVG path drawing',
})

const treatmentContext = (overrides: Partial<TreatmentContext> = {}): TreatmentContext => ({
  brief: goodBrief(),
  scene: 'video-s01',
  originScenes: ['base-1'],
  videoScenes: ['video-s01', 'video-s02'],
  catalog,
  bundleSkills: ['hyperframes-creative', 'hyperframes-animation', 'general-video'],
  bundleReferences: ['skills/hyperframes-creative/references/beat-direction.md', 'skills/hyperframes-animation/rules-index.md'],
  delivery: null,
  assetKeys: ['token-bucket@2'],
  ...overrides,
})

const goodTreatment = (): SceneTreatmentV1 => ({
  schemaVersion: 1,
  scene: 'video-s01',
  originScenes: ['base-1'],
  units: ['admission'],
  question: 'Why does a request pass?',
  takeaway: 'An admitted request spends one token.',
  evidenceRefs: ['ev-consume'],
  development: 'Establish the bucket holding capacity, then follow one request as it spends a token and passes.',
  demonstration: { text: 'Three tokens; request A arrives', values: [{ value: '3 tokens', basis: 'illustrative' }] },
  moments: [
    {
      id: 'm1', title: 'Establish capacity', purpose: 'The viewer needs the store before the spend', observation: 'Three tokens sit in the bucket',
      narration: { job: 'Introduce the bucket as stored capacity', guide: 'A token bucket holds capacity.' }, objects: { change: 'Bucket appears full', actors: ['bucket'] }, text: { content: 'token bucket', role: 'term' },
      presenter: { visibility: 'undecided', reason: 'A presenter could introduce the idea if one is recorded' }, camera: { treatment: 'hold', subject: 'bucket', reason: 'Let the map settle' }, audio: null,
      attention: 'the bucket', recipes: [{ id: 'svg-path-draw', catalog: 'rule', purpose: 'Draw the route the request will take', channel: 'objects', controls: ['route'] }], evidenceRefs: ['ev-consume'], estimateSeconds: 5,
    },
    {
      id: 'm2', title: 'A request spends a token', purpose: 'Make the cost of admission visible', observation: 'One token leaves as request A passes',
      narration: { job: 'Explain the admission condition', guide: 'Each admitted request consumes one token.' }, objects: { change: 'Request A travels in; one token leaves; A continues', actors: ['request', 'bucket'] }, text: null,
      presenter: null, camera: { treatment: 'follow the request, then settle', subject: 'request A', reason: 'Follow the action to its consequence' }, audio: null,
      attention: 'request A and the token it spends',
      recipes: [
        { id: 'camera-journey', catalog: 'blueprint', purpose: 'One continuous journey from arrival to admission', channel: 'camera', controls: ['world'] },
        { id: 'token-spend', catalog: 'adapted', purpose: 'The token leaving the bucket as a part of the drawn object', channel: 'objects', controls: ['bucket.tokens'] },
      ],
      evidenceRefs: ['ev-consume'], estimateSeconds: 7,
    },
  ],
  objects: [
    { entity: 'bucket', role: 'Holds capacity', appearance: 'A dimensional bucket with separable tokens', performance: 'Tokens leave one at a time', asset: { status: 'reuse', ref: 'token-bucket@2' } },
    { entity: 'request', role: 'The travelling call', appearance: 'A small labelled packet', performance: 'Travels to the bucket and on', asset: { status: 'generate' } },
  ],
  treatments: { presenter: 'Undecided; if recorded, the presenter introduces the question and yields the frame.', text: 'Only the term, once.', camera: 'Holds, then follows one request.' },
  skills: [
    { skill: 'hyperframes-creative', references: ['skills/hyperframes-creative/references/beat-direction.md'], why: 'Beat planning of the explanation' },
    { skill: 'hyperframes-animation', references: ['skills/hyperframes-animation/rules-index.md'], why: 'Choosing the path and camera recipes' },
  ],
  requirements: { assets: ['A request packet'], takes: [], decisions: ['Delivery for this scene'] },
  continuity: { entry: 'Bucket full, no requests', exit: 'Bucket holds two tokens; request A admitted' },
  unresolved: ['Presenter visibility depends on the delivery choice'],
  coverage: [{ unit: 'admission', need: 'Make the link between a token and admission perceptible', moments: ['m2'] }],
  rosterProposal: null,
  delivery: { voice: 'undecided', note: 'A presenter introduction would suit a recorded take' },
})

describe('the scene treatment', () => {
  it('accepts a plan that combines several skills within one continuous scene', () => {
    const report = validateTreatment(goodTreatment(), treatmentContext())
    expect(report.problems).toEqual([])
    // Catalogued is not proven: construction must still verify these.
    expect(report.constructionRisks.join('\n')).toMatch(/camera-journey/)
    expect(report.constructionRisks.join('\n')).toMatch(/adapted recipe "token-spend"/)
  })

  it('refuses a recipe the pinned catalog does not have unless it says it adapts one', () => {
    const treatment = goodTreatment()
    treatment.moments[0].recipes = [{ id: 'teleport-zoom', catalog: 'rule', purpose: 'Zoom', channel: 'camera', controls: [] }]
    expect(validateTreatment(treatment, treatmentContext()).problems.join('\n')).toMatch(/not a rule in the pinned catalog/)
  })

  it('cannot decide a delivery the creator has not chosen, nor show a presenter in a generated scene', () => {
    const decided = goodTreatment()
    decided.delivery.voice = 'human'
    expect(validateTreatment(decided, treatmentContext()).problems.join('\n')).toMatch(/keep it undecided/)
    const generated = goodTreatment()
    generated.delivery.voice = 'generated'
    expect(validateTreatment(generated, treatmentContext({ delivery: 'generated' })).problems.join('\n')).toMatch(/reserves no presenter space/)
  })

  it('says how every communication need of its units is met', () => {
    const treatment = goodTreatment()
    treatment.coverage = []
    expect(validateTreatment(treatment, treatmentContext()).problems.join('\n')).toMatch(/does not say how "Make the link/)
  })

  it('names only skills and references of the pinned bundle, and assets that exist', () => {
    const treatment = goodTreatment()
    treatment.skills.push({ skill: 'pitch-master', references: [], why: 'energy' })
    treatment.objects[0].asset = { status: 'reuse', ref: 'missing@1' }
    const problems = validateTreatment(treatment, treatmentContext()).problems.join('\n')
    expect(problems).toMatch(/"pitch-master", which is not in the pinned bundle/)
    expect(problems).toMatch(/not in the accepted asset library/)
  })
})

describe('the capability catalog', () => {
  it('reads rules, blueprints and techniques, none of them proven yet', () => {
    expect(parseRulesIndex('<rules>\n<a path="rules/a.md">One. Tags: x</a>\n</rules><rules>\n<a path="rules/a.md">One again. Tags: y</a>\n</rules>')).toEqual([
      { id: 'a', kind: 'rule', summary: 'One.', source: 'skills/hyperframes-animation/rules/a.md', tags: ['x', 'y'], bodyVendored: false, verifiedInInstalledRuntime: false },
    ])
    expect(parseBlueprintsIndex('<blueprint id="b" roles="Hook, CTA">\nDesc\n</blueprint>')[0].tags).toEqual(['Hook', 'CTA'])
    expect(parseTechniques('## Contents\n\n- SVG path drawing\n- When to use what\n\n').map(entry => entry.id)).toEqual(['svg-path-drawing'])
    expect(catalog.entries.every(entry => !entry.verifiedInInstalledRuntime)).toBe(true)
  })
})

describe('the handoff files', () => {
  it('writes the upstream brief envelope and keeps suggestions out of the accepted customizations', () => {
    const native = renderNativeBrief(goodBrief())
    expect(native).toMatch(/^---\nworkflow: general-video\nflow: automation\nstoryboard: yes\n/)
    expect(native).toMatch(/length: 60s/)
    expect(native).toMatch(/## Customizations\n\n- Keep it calm and concrete\./)
    expect(native).not.toMatch(/Customizations[\s\S]*Rich controllable objects/)
    expect(native).toMatch(/Read EXPLANATION\.md before planning/)
  })

  it('writes the companion with every statement\'s basis and the open demonstration', () => {
    const companion = renderExplanation(goodBrief())
    expect(companion).toMatch(/The bucket starts with three tokens\. _\(illustrative\)_/)
    expect(companion).toMatch(/Demonstration: open/)
    expect(companion).toMatch(/Base page base-2 → exhaustion/)
  })

  it('gives a scene packet its presentation input as reference only', () => {
    const packet = renderScenePacket({
      videoTitle: 'Rate limiting', scene: { id: 'video-s01', title: 'Admission', index: 0, originScenes: ['base-1'] },
      presentation: [{ scene: 'base-1', title: 'Admission', idea: 'A request spends a token', narration: 'Each request spends one.', sourcePassages: ['Each request that is admitted consumes one token.'], wireframe: 'pages/base-1.svg' }],
      script: 'Each request spends one token.', units: ['admission'], adjacent: [{ position: 'after', id: 'video-s02', title: 'Exhaustion', units: ['exhaustion'], takeaway: null }],
      direction: { video: '', scene: 'Keep the camera calm' }, delivery: null, reviewed: null, assets: [],
    })
    expect(packet).toMatch(/not a scene boundary, a layout, a duration/)
    expect(packet).toMatch(/keep delivery\.voice "undecided"/)
    expect(packet).toMatch(/For this scene: Keep the camera calm/)
  })
})

const record = (overrides: Partial<PlanningRecord>): PlanningRecord => ({
  id: 'r', kind: 'treatment', projectId: 'p', subject: 'video-s01', revision: 1, status: 'candidate', fingerprint: 'f1', inputs: { briefId: 'brief-1' },
  content: null, report: null, artifacts: null, runId: null, adapter: null, model: null, skillBundle: null, workflow: null, direction: '', error: null,
  createdAt: '', updatedAt: '', reviewedAt: null, ...overrides,
})
const brief = record({ id: 'brief-1', kind: 'brief', subject: '', status: 'ready' })

describe('planning states', () => {
  it('keeps the reviewed plan while a newer candidate runs, then fails', () => {
    const reviewed = record({ id: 't1', revision: 1, status: 'reviewed' })
    const running = record({ id: 't2', revision: 2, status: 'running' })
    const view = scenePlanningView([brief, reviewed, running], 'video-s01', { briefFingerprint: 'b', treatmentFingerprint: 'f1' })
    expect(view.state).toBe('planning')
    expect(view.reviewed?.id).toBe('t1')
    const failed = scenePlanningView([brief, reviewed, { ...running, status: 'failed' }], 'video-s01', { briefFingerprint: 'b', treatmentFingerprint: 'f1' })
    expect(failed.state).toBe('failed')
    expect(failed.reviewed?.id).toBe('t1')
  })

  it('shows a plan made from inputs that have since changed as stale', () => {
    const view = scenePlanningView([brief, record({ id: 't1', status: 'candidate', fingerprint: 'old' })], 'video-s01', { briefFingerprint: 'b', treatmentFingerprint: 'new' })
    expect(view.state).toBe('stale')
    expect(view.staleBecause).toMatch(/inputs changed/)
  })

  it('waits for the brief before a scene can plan', () => {
    expect(scenePlanningView([], 'video-s01', { briefFingerprint: null, treatmentFingerprint: null }).state).toBe('preparing')
    expect(scenePlanningView([{ ...brief, status: 'failed' }], 'video-s01', { briefFingerprint: null, treatmentFingerprint: null }).state).toBe('brief-failed')
    expect(scenePlanningView([brief], 'video-s01', { briefFingerprint: 'b', treatmentFingerprint: 'f1' }).state).toBe('ready-to-plan')
  })

  it('lands a result only on the newest run whose inputs are still current', () => {
    const older = record({ id: 't1', revision: 1, status: 'running', fingerprint: 'f1' })
    const newer = record({ id: 't2', revision: 2, status: 'running', fingerprint: 'f1' })
    expect(landingFor(older, [older, newer], 'f1')).toMatchObject({ lands: false, status: 'superseded' })
    expect(landingFor(newer, [older, newer], 'f1')).toEqual({ lands: true })
    expect(landingFor(newer, [older, newer], 'f2')).toMatchObject({ lands: false, reason: expect.stringMatching(/inputs changed/) })
    expect(landingFor({ ...newer, status: 'candidate' }, [newer], 'f1')).toMatchObject({ lands: false })
  })

  it('fingerprints the same inputs the same way whatever their key order', () => {
    expect(fingerprintOf({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(fingerprintOf({ b: [1, { d: 3, c: 2 }], a: 1 }))
    expect(fingerprintOf({ a: 1 })).not.toBe(fingerprintOf({ a: 2 }))
  })
})
