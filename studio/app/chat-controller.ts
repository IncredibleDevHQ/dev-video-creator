import { api } from './api'
import type { AppContext } from './app-context'

export const createSendChat =
  (app: AppContext) => async (request: import('../shared/api').ChatRequest) => {
    if (!app.snapshot) return
    const id = app.snapshot.project.id
    if (app.pendingChats.has(id)) return
    const fieldId =
      request.anchor.stage === 'notebook'
        ? 'source-question'
        : request.anchor.stage === 'video'
          ? 'video-instruction'
          : 'instruction'
    app.pendingChats.add(id)
    app.render()
    try {
      const updated = await api.chat(id, request)
      if (app.snapshot?.project.id === id) {
        app.snapshot = updated
        const field = document.getElementById(fieldId)
        if (
          field instanceof HTMLInputElement &&
          field.value.trim() === request.instruction
        )
          field.value = ''
      }
    } finally {
      app.pendingChats.delete(id)
      app.render()
    }
  }
