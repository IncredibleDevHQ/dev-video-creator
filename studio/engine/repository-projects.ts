import { createHash } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { inspectRepo, validateRepoLink } from './repo-git'
import { withOperationLock } from './persistence'
import {
  changeResearchProject,
  createResearchProject,
  researchProjects,
  researchProjectView
} from './research-projects'

/** A canonical local checkout owns one project, independent of chat branches. */
export const openRepositoryProject = async (
  path: unknown,
  branch?: unknown
) => {
  const inspected = await inspectRepo(path)
  const selected = await validateRepoLink({
    path: inspected.path,
    branch: branch || inspected.base
  })
  const canonical = await realpath(inspected.path)
  const key = createHash('sha256').update(canonical).digest('hex')
  return withOperationLock(`repository-project:${key}`, async () => {
    const existing = (await researchProjects()).find(
      (project) => project.repository?.path === canonical
    )
    if (existing) {
      await changeResearchProject(existing.id, async (project) => {
        project.repository = { ...selected, path: canonical }
      })
      return researchProjectView(existing.id)
    }
    const repository = {
      path: canonical,
      name: inspected.name,
      branch: selected.branch,
      base: inspected.base
    }
    return createResearchProject({ title: inspected.name }, repository)
  })
}
