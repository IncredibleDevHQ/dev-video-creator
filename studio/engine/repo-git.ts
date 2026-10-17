// A linked repo, read with git and never written: the branch's head, its
// diff with the base, its log, a file at a commit, a search. Every command
// reads objects only; GIT_OPTIONAL_LOCKS=0 keeps even the index untouched.
import { Refusal } from './refusal'
import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { basename, isAbsolute, resolve } from 'node:path'
import type { RepoInspection, RepoLink } from '../shared/repos'

const LIMIT = 60_000

const git = (path: string, args: string[], limit = LIMIT) =>
  new Promise<string>((done, fail) =>
    execFile(
      'git',
      ['-C', path, ...args],
      {
        timeout: 20_000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat' }
      },
      (error, stdout) =>
        error
          ? fail(new Error(`git ${args[0]} failed`))
          : done(
              stdout.length > limit
                ? `${stdout.slice(0, limit)}\n… (cut at ${limit} characters)`
                : stdout
            )
    )
  )

/** A ref the creator typed: a branch name, never an option or a range. */
const validRef = (value: string) =>
  /^[A-Za-z0-9._/-]{1,200}$/.test(value) &&
  !value.startsWith('-') &&
  !value.includes('..')
/** A path inside the repo, never above it. */
const validFile = (value: string) =>
  value.length > 0 &&
  value.length <= 400 &&
  !value.startsWith('/') &&
  !value.startsWith('-') &&
  !value.split('/').includes('..')

/** What a folder holds, before it is linked: its branches and its base. */
export const inspectRepo = async (raw: unknown): Promise<RepoInspection> => {
  const asked = String(raw || '').trim()
  if (!asked || !isAbsolute(asked))
    throw new Refusal('Give the repo’s full path on this computer')
  if (!(await stat(asked).catch(() => null))?.isDirectory())
    throw new Refusal('That folder does not exist')
  const path = (
    await git(asked, ['rev-parse', '--show-toplevel']).catch(() => '')
  ).trim()
  if (!path) throw new Refusal('That folder is not a git repo')
  const branches = (
    await git(path, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
  )
    .split('\n')
    .filter(Boolean)
  const current = (
    await git(path, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => '')
  ).trim()
  // The usual names first, then the branch the repo's remote calls its
  // default, then the one checked out.
  const remoteDefault = (
    await git(path, [
      'symbolic-ref',
      '--short',
      'refs/remotes/origin/HEAD'
    ]).catch(() => '')
  )
    .trim()
    .replace(/^origin\//, '')
  const base =
    ['main', 'master', 'trunk', 'develop'].find((name) =>
      branches.includes(name)
    ) ||
    (branches.includes(remoteDefault) ? remoteDefault : '') ||
    (branches.includes(current) ? current : '') ||
    branches[0] ||
    current
  return { path: resolve(path), name: basename(path), current, branches, base }
}

/** A link as the creator asked for it, checked against the repo. */
export const validateRepoLink = async (raw: unknown): Promise<RepoLink> => {
  const value = (raw ?? {}) as Record<string, unknown>
  const repo = await inspectRepo(value.path)
  const branch = String(value.branch || repo.current).trim()
  const base = String(value.base || repo.base).trim()
  for (const ref of [branch, base])
    if (!validRef(ref) || !repo.branches.includes(ref))
      throw new Refusal(`No branch called ${ref} in ${repo.name}`)
  const name = String(value.name || repo.name)
    .trim()
    .slice(0, 80)
  return { path: repo.path, name: name || repo.name, branch, base }
}

/** The branch's head commit, in full. */
export const branchHead = async (link: RepoLink) =>
  (await git(link.path, ['rev-parse', '--verify', `${link.branch}^{commit}`]))
    .trim()
    .toLowerCase()

/** The branch's own commits: those on it and not on its base, or since one. */
export const repoLog = (link: RepoLink, since?: string, limit = 60) =>
  git(link.path, [
    'log',
    '--format=%h %ad %s',
    '--date=short',
    '-n',
    String(limit),
    `${since && /^[0-9a-f]{7,40}$/.test(since) ? since : link.base}..${link.branch}`
  ])

/** What the branch changes: a summary, or the diff of one path. */
export const repoDiff = (
  link: RepoLink,
  options: { file?: string; stat?: boolean; since?: string } = {}
) => {
  if (options.file && !validFile(options.file))
    throw new Refusal('Name a file inside the repo')
  const from =
    options.since && /^[0-9a-f]{7,40}$/.test(options.since)
      ? `${options.since}..${link.branch}`
      : `${link.base}...${link.branch}`
  return git(link.path, [
    'diff',
    '--no-color',
    '--no-ext-diff',
    ...(options.stat ? ['--stat=120'] : []),
    from,
    ...(options.file ? ['--', options.file] : [])
  ])
}

/**
 * What the branch changes, in short: the totals, then the files that
 * changed most. A long-lived branch touches hundreds; a summary that lists
 * them all buries the story.
 */
export const repoChanges = async (
  link: RepoLink,
  options: { since?: string; top?: number } = {}
) => {
  const from =
    options.since && /^[0-9a-f]{7,40}$/.test(options.since)
      ? `${options.since}..${link.branch}`
      : `${link.base}...${link.branch}`
  const rows = (await git(link.path, ['diff', '--numstat', from], 2e6))
    .split('\n')
    .flatMap((line) => {
      const [added, removed, path] = line.split('\t')
      return path
        ? [{ path, added: Number(added) || 0, removed: Number(removed) || 0 }]
        : []
    })
  if (!rows.length) return 'No changes.'
  const top = options.top ?? 20
  const total = rows.reduce(
    (sum, row) => [sum[0] + row.added, sum[1] + row.removed],
    [0, 0]
  )
  const most = [...rows]
    .sort((a, b) => b.added + b.removed - (a.added + a.removed))
    .slice(0, top)
  return [
    `${rows.length} files changed, ${total[0]} lines added, ${total[1]} removed.`,
    ...most.map((row) => `${row.path} +${row.added} −${row.removed}`),
    ...(rows.length > top ? [`… and ${rows.length - top} more files`] : [])
  ].join('\n')
}

/** A file at the branch head, with line numbers, or a range of its lines. */
export const repoRead = async (
  link: RepoLink,
  file: string,
  from = 1,
  to = from + 399
) => {
  if (!validFile(file)) throw new Refusal('Name a file inside the repo')
  const text = await git(
    link.path,
    ['show', `${link.branch}:${file}`],
    4 * 1024 * 1024
  ).catch(() => {
    throw new Refusal(`No file ${file} on ${link.branch}`)
  })
  const lines = text.split('\n')
  const first = Math.max(1, Math.floor(from))
  const last = Math.min(lines.length, Math.max(first, Math.floor(to)))
  return {
    lines: lines.length,
    text: lines
      .slice(first - 1, last)
      .map((line, index) => `${first + index}: ${line}`)
      .join('\n')
  }
}

/** Where words appear on the branch head: file, line, text. */
export const repoSearch = async (link: RepoLink, words: string) => {
  const query = words.trim().slice(0, 200)
  if (!query) throw new Refusal('Search for some words')
  return git(
    link.path,
    ['grep', '-n', '-I', '-F', '-i', '--max-count=5', '-e', query, link.branch],
    20_000
  ).catch(() => '')
}

/** The branch's files, to know where to look. */
export const repoFiles = async (link: RepoLink, limit = 1500) => {
  const all = (
    await git(link.path, ['ls-tree', '-r', '--name-only', link.branch], 2e6)
  )
    .split('\n')
    .filter(Boolean)
  return all.length > limit
    ? [...all.slice(0, limit), `… and ${all.length - limit} more`]
    : all
}

/** Whether a commit is on the branch (its head or before it). */
export const onBranch = async (link: RepoLink, commit: string) =>
  /^[0-9a-f]{7,40}$/i.test(commit) &&
  (await git(link.path, [
    'merge-base',
    '--is-ancestor',
    commit,
    link.branch
  ]).then(
    () => true,
    () => false
  ))

/** How many lines a file has at a commit, or null when it is not there. */
export const linesAt = async (link: RepoLink, commit: string, file: string) =>
  validFile(file) && /^[0-9a-f]{7,40}$/i.test(commit)
    ? git(link.path, ['show', `${commit}:${file}`], 4 * 1024 * 1024).then(
        (text) => text.split('\n').length,
        () => null
      )
    : null
