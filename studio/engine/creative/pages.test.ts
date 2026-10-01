import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, expect, it, vi } from 'vitest'
import type { Outline } from '../source'
const { run } = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock('../harness/runtime', () => ({ runEngineStage: run }))
const root = await mkdtemp(join(tmpdir(), 'studio-page-protocol-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'store')
const { pageSvgProblems, validatePageReceipt, prepareCreativePages } =
  await import('./pages')
const { readRow, listNotebookRows } = await import('../persistence')
const { readSourceNarrative, pageBrandFrom } = await import('../source')
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
it('runs the pinned checker, archives the designed deck and resumes from its accepted objects', async () => {
  run.mockImplementation(async (input) => {
    const dir = join(root, 'run')
    await mkdir(join(dir, 'pages'), { recursive: true })
    for (const [name, body] of Object.entries(files))
      await writeFile(join(dir, 'pages', name), body)
    const result = await input.tools(dir)[0].call({ projectDir: dir })
    expect(result).toEqual({ accepted: true })
    return { status: 'done' }
  })
  const source = readSourceNarrative('Fixture speech and supporting words.')
  const input = {
    projectId: 'fixture',
    source,
    outline,
    brand: pageBrandFrom(source.palette, source.fonts),
    selection: { adapter: 'kimi' as const, model: 'fixture-model' },
    origin: 'http://fixture'
  }
  expect(await prepareCreativePages(input)).toEqual([svg])
  expect(await prepareCreativePages(input)).toEqual([svg])
  expect(run).toHaveBeenCalledOnce()
  const attempts = await listNotebookRows('creative-page-attempts', 'fixture')
  expect(attempts).toHaveLength(1)
  expect(
    (await readRow<any>('creative-page-attempts', attempts[0])).accepted
  ).toBe(true)
})

it('publishes stable safe candidates before deck acceptance and does not repeat them', async () => {
  const onDraft = vi.fn(async () => {})
  run.mockImplementationOnce(async (input) => {
    const dir = join(root, 'partial')
    await mkdir(join(dir, 'pages'), { recursive: true })
    await writeFile(join(dir, 'pages', '01_fixture.svg'), svg)
    await input.observe(dir)
    expect(onDraft).not.toHaveBeenCalled()
    await input.observe(dir)
    expect(onDraft).toHaveBeenCalledWith(0, svg)
    await input.observe(dir)
    expect(onDraft).toHaveBeenCalledOnce()
    await writeFile(
      join(dir, 'pages', '01_fixture.program.json'),
      files['01_fixture.program.json']
    )
    await input.observe(dir)
    expect(onDraft).toHaveBeenCalledOnce()
    return { status: 'error', failure: { message: 'Stopped' } }
  })
  const source = readSourceNarrative('Partial fixture')
  await expect(
    prepareCreativePages({
      projectId: 'partial',
      source,
      outline,
      brand: pageBrandFrom(source.palette, source.fonts),
      selection: { adapter: 'kimi' },
      origin: 'http://fixture',
      onDraft
    })
  ).rejects.toThrow('Stopped')
  expect(onDraft).toHaveBeenCalledOnce()
  run.mockImplementationOnce(async (input) => {
    expect(onDraft).toHaveBeenCalledTimes(2)
    expect(input.packet['packet/retained-pages/01_fixture.svg']).toBe(svg)
    expect(input.packet['packet/retained-pages/01_fixture.program.json']).toBe(
      files['01_fixture.program.json']
    )
    expect(input.task).toContain('continue the unfinished deck')
    return {
      status: 'error',
      failure: { message: 'Explicit retry fixture stopped' }
    }
  })
  await expect(
    prepareCreativePages({
      projectId: 'partial',
      source,
      outline,
      brand: pageBrandFrom(source.palette, source.fonts),
      selection: { adapter: 'kimi' },
      origin: 'http://fixture',
      onDraft
    })
  ).rejects.toThrow('Explicit retry fixture stopped')
})

it('saves a page pair immediately through the draft tool without accepting the deck', async () => {
  const onDraft = vi.fn(async () => {})
  run.mockImplementationOnce(async (input) => {
    const dir = join(root, 'explicit-draft')
    await mkdir(join(dir, 'pages'), { recursive: true })
    const tool = input
      .tools(dir)
      .find((tool: any) => tool.name === 'pages_save_draft')
    expect(tool.completesRun).toBeUndefined()
    expect(JSON.parse(input.packet['packet/PROGRESS.json']).next).toBe(1)
    await expect(tool.call({ index: 99 })).rejects.toThrow('outline page index')
    await writeFile(join(dir, 'pages', '01_fixture.svg'), svg)
    expect((await tool.call({ index: 1 })).saved).toBe(false)
    expect(onDraft).not.toHaveBeenCalled()
    await writeFile(
      join(dir, 'pages', '01_fixture.program.json'),
      files['01_fixture.program.json']
    )
    expect(await tool.call({ index: 1 })).toMatchObject({
      saved: true,
      index: 1
    })
    expect(onDraft).toHaveBeenCalledWith(0, svg)
    await tool.call({ index: 1 })
    expect(onDraft).toHaveBeenCalledOnce()
    expect(
      await listNotebookRows('creative-page-attempts', 'explicit-draft')
    ).toHaveLength(0)
    return {
      status: 'error',
      failure: { message: 'Fixture stopped after one draft' }
    }
  })
  const source = readSourceNarrative('Explicit draft fixture'),
    input = {
      projectId: 'explicit-draft',
      source,
      outline,
      brand: pageBrandFrom(source.palette, source.fonts),
      selection: { adapter: 'kimi' as const },
      origin: 'http://fixture',
      onDraft
    }
  await expect(prepareCreativePages(input)).rejects.toThrow(
    'Fixture stopped after one draft'
  )
  run.mockImplementationOnce(async (input) => {
    expect(JSON.parse(input.packet['packet/PROGRESS.json'])).toMatchObject({
      next: 'validate deck',
      pages: [{ index: 1, status: 'retained draft' }]
    })
    return { status: 'error', failure: { message: 'Resume fixture stopped' } }
  })
  await expect(prepareCreativePages(input)).rejects.toThrow(
    'Resume fixture stopped'
  )
})

it('bounds a style-preserving slide redraw and propagates a stopped run without retrying it', async () => {
  const source = readSourceNarrative('Fixture speech and supporting words.')
  const count = run.mock.calls.length
  run.mockRejectedValueOnce(new Error('Bounded slide edit stopped'))
  await expect(
    prepareCreativePages({
      projectId: 'bounded-edit',
      source,
      outline,
      brand: pageBrandFrom(source.palette, source.fonts),
      selection: { adapter: 'kimi' },
      origin: 'http://fixture',
      reuseStyle: true
    })
  ).rejects.toThrow('Bounded slide edit stopped')
  expect(run.mock.calls.length - count).toBe(1)
  expect(run.mock.calls.at(-1)![0]).toMatchObject({
    timeoutMs: 240000,
    idleTimeoutMs: 90000,
    maxToolCalls: 40
  })
})
