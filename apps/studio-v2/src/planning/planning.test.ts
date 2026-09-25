import { describe, expect, it } from 'vitest'
import { quotedIn, fingerprintOf } from './fingerprint'
import { buildCapabilityCatalog, parseBlueprintsIndex, parseRulesIndex, parseTechniques } from './capability-catalog'
import { validateBrief, type BriefContext, type ExplanationBriefV1 } from './explanation-brief'
import { continuityStatus, validateTreatment, type SceneTreatmentV1, type TreatmentContext } from './scene-treatment'
import { compareTreatments } from './plan-compare'
import { lineFingerprints, recordingGuide, scriptFingerprint, takeAgainst } from './recording-guide'
import { sketchSummary, validateSketch } from './sketch-bundle'
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

  // R11: a plan can say a change is made by a steady rate (a refill), so
  // its sketch must keep that rate's beat.
  it('checks the steady rates a ledger declares and the changes they make', () => {
    const treatment = stripeBucket()
    const ledger = (rates: unknown, rate: string) => ({
      quantity: 'tokens', capacity: 3, initial: 3,
      rates,
      events: [
        { moment: 'm2', what: 'spend', change: 'consume', amount: 1, after: 2 },
        { moment: 'm3', what: 'a drop lands', change: 'add', amount: 1, after: 3, rate },
      ],
      final: 3,
    })
    treatment.ledger = ledger([{ id: 'refill', what: 'a drop lands as a token', change: 'add', amount: 1 }], 'refill') as SceneTreatmentV1['ledger']
    expect(validateTreatment(treatment, treatmentContext()).problems).toEqual([])
    treatment.ledger = ledger([{ id: 'refill', what: 'drops', change: 'add', amount: 2 }, { id: 'leak', what: 'a leak', change: 'consume', amount: 1 }], 'drip') as SceneTreatmentV1['ledger']
    const problems = validateTreatment(treatment, treatmentContext()).problems.join('\n')
    expect(problems).toMatch(/event 2 \("a drop lands"\) is made by rate "drip", which the ledger does not declare/)
    expect(problems).toMatch(/rate refill makes none of the changes/)
    treatment.ledger = ledger([{ id: 'refill', what: 'drops', change: 'add', amount: 2 }], 'refill') as SceneTreatmentV1['ledger']
    expect(validateTreatment(treatment, treatmentContext()).problems.join('\n')).toMatch(/event 2 \("a drop lands"\) is made by rate refill, which adds 2 each time/)
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
    expect(guide.lines).toEqual([{ text: 'A token bucket holds capacity.', moment: 'm1', wording: 'approved' }, { text: 'Each admitted request consumes one token.', moment: 'm2', wording: 'approved' }])
    expect(guide).toMatchObject({ source: 'plan', matchesScript: true })
    expect(guide.steps.map(step => step.framing)).toEqual(['full', 'hidden'])
    expect(guide.steps[1].instruction).toMatch(/keep speaking; the graphics take the frame/)
    expect(guide.offCamera).toBe(true)
    expect(guide.sections.map(section => section.label)).toEqual(['1. Establish capacity — on camera', '2. A request spends a token — voice only'])
    expect(guide.delivery.join(' ')).toMatch(/The take sets the timing/)
    expect(guide.note).toMatch(/No take is needed to plan or to preview/)
  })

  // R4: the approved revision moved the refill after the refusal and added a
  // silent hold; the notebook's script still has the older order.
  it('follows the approved plan\'s order and silences, and says when the notebook\'s script is older', () => {
    const plan = goodTreatment()
    const moment = (id: string, title: string, guide: string | null) => ({ ...plan.moments[1], id, title, narration: guide === null ? null : { job: title, guide } })
    plan.moments = [
      moment('m1', 'Refused', 'If the bucket is empty, the request is rejected.'),
      moment('m2', 'Hold on the refill', null),
      moment('m3', 'Name the rate', 'Fresh tokens drip back in slowly.'),
    ] as typeof plan.moments
    const older = 'Fresh tokens drip back in slowly.\n\nIf the bucket is empty, the request is rejected.'
    const guide = recordingGuide({ plan, script: older, wordingPolicy: 'draft', delivery: 'human' })
    expect(guide.lines.map(line => line.text)).toEqual(['If the bucket is empty, the request is rejected.', 'Fresh tokens drip back in slowly.'])
    expect(guide.steps.map(step => step.instruction)[1]).toMatch(/^Silent — say nothing here/)
    expect(guide).toMatchObject({ source: 'plan', matchesScript: false, planScript: 'If the bucket is empty, the request is rejected.\n\nFresh tokens drip back in slowly.' })
    // Kept wording counts as kept only where the line is the notebook's own.
    const kept = recordingGuide({ plan, script: 'If the bucket is empty, the request is rejected.', wordingPolicy: 'preserve', delivery: 'human' })
    expect(kept.lines.map(line => line.wording)).toEqual(['approved', 'draft'])
    // A take remembers the words it was spoken against: cues and spacing do
    // not change them, order does.
    expect(scriptFingerprint('A line.\n\nB line. [pause]')).toBe(scriptFingerprint('A  line.\n\n\nB line.'))
    expect(scriptFingerprint(older)).not.toBe(scriptFingerprint(guide.planScript))
    // Unchanged for takes made before lines were kept: the same fingerprint.
    expect(scriptFingerprint('A line.\n\nB line.')).toBe('fa269a28')
  })

  // R4: a take made against an earlier script is flagged only where the
  // words changed — the lines it does not cover — not as a whole.
  it('says which lines an earlier take does not cover', () => {
    const spoken = 'Each request takes a token.\n\nWhen the bucket is empty, the request is refused.\n\nTokens drip back in.'
    const take = { hash: scriptFingerprint(spoken), lines: lineFingerprints(spoken) }
    expect(take.lines).toHaveLength(3)
    expect(takeAgainst(take, spoken)).toEqual({ current: true, changed: [], dropped: 0 })
    // The plan was revised: one line reworded, one added, the order kept.
    const revised = 'Each request takes a token.\n\nWhen the bucket is empty, the next request is refused with a 429.\n\nTokens drip back in.\n\nOne bucket per user, in Redis.'
    expect(takeAgainst(take, revised)).toEqual({ current: false, changed: ['When the bucket is empty, the next request is refused with a 429.', 'One bucket per user, in Redis.'], dropped: 1 })
    // Reordered only: every line is covered, but the take is not current.
    expect(takeAgainst(take, 'Tokens drip back in.\n\nEach request takes a token.\n\nWhen the bucket is empty, the request is refused.')).toEqual({ current: false, changed: [], dropped: 0 })
    // A take that kept only the whole fingerprint knows only the whole.
    expect(takeAgainst({ hash: take.hash }, revised)).toEqual({ current: false, changed: null, dropped: null })
  })

  it('has nothing to record for a generated or silent scene, and marks draft wording', () => {
    const generated = recordingGuide({ plan: goodTreatment(), script: 'Draft line.', wordingPolicy: 'draft', delivery: 'generated' })
    expect(generated.note).toMatch(/generated voice: there is nothing to record/)
    expect(generated.lines[0].wording).toBe('draft')
  })
})

describe('the plan preview sketch', () => {
  const sketchOf = (overrides: { html?: string; manifest?: Record<string, unknown> } = {}) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script></head><body>
<div id="root" data-composition-id="sketch-s01-r1" data-start="0" data-width="1920" data-height="1080" data-duration="12">
<div id="m1" class="clip" data-start="0" data-duration="5" data-track-index="0"><h1>Capacity</h1></div>
<div id="m2" class="clip" data-start="5" data-duration="7" data-track-index="0"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg></div>
</div><script>window.__timelines = window.__timelines || {}; const tl = gsap.timeline({ paused: true }); window.__timelines["sketch-s01-r1"] = tl</script></body></html>`
    const manifest = {
      version: 1, scene: 'video-s01', plan: { record: 'plan-1', revision: 1 },
      composition: { id: 'sketch-s01-r1', width: 1920, height: 1080, fps: 30, duration: 12 },
      runtime: { hyperframes: '0.7.106' },
      moments: [{ id: 'm1', title: 'Establish capacity', start: 0, end: 5, estimated: true }, { id: 'm2', title: 'A request spends a token', start: 5, end: 12, estimated: true }],
      layers: [{ id: 'bucket', kind: 'object', label: 'Bucket', moments: ['m1', 'm2'], asset: { libraryKey: 'token-bucket@2' } }],
      provisional: ['Timing is estimated from the plan'],
      ...overrides.manifest,
    }
    return { 'index.html': overrides.html ?? html, 'manifest.json': JSON.stringify(manifest) }
  }
  const sketchContext = (plan = goodTreatment()) => ({ scene: 'video-s01', plan: { record: 'plan-1', revision: 1, content: plan }, assetKeys: ['token-bucket@2'] })

  it('accepts a sketch that covers the plan, reuses the cast and says what is estimated', () => {
    const report = validateSketch(sketchOf(), sketchContext())
    expect(report.problems).toEqual([])
    expect(sketchSummary(report.manifest!)).toMatchObject({ duration: 12, moments: [{ id: 'm1', start: 0, end: 5 }, { id: 'm2', start: 5, end: 12 }], layers: [{ id: 'bucket', reuses: 'token-bucket@2' }] })
  })

  it('refuses a sketch that skips a moment, runs past its length or pretends its timing is measured', () => {
    const skipped = validateSketch(sketchOf({ manifest: { moments: [{ id: 'm2', title: 'x', start: 0, end: 13, estimated: false }] } }), sketchContext()).problems.join('\n')
    expect(skipped).toMatch(/must be the plan's moments in order \(m1, m2\)/)
    expect(skipped).toMatch(/moment m2 ends at 13s, after the composition \(12s\)/)
    expect(skipped).toMatch(/moment m2 must say its timing is estimated/)
    expect(validateSketch(sketchOf({ manifest: { provisional: [] } }), sketchContext()).problems.join('\n')).toMatch(/must say the timing is estimated/)
  })

  it('refuses code that reaches outside the sketch or cannot be seeked', () => {
    const html = sketchOf()['index.html']
    const reaching = validateSketch(sketchOf({ html: html.replace('</body>', '<script>fetch("https://example.com/x"); Math.random()</script></body>') }), sketchContext()).problems.join('\n')
    expect(reaching).toMatch(/refers to "https:\/\/example\.com\/x"/)
    expect(reaching).toMatch(/fetches from the network/)
    expect(reaching).toMatch(/is random/)
    const unregistered = validateSketch(sketchOf({ html: html.replace('window.__timelines["sketch-s01-r1"] = tl', '') }), sketchContext()).problems.join('\n')
    expect(unregistered).toMatch(/does not register window.__timelines\["sketch-s01-r1"\]/)
  })

  // The wording of a real sketch (Claude Code, Opus 5.5): every placeholder
  // is named in provisional, in its own words — none is flagged.
  it('reads a placeholder as said when provisional names it in other words, and flags one it never names', () => {
    const layer = (id: string, label: string, placeholder: string) => ({ id, kind: 'object', label, moments: ['m1'], placeholder })
    const layers = [
      layer('request-rate-limiter', 'Request rate limiter glyph that grows into the bucket (card-morph-anchor)', 'Native outline stand-in: the library artwork is not in this packet'),
      layer('user', 'User chip docked at the bucket\'s left rim (spring-pop-entrance)', 'Native circle-and-silhouette stand-in'),
      layer('http-429', '429 Too Many Requests badge in accent, popped onto request D', 'Native pill stand-in: the library 429 mark is not in this packet'),
      layer('drip', 'Inlet drop: swells slowly during the burst without falling', 'Sketch recolour of the page\'s drop to primary'),
      layer('sketch-annotations', 'Sketch-only strips: the moment tag at top left and the draft narration guide', 'Not planned on-screen text'),
      layer('presenter', 'Presenter slot at the right edge, shown only where the plan leaves it undecided', 'Stand-in: a framed silhouette'),
      layer('redis', 'Redis store panel in the secondary colour', 'Native panel'),
    ]
    const provisional = [
      'Timing is estimated from the plan (about 24 s) — no voice or take exists yet',
      'The request rate limiter glyph, the user chip and the 429 badge are native placeholders: their library artwork is not in this packet',
      'The bucket, drop and 429 badge are sketch recolours and re-rigs of the page artwork; the planned adapted assets do not exist yet',
      'The bottom strip shows the draft narration only as a timing aid; the plan puts no narration on screen',
      'Presenter is a stand-in: visibility is undecided and no take is recorded',
    ]
    const warnings = validateSketch(sketchOf({ manifest: { layers, provisional } }), sketchContext()).warnings.filter(text => /placeholder/.test(text))
    expect(warnings).toEqual(['layer redis has a placeholder that manifest.provisional does not mention'])
  })

  // R11 of the scene-review review: the mechanism's clock. The plan counts
  // tokens and declares the refill a steady rate; the sketch times each
  // change, and the product holds it to the count and the beat.
  const refillPlan = () => {
    const plan = goodTreatment()
    plan.ledger = {
      quantity: 'tokens in the bucket', capacity: 3, initial: 3,
      rates: [{ id: 'refill', what: 'a drop lands as a token', change: 'add', amount: 1 }],
      events: [
        { moment: 'm1', what: 'request A takes a token', change: 'consume', amount: 1, after: 2 },
        { moment: 'm1', what: 'request B takes a token', change: 'consume', amount: 1, after: 1 },
        { moment: 'm2', what: 'a drop lands', change: 'add', amount: 1, after: 2, rate: 'refill' },
        { moment: 'm2', what: 'another drop lands', change: 'add', amount: 1, after: 3, rate: 'refill' },
      ],
      final: 3,
    }
    return plan
  }
  type Schedule = { rules: Array<Record<string, unknown>>; pauses: Array<Record<string, unknown>>; events: Array<Record<string, unknown>> }
  const steady = (change: (schedule: Schedule) => void = () => {}) => {
    const schedule = {
      quantity: 'tokens in the bucket', capacity: 3, initial: 3,
      rules: [{ id: 'refill', change: 'add', amount: 1, every: 3, from: 4 }] as Array<Record<string, unknown>>,
      pauses: [] as Array<Record<string, unknown>>,
      events: [
        { at: 4, moment: 'm1', change: 'consume', amount: 1, after: 2, layers: ['bucket'] },
        { at: 4.5, moment: 'm1', change: 'consume', amount: 1, after: 1, layers: ['bucket'] },
        { at: 7, moment: 'm2', change: 'add', amount: 1, after: 2, rule: 'refill', layers: ['bucket'] },
        { at: 10, moment: 'm2', change: 'add', amount: 1, after: 3, rule: 'refill', layers: ['bucket'] },
      ] as Array<Record<string, unknown>>,
    }
    change(schedule)
    return schedule
  }
  const held = { id: 'held', kind: 'caption', label: 'Clock held', moments: ['m2'] }
  const layers = [{ id: 'bucket', kind: 'object', label: 'Bucket', moments: ['m1', 'm2'], asset: { libraryKey: 'token-bucket@2' } }, held]
  const clockProblems = (schedule: unknown, plan = refillPlan()) => validateSketch(sketchOf({ manifest: { layers, schedule } }), sketchContext(plan)).problems

  it('keeps the mechanism\'s clock: the plan\'s count, a steady refill, pauses shown', () => {
    expect(clockProblems(steady())).toEqual([])
    const report = validateSketch(sketchOf({ manifest: { layers, schedule: steady() } }), sketchContext(refillPlan()))
    expect(sketchSummary(report.manifest!).schedule).toEqual({ rules: [{ id: 'refill', change: 'add', amount: 1, every: 3, from: 4 }], pauses: [], events: 4 })
    // A counted plan needs a clock.
    expect(clockProblems(undefined)).toEqual([expect.stringMatching(/^the plan counts tokens in the bucket: add manifest\.schedule/)])
    // A pause holds the clock, so the beat lands later by as long.
    const paused = steady(schedule => {
      schedule.pauses = [{ start: 5.5, end: 7, note: 'The clock holds while the refill is named', shown: 'held' }]
      schedule.events[2].at = 8.5
      schedule.events[3].at = 11.5
    })
    expect(clockProblems(paused)).toEqual([])
  })

  it('refuses a refill timed to the narration instead of its beat', () => {
    // As the live sketch did: two drops close together, where the words fell.
    const narrated = clockProblems(steady(schedule => {
      schedule.rules[0].every = 1.4
      schedule.events[2].at = 7
      schedule.events[3].at = 8.4
    })).join('\n')
    expect(narrated).toMatch(/rule refill \(adds 1 every 1\.4s from 4s\) is due at 5\.4s, with 1 of 3, but nothing lands then/)
    // A drop late for its beat, and the beat it missed.
    const late = clockProblems(steady(schedule => { schedule.events[3].at = 11 })).join('\n')
    expect(late).toMatch(/is due at 10s, with 2 of 3, but nothing lands then/)
    expect(late).toMatch(/event 4 \(add at 11s\) is made by rule refill but falls off its beat \(due at 10s\)/)
    // A steady rate runs whenever there is room.
    expect(clockProblems(steady(schedule => { schedule.rules[0].from = 5; schedule.events[2].at = 8; schedule.events[3].at = 11 }))).toEqual([expect.stringMatching(/^rule refill starts at 5s, but it could add from 4s: a steady rate runs whenever there is room/)])
    // The plan's rate needs its rule.
    expect(clockProblems(steady(schedule => { schedule.rules = []; delete schedule.events[2].rule; delete schedule.events[3].rule })).join('\n')).toMatch(/the plan's rate refill \(a drop lands as a token\) needs a rule in manifest\.schedule\.rules/)
  })

  it('holds the schedule to the plan\'s count and to its pauses', () => {
    const miscounted = clockProblems(steady(schedule => { schedule.events[1].after = 2 })).join('\n')
    expect(miscounted).toMatch(/manifest\.schedule event 2 \(consume 1 → 2 in m1\) is not the plan's change 2 \(consume 1 → 1 in m1: "request B takes a token"\)/)
    const during = clockProblems(steady(schedule => { schedule.pauses = [{ start: 6.5, end: 7.5, note: 'Held', shown: 'held' }] })).join('\n')
    expect(during).toMatch(/event 3 \(add at 7s\) happens while the clock is held \(6\.5s–7\.5s\): nothing counted happens in a pause/)
    const unexplained = clockProblems(steady(schedule => { schedule.pauses = [{ start: 3, end: 3.5, note: '', shown: 'held' }] })).join('\n')
    expect(unexplained).toMatch(/the pause from 3s to 3\.5s needs a note/)
    expect(unexplained).toMatch(/the pause from 3s to 3\.5s is shown by layer "held", which does not take part in m1/)
    expect(clockProblems(steady(schedule => { schedule.events[0].layers = [] })).join('\n')).toMatch(/event 1 \(consume at 4s\) must name the layers that show it/)
  })

  it('needs a labelled stand-in wherever the plan shows a presenter, and cast it can reuse', () => {
    const plan = goodTreatment()
    plan.moments[0].presenter = { visibility: 'full', reason: 'Introduce it' }
    expect(validateSketch(sketchOf(), sketchContext(plan)).problems.join('\n')).toMatch(/shows a presenter in m1: add a presenter layer/)
    const stranger = validateSketch(sketchOf({ manifest: { layers: [{ id: 'bucket', kind: 'object', label: 'Bucket', moments: ['m1'], asset: { libraryKey: 'not-in-library' } }] } }), sketchContext()).problems.join('\n')
    expect(stranger).toMatch(/reuses "not-in-library", which is not in the cast or the library/)
  })
})
