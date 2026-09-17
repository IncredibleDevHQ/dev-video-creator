import { describe, expect, it } from 'vitest'
import { compileSceneProgram, programWithEdits, sanitizeSceneProgram, type SceneProgram } from './scene-program'
import type { SceneWindow } from './script-plan'
import type { SlideUnit } from './slide-atoms'

const unit = (id: string, label: string, bbox: [number, number, number, number], extra: Partial<SlideUnit> = {}): SlideUnit => ({
  id, ids: [id], kind: 'box', label, bbox: { x: bbox[0], y: bbox[1], width: bbox[2], height: bbox[3] }, chrome: false, children: [], ...extra,
})

// A page with two things and a small actor drawn beside the first.
const units: SlideUnit[] = [
  unit('node-client', 'Incoming request', [100, 300, 240, 120]),
  unit('node-bucket', 'Token bucket', [700, 300, 260, 140]),
  unit('actor-request', 'Request', [150, 340, 40, 40], { kind: 'shape', actorRole: 'request' }),
]
const viewBox = { width: 1280, height: 720 }
// The same page, with the bar the bucket's level is drawn on.
const withLevel: SlideUnit[] = [
  ...units,
  { ...unit('bucket-level', 'Level', [720, 420, 200, 12], { kind: 'shape' }) },
]

const program = (events: SceneProgram['beats'][number]['events']): SceneProgram => ({
  version: 1,
  page: 'test.svg',
  cast: [{ id: 'node-bucket', role: 'bucket', quantity: { of: 'tokens', value: 3, max: 3 } }],
  beats: [
    { id: 'b1', moment: 'establish', say: 'Two things sit on the page, and one of them holds tokens.', events: [{ actor: 'node-client', action: 'appear' }, { actor: 'node-bucket', action: 'appear' }] },
    { id: 'b2', moment: 'explain', say: 'A request arrives and takes a token from the bucket.', events },
    { id: 'b3', moment: 'consequence', say: 'When the bucket is empty the next one is turned away.', events: [{ actor: 'node-bucket', action: 'state', state: 'empty' }] },
  ],
})

const movesIn = (plan: { steps: Array<{ actions: Array<{ op: string; targets: string[]; startMs: number; value?: Record<string, number | string> }> }> }, beat: number) =>
  plan.steps[beat].actions.filter(action => action.op === 'move')

describe('the scene program', () => {
  it('moves the actor the page drew, and stops it at the edge of what it travels to', () => {
    const compiled = compileSceneProgram(program([{ actor: 'actor-request', action: 'travel', to: 'node-bucket', cue: 'arrives' }]), units, { viewBox })!
    const moves = movesIn(compiled.plan, 1)
    expect(moves).toHaveLength(1)
    expect(moves[0].targets).toContain('actor-request')
    // Centre to centre is 660 px; the actor stops short of covering the label.
    const dx = Number(moves[0].value!.dx)
    expect(dx).toBeGreaterThan(400)
    expect(dx).toBeLessThan(660 - 260 / 2)
  })

  it('never slides a labelled node: the page keeps the arrangement the reader learned', () => {
    const compiled = compileSceneProgram(program([{ actor: 'node-client', action: 'travel', to: 'node-bucket' }]), units, { viewBox })!
    expect(movesIn(compiled.plan, 1)).toHaveLength(0)
    expect(compiled.plan.steps[1].actions.map(action => action.op)).toContain('emphasize')
  })

  it('holds longest on the consequence, and says who speaks when the author said so', () => {
    const withSpeakers = program([{ actor: 'actor-request', action: 'travel', to: 'node-bucket' }])
    withSpeakers.beats[0].speaker = 'beside'
    withSpeakers.beats[2].speaker = 'page'
    const compiled = compileSceneProgram(withSpeakers, units, { viewBox })!
    expect(compiled.plan.steps[2].holdMs).toBeGreaterThan(compiled.plan.steps[1].holdMs)
    expect(compiled.windows[0].layout).toBe('beside')
    expect(compiled.windows[0].layoutByAuthor).toBe(true)
    expect(compiled.windows[1].layout).toBeUndefined()
  })

  it('rejects a request that is already standing at the door', () => {
    const compiled = compileSceneProgram(
      program([
        { actor: 'actor-request', action: 'travel', to: 'node-bucket' },
        { actor: 'actor-request', action: 'reject', to: 'node-bucket' },
      ]),
      units,
      { viewBox },
    )!
    const ops = compiled.plan.steps[1].actions.map(action => action.op)
    expect(ops).toContain('pulse')
    expect(ops).toContain('exit')
  })

  it('sends a rejected request home, so its next trip is the same journey', () => {
    const twice = program([
      { actor: 'actor-request', action: 'travel', to: 'node-bucket' },
      { actor: 'actor-request', action: 'reject', to: 'node-bucket' },
      { actor: 'actor-request', action: 'travel', to: 'node-bucket' },
    ])
    const compiled = compileSceneProgram(twice, units, { viewBox })!
    const moves = compiled.plan.steps[1].actions.filter(action => action.op === 'move')
    const net = moves.reduce((sum, action) => sum + Number(action.value!.dx), 0)
    const trips = moves.filter(action => Number(action.value!.dx) > 0)
    expect(trips).toHaveLength(2)
    expect(Number(trips[0].value!.dx)).toBe(Number(trips[1].value!.dx))
    // Two identical journeys and one trip home: the actor ends one away.
    expect(net).toBe(Number(trips[0].value!.dx))
  })

  it('shows what a thing holds as the bar the page drew, from the first frame', () => {
    const spending = program([{ actor: 'node-bucket', action: 'spend', amount: 2, cue: 'takes' }])
    spending.cast[0].quantity!.shownOn = 'bucket-level'
    const compiled = compileSceneProgram(spending, withLevel, { viewBox })!
    const opening = compiled.plan.steps[0].actions.find(action => action.op === 'level')!
    expect(opening.value).toMatchObject({ from: 1, to: 1 })
    expect(opening.startMs).toBe(0)
    const spent = compiled.plan.steps[1].actions.find(action => action.op === 'level')!
    expect(spent.value).toMatchObject({ from: 1, to: 1 / 3 })
    // The bar itself, never the node it is drawn inside.
    expect(spent.targets).toEqual(['bucket-level'])
    expect(opening.targets).toEqual(['bucket-level'])
    expect(compiled.plan.steps[1].actions.some(action => action.op === 'count')).toBe(false)
  })

  it('recomposes the page on purpose, and what moved keeps its identity', () => {
    const restaged = program([{ actor: 'actor-request', action: 'travel', to: 'node-bucket' }])
    restaged.beats[2].restage = [
      { id: 'node-bucket', grow: 1.5, to: 'right' },
      { id: 'node-client', clear: true },
    ]
    restaged.beats.push({ id: 'b4', moment: 'resolve', say: 'The bucket refills and the next call goes through.', events: [{ actor: 'actor-request', action: 'travel', to: 'node-bucket' }] })
    const compiled = compileSceneProgram(restaged, units, { viewBox })!
    const staging = compiled.plan.steps[2].actions
    expect(staging.find(action => action.op === 'resize')!.value).toMatchObject({ to: 1.5 })
    expect(staging.find(action => action.op === 'resize')!.targets).toContain('node-bucket')
    expect(staging.some(action => action.op === 'exit' && action.targets.includes('node-client'))).toBe(true)
    // The bucket moved right; the request's next trip goes to where it now
    // stands, not to where the page drew it.
    const moved = staging.find(action => action.op === 'move' && action.targets.includes('node-bucket'))!
    const firstTrip = compiled.plan.steps[1].actions.find(action => action.op === 'move')!
    const secondTrip = compiled.plan.steps[3].actions.find(action => action.op === 'move')!
    expect(Number(moved.value!.dx)).not.toBe(0)
    expect(Number(secondTrip.value!.dx)).not.toBe(Number(firstTrip.value!.dx))
  })

  it('transforms the one group that owns a thing, never its children as well', () => {
    // A node as the atomizer gives it: the group, and everything drawn inside.
    const withChildren: SlideUnit[] = [
      { ...unit('node-bucket', 'Token bucket', [700, 300, 260, 140]), ids: ['node-bucket', 'node-bucket-box', 'node-bucket-label', 'node-bucket-art'] },
      unit('actor-request', 'Request', [150, 340, 40, 40], { kind: 'shape', actorRole: 'request' }),
    ]
    const restaged = program([])
    restaged.beats[1].restage = [{ id: 'node-bucket', to: 'left', grow: 1.4 }]
    restaged.beats[2].camera = ['node-bucket']
    const compiled = compileSceneProgram(restaged, withChildren, { viewBox })!
    const moves = compiled.plan.steps[1].actions.filter(action => action.op === 'move')
    expect(moves).toHaveLength(1)
    expect(moves[0].targets).toEqual(['node-bucket'])
    const resize = compiled.plan.steps[1].actions.find(action => action.op === 'resize')!
    expect(resize.targets).toEqual(['node-bucket'])
    expect(resize.value).toMatchObject({ from: 1, to: 1.4 })
    // The bucket now sits left of centre, and the camera goes to where it is.
    const shot = compiled.plan.steps[2].actions.find(action => action.op === 'camera')!.value as Record<string, number>
    expect(shot.x + shot.width / 2).toBeLessThan(viewBox.width / 2)
    expect(shot.x).toBeGreaterThan(0)
  })

  it('measures every size from the drawing, so growing then restoring is a restore', () => {
    const sized = program([])
    sized.beats[1].restage = [{ id: 'node-bucket', grow: 1.5 }]
    sized.beats[2].restage = [{ id: 'node-bucket', grow: 1 }]
    const compiled = compileSceneProgram(sized, units, { viewBox })!
    const first = compiled.plan.steps[1].actions.find(action => action.op === 'resize')!
    const second = compiled.plan.steps[2].actions.find(action => action.op === 'resize')!
    expect(first.value).toMatchObject({ from: 1, to: 1.5 })
    expect(second.value).toMatchObject({ from: 1.5, to: 1 })
  })

  it('changes nothing when nothing was edited', () => {
    const authored = program([{ actor: 'node-bucket', action: 'spend', amount: 1, cue: 'takes' }])
    const same = authored.beats.map(beat => ({ say: beat.say, parts: [] }))
    const edited = programWithEdits(authored, same)
    expect(edited.beats.map(beat => (beat.events || []).map(event => event.action))).toEqual(
      authored.beats.map(beat => (beat.events || []).map(event => event.action)),
    )
    expect(edited.beats.map(beat => beat.moment)).toEqual(authored.beats.map(beat => beat.moment))
  })

  it('keeps a line\u2019s events when the line is rewritten from scratch', () => {
    const authored = program([{ actor: 'node-bucket', action: 'spend', amount: 1, cue: 'takes' }])
    const rewritten = authored.beats.map((beat, index) => ({
      say: index === 1 ? 'Every incoming call is charged one unit before anything else happens.' : beat.say,
      parts: [],
    }))
    const edited = programWithEdits(authored, rewritten)
    expect(edited.beats[1].events!.map(event => event.action)).toEqual(['spend'])
    expect(edited.beats[1].say).toBe(rewritten[1].say)
    expect(edited.beats[0].events!.map(event => event.action)).toEqual(['appear', 'appear'])
  })

  it('leaves a reworded line\u2019s events exactly where they were', () => {
    // Two lines about successive requests; the first is reworded so its cue
    // word now only appears in the second. Rewording is not a split.
    const authored = program([{ actor: 'node-bucket', action: 'spend', amount: 1, cue: 'takes' }])
    authored.beats[2].say = 'The next request takes the last token and the bucket is empty.'
    const reworded = authored.beats.map((beat, index) => ({
      say: index === 1 ? 'A request arrives and consumes one credit from the bucket.' : beat.say,
      parts: [],
    }))
    const edited = programWithEdits(authored, reworded)
    expect(edited.beats[1].events!.map(event => event.action)).toEqual(['spend'])
    expect(edited.beats[2].events!.map(event => event.action)).toEqual(['state'])
  })

  it('keeps the events when two lines are merged into one paragraph', () => {
    const authored = program([{ actor: 'node-bucket', action: 'spend', amount: 1, cue: 'takes' }])
    const merged: SceneWindow[] = [
      {
        say: `${authored.beats[0].say} ${authored.beats[1].say}`,
        parts: [],
      },
      { say: authored.beats[2].say, parts: [] },
    ]
    const edited = programWithEdits(authored, merged)
    expect(edited.beats).toHaveLength(2)
    // Both moments live on in the paragraph that carries both lines, each
    // keeping its own events rather than being folded into the first.
    expect(edited.beats[0].events!.map(event => event.action)).toEqual(['appear', 'appear'])
    expect(edited.beats[0].then!.map(part => part.events!.map(event => event.action))).toEqual([['spend']])
    expect(edited.beats[1].events!.map(event => event.action)).toEqual(['state'])
  })

  it('splits a line by its cues, so each half keeps what it named', () => {
    const authored = program([
      { actor: 'actor-request', action: 'travel', to: 'node-bucket', cue: 'arrives' },
      { actor: 'node-bucket', action: 'spend', amount: 1, cue: 'takes' },
    ])
    // The line cut where it was written, as pressing return mid-sentence does.
    const line = authored.beats[1].say
    const cut = line.indexOf(' and takes')
    const split: SceneWindow[] = [
      { say: authored.beats[0].say, parts: [] },
      { say: line.slice(0, cut), parts: [] },
      { say: line.slice(cut + 1), parts: [] },
      { say: authored.beats[2].say, parts: [] },
    ]
    const edited = programWithEdits(authored, split)
    const actions = edited.beats.map(beat => (beat.events || []).map(event => event.action))
    expect(actions[1]).toContain('travel')
    expect(actions[2]).toContain('spend')
    expect(actions[1]).not.toContain('spend')
  })

  it('keeps a merged moment\u2019s staging in its own place in the line', () => {
    const authored = program([{ actor: 'actor-request', action: 'travel', to: 'node-bucket', cue: 'arrives' }])
    authored.beats[2].restage = [{ id: 'node-bucket', to: 'left' }]
    authored.beats[2].camera = ['node-bucket']
    authored.beats[2].speaker = 'beside'
    const merged: SceneWindow[] = [
      { say: authored.beats[0].say, parts: [] },
      { say: `${authored.beats[1].say} ${authored.beats[2].say}`, parts: [] },
    ]
    const edited = programWithEdits(authored, merged)
    const line = edited.beats[1]
    expect(line.restage).toBeUndefined()
    expect(line.then).toHaveLength(1)
    // The later moment's own recomposition and shot stay with it, after the
    // arrival rather than before it.
    expect(line.then![0].restage).toEqual([{ id: 'node-bucket', to: 'left' }])
    expect(line.then![0].camera).toEqual(['node-bucket'])
    const compiled = compileSceneProgram(edited, units, { viewBox })!
    const ops = compiled.plan.steps[1].actions
    const travel = ops.findIndex(action => action.op === 'move' && action.targets.includes('actor-request'))
    const restaged = ops.findIndex(action => action.op === 'move' && action.targets.includes('node-bucket'))
    expect(travel).toBeGreaterThanOrEqual(0)
    expect(restaged).toBeGreaterThan(travel)
    // And its shot is taken later in the line, not at its first syllable.
    expect(ops.find(action => action.op === 'camera')!.startMs).toBeGreaterThan(0)
  })

  it('cuts one paragraph into three sentences and keeps the order', () => {
    const paragraph: SceneProgram = {
      version: 1,
      page: 'test.svg',
      cast: [{ id: 'node-bucket', role: 'bucket', quantity: { of: 'tokens', value: 3, max: 3 } }],
      beats: [
        {
          id: 'b1',
          moment: 'explain',
          say: 'A request arrives at the bucket. It spends one of the three tokens. The refill drips one back a second later.',
          events: [
            { actor: 'actor-request', action: 'travel', to: 'node-bucket', cue: 'arrives' },
            { actor: 'node-bucket', action: 'spend', amount: 1, cue: 'spends' },
            { actor: 'node-bucket', action: 'refill', amount: 1, cue: 'refill' },
          ],
        },
      ],
    }
    const sentences = paragraph.beats[0].say.split('. ').map((text, index, all) => ({
      say: index === all.length - 1 ? text : `${text}.`,
      parts: [],
    }))
    const edited = programWithEdits(paragraph, sentences)
    expect(edited.beats.map(beat => (beat.events || []).map(event => event.action))).toEqual([['travel'], ['spend'], ['refill']])
  })

  it('takes the camera choice back from the card, and leaves the events alone', () => {
    const authored = program([{ actor: 'node-bucket', action: 'spend', amount: 1 }])
    authored.beats[1].camera = ['node-bucket']
    const stay: SceneWindow[] = authored.beats.map((beat, index) => ({ say: beat.say, parts: [], ...(index === 1 ? { camera: [] } : {}) }))
    const edited = programWithEdits(authored, stay)
    expect(edited.beats[1].camera).toBe('page')
    expect(edited.beats[1].events!.map(event => event.action)).toEqual(['spend'])
  })

  it('becomes something else from where it now stands, moving one group', () => {
    const page: SlideUnit[] = [
      ...units,
      { ...unit('node-response', 'Response', [1000, 300, 200, 100]), ids: ['node-response', 'node-response-box'] },
      { ...unit('actor-request', 'Request', [150, 340, 40, 40], { kind: 'shape', actorRole: 'request' }), ids: ['actor-request', 'actor-request-dot'] },
    ]
    const becoming = program([
      { actor: 'actor-request', action: 'travel', to: 'node-bucket' },
      { actor: 'actor-request', action: 'become', to: 'node-response' },
    ])
    const compiled = compileSceneProgram(becoming, page, { viewBox })!
    const moves = compiled.plan.steps[1].actions.filter(action => action.op === 'move')
    expect(moves.every(action => action.targets.length === 1 && action.targets[0] === 'actor-request')).toBe(true)
    // Where it ends up: the response's own centre, not one journey past it.
    const travelled = moves.reduce((sum, action) => sum + Number(action.value!.dx), 0)
    const centre = 150 + 40 / 2 + travelled
    expect(Math.round(centre)).toBe(1000 + 200 / 2)
  })

  it('leaves the camera alone when a beat says nothing about it', () => {
    const quiet = program([{ actor: 'node-bucket', action: 'spend', amount: 1 }])
    quiet.beats[1].camera = ['node-bucket']
    const compiled = compileSceneProgram(quiet, units, { viewBox })!
    // The beat that asked for a close-up carries one; the next carries no
    // camera line at all, so the shot stays where the scene put it.
    expect(compiled.windows[1].camera).toEqual(['node-bucket'])
    expect(compiled.windows[2].camera).toBeUndefined()
    const edited = programWithEdits(quiet, compiled.windows)
    expect(edited.beats[1].camera).toEqual(['node-bucket'])
    expect(edited.beats[2].camera).toBeUndefined()
  })

  it('moves a named piece of the artwork a thing is wearing', () => {
    // A bucket wearing accepted artwork: the tokens and the level are pieces
    // the scene may move by name, whatever ids the drawing gave them.
    const dressed: SlideUnit[] = [
      {
        ...unit('node-bucket', 'Token bucket', [700, 300, 260, 140]),
        ids: ['node-bucket', 'ap-1234-shell', 'ap-1234-tokens', 'ap-1234-level'],
        appearance: {
          key: 'ap-1234',
          parts: { shell: 'ap-1234-shell', tokens: 'ap-1234-tokens', level: 'ap-1234-level' },
          envelope: { x: 690, y: 290, width: 280, height: 160 },
        },
      },
      unit('actor-request', 'Request', [150, 340, 40, 40], { kind: 'shape', actorRole: 'request' }),
    ]
    const wearing = program([{ actor: 'node-bucket', action: 'spend', amount: 1, cue: 'takes' }])
    wearing.cast[0].quantity!.shownOn = 'node-bucket.level'
    const compiled = compileSceneProgram(wearing, dressed, { viewBox })!
    const level = compiled.plan.steps[1].actions.find(action => action.op === 'level')!
    // The level op targets the piece inside the drawing, not the whole thing.
    expect(level.targets).toEqual(['ap-1234-level'])
    expect(level.value).toMatchObject({ from: 1, to: 2 / 3 })
  })

  it('spends the number, the bar and the tokens from one quantity', () => {
    // A bucket wearing artwork whose three tokens are separate pieces.
    const dressed: SlideUnit[] = [
      {
        ...unit('node-bucket', 'Token bucket', [700, 300, 260, 140]),
        ids: ['node-bucket', 'art-level', 'art-tokens', 'art-token-1', 'art-token-2', 'art-token-3'],
        appearance: {
          parts: {
            level: 'art-level',
            tokens: 'art-tokens',
            'tokens-1': 'art-token-1',
            'tokens-2': 'art-token-2',
            'tokens-3': 'art-token-3',
          },
        },
      },
      unit('actor-request', 'Request', [150, 340, 40, 40], { kind: 'shape', actorRole: 'request' }),
    ]
    const holding = program([{ actor: 'node-bucket', action: 'spend', amount: 2, cue: 'takes' }])
    holding.cast[0].quantity = { of: 'tokens', value: 3, max: 3, shownOn: 'node-bucket.level', counted: 'node-bucket.tokens' }
    const compiled = compileSceneProgram(holding, dressed, { viewBox })!
    const spending = compiled.plan.steps[1].actions
    // The bar drains to a third…
    expect(spending.find(action => action.op === 'level')!.value).toMatchObject({ from: 1, to: 1 / 3 })
    // …and the last two tokens leave, newest first, one after the other.
    const left = spending.filter(action => action.op === 'exit').map(action => action.targets[0])
    expect(left).toEqual(['art-token-3', 'art-token-2'])
    // Refilling brings one back, and never more than the thing can hold.
    const back = compileSceneProgram(
      { ...holding, beats: [...holding.beats, { id: 'b4', moment: 'resolve', say: 'A token drips back in.', events: [{ actor: 'node-bucket', action: 'refill', amount: 1, cue: 'drips' }] }] },
      dressed,
      { viewBox },
    )!
    const returned = back.plan.steps[3].actions.filter(action => action.op === 'reveal').map(action => action.targets[0])
    expect(returned).toEqual(['art-token-2'])
  })

  it('lets the artwork answer the event that happened to it', () => {
    const dressed: SlideUnit[] = [
      {
        ...unit('node-server', 'Server', [700, 300, 260, 140]),
        ids: ['node-server', 'art-indicator'],
        appearance: { parts: { indicator: 'art-indicator' } },
      },
      unit('actor-request', 'Request', [150, 340, 40, 40], { kind: 'shape', actorRole: 'request' }),
    ]
    const working = program([{ actor: 'actor-request', action: 'pass', to: 'node-server', cue: 'through' }])
    working.cast = [{ id: 'node-server', role: 'server', shows: { pass: 'node-server.indicator' } }]
    const compiled = compileSceneProgram(working, dressed, { viewBox })!
    // Nothing reacts for the request; the server's own indicator lights.
    const lit = compiled.plan.steps[1].actions.find(action => action.targets[0] === 'art-indicator')
    expect(lit).toBeUndefined()
    const onServer = compileSceneProgram(
      { ...working, beats: working.beats.map((beat, index) => (index === 1 ? { ...beat, events: [{ actor: 'node-server', action: 'pass', to: 'node-server', cue: 'through' }] } : beat)) },
      dressed,
      { viewBox },
    )!
    const played = onServer.plan.steps[1].actions.find(action => action.targets[0] === 'art-indicator')!
    // Its own behaviour, seeked from the scene's clock rather than played.
    expect(played.op).toBe('clip')
    expect(played.value).toMatchObject({ from: 0 })
  })

  // ——— An author's own timing ———
  it('lands an event later when the author nudged it, without moving the words', () => {
    const plain = compileSceneProgram(program([{ actor: 'actor-request', action: 'travel', to: 'node-bucket', cue: 'takes' }]), units, { viewBox })!
    const nudged = compileSceneProgram(program([{ actor: 'actor-request', action: 'travel', to: 'node-bucket', cue: 'takes', nudgeMs: 600 }]), units, { viewBox })!
    const at = (compiled: typeof plain) => movesIn(compiled.plan, 1)[0].startMs
    expect(at(nudged) - at(plain)).toBe(600)
    // The line itself is untouched: same words, same window.
    expect(nudged.windows[1].say).toBe(plain.windows[1].say)
  })

  it("keeps an author's nudge when the line it was cued from is rewritten", () => {
    const authored = sanitizeSceneProgram(program([{ actor: 'actor-request', action: 'travel', to: 'node-bucket', cue: 'takes', nudgeMs: -400 }]), units)!
    const windows: SceneWindow[] = authored.beats.map(beat => ({ say: beat.say, parts: [] }))
    windows[1] = { ...windows[1], say: 'A request turns up and takes a token from the bucket.' }
    const edited = programWithEdits(authored, windows)
    const carried = edited.beats[1].events!.find(event => event.action === 'travel')!
    expect(carried.nudgeMs).toBe(-400)
    expect(carried.id).toBe(authored.beats[1].events![0].id)
  })

  it('names every event and refuses a nudge past four seconds', () => {
    const clean = sanitizeSceneProgram(program([{ actor: 'actor-request', action: 'travel', to: 'node-bucket', nudgeMs: 99_000 }]), units)!
    const event = clean.beats[1].events![0]
    expect(event.id).toBeTruthy()
    expect(event.nudgeMs).toBe(4000)
    // Every event on the page can be spoken of by name.
    expect(clean.beats.flatMap(beat => beat.events || []).every(one => Boolean(one.id))).toBe(true)
  })

  it('keeps a binding to a drawn object before the drawing has arrived', () => {
    // The page asked to be drawn as a slot pool and bound its quantity to that
    // object's own piece. Nothing is drawn yet; the binding must survive until
    // it is, or the wireframe stage quietly rewrites what the author meant.
    const asking: SlideUnit[] = [
      { ...unit('node-pool', 'Slot pool', [700, 300, 260, 140]), objectName: 'slot-pool' },
      unit('actor-request', 'Request', [150, 340, 40, 40], { kind: 'shape', actorRole: 'request' }),
    ]
    const authored = program([{ actor: 'node-pool', action: 'spend', amount: 1, cue: 'takes' }])
    authored.cast = [{ id: 'node-pool', role: 'pool', quantity: { of: 'slots', value: 4, max: 4, shownOn: 'node-pool.occupied' }, shows: { pass: 'node-pool.gate' } }]
    const clean = sanitizeSceneProgram(authored, asking)!
    expect(clean.cast[0].quantity!.shownOn).toBe('node-pool.occupied')
    expect(clean.cast[0].shows!.pass).toBe('node-pool.gate')
    // A thing that asked for nothing keeps the old rule: a piece it does not
    // have is not a name.
    const plain = sanitizeSceneProgram(authored, [unit('node-pool', 'Slot pool', [700, 300, 260, 140]), asking[1]])!
    expect(plain.cast[0].quantity!.shownOn).toBeUndefined()
  })

  it('refuses ids the page does not have', () => {
    const raw = program([{ actor: 'ghost', action: 'travel', to: 'node-bucket' }])
    const clean = sanitizeSceneProgram(raw, units)
    expect(clean!.beats[1].events).toHaveLength(0)
  })
})
