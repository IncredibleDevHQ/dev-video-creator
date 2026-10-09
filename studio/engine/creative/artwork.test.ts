import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import type { SceneTreatmentV1 } from './scene-treatment'

// Storage in memory; the provider is a local server answering from a queue.
// Nothing leaves the machine, and the key is a placeholder.
const rows = new Map<string, unknown>()
const assets = new Map<string, Buffer>()
vi.mock('../persistence', () => ({
  readRow: async (table: string, id: string) => rows.get(`${table}/${id}`),
  writeRow: async (table: string, id: string, row: unknown) => {
    rows.set(`${table}/${id}`, row)
  },
  storeAsset: async (input: { body: Buffer }) => {
    const objectKey = `art-${assets.size + 1}.svg`
    assets.set(objectKey, input.body)
    return { objectKey }
  },
  readAsset: async (key: string) => assets.get(key)!
}))
const {
  artworkPacket,
  artworkPrompt,
  drawSceneArtwork,
  inlineArtwork,
  objectsToDraw,
  safeSvg,
  scopeIds
} = await import('./artwork')
const { normalizeTreatment } = await import('./treatment-normalize')
const { validateTreatment } = await import('./scene-treatment')

const gauge = {
  entity: 'rate-limiter',
  role: 'A per-user rate limiter',
  appearance: 'A gauge on a short pipe with a valve gate',
  performance: 'closes its gate when a user goes over the limit',
  asset: { status: 'generate' as const, reason: 'The viewer watches it act' },
  parts: [
    { id: 'needle', what: 'the gauge needle' },
    { id: 'gate', what: 'the valve gate' }
  ]
}
const treatment = {
  objects: [
    gauge,
    { ...gauge, entity: 'dots', asset: { status: 'native' as const } }
  ],
  treatments: {
    presenter: '',
    text: 'Paper ground, ink #1f2328, accent #3a5fcd',
    camera: ''
  }
} as unknown as SceneTreatmentV1
const plain = '<svg viewBox="0 0 480 360"><path d="M0 0h10"/></svg>'
const grouped =
  '<svg viewBox="0 0 480 360"><g id="needle"><path d="M0 0h10"/></g><g id="gate"><path d="M1 1h2"/></g></svg>'

const answers: Array<{ status: number; body: unknown }> = []
const received: Array<{ path: string; authorization?: string; body: string }> =
  []
const answer = (status: number, body: unknown) => answers.push({ status, body })
const drawing = (svg: string) => answer(200, { data: [{ svg }] })
// Answers for the request whose body says this, whatever order they come in.
const routes: Array<{ says: string; svg: string }> = []
const route = (says: string, svg: string) => routes.push({ says, svg })
const provider = createServer((request, response) => {
  let body = ''
  request.on('data', (chunk) => (body += chunk))
  request.on('end', () => {
    received.push({
      path: request.url || '',
      authorization: request.headers.authorization,
      body
    })
    const routed = routes.findIndex((item) => body.includes(item.says))
    // An animation, as Quiver's: the drawing given, with a loop in a
    // <style> on its first group (and a colour, which is not kept).
    const animate = () =>
      Buffer.from(JSON.parse(body).svg_source.base64, 'base64')
        .toString()
        .replace(
          /<svg\b[^>]*>/,
          (open) =>
            `${open}<style>@keyframes breathe { 50% { transform: scale(1.04); fill: red } } .breathe { transform-origin: 5px 5px; animation: breathe 3s ease-in-out infinite; fill: red }</style>`
        )
        .replace('<g ', '<g class="breathe" ')
    const next =
      routed >= 0
        ? {
            status: 200,
            body: { data: [{ svg: routes.splice(routed, 1)[0].svg }] }
          }
        : request.url === '/v1/svgs/animations'
          ? { status: 200, body: { data: [{ svg: animate() }] } }
          : answers.shift() || { status: 500, body: { code: 'none' } }
    response.writeHead(next.status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(next.body))
  })
})
beforeAll(async () => {
  await new Promise<void>((resolve) => provider.listen(0, '127.0.0.1', resolve))
  const { port } = provider.address() as AddressInfo
  process.env.QUIVER_BASE_URL = `http://127.0.0.1:${port}`
})
afterAll(() => {
  provider.close()
  delete process.env.QUIVER_BASE_URL
  delete process.env.QUIVER_API_KEY
})
beforeEach(() => {
  rows.clear()
  assets.clear()
  answers.length = 0
  routes.length = 0
  received.length = 0
  process.env.QUIVER_API_KEY = 'test-key'
})

it('draws the main actors the plan names, by their parts, in the scene’s look', () => {
  expect(objectsToDraw(treatment).map((object) => object.entity)).toEqual([
    'rate-limiter'
  ])
  const prompt = artworkPrompt(gauge, treatment.treatments.text)
  expect(prompt).toContain('A gauge on a short pipe with a valve gate')
  expect(prompt).toContain('accent #3a5fcd')
  expect(prompt).toContain(
    'id "needle": the gauge needle; id "gate": the valve gate.'
  )
  expect(prompt).toContain('No text, numbers or letters')
  // Alone and at rest: the scene draws what it acts on, and animates it.
  expect(prompt).toContain('Draw this one object alone')
  expect(prompt).not.toContain('closes its gate')
})

it('keeps only drawing: no scripts, foreign content, images, handlers or outside links', () => {
  const svg = safeSvg(
    '<?xml version="1.0"?><svg onload="x()"><script>alert(1)</script><foreignObject><div/></foreignObject><image href="http://x/y.png"/><use href="#a"/><a href="https://x">k</a><g id="a"/></svg>'
  )
  expect(svg).toBe('<svg><use href="#a"/><a>k</a><g id="a"/></svg>')
  expect(() => safeSvg('<div>not a drawing</div>')).toThrow('not an SVG')
  // A credit comment or metadata would be an outside link in the production.
  expect(
    safeSvg(
      '<svg><!-- SVG created by a tool (https://x.example) --><metadata><rdf>https://x.example</rdf></metadata><path d="M0 0"/></svg>'
    )
  ).toBe('<svg><path d="M0 0"/></svg>')
  // Motion is the scene's, on its seekable timeline.
  expect(
    safeSvg(
      '<svg><g id="n"><animateTransform attributeName="transform" dur="2s"/><path d="M0 0"/><animate attributeName="opacity">x</animate><set to="1"/></g></svg>'
    )
  ).toBe('<svg><g id="n"><path d="M0 0"/></g></svg>')
})

it('drops the motion a drawing brings, so only the scene’s timeline moves it', () => {
  expect(
    safeSvg(
      '<svg><style>@keyframes qv-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.01); } } .qv-breathe { transform-origin: 2px 3px; animation: qv-breathe 8s infinite; } .lit{fill:#3a5fcd;transition:fill 1s}</style><g class="qv-breathe" style="animation-delay: 1s; opacity: .9"/></svg>'
    )
  ).toBe(
    '<svg><style> .qv-breathe { transform-origin: 2px 3px; } .lit{fill:#3a5fcd;}</style><g class="qv-breathe" style="opacity: .9"/></svg>'
  )
})

it('names a drawing’s own ids after its object, so two drawings in one page never share a gradient', () => {
  const svg =
    '<svg><defs><linearGradient id="paint0"/><filter id="f"/></defs><g id="needle" filter="url(#f)"><path fill="url(#paint0)" data-id="x"/><use xlink:href="#paint0"/></g></svg>'
  expect(scopeIds(svg, 'rate-limiter', ['needle'])).toBe(
    '<svg><defs><linearGradient id="rate-limiter-paint0"/><filter id="rate-limiter-f"/></defs><g id="needle" filter="url(#rate-limiter-f)"><path fill="url(#rate-limiter-paint0)" data-id="x"/><use xlink:href="#rate-limiter-paint0"/></g></svg>'
  )
  // So do the classes its styles define; other class names are left alone.
  expect(
    scopeIds(
      '<svg><style>.lit{fill:#3a5fcd;opacity:0.5}</style><g class="lit glow"/></svg>',
      'api',
      []
    )
  ).toBe(
    '<svg><style>.api-lit{fill:#3a5fcd;opacity:0.5}</style><g class="api-lit glow"/></svg>'
  )
})

it('asks once to group the parts that came back unnamed, then keeps the drawing', async () => {
  drawing(plain)
  drawing(grouped)
  const progress: string[] = []
  const drawn = await drawSceneArtwork({
    projectId: 'p',
    sceneId: 's',
    treatment,
    onProgress: (message) => progress.push(message)
  })
  expect(received.map((call) => call.path)).toEqual([
    '/v1/svgs/generations',
    '/v1/svgs/edits',
    '/v1/svgs/animations'
  ])
  // The key travels in the header only.
  expect(received[0].authorization).toBe('Bearer test-key')
  expect(received[0].body).not.toContain('test-key')
  expect(drawn).toEqual([
    {
      entity: 'rate-limiter',
      file: 'assets/generated-rate-limiter/asset.svg',
      parts: ['needle', 'gate'],
      missing: [],
      objectKey: 'art-1.svg',
      idle: { objectKey: 'art-2.svg' }
    }
  ])
  expect(progress).toEqual([
    "Drawing the scene's objects (0 of 1)",
    "Drawing the scene's objects (1 of 1)",
    'Bringing the objects to life (0 of 1)',
    'Bringing the objects to life (1 of 1)'
  ])
  // The same plan draws nothing new.
  received.length = 0
  expect(
    await drawSceneArtwork({ projectId: 'p', sceneId: 's', treatment })
  ).toEqual(drawn)
  expect(received).toEqual([])
  const packet = await artworkPacket(drawn)
  // Its idle loop is in it: motion only, named for the object, finite, on
  // a wrapper around the part it moves.
  const alive =
    packet['packet/assets/generated-rate-limiter/asset.svg'].toString()
  expect(alive).toContain(
    '<style data-idle-loop="">@keyframes rate-limiter-breathe { 50% { transform: scale(1.04); } }'
  )
  expect(alive).toContain(
    '.rate-limiter-breathe { transform-origin: 5px 5px; animation: rate-limiter-breathe 3s ease-in-out 999; }'
  )
  expect(alive).not.toContain('fill: red')
  expect(alive).toContain(
    '<g class="rate-limiter-breathe" data-idle=""><g id="needle" data-part="needle"><path d="M0 0h10"/></g></g><g id="gate" data-part="gate">'
  )
  const manifest = JSON.parse(packet['packet/ARTWORK.json'].toString())
  expect(manifest.objects).toEqual([
    {
      entity: 'rate-limiter',
      file: 'assets/generated-rate-limiter/asset.svg',
      libraryKey: 'generated-rate-limiter',
      place: '<div data-artwork="rate-limiter"></div>',
      viewBox: '0 0 480 360',
      parts: ['needle', 'gate'],
      missing: [],
      idle: 'its own loop, in the drawing'
    }
  ])
  expect(manifest.rule).toContain('[data-part="PART"]')
  expect(manifest.rule).toContain('alive by itself')
})

it('puts each drawing into its empty placeholder, sized to fill it, and leaves the rest', () => {
  const drawings = {
    gauge: '<svg width="74" height="58"><g data-part="needle"/></svg>',
    queue: '<svg viewBox="0 0 480 360" width="480"><path d="M0 0"/></svg>'
  }
  const page =
    '<div id="a" class="art" data-artwork="gauge"> </div><div data-artwork="queue"></div><div data-artwork="queue"><svg>kept</svg></div><div data-artwork="other"></div>'
  const once = inlineArtwork(page, drawings)
  expect(once.placed).toEqual(['gauge', 'queue'])
  expect(once.html).toBe(
    '<div id="a" class="art" data-artwork="gauge"><svg viewBox="0 0 74 58" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><g data-part="needle"/></svg></div>' +
      '<div data-artwork="queue"><svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 480 360"><path d="M0 0"/></svg></div>' +
      '<div data-artwork="queue"><svg>kept</svg></div><div data-artwork="other"></div>'
  )
  // A page already holding its drawings is left as it is.
  expect(inlineArtwork(once.html, drawings)).toEqual({
    html: once.html,
    placed: []
  })
})

it('finds parts under the ids a drawing gave them, and draws each object alone', async () => {
  drawing(
    '<svg><defs><linearGradient id="paint0"/></defs><g id="Needle_1"><path fill="url(#paint0)"/></g><g id="rate-limiter-gate--part-1"/><g id="rate-limiter-gate--part-2"/><g id="gauge-shadow"/></svg>'
  )
  const [drawn] = await drawSceneArtwork({
    projectId: 'p',
    sceneId: 's',
    treatment
  })
  // Both parts were found, so no second request regrouped them.
  expect(received.map((call) => call.path)).not.toContain('/v1/svgs/edits')
  expect(drawn).toMatchObject({ parts: ['needle', 'gate'], missing: [] })
  expect(JSON.parse(received[0].body).prompt).toContain(
    'Draw this one object alone'
  )
  // Scoped and marked as found, inside the loop's wrapper.
  const svg = (await artworkPacket([drawn]))[
    'packet/assets/generated-rate-limiter/asset.svg'
  ].toString()
  expect(svg).toContain(
    '<defs><linearGradient id="rate-limiter-paint0"/></defs><g class="rate-limiter-breathe" data-idle=""><g id="rate-limiter-Needle_1" data-part="needle"><path fill="url(#rate-limiter-paint0)"/></g></g><g id="rate-limiter-gate--part-1" data-part="gate"/><g id="rate-limiter-gate--part-2" data-part="gate"/><g id="rate-limiter-gauge-shadow"/></svg>'
  )
})

it('cleans a kept drawing again when it goes into a packet', async () => {
  assets.set(
    'kept.svg',
    Buffer.from(
      '<svg><style>@keyframes a { to { opacity: 0 } } .b { animation: a 1s }</style><g id="gate" class="b"/></svg>'
    )
  )
  const packet = await artworkPacket([
    {
      entity: 'gate',
      file: 'assets/generated-gate/asset.svg',
      parts: ['gate'],
      missing: [],
      objectKey: 'kept.svg'
    }
  ])
  expect(packet['packet/assets/generated-gate/asset.svg'].toString()).toBe(
    '<svg><style> .gate-b { }</style><g id="gate" class="gate-b"/></svg>'
  )
})

it('reports an object it could not draw, and draws nothing without a key', async () => {
  answer(402, { code: 'quota', message: 'No credits' })
  const [failed] = await drawSceneArtwork({
    projectId: 'p',
    sceneId: 's',
    treatment
  })
  expect(failed.error).toBe('Quiver answered 402: quota · No credits')
  expect(
    JSON.parse(
      (await artworkPacket([failed]))['packet/ARTWORK.json'].toString()
    ).objects[0]
  ).toMatchObject({
    entity: 'rate-limiter',
    error: 'Quiver answered 402: quota · No credits'
  })
  delete process.env.QUIVER_API_KEY
  received.length = 0
  expect(
    await drawSceneArtwork({ projectId: 'p', sceneId: 's', treatment })
  ).toEqual([])
  expect(received).toEqual([])
})

it('keeps the parts a plan names for a drawn object', () => {
  const plan = normalizeTreatment({
    objects: [
      { ...gauge, parts: [...gauge.parts, { id: '', what: 'dropped' }] }
    ]
  })
  expect(plan.objects[0].parts).toEqual(gauge.parts)
})

it('asks a plan for its drawn parts only when a provider draws them', () => {
  const drawn = (entity: string, ids: string[]) => ({
    ...gauge,
    entity,
    parts: ids.map((id) => ({ id, what: `the ${id}` }))
  })
  const context = {
    brief: { purpose: {}, units: [], evidence: [], coverage: [], entities: [] },
    scene: 's',
    originScenes: [],
    videoScenes: [],
    catalog: { entries: [] },
    bundleSkills: [],
    bundleReferences: [],
    delivery: null,
    assetKeys: []
  }
  const objects = [
    drawn('rate-limiter', ['gate', 'needle']),
    drawn('load-shedder', ['gate']),
    drawn('queue', [])
  ]
  const partProblems = (drawsArtwork: boolean) =>
    validateTreatment({ objects }, {
      ...context,
      ...(drawsArtwork ? { drawsArtwork: true } : {})
    } as never).problems.filter((problem) => problem.includes('part'))
  // The drawings share one page, so a part id names one part in it.
  expect(partProblems(true)).toEqual([
    'part "gate" is named by both rate-limiter and load-shedder: give each drawn part its own id',
    'object queue is drawn for the scene: name the parts its moments move in parts, so the drawing separates them'
  ])
  // Without a provider nothing is drawn, so nothing more is asked.
  expect(partProblems(false)).toEqual([])
})

const posing = {
  ...treatment,
  objects: [
    {
      ...gauge,
      poses: [
        { id: 'shut', what: 'the valve gate closed across the pipe' },
        { id: 'limit', what: 'the needle at the limit' }
      ]
    }
  ]
} as unknown as SceneTreatmentV1
const marked =
  '<svg viewBox="0 0 480 360"><g id="needle" data-part="needle"><path d="M0 0h10"/></g><g id="gate" data-part="gate"><path d="M1 1h2"/></g></svg>'

it('draws each pose from the drawing, asks again once when it cannot tween, and keeps it', async () => {
  drawing(grouped)
  route(
    'valve gate closed',
    grouped.replace('<g id="gate">', '<g id="gate" transform="rotate(90 1 1)">')
  )
  route(
    'needle at the limit',
    grouped.replace('</svg>', '<circle r="1"/></svg>')
  )
  route(
    'needle at the limit',
    grouped.replace(
      '<g id="needle">',
      '<g id="needle" transform="rotate(40 0 0)">'
    )
  )
  const progress: string[] = []
  const [drawn] = await drawSceneArtwork({
    projectId: 'p',
    sceneId: 's',
    treatment: posing,
    onProgress: (message) => progress.push(message)
  })
  const edits = received
    .filter((call) => call.path === '/v1/svgs/edits')
    .map((call) => JSON.parse(call.body))
  expect(edits).toHaveLength(3)
  // Each pose is an edit of the drawing itself, asked for as a keyframe.
  expect(edits[0]).toMatchObject({
    model: 'arrow-2',
    max_review_steps: 2,
    reasoning_effort: 'medium'
  })
  for (const edit of edits)
    expect(Buffer.from(edit.svg_source.base64, 'base64').toString()).toBe(
      marked
    )
  expect(edits[0].prompt).toContain('Keep every element')
  // The second ask says why the first could not be tweened.
  expect(
    edits.find((edit) => edit.prompt.includes('could not be tweened')).prompt
  ).toContain(
    'it has 6 elements where the drawing has 5: it added or removed shapes'
  )
  expect(drawn.poses).toEqual([
    {
      id: 'shut',
      what: 'the valve gate closed across the pipe',
      objectKey: expect.any(String)
    },
    {
      id: 'limit',
      what: 'the needle at the limit',
      objectKey: expect.any(String)
    }
  ])
  // Its two poses and its idle loop.
  expect(progress.slice(-1)).toEqual(['Bringing the objects to life (3 of 3)'])
  // The same plan asks for nothing again.
  received.length = 0
  const [again] = await drawSceneArtwork({
    projectId: 'p',
    sceneId: 's',
    treatment: posing
  })
  expect(received).toEqual([])
  expect(again.poses).toEqual(drawn.poses)
  // The packet puts each pose on the drawing and says how to play it.
  const packet = await artworkPacket([drawn])
  expect(
    packet['packet/assets/generated-rate-limiter/asset.svg'].toString()
  ).toContain(
    '<g id="gate" data-part="gate" transform="rotate(0 1 1)" data-posed="" data-pose-shut="{&quot;attr&quot;:{&quot;transform&quot;:&quot;rotate(90 1 1)&quot;}}">'
  )
  const manifest = JSON.parse(packet['packet/ARTWORK.json'].toString())
  expect(manifest.objects[0].poses).toEqual([
    {
      id: 'shut',
      what: 'the valve gate closed across the pipe',
      moves: ['gate'],
      motion: 'smooth'
    },
    {
      id: 'limit',
      what: 'the needle at the limit',
      moves: ['needle'],
      motion: 'smooth'
    }
  ])
  expect(manifest.rule).toContain('artworkPose(tl, ENTITY, POSE, at, seconds)')
})

it('keeps a pose’s error when it cannot be tweened twice, and offers no player', async () => {
  drawing(grouped)
  route('valve gate closed', grouped.replace('</svg>', '<circle r="1"/></svg>'))
  route('valve gate closed', grouped.replace('0 0 480 360', '0 0 10 10'))
  const one = {
    ...posing,
    objects: [{ ...gauge, poses: [posing.objects[0].poses![0]] }]
  } as unknown as SceneTreatmentV1
  const [drawn] = await drawSceneArtwork({
    projectId: 'p',
    sceneId: 's',
    treatment: one
  })
  const error =
    'The pose could not be tweened from the drawing: it changed the viewBox'
  expect(drawn.poses).toEqual([
    { id: 'shut', what: 'the valve gate closed across the pipe', error }
  ])
  const manifest = JSON.parse(
    (await artworkPacket([drawn]))['packet/ARTWORK.json'].toString()
  )
  expect(manifest.objects[0].poses).toEqual([
    { id: 'shut', what: 'the valve gate closed across the pipe', error }
  ])
  expect(manifest.rule).not.toContain('artworkPose')
})

it('keeps a drawn object’s poses, a few and plainly named', () => {
  const plan = normalizeTreatment({
    objects: [
      {
        ...gauge,
        poses: [
          { id: 'shut', what: 'the gate closed' },
          { id: '', what: 'dropped' }
        ]
      }
    ]
  })
  expect(plan.objects[0].poses).toEqual([
    { id: 'shut', what: 'the gate closed' }
  ])
  const context = {
    brief: { purpose: {}, units: [], evidence: [], coverage: [], entities: [] },
    scene: 's',
    originScenes: [],
    videoScenes: [],
    catalog: { entries: [] },
    bundleSkills: [],
    bundleReferences: [],
    delivery: null,
    assetKeys: [],
    drawsArtwork: true
  }
  const poses = ['rest', 'Shut', 'open', 'open'].map((id) => ({
    id,
    what: `the gate ${id}`
  }))
  expect(
    validateTreatment(
      { objects: [{ ...gauge, poses }] },
      context as never
    ).problems.filter((problem) => problem.includes(' pose'))
  ).toEqual([
    'object rate-limiter names 4 poses: keep the three its moments need most',
    'object rate-limiter names pose "open" twice',
    'object rate-limiter pose "Shut" must be a lowercase id (letters, digits, hyphens)',
    'object rate-limiter names a pose "rest", which is the drawing as drawn: name the pose for the state it shows'
  ])
})
