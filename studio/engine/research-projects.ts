import type { RepoLink } from '../shared/repos'
import { randomUUID } from 'node:crypto'
import type { Snapshot } from '../shared/api'
import type {
  ResearchProject,
  ResearchProjectView,
  ResearchProjectSummary,
  NoteBlock
} from '../shared/research'
import { validateHarnessSelection } from './harness/preference'
import { validExcerpt } from '../shared/research'
import { readRow, writeRow, listRows, withOperationLock } from './persistence'
import { loadProject, changeProject } from './projects'
import { readSourceNarrative } from './source-document'
import { addNote } from './map-notes'
import { startPresentation } from './notebook-intake'
import { Refusal } from './refusal'
import { normalizeResearchChats } from '../shared/research-chats'

const table = 'research-projects'
export const readResearchProject = async (id: string) => {
  const project = await readRow<ResearchProject>(table, id)
  if (!project) throw new Refusal('Project not found')
  return normalizeResearchChats(project)
}
const queues = new Map<string, Promise<unknown>>()
const lockedChange = <T>(
  id: string,
  change: (project: ResearchProject) => Promise<T> | T
) =>
  withOperationLock(`research-project:${id}`, async () => {
    const project = await readResearchProject(id)
    const result = await change(project)
    project.updatedAt = new Date().toISOString()
    await writeRow(table, id, project)
    return result
  })
export const changeResearchProject = async <T>(
  id: string,
  change: (project: ResearchProject) => Promise<T> | T
): Promise<T> => {
  const previous = queues.get(id) || Promise.resolve()
  const next = previous.catch(() => {}).then(() => lockedChange(id, change))
  queues.set(id, next)
  try {
    return await next
  } finally {
    if (queues.get(id) === next) queues.delete(id)
  }
}
export const researchProjects = async (): Promise<ResearchProjectSummary[]> => {
  const projects = await Promise.all(
    (await listRows(table)).map(readResearchProject)
  )
  return projects
    .map(({ id, title, updatedAt, notebooks, nodes, repository }) => ({
      id,
      title,
      updatedAt,
      notebooks: notebooks.length,
      questions: nodes.length,
      ...(repository ? { repository } : {})
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
export const researchProjectView = async (
  id: string
): Promise<ResearchProjectView> => {
  const project = await readResearchProject(id)
  const snapshots = await Promise.all(
    project.notebooks.map((n) => loadProject(n.id))
  )
  return {
    ...project,
    snapshots: snapshots.filter((s): s is Snapshot => Boolean(s)),
    canvas: project.canvasId ? await loadProject(project.canvasId) : null
  }
}
export const requiredText = (value: unknown, label: string, max = 7600) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Refusal(`${label} needs 1–${max} characters`)
  return value.trim()
}
const createNotebookRecord = async (
  space: string,
  title: string,
  source: string
) => {
  const id = randomUUID()
  const snapshot: Snapshot = {
    project: {
      id,
      title,
      source,
      slides: [],
      video: null,
      researchProjectId: space
    },
    status: 'draft',
    sourceOnly: true,
    error: null,
    events: []
  }
  await writeRow('sources', id, readSourceNarrative(source, title, Infinity))
  await writeRow('projects', id, snapshot)
  return id
}
export const createResearchProject = async (
  body: Record<string, unknown>,
  repository?: RepoLink
) => {
  const title =
    body.title === undefined
      ? 'My project'
      : requiredText(body.title, 'Project title', 160)
  const source = body.text === undefined ? '' : requiredText(body.text, 'Note')
  const id = randomUUID()
  const at = new Date().toISOString()
  const notebookId = await createNotebookRecord(id, 'Notebook 1', source)
  const project: ResearchProject = {
    id,
    title,
    createdAt: at,
    updatedAt: at,
    notebooks: [
      {
        id: notebookId,
        title: 'Notebook 1',
        blocks: source ? [{ id: randomUUID(), text: source, at }] : []
      }
    ],
    nodes: [],
    chats: [],
    repos: repository ? [repository] : [],
    ...(repository ? { repository } : {})
  }
  await writeRow(table, id, project)
  return researchProjectView(id)
}
export const addProjectNotebook = async (
  id: string,
  body: Record<string, unknown>
) => {
  const title = requiredText(body.title, 'Notebook title', 160)
  await changeResearchProject(id, async (p) => {
    const notebookId = await createNotebookRecord(id, title, '')
    p.notebooks.push({ id: notebookId, title, blocks: [] })
  })
  return researchProjectView(id)
}

/** Saved blocks are the durable source of truth. Sync failures never lose a
 * captured thought; Retry sync replays deterministic note IDs without duplicates. */
export const syncResearchProject = async (id: string) => {
  await changeResearchProject(id, async (p) => {
    try {
      for (const notebook of p.notebooks) {
        const saved = await loadProject(notebook.id)
        if (!saved)
          throw new Refusal(
            'A notebook is missing; your captured notes are still saved'
          )
        if (saved.status === 'draft' && !saved.project.slides.length) {
          const text = notebook.blocks
            .map(
              (block) =>
                block.text +
                (block.comment ? `\n\nYour comment: ${block.comment}` : '')
            )
            .join('\n\n')
          await changeProject(notebook.id, async (s) => {
            s.project.source = text
            s.project.title = notebook.title
            await writeRow(
              'sources',
              notebook.id,
              readSourceNarrative(text, notebook.title, Infinity)
            )
          })
        } else {
          for (const block of notebook.blocks)
            if (!saved.project.researchSeedBlocks?.includes(block.id))
              await addNote(
                notebook.id,
                {
                  text:
                    block.text +
                    (block.comment ? `\n\nYour comment: ${block.comment}` : '')
                },
                block.id
              )
        }
      }
      if (p.canvasId) {
        const canvas = await loadProject(p.canvasId)
        if (!canvas) throw new Refusal('The shared canvas is missing')
        for (const notebook of p.notebooks)
          for (const block of notebook.blocks)
            if (!canvas.project.researchSeedBlocks?.includes(block.id))
              await addNote(
                p.canvasId,
                {
                  text: `[Notebook: ${notebook.title}]\n\n${block.text}${
                    block.comment ? `\n\nYour comment: ${block.comment}` : ''
                  }`
                },
                block.id
              )
      }
      delete p.syncError
    } catch (error) {
      p.syncError =
        error instanceof Error
          ? error.message
          : 'Could not update the wireframes'
    }
  })
  return researchProjectView(id)
}
/** Each project has one organizer. The saved block is durable before any AI
 * work starts; repeated saves replay stable IDs rather than duplicate cards. */
const organizers = new Map<string, Promise<void>>()
export const organizeResearchProject = (id: string) => {
  if (organizers.has(id)) return organizers.get(id)!
  const job = (async () => {
    try {
      const project = await readResearchProject(id)
      if (
        !project.autoOrganize ||
        !project.notebooks.some((n) => n.blocks.length)
      )
        return
      await prepareProjectWireframes(id, { harness: project.harness })
    } catch (error) {
      await changeResearchProject(id, (p) => {
        p.syncError =
          error instanceof Error
            ? error.message
            : 'Could not organize your notes'
      })
    }
  })().finally(() => organizers.delete(id))
  organizers.set(id, job)
  return job
}
export const addProjectNote = async (
  id: string,
  body: Record<string, unknown>
) => {
  await changeResearchProject(id, (p) => {
    if (body.autoOrganize === true) {
      p.autoOrganize = true
      if (body.harness) p.harness = validateHarnessSelection(body.harness)
    }
    const notebook = p.notebooks.find((n) => n.id === body.notebookId)
    if (!notebook) throw new Refusal('Choose a notebook in this project')
    let block: NoteBlock
    if (body.nodeId) {
      const node = p.nodes.find(
        (n) => n.id === body.nodeId && n.state === 'done'
      )
      if (!node || !validExcerpt(node.answerText, body.start, body.end))
        throw new Refusal('Select an excerpt from a completed response')
      const comment =
        typeof body.comment === 'string' && body.comment.trim()
          ? requiredText(body.comment, 'Comment', 2000)
          : ''
      const start = body.start as number,
        end = body.end as number
      if (
        notebook.blocks.some(
          (b) =>
            b.origin?.nodeId === node.id &&
            b.origin.start === start &&
            b.origin.end === end &&
            (b.comment || '') === comment
        )
      )
        return
      block = {
        id: randomUUID(),
        at: new Date().toISOString(),
        text: node.answerText.slice(start, end),
        ...(comment ? { comment } : {}),
        origin: {
          nodeId: node.id,
          question: node.question,
          response: node.answerText,
          start,
          end,
          repos: node.repos
        }
      }
    } else
      block = {
        id: randomUUID(),
        at: new Date().toISOString(),
        text: requiredText(body.text, 'Note')
      }
    notebook.blocks.push(block)
  })
  const view = await syncResearchProject(id)
  if (view.autoOrganize) void organizeResearchProject(id)
  return view
}
export const prepareProjectWireframes = async (
  id: string,
  body: Record<string, unknown>
) => {
  const view = await syncResearchProject(id)
  if (view.syncError) throw new Refusal(view.syncError)
  let target = ''
  await changeResearchProject(id, async (p) => {
    if (body.notebookId) {
      const notebook = p.notebooks.find((n) => n.id === body.notebookId)
      if (!notebook?.blocks.length)
        throw new Refusal('Add a note to this notebook first')
      target = notebook.id
      await changeProject(target, (s) => {
        s.project.researchSeedBlocks = notebook.blocks.map((b) => b.id)
      })
    } else {
      const blocks = p.notebooks.flatMap((n) =>
        n.blocks.map((b) => ({ ...b, notebook: n.title }))
      )
      if (!blocks.length)
        throw new Refusal('Add a note before creating the canvas')
      if (!p.canvasId) {
        const text = blocks
          .map(
            (b) =>
              `## ${b.notebook}\n\n${b.text}${b.comment ? `\n\nYour comment: ${b.comment}` : ''}`
          )
          .join('\n\n')
        p.canvasId = await createNotebookRecord(
          id,
          `${p.title} · Shared canvas`,
          text
        )
        await changeProject(p.canvasId, (s) => {
          s.project.researchSeedBlocks = blocks.map((b) => b.id)
        })
      }
      target = p.canvasId
    }
  })
  const snapshot = await loadProject(target)
  if (snapshot?.status === 'draft')
    await startPresentation(target, body.harness)
  return researchProjectView(id)
}
