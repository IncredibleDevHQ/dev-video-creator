import { describe, expect, it } from 'vitest'
import { quotedIn, fingerprintOf } from './fingerprint'
import { buildCapabilityCatalog, parseBlueprintsIndex, parseRulesIndex, parseTechniques } from './capability-catalog'
import { validateBrief, type BriefContext, type ExplanationBriefV1 } from './explanation-brief'
import { continuityStatus, validateTreatment, type SceneTreatmentV1, type TreatmentContext } from './scene-treatment'
import { compareTreatments } from './plan-compare'
import { recordingGuide } from './recording-guide'
import { renderExplanation, renderNativeBrief, renderScenePacket } from './brief-adapter'
import { PLANNING_SCHEMA, briefFingerprint, briefFreshness, landingFor, scenePlanningView, treatmentFingerprint, treatmentFreshness, type BriefInputs, type PlanningRecord, type TreatmentInputs } from './planning-records'

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

  it('takes the video length from the creator, not from the slides', () => {
    expect(validateBrief(goodBrief(), context({ requestedSeconds: 60 })).ok).toBe(true)
    expect(validateBrief(goodBrief(), context({ requestedSeconds: null })).problems.join('\n')).toMatch(/creator's chosen length/)
  })

  it('does not claim a full reading of a source that survives only in fragments', () => {
    expect(validateBrief(goodBrief(), context({ sourceText: '' })).problems.join('\n')).toMatch(/only fragments of it were retained/)
  })

  // R3: with only the passages kept on the base pages, those passages are
  // the source evidence — checked against that pool, with their page.
  const KEPT = [
    { scene: 'base-1', text: 'Each request that is admitted consumes one token.' },
    { scene: 'base-1', text: 'When a burst arrives, the requests are admitted until the bucket is empty; the next request is rejected.' },
    { scene: 'base-2', text: 'Tokens are added back at a steady refill rate, so a later request can pass again.' },
  ]
  const fragmentBrief = () => {
    const brief = goodBrief()
    brief.source.coverage = 'fragments'
    brief.source.limitations = ['Only the passages kept on the base pages survive.']
    return brief
  }

  it('accepts a passage kept on a base page as source evidence, and records the page', () => {
    const report = validateBrief(fragmentBrief(), context({ sourceText: '', sourceFragments: KEPT }))
    expect(report.problems).toEqual([])
    expect(report.brief.evidence.map(entry => entry.lineage)).toEqual([
      { pool: 'fragments', pages: ['base-1'] },
      { pool: 'fragments', pages: ['base-1'] },
      { pool: 'fragments', pages: ['base-2'] },
    ])
  })

  it('refuses a source quotation the kept passages do not contain, or one joining two pages', () => {
    const missing = fragmentBrief()
    missing.evidence[0].text = 'A token bucket holds a fixed number of tokens.'
    expect(validateBrief(missing, context({ sourceText: '', sourceFragments: KEPT })).problems.join('\n')).toMatch(/evidence ev-consume is not one of the source passages kept on the base pages/)
    const joined = fragmentBrief()
    joined.evidence[0].text = 'Each request that is admitted consumes one token … Tokens are added back at a steady refill rate'
    expect(validateBrief(joined, context({ sourceText: '', sourceFragments: KEPT })).problems.join('\n')).toMatch(/not one of the source passages kept/)
  })

  it('warns which base pages kept no passage', () => {
    const report = validateBrief(fragmentBrief(), context({ sourceText: '', sourceFragments: KEPT.filter(entry => entry.scene === 'base-1'), baseSceneIds: ['base-1', 'base-2'] }))
    expect(report.warnings.join('\n')).toMatch(/1 of 2 base pages kept none \(base-2\)/)
  })

  it('has no source evidence when nothing of the source was retained', () => {
    const report = validateBrief(fragmentBrief(), context({ sourceText: '', sourceFragments: [] }))
    expect(report.problems.join('\n')).toMatch(/nothing of the source was retained/)
  })

  it('never takes a lineage from the harness, and keeps the creator\'s words apart', () => {
    const brief = goodBrief()
    brief.evidence.push({ id: 'ev-creator', kind: 'creator', text: 'A bucket holds three tokens, and the calls that arrive spend them.', lineage: { pool: 'full' } })
    brief.evidence[0] = { ...brief.evidence[0], lineage: { pool: 'creator' } }
    const report = validateBrief(brief, context())
    expect(report.problems).toEqual([])
    expect(report.brief.evidence[0].lineage).toEqual({ pool: 'full' })
    expect(report.brief.evidence.find(entry => entry.id === 'ev-creator')?.lineage).toEqual({ pool: 'creator' })
    // A source passage relabelled as the creator's does not pass.
    const relabelled = goodBrief()
    relabelled.evidence[0].kind = 'creator'
    expect(validateBrief(relabelled, context()).problems.join('\n')).toMatch(/evidence ev-consume is not something the creator wrote/)
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
  ledger: null,
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
  continuity: { entry: 'Bucket full, no requests', exit: 'Bucket holds two tokens; request A admitted', incoming: { kind: 'self-contained' }, outgoing: { kind: 'self-contained' } },
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
    // A catalogued recipe used by two moments is one risk.
    const shared = goodTreatment()
    shared.moments[1].recipes.push({ ...shared.moments[0].recipes[0] })
    expect(validateTreatment(shared, treatmentContext()).constructionRisks.filter(risk => /svg-path-draw/.test(risk))).toHaveLength(1)
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

  // R7: an illustrative example still obeys its own mechanism.
  const stripeBucket = () => {
    const treatment = goodTreatment()
    treatment.moments.push(
      { ...treatment.moments[1], id: 'm3', title: 'A burst drains it', observation: 'Eight requests arrive; the bucket empties' },
      { ...treatment.moments[1], id: 'm4', title: 'The ninth is refused', observation: 'Request nine is turned away' },
    )
    treatment.demonstration = { text: 'Five tokens, two refills, a burst of eight requests; the ninth is refused', values: [{ value: '5 tokens', basis: 'illustrative' }, { value: '2 refill tokens', basis: 'illustrative' }, { value: '8 requests', basis: 'illustrative' }] }
    return treatment
  }

  it('warns when a demonstration counts without a ledger', () => {
    const report = validateTreatment(stripeBucket(), treatmentContext())
    expect(report.warnings.join('\n')).toMatch(/the demonstration counts \(5 tokens, 2 refill tokens, 8 requests\) but has no ledger/)
  })

  it('refuses the review\'s impossible bucket: eight admitted from seven tokens', () => {
    const treatment = stripeBucket()
    const consume = (moment: string, after: number) => ({ moment, what: 'a request is admitted', change: 'consume' as const, amount: 1, after })
    treatment.ledger = {
      quantity: 'tokens in the bucket',
      capacity: 5,
      initial: 5,
      events: [
        consume('m2', 4), consume('m3', 3), consume('m3', 2), consume('m3', 1), consume('m3', 0),
        { moment: 'm3', what: 'refill', change: 'add', amount: 2, after: 2 },
        consume('m3', 1), consume('m3', 0), consume('m3', 0),
        { moment: 'm4', what: 'request nine', change: 'refuse', amount: 0, after: 0 },
      ],
      final: 0,
    }
    const problems = validateTreatment(treatment, treatmentContext()).problems.join('\n')
    expect(problems).toMatch(/event 9 \("a request is admitted"\) consumes 1 while only 0 remain — it would be refused/)
    // The r2 correction: seven admitted, the eighth refused.
    treatment.ledger.events.splice(8, 2, { moment: 'm4', what: 'request eight', change: 'refuse', amount: 0, after: 0 })
    expect(validateTreatment(treatment, treatmentContext()).problems).toEqual([])
  })

  it('checks a ledger\'s order, refusals, capacity and stated counts', () => {
    const treatment = stripeBucket()
    treatment.ledger = {
      quantity: 'tokens',
      capacity: 3,
      initial: 3,
      events: [
        { moment: 'm3', what: 'spend', change: 'consume', amount: 1, after: 2 },
        { moment: 'm2', what: 'early', change: 'consume', amount: 1, after: 2 },
        { moment: 'm3', what: 'refused too soon', change: 'refuse', amount: 1, after: 1 },
        { moment: 'm4', what: 'overfill', change: 'add', amount: 5, after: 3 },
      ],
      final: 4,
    }
    const problems = validateTreatment(treatment, treatmentContext()).problems.join('\n')
    expect(problems).toMatch(/event 2 \("early"\) is listed after an event of a later moment/)
    expect(problems).toMatch(/event 2 \("early"\) says 2 remain after it, but the count is 1/)
    expect(problems).toMatch(/event 3 \("refused too soon"\): a refused request consumes nothing/)
    expect(problems).toMatch(/event 3 \("refused too soon"\) is refused while 1 remain/)
    expect(problems).toMatch(/event 4 \("overfill"\) adds 5 to 1, past the capacity of 3/)
    expect(problems).toMatch(/final is 4, but the events leave 3/)
  })

  // R8: a seam rests on a reviewed neighbour, or is self-contained, or is
  // a proposal that stays provisional.
  const reviewedBefore = { position: 'before' as const, scene: 'video-s00', reviewed: { recordId: 'rec-s00', revision: 2, entry: 'Nothing', exit: 'Four limiter tiles; one marked most frequent' } }

  it('refuses an agreed seam with a neighbour that has no reviewed plan', () => {
    const treatment = goodTreatment()
    treatment.continuity.incoming = { kind: 'agreed' }
    const unplanned = { ...reviewedBefore, reviewed: null }
    expect(validateTreatment(treatment, treatmentContext({ neighbors: [unplanned] })).problems.join('\n')).toMatch(/continuity.incoming is agreed, but video-s00 has no reviewed plan/)
    // Proposed is allowed, and stays provisional.
    treatment.continuity.incoming = { kind: 'proposed', note: 'Open on the four tiles if scene 9 ends there' }
    const report = validateTreatment(treatment, treatmentContext({ neighbors: [unplanned] }))
    expect(report.problems).toEqual([])
    expect(report.warnings.join('\n')).toMatch(/proposes a seam with video-s00 .* stays provisional/)
  })

  it('records the agreement it rests on, and it breaks when that plan changes', () => {
    const treatment = goodTreatment()
    treatment.continuity.incoming = { kind: 'agreed' }
    const report = validateTreatment(treatment, treatmentContext({ neighbors: [reviewedBefore] }))
    expect(report.problems).toEqual([])
    expect(report.treatment.continuity.incoming).toMatchObject({ kind: 'agreed', scene: 'video-s00', record: 'rec-s00', revision: 2 })
    expect(continuityStatus(report.treatment, [reviewedBefore])[0]).toMatchObject({ state: 'agreed' })
    const revised = { ...reviewedBefore, reviewed: { ...reviewedBefore.reviewed, recordId: 'rec-s00-r3', revision: 3 } }
    expect(continuityStatus(report.treatment, [revised])[0]).toMatchObject({ state: 'broken', reason: expect.stringMatching(/reviewed plan changed/) })
    expect(continuityStatus(report.treatment, [revised])[1]).toMatchObject({ state: 'self-contained' })
  })

  it('needs every side stated, and only real neighbours', () => {
    const treatment = goodTreatment()
    treatment.continuity.incoming = { kind: '' as never }
    treatment.continuity.outgoing = { kind: 'proposed' }
    const problems = validateTreatment(treatment, treatmentContext({ neighbors: [] })).problems.join('\n')
    expect(problems).toMatch(/continuity.incoming must say whether the opening is self-contained/)
    expect(problems).toMatch(/continuity.outgoing is proposed, but no scene comes after this one/)
  })

  it('notices an actor its moments move but never cast', () => {
    const treatment = goodTreatment()
    treatment.objects = treatment.objects.filter(object => object.entity !== 'request')
    const report = validateTreatment(treatment, treatmentContext())
    expect(report.problems).toEqual([])
    expect(report.warnings.join('\n')).toMatch(/"request" moves in a moment but is not cast/)
    expect(validateTreatment(goodTreatment(), treatmentContext()).warnings.join('\n')).not.toMatch(/not cast/)
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
  content: null, report: null, artifacts: null, runId: null, adapter: null, model: null, reportedModel: null, skillBundle: null, workflow: null, direction: '', error: null,
  createdAt: '', updatedAt: '', reviewedAt: null, approval: null, ...overrides,
})
const briefNow: BriefInputs = { schema: PLANNING_SCHEMA, baseNotebook: 'b', baseRevision: 'r1', sourceRevision: 's1', narrativeRevision: null, modelRevision: null, wordingPolicy: 'draft', scripts: [{ scene: 'video-s01', text: 'A bucket holds tokens.' }], themeRef: 't1', requestedSeconds: 360, videoDirection: '', sceneDecisions: [], bundleHash: 'h' }
const brief = record({ id: 'brief-1', kind: 'brief', subject: '', status: 'ready', inputs: briefNow, fingerprint: briefFingerprint(briefNow) })
const sceneNow: TreatmentInputs = { schema: PLANNING_SCHEMA, briefId: 'brief-1', briefFingerprint: brief.fingerprint, scene: 'video-s01', originScenes: ['base-1'], direction: 'Calm', videoDirection: '', themeRef: 't1', delivery: null, bundleHash: 'h', script: 'A bucket holds tokens.' }
const plan = (overrides: Partial<PlanningRecord> = {}) => record({ id: 't1', inputs: sceneNow, fingerprint: treatmentFingerprint(sceneNow), ...overrides })
const fresh = { briefFresh: briefFreshness(brief, briefNow), inputs: sceneNow }

describe('planning states', () => {
  it('keeps the reviewed plan while a newer candidate runs, then fails', () => {
    const reviewed = plan({ id: 't1', revision: 1, status: 'reviewed' })
    const running = plan({ id: 't2', revision: 2, status: 'running' })
    const view = scenePlanningView([brief, reviewed, running], 'video-s01', fresh)
    expect(view.state).toBe('planning')
    expect(view.reviewed?.id).toBe('t1')
    const failed = scenePlanningView([brief, reviewed, { ...running, status: 'failed' }], 'video-s01', fresh)
    expect(failed.state).toBe('failed')
    expect(failed.reviewed?.id).toBe('t1')
  })

  it('names what moved when a scene plan goes stale', () => {
    const view = scenePlanningView([brief, plan({ status: 'reviewed' })], 'video-s01', { ...fresh, inputs: { ...sceneNow, delivery: 'human', script: 'A bucket holds tokens, one per request.' } })
    expect(view.state).toBe('stale')
    expect(view.staleBecause).toBe('the scene\'s script and the scene\'s delivery changed since this plan was made')
  })

  it('makes every plan from a stale brief stale, and says why', () => {
    const moved = { ...briefNow, sourceRevision: 's2' }
    const view = scenePlanningView([brief, plan()], 'video-s01', { briefFresh: briefFreshness(brief, moved), inputs: sceneNow })
    expect(view.state).toBe('stale')
    expect(view.staleBecause).toBe('its explanation brief is stale: the retained source changed since it was made')
    expect(treatmentFreshness(plan(), { brief, briefFresh: briefFreshness(brief, moved), inputs: sceneNow })).toMatchObject({ fresh: false })
    expect(treatmentFreshness(plan(), { brief, ...fresh })).toEqual({ fresh: true, reason: null })
  })

  it('keeps one scene\'s words, theme and delivery out of the brief', () => {
    // Scene-level edits never make the brief — and so every scene — stale.
    for (const change of [{ scripts: [{ scene: 'video-s01', text: 'Reworded.' }] }, { themeRef: 't2' }, { sceneDecisions: [{ scene: 'video-s01', voice: 'human' }] }]) {
      expect(briefFreshness(brief, { ...briefNow, ...change })).toEqual({ fresh: true, reason: null })
    }
    // What the brief does depend on is named.
    expect(briefFreshness(brief, { ...briefNow, narrativeRevision: 'n2', wordingPolicy: 'preserve' })).toEqual({ fresh: false, reason: 'the narrative, the wording policy and the preserved wording changed since it was made' })
    expect(briefFreshness(brief, { ...briefNow, videoDirection: 'Shorter' }).reason).toBe('the video direction changed since it was made')
  })

  it('reads a record made under older rules as stale, once, with that reason', () => {
    const { schema: _schema, ...older } = briefNow
    const old = record({ id: 'brief-0', kind: 'brief', subject: '', status: 'ready', inputs: older, fingerprint: 'fp-under-old-rules' })
    expect(briefFreshness(old, briefNow).reason).toMatch(/^the planning rules changed/)
  })

  it('waits for the brief before a scene can plan', () => {
    expect(scenePlanningView([], 'video-s01', null).state).toBe('needs-brief')
    expect(scenePlanningView([{ ...brief, status: 'failed' }], 'video-s01', null).state).toBe('brief-failed')
    expect(scenePlanningView([brief], 'video-s01', fresh).state).toBe('ready-to-plan')
  })

  it('lands a result only on the newest run whose inputs are still current', () => {
    const older = plan({ id: 't1', revision: 1, status: 'running' })
    const newer = plan({ id: 't2', revision: 2, status: 'running' })
    const ok = { fresh: true, reason: null } as const
    expect(landingFor(older, [older, newer], ok)).toMatchObject({ lands: false, status: 'superseded' })
    expect(landingFor(newer, [older, newer], ok)).toEqual({ lands: true })
    expect(landingFor(newer, [older, newer], { fresh: false, reason: 'the scene direction changed since this plan was made' })).toMatchObject({ lands: false, reason: expect.stringMatching(/inputs changed while it ran \(the scene direction changed/) })
    expect(landingFor({ ...newer, status: 'candidate' }, [newer], ok)).toMatchObject({ lands: false })
  })

  it('fingerprints the same inputs the same way whatever their key order', () => {
    expect(fingerprintOf({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(fingerprintOf({ b: [1, { d: 3, c: 2 }], a: 1 }))
    expect(fingerprintOf({ a: 1 })).not.toBe(fingerprintOf({ a: 2 }))
  })
})

describe('comparing plan revisions', () => {
  it('names what changed by what a creator would notice', () => {
    const before = goodTreatment()
    const after = goodTreatment()
    after.takeaway = 'Admission costs exactly one token.'
    after.moments[1].camera = { treatment: 'push in', subject: 'the bucket', reason: 'Show the spend up close' }
    after.moments[1].presenter = { visibility: 'hidden', reason: 'The graphics carry it' }
    after.moments.push({ ...after.moments[1], id: 'm3', title: 'The next request waits', observation: 'The bucket is empty' })
    after.objects[1].asset = { status: 'native', reason: 'A plain packet reads fastest' }
    after.continuity.outgoing = { kind: 'proposed', note: 'Open the next scene on the empty bucket' }
    const differences = compareTreatments(before, after)
    const labels = differences.map(entry => `${entry.category}:${entry.change}:${entry.label}`)
    expect(labels).toEqual(expect.arrayContaining([
      'purpose:changed:The takeaway',
      'camera:changed:A request spends a token: camera',
      'presenter:changed:A request spends a token: presenter',
      'moments:added:The next request waits',
      'objects:changed:request: artwork',
      'continuity:changed:How it leaves',
    ]))
    expect(differences.find(entry => entry.label === 'request: artwork')).toMatchObject({ before: 'generate', after: 'native' })
    expect(compareTreatments(before, goodTreatment())).toEqual([])
  })
})

describe('the recording guide', () => {
  it('asks for every spoken line, and says where the speaker is for each moment', () => {
    const plan = goodTreatment()
    plan.moments[0].presenter = { visibility: 'full', reason: 'Introduce the idea' }
    plan.moments[1].presenter = { visibility: 'hidden', reason: 'The spend carries it' }
    const guide = recordingGuide({ plan, script: 'A token bucket holds capacity.\n\nEach admitted request consumes one token. [pause]', wordingPolicy: 'preserve', delivery: null })
    expect(guide.lines).toEqual([{ text: 'A token bucket holds capacity.', wording: 'approved' }, { text: 'Each admitted request consumes one token.', wording: 'approved' }])
    expect(guide.steps.map(step => step.framing)).toEqual(['full', 'hidden'])
    expect(guide.steps[1].instruction).toMatch(/keep speaking; the graphics take the frame/)
    expect(guide.offCamera).toBe(true)
    expect(guide.sections.map(section => section.label)).toEqual(['1. Establish capacity — on camera', '2. A request spends a token — voice only'])
    expect(guide.delivery.join(' ')).toMatch(/The take sets the timing/)
    expect(guide.note).toMatch(/No take is needed to plan or to preview/)
  })

  it('has nothing to record for a generated or silent scene, and marks draft wording', () => {
    const generated = recordingGuide({ plan: goodTreatment(), script: 'Draft line.', wordingPolicy: 'draft', delivery: 'generated' })
    expect(generated.note).toMatch(/generated voice: there is nothing to record/)
    expect(generated.lines[0].wording).toBe('draft')
  })
})
