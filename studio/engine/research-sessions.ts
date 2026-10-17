import { randomUUID } from 'node:crypto'
import type { RepoLink } from '../shared/repos'
import {
  changeResearchProject,
  researchProjectView,
  requiredText
} from './research-projects'
import { validateRepoLink } from './repo-git'
import { validateHarnessSelection } from './harness/preference'
import { Refusal } from './refusal'

export const researchRepositories = async (
  raw: unknown
): Promise<RepoLink[]> => {
  if (!Array.isArray(raw) || raw.length > 4)
    throw new Refusal('Choose up to four repositories')
  const links = await Promise.all(raw.map(validateRepoLink))
  return links.filter(
    (r, i) =>
      links.findIndex(
        (other) => other.path === r.path && other.branch === r.branch
      ) === i
  )
}
/** Chats own next-turn context; each answer retains its original pinned context. */
export const saveResearchChat = async (
  id: string,
  body: Record<string, unknown>
) => {
  const title =
    body.title === undefined
      ? undefined
      : requiredText(body.title, 'Chat name', 160)
  const repos =
    body.repos === undefined
      ? undefined
      : await researchRepositories(body.repos)
  const harness =
    body.harness === undefined
      ? undefined
      : validateHarnessSelection(body.harness)
  await changeResearchProject(id, (project) => {
    const at = new Date().toISOString()
    if (body.chatId !== undefined) {
      const chat = project.chats!.find((c) => c.id === body.chatId)
      if (!chat) throw new Refusal('Choose a chat in this project')
      if (title !== undefined) chat.title = title
      if (repos !== undefined) chat.repos = repos
      if (harness !== undefined) chat.harness = harness
      chat.updatedAt = at
    } else {
      project.chats!.push({
        id: randomUUID(),
        title: title || 'New chat',
        createdAt: at,
        updatedAt: at,
        repos: repos || [],
        harness: harness || { adapter: 'claude-code' }
      })
    }
  })
  return researchProjectView(id)
}
