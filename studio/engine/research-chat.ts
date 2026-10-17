import { parseHTML } from 'linkedom'
import { researchHtml } from '../shared/research-markdown'
import { randomUUID } from 'node:crypto'
import type {
  ResearchAnchor,
  ResearchNode,
  ResearchRepo
} from '../shared/research'
import { researchPath, validExcerpt } from '../shared/research'
import {
  changeResearchProject,
  readResearchProject,
  requiredText,
  researchProjectView
} from './research-projects'
import { validateRepoLink, branchHead, repoFiles } from './repo-git'
import { repoTools } from './repo-answers'
import { availableHarness, detectedHarness } from './notebook-intake'
import { runValidatedJsonStage } from './creative/stage'
import { Refusal } from './refusal'
import { readRow, listRows, listNotebookRows } from './persistence'
import { cancelEngineRun, type EngineRun } from './harness/runtime'
import { agentStopped } from './notebook-chat'

const running = new Map<string, Promise<void>>()
export const validateResearchReply = (raw: unknown) => {
  const answer = (raw as { answer?: unknown })?.answer
  const ok =
    typeof answer === 'string' &&
    Boolean(answer.trim()) &&
    answer.length <= 50000
  return {
    ok,
    problems: ok
      ? []
      : ['Write answer as Markdown, between 1 and 50000 characters'],
    warnings: [],
    value: { answer: typeof answer === 'string' ? answer : '' }
  }
}
export const askResearch = async (
  id: string,
  body: Record<string, unknown>
) => {
  const question = requiredText(body.question, 'Question', 8000)
  const project = await readResearchProject(id)
  const parentId = typeof body.parentId === 'string' ? body.parentId : null
  const parent = project.nodes.find((n) => n.id === parentId)
  if (parentId && (!parent || parent.state !== 'done'))
    throw new Refusal('Branch from a completed answer')
  const harness = body.harness
    ? await availableHarness(body.harness)
    : project.harness || (await detectedHarness())
  const rawRepos = body.repos ?? project.repos
  if (!Array.isArray(rawRepos) || rawRepos.length > 4)
    throw new Refusal('Choose up to four repositories')
  const repos: ResearchRepo[] = []
  for (const raw of rawRepos) {
    const link = await validateRepoLink(raw)
    repos.push({ ...link, commit: await branchHead(link) })
  }
  let anchor: ResearchAnchor | undefined
  if (body.anchor) {
    const raw = body.anchor as ResearchAnchor
    let text = ''
    if (raw.kind === 'response') {
      const source = project.nodes.find(
        (n) => n.id === raw.id && n.state === 'done'
      )
      if (source?.id !== parentId)
        throw new Refusal('Branch from the selected response')
      text = source.answerText
    } else if (raw.kind === 'note') {
      const block = project.notebooks
        .find((n) => n.id === raw.notebookId)
        ?.blocks.find((b) => b.id === raw.id)
      if (!block) throw new Refusal('Select a note in this project')
      text = block.text
      if (block.origin && parentId !== block.origin.nodeId)
        throw new Refusal('Start this branch from the note’s source response')
    } else throw new Refusal('Choose a response or notebook passage')
    if (!validExcerpt(text, raw.start, raw.end))
      throw new Refusal('Select a valid passage')
    anchor = {
      kind: raw.kind,
      id: raw.id,
      ...(raw.kind === 'note' ? { notebookId: raw.notebookId } : {}),
      start: raw.start,
      end: raw.end,
      text: text.slice(raw.start, raw.end)
    }
  }
  const node: ResearchNode = {
    id: randomUUID(),
    parentId,
    question,
    anchor,
    harness,
    repos,
    at: new Date().toISOString(),
    state: 'working',
    answer: '',
    answerText: '',
    activity: 'Starting research…'
  }
  await changeResearchProject(id, (p) => {
    if (p.nodes.some((n) => n.state === 'working'))
      throw new Refusal(
        'Wait for the current answer, or stop it before asking another question'
      )
    p.nodes.push(node)
    p.repos = repos.map(({ commit: _, ...link }) => link)
    p.harness = harness
  })
  scheduleResearch(id, node.id)
  return { nodeId: node.id, project: await researchProjectView(id) }
}
const scheduleResearch = (id: string, nodeId: string) => {
  const job = answerResearch(id, nodeId)
    .catch(async (error: unknown) => {
      const message =
        agentStopped(error, 'The agent could not finish. Try again.')
          ?.message ||
        (error instanceof Error ? error.message : 'The agent could not finish')
      await changeResearchProject(id, (p) => {
        const node = p.nodes.find((n) => n.id === nodeId)
        if (node?.state === 'working') {
          node.state = 'failed'
          node.error = message
        }
      })
    })
    .finally(() => running.delete(nodeId))
  running.set(nodeId, job)
  void job.catch(() => {})
}
const answerResearch = async (id: string, nodeId: string) => {
  const project = await readResearchProject(id)
  const node = project.nodes.find((n) => n.id === nodeId)!
  if (node.state !== 'working') return
  const history = researchPath(project.nodes, node.parentId).map(
    ({ question, answer, anchor }) => ({ question, answer, anchor })
  )
  // Tools read the exact pinned commit, even if another process moves a branch.
  const tools = node.repos.flatMap((repo, index) =>
    repoTools({ ...repo, branch: repo.commit }).map((tool) => ({
      ...tool,
      name: `context_${index + 1}_${tool.name}`,
      description: `${repo.name} · ${repo.branch} · ${repo.commit.slice(0, 7)}: ${tool.description}`
    }))
  )
  const context = await Promise.all(
    node.repos.map(async (repo, index) => ({
      ...repo,
      toolsPrefix: `context_${index + 1}_`,
      files: await repoFiles({ ...repo, branch: repo.commit }, 1500)
    }))
  )
  if (
    (await readResearchProject(id)).nodes.find((n) => n.id === nodeId)
      ?.state !== 'working'
  )
    return
  const answer = await runValidatedJsonStage({
    projectId: project.notebooks[0].id,
    sceneId: node.id,
    inputKey: node.id,
    checkpoint: 'research-answer',
    stage: 'story',
    route: 'Research Project',
    file: 'story/research.json',
    tool: 'story_submit_research',
    selection: node.harness,
    origin:
      process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
      `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`,
    operation: 'chat',
    tools,
    skillFiles: ['SKILL.md', 'workflows/research-project.md'],
    stageContext: { question: node.question },
    packet: {
      'packet/QUESTION.json': JSON.stringify({
        question: node.question,
        selection: node.anchor || null
      }),
      'packet/CONVERSATION.json': JSON.stringify(history),
      'packet/REPOSITORIES.json': JSON.stringify(context),
      'packet/NOTEBOOKS.json': JSON.stringify(
        project.notebooks.map((n) => ({
          title: n.title,
          notes: n.blocks.map((b) => b.text)
        }))
      )
    },
    validate: validateResearchReply,
    onEvent: async (event) => {
      if (event.type !== 'tool') return
      // Never stream tool payloads or private chain-of-thought into the chat.
      await changeResearchProject(id, (p) => {
        const n = p.nodes.find((item) => item.id === nodeId)
        if (n?.state === 'working')
          n.activity = /context_\d+_repo_/.test(event.tool || '')
            ? 'Reading repository context…'
            : 'Working on your answer…'
      }).catch(() => {})
    }
  })
  await changeResearchProject(id, (p) => {
    const n = p.nodes.find((item) => item.id === nodeId)
    if (n?.state === 'working') {
      n.answer = answer.answer
      n.answerText =
        parseHTML(
          `<div id="answer">${researchHtml(answer.answer)}</div>`
        ).document.getElementById('answer')!.textContent || ''
      n.state = 'done'
      delete n.activity
    }
  })
}
export const stopResearch = async (
  id: string,
  body: Record<string, unknown>
) => {
  await changeResearchProject(id, (p) => {
    const node = p.nodes.find((n) => n.id === body.nodeId)
    if (!node) throw new Refusal('Question not found')
    if (node.state === 'working') node.state = 'stopped'
  })
  const project = await readResearchProject(id)
  for (const runId of await listNotebookRows(
    'engine-runs',
    project.notebooks[0].id
  )) {
    const run = await readRow<EngineRun>('engine-runs', runId)
    if (
      run &&
      run.sceneId === body.nodeId &&
      ['preparing', 'running'].includes(run.status)
    )
      cancelEngineRun(runId)
  }
  return researchProjectView(id)
}
export const settledResearch = async (nodeId: string) => {
  await running.get(nodeId)
}
export const recoverResearch = async () => {
  for (const id of await listRows('research-projects'))
    await changeResearchProject(id, (p) => {
      for (const node of p.nodes)
        if (node.state === 'working') {
          node.state = 'failed'
          node.error =
            'Research was interrupted when the studio restarted. Your question and earlier answers are saved. Ask again to continue.'
        }
    })
}
