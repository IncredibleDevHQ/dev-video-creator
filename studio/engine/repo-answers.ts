// The local agent answers a page's request from a linked repo: the code that
// does X, the branch's diff, how to reproduce the bug. It reads the branch
// through engine tools that only read; its answer names the commit and the
// files, and the page is redrawn with it. Not right? Ask again, saying why.
import { Refusal } from './refusal'
import type { Snapshot } from '../shared/api'
import { repoAskKey, type RepoLink, type RepoProvenance } from '../shared/repos'
import { addEvent } from './activity'
import type { EngineTool } from './harness/submissions'
import { detectedHarness } from './notebook-intake'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import {
  branchHead,
  linesAt,
  repoDiff,
  repoFiles,
  repoLog,
  repoRead,
  repoSearch,
  validateRepoLink
} from './repo-git'
import { chatSlide } from './slide-changes'
import { runValidatedJsonStage } from './creative/stage'

const origin = () =>
  process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`

/** Links a notebook to its repos, each checked against the folder. */
export const setNotebookRepos = async (id: string, raw: unknown) => {
  const asked = (raw as { repos?: unknown })?.repos
  if (!Array.isArray(asked) || asked.length > 4)
    throw new Refusal('Link up to four repos')
  const repos: RepoLink[] = []
  for (const item of asked) repos.push(await validateRepoLink(item))
  return changeProject(id, (current) => {
    if (repos.length) current.project.repos = repos
    else delete current.project.repos
    addEvent(
      current,
      'slide',
      repos.length
        ? `Linked ${repos.map((repo) => `${repo.name} (${repo.branch})`).join(', ')}`
        : 'Unlinked the repos'
    )
  })
}

/** The engine's read-only tools over one repo, for the agent. */
export const repoTools = (link: RepoLink): EngineTool[] => {
  const text = (value: unknown) => String(value ?? '')
  return [
    {
      name: 'repo_read',
      description: `Read a file on ${link.branch} of ${link.name}, with line numbers`,
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          from: { type: 'number' },
          to: { type: 'number' }
        },
        required: ['path']
      },
      call: async (args) =>
        repoRead(
          link,
          text(args.path),
          Number(args.from) || 1,
          Number(args.to) || undefined
        )
    },
    {
      name: 'repo_search',
      description: `Find words in the files on ${link.branch} of ${link.name}`,
      inputSchema: {
        type: 'object',
        properties: { words: { type: 'string' } },
        required: ['words']
      },
      call: async (args) => ({ hits: await repoSearch(link, text(args.words)) })
    },
    {
      name: 'repo_diff',
      description: `What ${link.branch} changes against ${link.base}: a summary, or one file's diff`,
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: []
      },
      call: async (args) => ({
        diff: await repoDiff(link, {
          file: args.path ? text(args.path) : undefined,
          stat: !args.path
        })
      })
    }
  ]
}

type Answer = { text: string; files: RepoProvenance['files']; commit: string }

/** The agent's answer, checked against the branch it read. */
export const validateRepoAnswer = (
  raw: unknown,
  head: string,
  files: Set<string>
) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const problems: string[] = []
  const text = String(value.text ?? '').trim()
  if (!text || text.length > 1500)
    problems.push('Write text: the answer, in 1–1500 characters')
  const commit = String(value.commit ?? '').toLowerCase()
  if (commit.length < 7 || !head.startsWith(commit))
    problems.push(`Set commit to the branch head you read, ${head}`)
  const cited = Array.isArray(value.files) ? value.files : []
  const kept: Answer['files'] = []
  for (const item of cited.slice(0, 8)) {
    const path = String((item as { path?: unknown })?.path ?? '')
    const lines = (item as { lines?: unknown })?.lines
    if (!files.has(path)) {
      problems.push(`${path || 'A file'} is not on the branch`)
      continue
    }
    const range =
      Array.isArray(lines) &&
      lines.length === 2 &&
      lines.every((line) => Number.isInteger(line) && line > 0) &&
      lines[0] <= lines[1]
        ? ([lines[0], lines[1]] as [number, number])
        : undefined
    kept.push(range ? { path, lines: range } : { path })
  }
  if (!kept.length) problems.push('Name the files the answer comes from')
  return {
    ok: problems.length === 0,
    problems,
    warnings: [],
    value: { text, files: kept, commit: head }
  }
}

const findNeed = (snapshot: Snapshot, slideId: string, what: string) => {
  const slide = snapshot.project.slides.find((item) => item.id === slideId)
  const need = slide?.needs?.find((item) => item.what === what && !item.source)
  if (!slide || !need) throw new Refusal('This wireframe does not ask for that')
  return { slide, need }
}

/**
 * Asks the agent for a page's evidence from the notebook's repo, in the
 * background. `prompt` is the creator's correction when asking again.
 */
export const askRepo = async (id: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const slideId = String(value.slideId || '')
  const what = String(value.what || '').trim()
  const prompt = String(value.prompt || '')
    .trim()
    .slice(0, 1000)
  const snapshot = await loadProject(id)
  if (!snapshot) throw new Refusal('Notebook not found')
  const repo =
    snapshot.project.repos?.find((item) => item.name === value.repo) ||
    snapshot.project.repos?.[0]
  if (!repo) throw new Refusal('Link a repo first')
  findNeed(snapshot, slideId, what)
  const key = repoAskKey(slideId, what)
  if (snapshot.repoAsks?.[key]?.state === 'asking') return snapshot
  const asked = await changeProject(id, (current) => {
    current.repoAsks = {
      ...current.repoAsks,
      [key]: { slideId, what, state: 'asking', at: new Date().toISOString() }
    }
  })
  void answerFromRepo(id, repo, slideId, what, prompt).catch(
    async (error: Error) =>
      changeProject(id, (current) => {
        current.repoAsks = {
          ...current.repoAsks,
          [key]: {
            slideId,
            what,
            state: 'failed',
            error: error.message || 'The agent could not answer',
            at: new Date().toISOString()
          }
        }
      }).catch(() => {})
  )
  return asked
}

const answerFromRepo = async (
  id: string,
  repo: RepoLink,
  slideId: string,
  what: string,
  prompt: string
) => {
  const snapshot = (await loadProject(id))!
  const { slide, need } = findNeed(snapshot, slideId, what)
  const asked = new Date().toISOString()
  const head = await branchHead(repo)
  const files = await repoFiles(repo, Infinity)
  const previous = slide.answers?.find((item) => item.what === what)
  const request = {
    what,
    kind: need.kind,
    page: { title: slide.title, idea: slide.idea, narration: slide.narration },
    beats: slide.beats,
    prompt: prompt || null,
    previous: previous ? previous.answer : null
  }
  const answer = await runValidatedJsonStage<Answer>({
    projectId: id,
    // Each ask is its own run: asking again never replays the last answer.
    inputKey: fingerprintOf({ request, head, repo: repo.path, asked }),
    checkpoint: 'repo-answer',
    stage: 'story',
    route: 'Answer From Repo',
    stageContext: { request, repo: { name: repo.name, branch: repo.branch } },
    file: 'story/answer.json',
    tool: 'story_submit_answer',
    packet: {
      'packet/REQUEST.json': JSON.stringify(request, null, 1),
      'packet/REPO.md': [
        `# ${repo.name}, branch ${repo.branch} (base ${repo.base})`,
        `Head commit: ${head}`,
        '## The branch’s commits',
        await repoLog(repo),
        '## What it changes',
        await repoDiff(repo, { stat: true }),
        '## Files',
        files.slice(0, 1500).join('\n')
      ].join('\n\n')
    },
    selection: snapshot.project.harness ?? (await detectedHarness()),
    origin: origin(),
    tools: repoTools(repo),
    validate: (raw) => validateRepoAnswer(raw, head, new Set(files))
  })
  // A range past the file's end is dropped, not trusted.
  const cited: Answer['files'] = []
  for (const file of answer.files) {
    const lines = await linesAt(repo, head, file.path)
    cited.push(
      file.lines && lines && file.lines[1] <= lines ? file : { path: file.path }
    )
  }
  const from: RepoProvenance = {
    repo: repo.name,
    branch: repo.branch,
    commit: head,
    files: cited,
    ...(prompt ? { asked: prompt } : {})
  }
  await changeProject(id, (current) => {
    const page = current.project.slides.find((item) => item.id === slideId)
    if (!page) return
    page.answers = [
      ...(page.answers || []).filter((item) => item.what !== what),
      { what, answer: answer.text, from }
    ]
    const asks = { ...current.repoAsks }
    delete asks[repoAskKey(slideId, what)]
    current.repoAsks = asks
    addEvent(current, 'slide', `${repo.name} answered “${what}”`)
  })
  return chatSlide(id, {
    anchor: { stage: 'presentation', slideId },
    instruction: `Show the evidence the agent found in ${repo.name} (${repo.branch}) for this page. ${what}: ${answer.text} From ${cited.map((file) => file.path).join(', ')}. It is the creator's own, not the article's: put it in the narration and the parts, never in source.`
  })
}
