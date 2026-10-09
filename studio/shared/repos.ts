// Repos a notebook or a series is linked to. The branch is the scenario: the
// local agent answers a page's request from it, read-only, and each answer
// names where it came from, a commit and the files it read.

export type RepoLink = {
  /** The repo's folder on this computer. */
  path: string
  name: string
  /** The branch that captures the scenario. */
  branch: string
  /** What the branch is compared with: its diff is base...branch. */
  base: string
}

/** Where an answer came from: the repo, its branch and commit, the files. */
export type RepoProvenance = {
  repo: string
  branch: string
  commit: string
  files: Array<{ path: string; lines?: [number, number] }>
  /** The creator's correction when they asked again. */
  asked?: string
}

/** A request the agent is answering, or failed to. */
export type RepoAsk = {
  slideId: string
  what: string
  state: 'asking' | 'failed'
  error?: string
  at: string
}

/** What the studio knows about a folder before it is linked. */
export type RepoInspection = {
  path: string
  name: string
  current: string
  branches: string[]
  base: string
}

export const repoAskKey = (slideId: string, what: string) =>
  `${slideId}\u0000${what}`

export const shortCommit = (commit: string) => commit.slice(0, 7)

/** Kinds of evidence a repo can hold; the rest is the creator's to give. */
export const REPO_KINDS = [
  'code',
  'diff',
  'terminal',
  'timeline',
  'numbers',
  'diagram',
  'demo',
  'quote'
] as const
