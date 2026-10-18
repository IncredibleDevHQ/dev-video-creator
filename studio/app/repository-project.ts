import { destinationPicker } from './destination-picker'
import { escape } from './ui'
import type { ResearchProjectView } from '../shared/research'
import type { RepoInspection } from '../shared/repos'
import { requestJson } from './http'
import { researchRequest } from './research-api'

/** One folder choice opens the owning project, including its existing chats. */
export const chooseRepositoryProject =
  async (): Promise<ResearchProjectView | null> => {
    const picked = await requestJson<{ repository: RepoInspection | null }>(
      '/api/repos/pick',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      }
    )
    if (!picked.repository) return null
    const repository = picked.repository
    const branch = await new Promise<string | null>((resolve) => {
      const dialog = document.createElement('dialog')
      dialog.className = 'chat-setup'
      dialog.innerHTML = `<form method="dialog"><header><div><h2>Open ${escape(repository.name)}</h2><p>Choose a branch, then start researching in chat.</p></div></header><div class="chat-setup-body"><p>${escape(repository.path)}</p><label for="project-start-branch">Branch</label><select id="project-start-branch" name="branch">${repository.branches.map((value) => `<option value="${escape(value)}" ${value === repository.current ? 'selected' : ''}>${escape(value)}</option>`).join('')}</select></div><footer><button value="cancel">Cancel</button><button value="open" class="research-primary" ${repository.branches.length ? '' : 'disabled'}>Open project →</button></footer></form>`
      document.body.append(dialog)
      const select = dialog.querySelector<HTMLSelectElement>('select')!
      destinationPicker(select, 'branch')
      dialog.addEventListener(
        'close',
        () => {
          resolve(dialog.returnValue === 'open' ? select.value : null)
          dialog.remove()
        },
        { once: true }
      )
      dialog.showModal()
    })
    if (!branch) return null
    return researchRequest<ResearchProjectView>('/repository', {
      path: repository.path,
      branch
    })
  }
