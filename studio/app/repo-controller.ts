// Linking a repo, asking it for a page's evidence (again, when wrong), and
// capturing a page's product demo.
import type { AppContext } from './app-context'
import { repoDialog } from './repo-view'
import { studioApi } from './studio-api'

export const clickRepos = async (
  app: AppContext,
  target: HTMLButtonElement,
  action: string | undefined
) => {
  const snapshot = app.snapshot
  if (!snapshot) return
  const id = snapshot.project.id
  if (action === 'repo-dialog') {
    app.showDialog(repoDialog(snapshot))
    return
  }
  if (action === 'inspect-repo') {
    const field = app.dialog.querySelector<HTMLInputElement>('#repo-path')
    if (!field?.value.trim()) return
    target.disabled = true
    try {
      const found = await studioApi.inspectRepo(field.value.trim())
      app.showDialog(repoDialog(snapshot, found))
    } finally {
      target.disabled = false
    }
    return
  }
  if (action === 'unlink-repos') {
    app.snapshot = await studioApi.setRepos(id, [])
    app.dialog.close()
    app.render()
    return
  }
  if (action === 'ask-repo') {
    app.snapshot = await studioApi.askRepo(id, {
      slideId: target.dataset.evidenceSlide || '',
      what: target.dataset.evidenceWhat || ''
    })
    app.render()
  }
}

export const submitRepos = async (
  app: AppContext,
  form: HTMLFormElement,
  values: FormData
) => {
  if (!app.snapshot) return
  const id = app.snapshot.project.id
  if (form.id === 'repo-form') {
    app.snapshot = await studioApi.setRepos(id, [
      {
        path: String(values.get('path') || '').trim(),
        branch: String(values.get('branch') || ''),
        base: String(values.get('base') || '')
      }
    ])
    app.dialog.close()
    app.render()
  }
  if (form.matches('.capture-form')) {
    app.snapshot = await studioApi.captureDemo(id, {
      slideId: form.dataset.captureSlide || '',
      url: String(values.get('url') || '').trim(),
      steps: String(values.get('steps') || '')
    })
    app.render()
  }
  if (form.matches('.ask-again')) {
    const prompt = String(values.get('prompt') || '').trim()
    if (!prompt) return
    app.snapshot = await studioApi.askRepo(id, {
      slideId: form.dataset.evidenceSlide || '',
      what: form.dataset.evidenceWhat || '',
      prompt
    })
    app.render()
  }
}
