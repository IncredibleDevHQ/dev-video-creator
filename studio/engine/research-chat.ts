import { researchDocumentFor } from '../shared/research-documents'
import {
  prepareResearchSession,
  finishResearchSession
} from './research-agent-session'
import { parseHTML } from 'linkedom'
import { researchHtml } from '../shared/research-markdown'
import { randomUUID } from 'node:crypto'
import type {
  ResearchAnchor,
  ResearchNode,
  ResearchRepo
} from '../shared/research'
import { validExcerpt } from '../shared/research'
import {
  changeResearchProject,
  readResearchProject,
  requiredText,
  researchProjectView
} from './research-projects'
import { branchHead, repoFiles } from './repo-git'
import { researchRepositories } from './research-sessions'
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
  if (body.chatId !== undefined && typeof body.chatId !== 'string')
    throw new Refusal('Choose a chat in this project')
  const parentId = typeof body.parentId === 'string' ? body.parentId : null
  const parent = project.nodes.find((n) => n.id === parentId)
  if (parentId && (!parent || parent.state !== 'done'))
    throw new Refusal('Branch from a completed answer')
  const chatId = typeof body.chatId === 'string' ? body.chatId : parent?.chatId
  const chat = project.chats!.find((c) => c.id === chatId)
  if (chatId && !chat) throw new Refusal('Choose a chat in this project')
  if (
    body.notebookId !== undefined &&
    !project.notebooks.some((n) => n.id === body.notebookId)
  )
    throw new Refusal('Choose a notebook in this project')
  if (parent && parent.chatId !== chatId)
    throw new Refusal('Choose a question from this chat')
  const harness = await availableHarness(
    body.harness || chat?.harness || (await detectedHarness())
  )
  const links = await researchRepositories(body.repos ?? chat?.repos ?? [])
  const repos: ResearchRepo[] = await Promise.all(
    links.map(async (link) => ({ ...link, commit: await branchHead(link) }))
  )
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
  const contextDocument =
    typeof body.contextDocumentId === 'string'
      ? researchDocumentFor(project.nodes, body.contextDocumentId)
      : researchDocumentFor(project.nodes, parentId)
  if (
    body.contextDocumentId &&
    (!contextDocument || contextDocument.chatId !== chatId)
  )
    throw new Refusal('Choose a research document from this chat')
  const createsDocument =
    Boolean(anchor) ||
    !project.nodes.some((n) => n.chatId === chatId && n.state === 'done')
  const node: ResearchNode = {
    id: randomUUID(),
    chatId: chatId || randomUUID(),
    parentId,
    artifact: createsDocument
      ? { title: question.slice(0, 100), parentId: contextDocument?.id || null }
      : false,
    contextDocumentId: contextDocument?.id,
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
    if (p.nodes.some((n) => n.chatId === node.chatId && n.state === 'working'))
      throw new Refusal(
        'Wait for this chat’s answer, or stop it before asking another question'
      )
    p.nodes.push(node)
    let session = p.chats!.find((c) => c.id === node.chatId)
    if (!session) {
      session = {
        id: node.chatId!,
        title: question.slice(0, 100),
        createdAt: node.at,
        updatedAt: node.at,
        notebookId:
          (body.notebookId as string | undefined) || p.notebooks[0].id,
        repos: links
      }
      p.chats!.push(session)
    }
    session.updatedAt = node.at
    session.lastNodeId = node.id
    session.repos = links
    session.harness = harness
  })
  scheduleResearch(id, node.id)
  return { nodeId: node.id, project: await researchProjectView(id) }
}
const scheduleResearch = (id: string, nodeId: string) => {
  const job = answerResearch(id, nodeId)
    .catch(async (error: unknown) => {
      const message =
        agentStopped(
          error,
          'The local agent could not finish. Your question is saved. Choose another agent below and use Ask again, or retry with this agent.'
        )?.message ||
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
  const history = project.nodes
    .filter(
      (n) =>
        n.chatId === node.chatId &&
        n.at <= node.at &&
        n.id !== node.id &&
        n.state === 'done'
    )
    .map(({ question, answer, anchor }) => ({ question, answer, anchor }))
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
  const session = await prepareResearchSession(id, node)
  await changeResearchProject(id, (p) => {
    const current = p.nodes.find((n) => n.id === nodeId)
    if (current?.state === 'working') current.sessionMode = session.mode
  })
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
    operation: 'research',
    session: { workspaceId: session.workspaceId, resumeId: session.resumeId },
    onRun: (run) => finishResearchSession(session, node.id, run),
    tools,
    skillFiles: ['SKILL.md', 'workflows/research-project.md'],
    stageContext: { question: node.question },
    packet: {
      'packet/QUESTION.json': JSON.stringify({
        question: node.question,
        selection: node.anchor || null
      }),
      'packet/ACTIVE_DOCUMENT.json': JSON.stringify(
        researchDocumentFor(project.nodes, node.contextDocumentId || null) ||
          null
      ),
      'packet/CONVERSATION.json': JSON.stringify(history),
      'packet/REPOSITORIES.json': JSON.stringify(context),
      'packet/NOTEBOOKS.json': JSON.stringify(
        project.notebooks.map((n) => ({
          title: n.title,
          notes: n.blocks.map((b) => b.text)
        }))
      )
    },
    validate: (raw) => {
      const report = validateResearchReply(raw)
      if (
        report.ok &&
        node.anchor &&
        report.value.answer.length > 300 &&
        history.some(
          (previous) =>
            previous.question !== node.question &&
            previous.answer.trim() === report.value.answer.trim()
        )
      ) {
        report.ok = false
        report.problems.push(
          'This repeats an earlier answer verbatim. Answer the current question in packet/QUESTION.json about the selected passage, using a new document title and fresh findings.'
        )
      }
      return report
    },
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
