import { execFileSync } from 'node:child_process'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
// The agent is a stand-in: these checks prove the plumbing, not a model.
const { stage, chat } = vi.hoisted(() => ({ stage: vi.fn(), chat: vi.fn() }))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./slide-changes', () => ({ chatSlide: chat }))
const root = await mkdtemp(join(tmpdir(), 'minimal-repo-answers-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const repo = join(root, 'limiter')
const { writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const git = await import('./repo-git')
const { askRepo, repoTools, setNotebookRepos, validateRepoAnswer } =
  await import('./repo-answers')
afterAll(() => rm(root, { recursive: true, force: true }))

const run = (...args: string[]) =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
beforeAll(async () => {
  execFileSync('git', ['init', '-q', '-b', 'main', repo])
  run('config', 'user.email', 'test@example.com')
  run('config', 'user.name', 'Test')
  await writeFile(join(repo, 'bucket.ts'), 'export const size = 10\n')
  run('add', '.')
  run('commit', '-qm', 'A bucket')
  run('checkout', '-qb', 'fix-burst')
  await writeFile(
    join(repo, 'bucket.ts'),
    'export const size = 10\nexport const burst = 40\n'
  )
  run('commit', '-qam', 'Allow a burst of 40')
  run('checkout', '-q', 'main')
})

it('reads a branch without writing to the repo', async () => {
  const before = run('status', '--porcelain=v1', '--branch')
  const found = await git.inspectRepo(repo)
  expect(found).toMatchObject({
    name: 'limiter',
    current: 'main',
    base: 'main',
    branches: ['fix-burst', 'main']
  })
  const link = await git.validateRepoLink({ path: repo, branch: 'fix-burst' })
  expect(link).toMatchObject({ branch: 'fix-burst', base: 'main' })
  const head = await git.branchHead(link)
  expect(head).toBe(run('rev-parse', 'fix-burst').trim())
  expect(await git.repoLog(link)).toContain('Allow a burst of 40')
  expect(await git.repoDiff(link, { file: 'bucket.ts' })).toContain(
    '+export const burst = 40'
  )
  expect((await git.repoRead(link, 'bucket.ts')).text).toBe(
    '1: export const size = 10\n2: export const burst = 40\n3: '
  )
  expect(await git.repoSearch(link, 'BURST')).toContain('bucket.ts:2:')
  expect(await git.onBranch(link, head.slice(0, 8))).toBe(true)
  expect(await git.linesAt(link, head, 'bucket.ts')).toBe(3)
  expect(await git.linesAt(link, head, 'missing.ts')).toBeNull()
  // Nothing about the repo changed: same branch, same tree, no lock left.
  expect(run('status', '--porcelain=v1', '--branch')).toBe(before)
  expect(await readdir(join(repo, '.git'))).not.toContain('index.lock')
})

it('refuses what is not a repo, a branch or a file inside it', async () => {
  await expect(git.inspectRepo('relative/path')).rejects.toThrow('full path')
  await expect(git.inspectRepo(root)).rejects.toThrow('not a git repo')
  await expect(
    git.validateRepoLink({ path: repo, branch: '--output=/tmp/x' })
  ).rejects.toThrow('No branch called')
  const link = await git.validateRepoLink({ path: repo, branch: 'fix-burst' })
  await expect(git.repoRead(link, '../secret')).rejects.toThrow(
    'inside the repo'
  )
  await expect(git.repoRead(link, '/etc/hosts')).rejects.toThrow(
    'inside the repo'
  )
})

it('checks an answer against the branch it read', () => {
  const head = 'abcdef1234567890'
  const files = new Set(['bucket.ts'])
  expect(
    validateRepoAnswer(
      {
        text: 'A burst of 40.',
        files: [{ path: 'bucket.ts', lines: [2, 2] }],
        commit: 'abcdef1'
      },
      head,
      files
    )
  ).toMatchObject({
    ok: true,
    value: { commit: head, files: [{ path: 'bucket.ts', lines: [2, 2] }] }
  })
  const refused = validateRepoAnswer(
    { text: '', files: [{ path: 'made-up.ts' }], commit: '1234567' },
    head,
    files
  )
  expect(refused.problems).toEqual([
    'Write text: the answer, in 1–1500 characters',
    `Set commit to the branch head you read, ${head}`,
    'made-up.ts is not on the branch',
    'Name the files the answer comes from'
  ])
})

it('links the repo, asks it for a page’s evidence, and keeps where it came from', async () => {
  const id = 'asks'
  await writeRow('projects', id, {
    project: {
      id,
      title: 'Bursts',
      source: '',
      harness: { adapter: 'kimi' },
      slides: [
        {
          id: 'a',
          title: 'The fix',
          svg: '<svg/>',
          needs: [{ kind: 'code', what: 'the burst setting', source: null }]
        }
      ],
      video: null
    },
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
  await expect(
    askRepo(id, { slideId: 'a', what: 'the burst setting' })
  ).rejects.toThrow('Link a repo first')
  const linked = await setNotebookRepos(id, {
    repos: [{ path: repo, branch: 'fix-burst' }]
  })
  expect(linked.project.repos).toEqual([
    expect.objectContaining({ name: 'limiter', branch: 'fix-burst' })
  ])
  const head = run('rev-parse', 'fix-burst').trim()
  stage.mockImplementation(async (input) => {
    // The agent reads through the engine's tools, then answers.
    const read = input.tools.find(
      (tool: { name: string }) => tool.name === 'repo_read'
    )
    expect((await read.call({ path: 'bucket.ts', from: 2 })).text).toBe(
      '2: export const burst = 40\n3: '
    )
    expect(input.packet['packet/REPO.md']).toContain(head)
    const report = input.validate({
      text: 'The bucket allows a burst of 40 requests.',
      files: [{ path: 'bucket.ts', lines: [2, 9] }],
      commit: head.slice(0, 9)
    })
    expect(report.ok).toBe(true)
    return report.value
  })
  chat.mockResolvedValue(undefined)
  const asking = await askRepo(id, { slideId: 'a', what: 'the burst setting' })
  expect(Object.values(asking.repoAsks!)).toEqual([
    expect.objectContaining({ state: 'asking' })
  ])
  await vi.waitFor(() => expect(chat).toHaveBeenCalledOnce())
  const answered = (await loadProject(id))!
  expect(answered.project.slides[0].answers).toEqual([
    {
      what: 'the burst setting',
      answer: 'The bucket allows a burst of 40 requests.',
      // Lines past the file's end are dropped, not trusted.
      from: {
        repo: 'limiter',
        branch: 'fix-burst',
        commit: head,
        files: [{ path: 'bucket.ts' }]
      }
    }
  ])
  expect(answered.repoAsks).toEqual({})
  expect(chat.mock.calls[0][1].instruction).toContain('From bucket.ts')
  // Asked again with a correction: the prompt reaches the agent.
  await askRepo(id, {
    slideId: 'a',
    what: 'the burst setting',
    prompt: 'Use the size too'
  }).catch(() => {})
  await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(2))
  expect(stage.mock.calls[1][0].stageContext.request.prompt).toBe(
    'Use the size too'
  )
  expect(repoTools(linked.project.repos![0]).map((tool) => tool.name)).toEqual([
    'repo_read',
    'repo_search',
    'repo_diff'
  ])
})
