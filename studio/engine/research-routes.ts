import { openRepositoryProject } from './repository-projects'
import {
  createResearchProject,
  researchProjectView,
  researchProjects,
  addProjectNotebook,
  addProjectNote,
  prepareProjectWireframes,
  syncResearchProject,
  changeResearchProject,
  requiredText
} from './research-projects'
import { askResearch, stopResearch } from './research-chat'
import { saveResearchChat } from './research-sessions'

export const researchRoute = async (
  url: URL,
  method: string,
  body: Record<string, unknown>
) => {
  const ok = (value: unknown) => ({ status: 200, value })
  if (url.pathname === '/api/research-projects/repository' && method === 'POST')
    return ok(await openRepositoryProject(body.path, body.branch))
  if (url.pathname === '/api/research-projects') {
    if (method === 'GET') return ok(await researchProjects())
    if (method === 'POST') return ok(await createResearchProject(body))
  }
  const match = url.pathname.match(
    /^\/api\/research-projects\/([a-zA-Z0-9_-]+)(?:\/(notebooks|notes|ask|stop|wireframes|sync|rename|chats))?$/
  )
  if (!match) return null
  const [, id, action] = match
  if (method === 'GET' && !action) return ok(await researchProjectView(id))
  if (method !== 'POST') return null
  if (action === 'notebooks') return ok(await addProjectNotebook(id, body))
  if (action === 'notes') return ok(await addProjectNote(id, body))
  if (action === 'chats') return ok(await saveResearchChat(id, body))
  if (action === 'ask') return ok(await askResearch(id, body))
  if (action === 'stop') return ok(await stopResearch(id, body))
  if (action === 'wireframes')
    return ok(await prepareProjectWireframes(id, body))
  if (action === 'sync') return ok(await syncResearchProject(id))
  if (action === 'rename') {
    const title = requiredText(body.title, 'Title', 160)
    await changeResearchProject(id, (p) => {
      if (body.notebookId) {
        const n = p.notebooks.find((n) => n.id === body.notebookId)
        if (n) n.title = title
      } else p.title = title
    })
    return ok(await researchProjectView(id))
  }
  return null
}
