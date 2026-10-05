import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, expect, it, vi } from 'vitest'
import type { Outline } from '../source-outline'
const { run } = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock('../harness/runtime', () => ({ runEngineStage: run }))
const root = await mkdtemp(join(tmpdir(), 'studio-page-protocol-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'store')
const {
  pageSvgProblems,
  validatePageReceipt,
  prepareCreativePages,
  PageDrawingError,
  PAGE_ATTEMPTS
} = await import('./pages')
const { readRow, listNotebookRows } = await import('../persistence')
const { readSourceNarrative } = await import('../source-document')
const { pageBrandFrom } = await import('../source-page')
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" font-size="32" data-page-role="title" data-page-index="01"><g id="background" data-role="background"><rect width="1280" height="720" fill="#fff"/></g><g id="s01-node-title" data-role="node" data-kind="label"><text x="80" y="200">Explicit synthetic page fixture</text></g></svg>'
const outline: Outline = {
  title: 'Fixture',
  targetSeconds: 5,
  glossary: [],
  scenes: [
    {
      title: 'Fixture',
      idea: 'Synthetic fixture only',
      kind: 'title',
      seconds: 5,
      parts: [],
      relations: [],
      narration: 'Fixture speech.',
      source: []
    }
  ]
}
const files = {
  '01_fixture.svg': svg,
  '01_fixture.program.json': JSON.stringify({
    version: 1,
    page: '01_fixture.svg',
    cast: [],
    beats: [
      { id: 'b1', moment: 'establish', say: 'Fixture speech.', events: [] },
      { id: 'b2', moment: 'resolve', say: 'Fixture complete.', events: [] }
    ]
  }),
  'receipt.json': JSON.stringify({
    pages: [
      {
        index: 1,
        title: 'Fixture',
        kind: 'title',
        file: '01_fixture.svg',
        program: '01_fixture.program.json',
        form: 'definition',
        topology: 'typography',
        checks: 'pass'
      }
    ]
  }),
  'contract.md': 'Explicit fixture contract',
  'design_spec.md': 'Explicit fixture design spec',
  'spec_lock.md': 'Explicit fixture lock'
}
afterAll(() => rm(root, { recursive: true, force: true }))
it('accepts passive local SVG shapes and rejects active content or outside references', () => {
  expect(pageSvgProblems(svg)).toEqual([])
  for (const value of [
    '<script>alert(1)</script>',
    '<foreignObject><p>active</p></foreignObject>',
    '<use href="https://example.com/icon.svg"/>',
    '<rect onclick="alert(1)"/>',
    '<rect fill="url(https://example.com/art.svg)"/>'
  ])
    expect(
      pageSvgProblems(svg.replace('</svg>', value + '</svg>')).length
    ).toBeGreaterThan(0)
})
it('requires every outline page and its program to keep the same identity', () => {
  expect(validatePageReceipt(files, outline).problems).toEqual([])
  const bad = {
    ...files,
    'receipt.json': JSON.stringify({
      pages: [
        { index: 2, title: 'Different', kind: 'list', file: '01_fixture.svg' }
      ]
    })
  }
  expect(
    validatePageReceipt(
      { ...files, 'receipt.json': '{"pages":[null]}' },
      outline
    ).problems.length
  ).toBeGreaterThan(0)
  expect(validatePageReceipt(bad, outline).problems).toContain(
    'Page 1 must retain its outline identity, title and kind'
  )
  const missing = { ...files }
  delete (missing as Partial<typeof files>)['01_fixture.program.json']
  expect(validatePageReceipt(missing, outline).problems).toContain(
    'Page 1 needs its retained program'
  )
})
// A synthetic harness: writes the given files into the run's pages folder and
// submits the page the call was asked to draw.
const drawInto =
  (dir: string, pageFiles: Record<string, string>) => async (input: any) => {
    await mkdir(join(dir, 'pages'), { recursive: true })
    for (const [name, body] of Object.entries(pageFiles))
      await writeFile(join(dir, 'pages', name), body)
    const tool = input.tools(dir)[0]
    const result = await tool.call({
      projectDir: dir,
      index: JSON.parse(input.packet['packet/PROGRESS.json']).draw,
      form: 'definition',
      topology: 'typography'
    })
    if (!result.accepted) throw new Error(result.problems.join('; '))
    await input.accept(dir)
    return { status: 'done' }
  }
const page1 = {
  '01_fixture.svg': files['01_fixture.svg'],
  '01_fixture.program.json': files['01_fixture.program.json']
}
const design = {
  'contract.md': files['contract.md'],
  'design_spec.md': files['design_spec.md'],
  'spec_lock.md': files['spec_lock.md']
}
const two: Outline = {
  ...outline,
  scenes: [outline.scenes[0], { ...outline.scenes[0], title: 'Second' }]
}
const svg2 = svg
  .replace('data-page-index="01"', 'data-page-index="02"')
  .replace(/s01-/g, 's02-')
const page2 = {
  '02_second.svg': svg2,
  '02_second.program.json': files['01_fixture.program.json'].replace(
    '01_fixture.svg',
    '02_second.svg'
  )
}
it('draws the design system with page one, then each later page in a call of its own, and resumes from the accepted deck', async () => {
  run.mockReset()
  run
    .mockImplementationOnce(
      drawInto(join(root, 'design'), { ...design, ...page1 })
    )
    .mockImplementationOnce(drawInto(join(root, 'second'), page2))
  const source = readSourceNarrative('Fixture speech and supporting words.')
  const onDrawing = vi.fn(async (_indexes: number[]) => {})
  const input = {
    projectId: 'fixture',
    source,
    outline: two,
    brand: pageBrandFrom(source.palette, source.fonts),
    selection: { adapter: 'kimi' as const, model: 'fixture-model' },
    origin: 'http://fixture',
    onDrawing
  }
  expect(await prepareCreativePages(input)).toEqual([svg, svg2])
  expect(run).toHaveBeenCalledTimes(2)
  // The engine says which pages are in a call, not a guess from the counts.
  expect(onDrawing.mock.calls.map((call) => call[0])).toEqual([
    [0],
    [],
    [1],
    []
  ])
  const [first, second] = run.mock.calls.map((call) => call[0])
  expect(first).toMatchObject({ operation: 'design', route: 'Draw Pages' })
  expect(first.task).toContain('design system and its first page only')
  expect(second).toMatchObject({ operation: 'page', route: 'Draw One Page' })
  expect(second.packet['packet/retained-pages/design_spec.md']).toBe(
    design['design_spec.md']
  )
  expect(second.packet['packet/retained-pages/01_fixture.svg']).toBe(svg)
  expect(JSON.parse(second.packet['packet/PROGRESS.json'])).toMatchObject({
    draw: 2,
    pages: [
      { index: 1, status: 'drawn' },
      { index: 2, status: 'this call' }
    ]
  })
  // The accepted deck is a checkpoint: drawing it again starts nothing.
  expect(await prepareCreativePages(input)).toEqual([svg, svg2])
  expect(run).toHaveBeenCalledTimes(2)
  const attempts = await listNotebookRows('creative-page-attempts', 'fixture')
  const rows = await Promise.all(
    attempts.map((id) => readRow<any>('creative-page-attempts', id))
  )
  expect(rows.filter((row) => row.accepted)).toHaveLength(3)
})

it('retries a page that ran out of time, keeps what was drawn, and names the page when it gives up', async () => {
  run.mockReset()
  const onDraft = vi.fn(async () => {})
  const stopped = {
    status: 'error',
    failure: { category: 'interrupted', message: 'The agent ran out of time.' }
  }
  run
    .mockImplementationOnce(
      drawInto(join(root, 'p-design'), { ...design, ...page1 })
    )
    .mockResolvedValue(stopped)
  const source = readSourceNarrative('Partial fixture')
  const input = {
    projectId: 'partial',
    source,
    outline: two,
    brand: pageBrandFrom(source.palette, source.fonts),
    selection: { adapter: 'kimi' as const },
    origin: 'http://fixture',
    onDraft
  }
  const error = await prepareCreativePages(input).catch((reason) => reason)
  expect(error).toBeInstanceOf(PageDrawingError)
  expect(error).toMatchObject({ page: 2, saved: 1, total: 2 })
  // One design call, then three calls for page two.
  expect(run).toHaveBeenCalledTimes(1 + PAGE_ATTEMPTS)
  expect(run.mock.calls[2][0].task).toContain(
    'An earlier call for this page stopped'
  )
  expect(onDraft).toHaveBeenCalledWith(0, svg)
  // Try again restores page one without drawing it, and draws only page two.
  run.mockReset()
  run.mockImplementationOnce(drawInto(join(root, 'p-second'), page2))
  expect(await prepareCreativePages(input)).toEqual([svg, svg2])
  expect(run).toHaveBeenCalledOnce()
  expect(run.mock.calls[0][0].route).toBe('Draw One Page')
})

it('refuses a page that draws more than it was asked, and does not retry a stop the creator asked for', async () => {
  run.mockReset()
  run.mockImplementationOnce(async (input: any) => {
    const dir = join(root, 'greedy')
    await mkdir(join(dir, 'pages'), { recursive: true })
    for (const [name, body] of Object.entries({
      ...design,
      ...page1,
      ...page2
    }))
      await writeFile(join(dir, 'pages', name), body)
    const result = await input.tools(dir)[0].call({
      projectDir: dir,
      index: 1,
      form: 'definition',
      topology: 'typography'
    })
    expect(result.accepted).toBe(false)
    expect(result.problems).toContain('Draw only page 01; remove 02_second.svg')
    return {
      status: 'cancelled',
      failure: { category: 'interrupted', message: 'Stopped' }
    }
  })
  const source = readSourceNarrative('Greedy fixture')
  await expect(
    prepareCreativePages({
      projectId: 'greedy',
      source,
      outline: two,
      brand: pageBrandFrom(source.palette, source.fonts),
      selection: { adapter: 'kimi' },
      origin: 'http://fixture'
    })
  ).rejects.toBeInstanceOf(PageDrawingError)
  expect(run).toHaveBeenCalledOnce()
})

it('sizes a style-preserving wireframe change for its model and passes the change with its target', async () => {
  run.mockReset()
  const source = readSourceNarrative('Fixture speech and supporting words.')
  run.mockRejectedValueOnce(new Error('Bounded slide edit stopped'))
  await expect(
    prepareCreativePages({
      projectId: 'bounded-edit',
      source,
      outline,
      brand: pageBrandFrom(source.palette, source.fonts),
      selection: { adapter: 'kimi' },
      origin: 'http://fixture',
      reuseStyle: true,
      edit: {
        instruction: 'Move the label off the box',
        target: { id: 's01-edge-1', label: 'sends to', kind: 'connector' },
        svg
      }
    })
  ).rejects.toThrow('Bounded slide edit stopped')
  expect(run).toHaveBeenCalledOnce()
  const call = run.mock.calls[0][0]
  expect(call.operation).toBe('revise-page')
  expect(call.packet['packet/CURRENT_PAGE.svg']).toBe(svg)
  expect(JSON.parse(call.packet['packet/EDIT.json']).target.id).toBe(
    's01-edge-1'
  )
  expect(call.task).toContain('They pointed at “sends to” (element s01-edge-1)')
})

it('refuses page furniture, a connector label on a box and a line through a box', async () => {
  const { checkPinnedPages } = await import('./page-checks')
  const page = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" font-size="22" data-page-role="diagram" data-page-index="01">
<g data-role="background"><rect width="1280" height="720" fill="#fff"/></g>
<g data-role="header"><text x="80" y="60" font-size="20">§ 01 · FIXTURE</text><text id="s01-title" x="80" y="110" font-size="38">Fixture</text></g>
<g data-role="footer"><text x="1200" y="690" text-anchor="end" font-size="20">site · SHEET 01 / 02</text></g>
<g id="s01-node-a" data-role="node" data-kind="box"><rect x="80" y="300" width="240" height="120" fill="#eee"/><text x="100" y="360">Alpha</text></g>
<g id="s01-node-b" data-role="node" data-kind="box"><rect x="520" y="300" width="240" height="120" fill="#eee"/><text x="540" y="360">Beta</text></g>
<g id="s01-node-c" data-role="node" data-kind="box"><rect x="960" y="300" width="240" height="120" fill="#eee"/><text x="980" y="360">Gamma</text></g>
<line id="s01-edge-1" data-role="connector" data-verb="sends to" data-from="s01-node-a" data-to="s01-node-c" x1="320" y1="360" x2="960" y2="360" stroke="#000"/>
<text x="290" y="350" font-family="monospace" font-size="20">sends to</text>
<g id="s01-actor-req" data-actor="request" opacity="0"><circle cx="300" cy="360" r="14" fill="#000"/></g>
</svg>`
  const problems = await checkPinnedPages({
    '01_fixture.svg': page,
    '01_fixture.program.json': files['01_fixture.program.json'].replace(
      '01_fixture.svg',
      '01_fixture.svg'
    ),
    'design_spec.md': 'spec',
    'spec_lock.md': 'lock'
  })
  expect(problems.some((p) => p.includes('page furniture'))).toBe(true)
  expect(
    problems.some((p) =>
      p.includes("label 'sends to' sits on node 's01-node-a'")
    )
  ).toBe(true)
  expect(
    problems.some((p) =>
      p.includes("connector 's01-edge-1' runs through node 's01-node-b'")
    )
  ).toBe(true)
})
