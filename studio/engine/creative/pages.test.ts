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
  PAGE_ATTEMPTS,
  PAGE_CONCURRENCY
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
  'receipt.json': JSON.stringify({
    pages: [
      {
        index: 1,
        title: 'Fixture',
        kind: 'title',
        file: '01_fixture.svg',
        form: 'definition',
        topology: 'typography',
        checks: 'pass'
      }
    ]
  })
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
it('requires every outline page to keep its identity in the receipt', () => {
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
  const missing: Record<string, string> = { ...files }
  delete missing['01_fixture.svg']
  expect(validatePageReceipt(missing, outline).problems).toContain(
    'Missing 01_fixture.svg'
  )
})
// A synthetic harness: writes the given files into the run's pages folder and
// submits the page the call was asked to draw.
const drawInto =
  (dir: string, pageFiles: Record<string, string>, wait = 0) =>
  async (input: any) => {
    await mkdir(join(dir, 'pages'), { recursive: true })
    for (const [name, body] of Object.entries(pageFiles))
      await writeFile(join(dir, 'pages', name), body)
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
    const tool = input.tools(dir)[0]
    const result = await tool.call({
      projectDir: dir,
      index: JSON.parse(input.packet['packet/PAGE.json']).index,
      form: 'definition',
      topology: 'typography'
    })
    if (!result.accepted) throw new Error(result.problems.join('; '))
    await input.accept(dir)
    return { status: 'done' }
  }
const pageOf = (number: number, slug: string) => ({
  [`${String(number).padStart(2, '0')}_${slug}.svg`]: svg
    .replace(
      'data-page-index="01"',
      `data-page-index="${String(number).padStart(2, '0')}"`
    )
    .replace(/s01-/g, `s${String(number).padStart(2, '0')}-`)
})
const page1 = pageOf(1, 'fixture')
const page2 = pageOf(2, 'second')
const svg2 = page2['02_second.svg']
const two: Outline = {
  ...outline,
  scenes: [outline.scenes[0], { ...outline.scenes[0], title: 'Second' }]
}
const fixtureInput = (projectId: string, extra: object = {}) => {
  const source = readSourceNarrative('Fixture speech and supporting words.')
  return {
    projectId,
    source,
    outline: two,
    brand: pageBrandFrom(source.palette, source.fonts),
    selection: { adapter: 'kimi' as const, model: 'fixture-model' },
    origin: 'http://fixture',
    ...extra
  }
}

it('draws page one alone from a small packet, then each later page against it, and resumes from the accepted deck', async () => {
  run.mockReset()
  run
    .mockImplementationOnce(drawInto(join(root, 'first'), page1))
    .mockImplementationOnce(drawInto(join(root, 'second'), page2))
  const onDrawing = vi.fn(async (_indexes: number[]) => {})
  const input = fixtureInput('fixture', { onDrawing })
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
  for (const call of [first, second]) {
    expect(call).toMatchObject({ operation: 'page', route: 'Draw Page' })
    // The spec, the page and a style page: no article, outline or manuals.
    expect(Object.keys(call.packet).sort()).toEqual(
      call === first
        ? ['packet/PAGE.json', 'packet/SPEC.md']
        : ['packet/PAGE.json', 'packet/SPEC.md', 'packet/STYLE.svg']
    )
    expect(call.packet['packet/SPEC.md']).toContain(input.brand.accent)
    expect(call.packet['packet/SPEC.md']).toContain('data-icon="NAME"')
    expect(call.task).toContain('Draw Page route')
  }
  expect(second.packet['packet/STYLE.svg']).toBe(svg)
  expect(JSON.parse(second.packet['packet/PAGE.json'])).toMatchObject({
    index: 2,
    title: 'Second',
    deck: { title: 'Fixture', pages: 2, before: 'Fixture', after: null }
  })
  // The accepted deck is a checkpoint: drawing it again starts nothing.
  expect(await prepareCreativePages(input)).toEqual([svg, svg2])
  expect(run).toHaveBeenCalledTimes(2)
  const attempts = await listNotebookRows('creative-page-attempts', 'fixture')
  const rows = await Promise.all(
    attempts.map((id) => readRow<any>('creative-page-attempts', id))
  )
  // Each page was checked once, when it was submitted; no deck re-check.
  expect(rows.filter((row) => row.accepted)).toHaveLength(2)
})

it('draws the pages after the first at the same time', async () => {
  run.mockReset()
  const scenes = [1, 2, 3, 4].map((n) => ({
    ...outline.scenes[0],
    title: `Page ${n}`
  }))
  for (const n of [1, 2, 3, 4])
    run.mockImplementationOnce(
      drawInto(join(root, `wide-${n}`), pageOf(n, `page-${n}`), 30)
    )
  const onDrawing = vi.fn(async (_indexes: number[]) => {})
  const pages = await prepareCreativePages({
    ...fixtureInput('wide', { onDrawing }),
    outline: { ...outline, scenes }
  })
  expect(pages).toHaveLength(4)
  const widest = Math.max(...onDrawing.mock.calls.map((call) => call[0].length))
  expect(widest).toBe(Math.min(PAGE_CONCURRENCY, 3))
  expect(onDrawing.mock.calls[0][0]).toEqual([0])
})

it('draws named icons in on submission and refuses a name it does not know', async () => {
  run.mockReset()
  const withIcon = (name: string) =>
    svg.replace(
      '</g><g id="s01-node-title"',
      `<g data-icon="${name}" transform="translate(80 400) scale(1.8333)" fill="none" stroke="#123456" stroke-width="2"/></g><g id="s01-node-title"`
    )
  let refusal: string[] = []
  run.mockImplementationOnce(async (input: any) => {
    const dir = join(root, 'icons')
    await mkdir(join(dir, 'pages'), { recursive: true })
    const tool = input.tools(dir)[0]
    const args = { index: 1, form: 'definition', topology: 'typography' }
    await writeFile(
      join(dir, 'pages', '01_icons.svg'),
      withIcon('no-such-icon')
    )
    refusal = (await tool.call(args)).problems
    await writeFile(join(dir, 'pages', '01_icons.svg'), withIcon('server'))
    expect((await tool.call(args)).accepted).toBe(true)
    await input.accept(dir)
    return { status: 'done' }
  })
  const [page] = await prepareCreativePages({
    ...fixtureInput('icons'),
    outline
  })
  expect(refusal).toContain(
    'No icon is named “no-such-icon”; use a name from SPEC.md'
  )
  expect(page).toMatch(
    /<g data-icon="server"[^>]*stroke-linecap="round"[^>]*><path d="M3 7a3/
  )
  expect(pageSvgProblems(page)).toEqual([])
})

it('retries a page that ran out of time from its refused draft, keeps what was drawn, and names the page when it gives up', async () => {
  run.mockReset()
  const onDraft = vi.fn(async () => {})
  const stopped = {
    status: 'error',
    failure: { category: 'interrupted', message: 'The agent ran out of time.' }
  }
  const misnamed = { '02_Second.svg': svg2 }
  run
    .mockImplementationOnce(drawInto(join(root, 'p-first'), page1))
    .mockImplementationOnce(async (input: any) => {
      // A draft the studio refuses, then the call runs out of time.
      const dir = join(root, 'p-refused')
      await mkdir(join(dir, 'pages'), { recursive: true })
      for (const [name, body] of Object.entries(misnamed))
        await writeFile(join(dir, 'pages', name), body)
      const result = await input.tools(dir)[0].call({
        index: 2,
        form: 'definition',
        topology: 'typography'
      })
      expect(result.accepted).toBe(false)
      return stopped
    })
    .mockResolvedValue(stopped)
  const input = fixtureInput('partial', { onDraft })
  const error = await prepareCreativePages(input).catch((reason) => reason)
  expect(error).toBeInstanceOf(PageDrawingError)
  expect(error).toMatchObject({ page: 2, saved: 1, total: 2 })
  expect(run).toHaveBeenCalledTimes(1 + PAGE_ATTEMPTS)
  const retry = run.mock.calls[2][0]
  expect(retry.task).toContain('An earlier call for this page stopped')
  // The next call corrects the refused draft rather than starting over.
  expect(retry.packet['packet/CURRENT_PAGE.svg']).toBe(svg2)
  expect(JSON.parse(retry.packet['packet/FIX.json']).problems[0]).toContain(
    'Name the file pages/02_<slug>.svg'
  )
  expect(onDraft).toHaveBeenCalledWith(0, svg)
  // Try again restores page one without drawing it, and draws only page two.
  run.mockReset()
  run.mockImplementationOnce(drawInto(join(root, 'p-second'), page2))
  expect(await prepareCreativePages(input)).toEqual([svg, svg2])
  expect(run).toHaveBeenCalledOnce()
  expect(run.mock.calls[0][0].packet['packet/STYLE.svg']).toBe(svg)
})

it('refuses a page that draws more than it was asked, and does not retry a stop the creator asked for', async () => {
  run.mockReset()
  run.mockImplementationOnce(async (input: any) => {
    const dir = join(root, 'greedy')
    await mkdir(join(dir, 'pages'), { recursive: true })
    for (const [name, body] of Object.entries({ ...page1, ...page2 }))
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
  await expect(
    prepareCreativePages(fixtureInput('greedy'))
  ).rejects.toBeInstanceOf(PageDrawingError)
  expect(run).toHaveBeenCalledOnce()
})

it('sizes a wireframe change for its model and passes the change, its target and a page to match', async () => {
  run.mockReset()
  run.mockRejectedValueOnce(new Error('Bounded slide edit stopped'))
  await expect(
    prepareCreativePages({
      ...fixtureInput('bounded-edit'),
      outline,
      reuseStyle: true,
      style: svg2,
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
  expect(call.packet['packet/STYLE.svg']).toBe(svg2)
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
  // One page, on its own, the way it is checked when it is submitted.
  const problems = await checkPinnedPages({ '01_fixture.svg': page })
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
