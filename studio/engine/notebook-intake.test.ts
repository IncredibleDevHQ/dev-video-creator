import { expect, it, vi } from 'vitest'
const { brief, story, pages, probe, readUrl } = vi.hoisted(() => ({
  brief: vi.fn(),
  story: vi.fn(),
  pages: vi.fn(),
  probe: vi.fn(),
  readUrl: vi.fn()
}))
vi.mock('./creative/brief', () => ({ prepareCreativeBrief: brief }))
vi.mock('./creative/story', () => ({ prepareCreativeStory: story }))
vi.mock('./creative/pages', () => ({ prepareCreativePages: pages }))
vi.mock('./source-reader', () => ({ readSourceUrl: readUrl }))
vi.mock('./harness/runtime', async (original) => ({
  ...(await original<typeof import('./harness/runtime')>()),
  inspectHarnesses: probe
}))
const { createProject, loadProject, replaceBlockedSource, changeProject } =
  await import('./projects')
const {
  startPresentation,
  setNotebookHarness,
  setNotebookLength,
  refreshNotebookSource,
  editNotebookSource
} = await import('./notebook-intake')
const { saveHarnessPreference, loadHarnessPreference } =
  await import('./harness/preference')
const { recoverProjects } = await import('./recovery')
const { readRow, writeRow } = await import('./persistence')
const { readSourceNarrative } = await import('./source-document')

it('saves edited Markdown and its title without model generation, retaining link metadata', async () => {
  const notebook = await draft()
  const id = notebook.project.id
  await changeProject(id, (current) => {
    current.project.sourceUrl = 'https://example.com/post'
  })
  const original = (await readRow<ReturnType<typeof readSourceNarrative>>(
    'sources',
    id
  ))!
  await writeRow('sources', id, {
    ...original,
    kind: 'url',
    url: 'https://example.com/post',
    images: [{ url: 'https://example.com/diagram.png', alt: 'Diagram' }]
  })
  await writeRow('outlines', id, { stale: true })
  const calls = brief.mock.calls.length
  const saved = await editNotebookSource(
    id,
    '# Revised notes\n\n- Keep **Markdown**\n- A new idea',
    'My notebook'
  )
  expect(saved.project.title).toBe('My notebook')
  expect(saved.project.source).toContain('**Markdown**')
  expect(saved.project.sourceUrl).toBe('https://example.com/post')
  expect(saved.status).toBe('draft')
  const retained = await readRow<ReturnType<typeof readSourceNarrative>>(
    'sources',
    id
  )
  expect(retained?.text).toBe(saved.project.source)
  expect(retained?.images).toHaveLength(1)
  expect(await readRow('outlines', id)).toBeNull()
  expect(brief.mock.calls.length).toBe(calls)
  await expect(editNotebookSource(id, '', 'Title')).rejects.toThrow(
    'Add some notes'
  )
  await changeProject(id, (current) => {
    current.status = 'building'
  })
  await expect(editNotebookSource(id, 'New notes', 'Title')).rejects.toThrow(
    'before creating slides'
  )
  await changeProject(id, (current) => {
    current.status = 'draft'
  })
})
const draft = async (
  text = '# A clear idea\n\n**Markdown** stays readable.\n\n- First point\n- Second point'
) => {
  const created = await createProject(text, undefined, true)
  await vi.waitFor(async () =>
    expect((await loadProject(created.project.id))?.status).toBe('draft')
  )
  return (await loadProject(created.project.id))!
}
it('keeps saved notes whole, though the editor’s markdown runs longer than they count', async () => {
  const notebook = await draft()
  const id = notebook.project.id
  // Escaped characters and a widened table count as the creator sees them;
  // raw, these notes are well over 24,000 characters (review 6: their end
  // was cut while the editor said "Saved").
  const rows = Array.from(
    { length: 400 },
    (_, i) =>
      `| row ${i} | value \\_${i} |\n| ------------------------ | ------------------------ |`
  ).join('\n')
  const notes = `${rows}\n\n## The last section\n\nIt ends here.`
  expect(notes.length).toBeGreaterThan(24_000)
  const saved = await editNotebookSource(id, notes, 'Long notes')
  expect(saved.project.source.endsWith('It ends here.')).toBe(true)
  const kept = await readRow<ReturnType<typeof readSourceNarrative>>(
    'sources',
    id
  )
  expect(kept?.text.endsWith('It ends here.')).toBe(true)
  // Notes too large to send are refused before the request would be,
  // whatever they count.
  const padded = `| a${' '.repeat(600_000)}| b |\n| --- | --- |`
  await expect(editNotebookSource(id, padded, 'Long notes')).rejects.toThrow(
    'too large to send'
  )
})

it('keeps the planned story when the length chosen is the one it has', async () => {
  const notebook = await draft()
  const id = notebook.project.id
  const planned = async () => {
    await changeProject(id, (current) => {
      current.status = 'failed'
      current.plan = [{ id: 'p1', title: 'One', narration: 'Words.' }]
      current.plannedSlides = 4
    })
    await writeRow('outlines', id, { scenes: [] })
  }
  await planned()
  // No length chosen is Medium: choosing it again changes nothing (review
  // 6: the outline went, and Try again planned the story again).
  await setNotebookLength(id, 'medium')
  expect((await loadProject(id))!.plan).toBeTruthy()
  expect(await readRow('outlines', id)).toBeTruthy()
  await setNotebookLength(id, 'long')
  expect((await loadProject(id))!.plan).toBeUndefined()
  expect(await readRow('outlines', id)).toBeNull()
})

it('retains Markdown in an empty notebook without detecting or running an agent, including after restart', async () => {
  expect(await loadHarnessPreference()).toBeNull()
  const notebook = await draft()
  expect(notebook.project.title).toBe('A clear idea')
  expect(notebook.project.source).toContain('**Markdown**')
  expect(notebook.project.slides).toEqual([])
  expect(notebook.project.harness).toBeUndefined()
  expect(await readRow('sources', notebook.project.id)).toBeTruthy()
  const jobs = {
    slides: vi.fn(),
    planning: vi.fn(),
    scene: vi.fn(),
    video: vi.fn()
  }
  await recoverProjects(jobs)
  expect(jobs.slides).not.toHaveBeenCalled()
  expect(probe).not.toHaveBeenCalled()
  expect(brief).not.toHaveBeenCalled()
})
it('starts generation only on explicit presentation creation and rejects a duplicate start', async () => {
  const notebook = await draft()
  probe.mockResolvedValue([{ id: 'codex', ok: true }])
  let release!: () => void
  brief.mockImplementation(async () => {
    await new Promise<void>((resolve) => {
      release = resolve
    })
    return { entities: [], units: [], coverage: [] }
  })
  story.mockResolvedValue({
    title: 'Synthetic test',
    scenes: [
      {
        title: 'Synthetic test',
        kind: 'title',
        seconds: 5,
        narration: 'Fixture.',
        parts: [],
        relations: [],
        source: []
      }
    ],
    targetSeconds: 5,
    glossary: []
  })
  pages.mockResolvedValue(['<svg id="synthetic-test"/>'])
  const started = await startPresentation(notebook.project.id, {
    adapter: 'codex',
    model: 'fixture-model'
  })
  expect(started.status).toBe('building')
  expect(started.sourceOnly).toBe(false)
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  await expect(
    startPresentation(notebook.project.id, { adapter: 'codex' })
  ).rejects.toThrow('not ready')
  await expect(
    setNotebookHarness(notebook.project.id, { adapter: 'kimi' })
  ).rejects.toThrow('generation')
  release()
  await vi.waitFor(async () =>
    expect((await loadProject(notebook.project.id))?.status).toBe('ready')
  )
  expect((await loadProject(notebook.project.id))?.project.slides).toHaveLength(
    1
  )
})
it('rejects an unavailable agent while leaving the source notebook intact', async () => {
  const notebook = await draft()
  probe.mockResolvedValue([{ id: 'kimi', ok: false }])
  await expect(
    startPresentation(notebook.project.id, { adapter: 'kimi' })
  ).rejects.toThrow('unavailable')
  expect((await loadProject(notebook.project.id))?.status).toBe('draft')
})
it('remembers the chosen default and lets an idle notebook switch agents without losing its source', async () => {
  await saveHarnessPreference({ adapter: 'codex', model: 'chosen-model' })
  const notebook = await draft()
  expect(notebook.project.harness).toEqual({
    adapter: 'codex',
    model: 'chosen-model'
  })
  await setNotebookHarness(notebook.project.id, {
    adapter: 'claude-code',
    model: 'sonnet'
  })
  const saved = (await loadProject(notebook.project.id))!
  expect(saved.project.harness?.adapter).toBe('claude-code')
  expect(saved.project.source).toBe(notebook.project.source)
})
it('recovers blocked URL intake to a draft, without generating slides', async () => {
  const calls = brief.mock.calls.length
  readUrl.mockRejectedValue(
    new Error('The site blocked reading. Paste the article text.')
  )
  const notebook = await createProject(
    'https://example.com/article',
    undefined,
    true
  )
  await vi.waitFor(async () =>
    expect((await loadProject(notebook.project.id))?.status).toBe('failed')
  )
  const saved = await replaceBlockedSource(
    notebook.project.id,
    '# Recovered article\n\nThis is the article text pasted by its author, ready to read.'
  )
  expect(saved.status).toBe('draft')
  expect(saved.project.title).toBe('Recovered article')
  expect(saved.project.sourceUrl).toBe('https://example.com/article')
  expect(brief.mock.calls.length).toBe(calls)
})
it('cuts a long pasted article as a read one is, and says so', async () => {
  readUrl.mockRejectedValue(
    new Error('The site blocked reading. Paste the article text.')
  )
  const notebook = await createProject(
    'https://example.com/long',
    undefined,
    true
  )
  await vi.waitFor(async () =>
    expect((await loadProject(notebook.project.id))?.status).toBe('failed')
  )
  await expect(
    replaceBlockedSource(notebook.project.id, 'x'.repeat(500_001))
  ).rejects.toThrow('too large to send')
  const article = `# A long post\n\n${'A paragraph of the post. '.repeat(40)}\n\n`
  const saved = await replaceBlockedSource(
    notebook.project.id,
    article.repeat(40)
  )
  expect(saved.project.source).toMatch(/\n\n… \[cut: [^\]]+\]$/)
  const read = await readRow<ReturnType<typeof readSourceNarrative>>(
    'sources',
    notebook.project.id
  )
  expect(read?.text).toBe(saved.project.source)
  expect(read?.warnings.join(' ')).toMatch(/The text was long; its first/)
})
it('resumes an interrupted source read without scheduling a presentation', async () => {
  const notebook = await draft()
  await changeProject(notebook.project.id, (current) => {
    current.status = 'reading'
  })
  const jobs = {
    slides: vi.fn(),
    planning: vi.fn(),
    scene: vi.fn(),
    video: vi.fn()
  }
  await recoverProjects(jobs)
  await vi.waitFor(async () =>
    expect((await loadProject(notebook.project.id))?.status).toBe('draft')
  )
  expect(jobs.slides).not.toHaveBeenCalled()
})

it('refreshes an idle URL notebook without generating or retaining its stale slide plan', async () => {
  const notebook = await draft('# Old source\n\nMenu and article.')
  const id = notebook.project.id
  await changeProject(id, (current) => {
    current.project.sourceUrl = 'https://example.com/article'
    current.status = 'failed'
    current.sourceOnly = false
    current.error = 'Previous generation failed'
  })
  await writeRow('outlines', id, { source: 'Old menu text', outline: {} })
  readUrl.mockResolvedValue({
    ...readSourceNarrative('# Clean article\n\nOnly the article remains.'),
    kind: 'url',
    url: 'https://example.com/article'
  })
  const calls = brief.mock.calls.length
  const refreshing = await refreshNotebookSource(id)
  expect(refreshing.status).toBe('reading')
  expect(refreshing.project.source).toContain('Old source')
  await vi.waitFor(async () =>
    expect((await loadProject(id))?.status).toBe('draft')
  )
  const saved = (await loadProject(id))!
  expect(saved.project.id).toBe(id)
  expect(saved.project.source).toBe(
    '# Clean article\n\nOnly the article remains.'
  )
  expect(saved.project.sourceUrl).toBe('https://example.com/article')
  expect(saved.sourceOnly).toBe(true)
  expect(saved.error).toBeNull()
  expect(await readRow('outlines', id)).toBeNull()
  expect(brief.mock.calls.length).toBe(calls)
})

it('keeps the saved source if a refresh fails and rejects changes to a working presentation', async () => {
  const notebook = await draft('# Retained article\n\nKeep this saved text.')
  const id = notebook.project.id
  await changeProject(id, (current) => {
    current.project.sourceUrl = 'https://example.com/article'
  })
  readUrl.mockRejectedValue(new Error('The website is unavailable'))
  await refreshNotebookSource(id)
  await vi.waitFor(async () =>
    expect((await loadProject(id))?.status).toBe('failed')
  )
  expect((await loadProject(id))?.project.source).toBe(notebook.project.source)
  expect((await readRow<{ text: string }>('sources', id))?.text).toBe(
    notebook.project.source
  )
  await changeProject(id, (current) => {
    current.status = 'building'
  })
  await expect(refreshNotebookSource(id)).rejects.toThrow(
    'before creating slides'
  )
  await changeProject(id, (current) => {
    current.status = 'failed'
    current.project.slides = [
      { id: 'existing-slide' }
    ] as typeof current.project.slides
  })
  await expect(refreshNotebookSource(id)).rejects.toThrow(
    'before creating slides'
  )
})
