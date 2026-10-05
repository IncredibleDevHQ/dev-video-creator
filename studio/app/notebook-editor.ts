import type { Editor } from '@tiptap/core'
import { api } from './api'
import type { AppContext } from './app-context'
import { runNotebookCommand, updateNotebookToolbar } from './notebook-toolbar'

const editors = new WeakMap<HTMLElement, Editor>()
const loading = new WeakSet<HTMLElement>()
let runtime: Promise<typeof import('./notebook-editor-runtime')> | undefined
const loadEditor = () => (runtime ||= import('./notebook-editor-runtime'))

export const noteRevision = (text: string) => {
  let hash = 2166136261
  for (let index = 0; index < text.length; index++)
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619)
  return `${text.length}:${hash >>> 0}`
}

type EditState = {
  timer?: ReturnType<typeof setTimeout>
  saving?: Promise<void>
  composing: boolean
}
const edits = new WeakMap<HTMLElement, EditState>()
const stateOf = (editor: HTMLElement) => {
  let state = edits.get(editor)
  if (!state) {
    state = { composing: false }
    edits.set(editor, state)
  }
  return state
}
const status = (app: AppContext, text: string) => {
  const label = app.root.querySelector<HTMLElement>('[data-note-save]')
  if (label) label.textContent = text
}

const save = async (app: AppContext, editor: HTMLElement): Promise<void> => {
  const state = stateOf(editor)
  clearTimeout(state.timer)
  if (state.saving) {
    await state.saving
    return save(app, editor)
  }
  if (editor.dataset.dirty !== 'true' || state.composing) return
  const id = editor.dataset.notebookEditor!
  const title = app.snapshot?.project.title
  if (!title || app.snapshot?.project.id !== id) return
  const instance = editors.get(editor)
  if (!instance) return
  const text = instance.getMarkdown().trim()
  if (!text) {
    status(app, 'Add some notes to save.')
    throw new Error('Add some notes to save')
  }
  status(app, 'Saving…')
  const work = (async () => {
    try {
      const snapshot = await api.editSource(id, text, title)
      editor.dataset.sourceRevision = noteRevision(snapshot.project.source)
      if (instance.getMarkdown().trim() === text) editor.dataset.dirty = 'false'
      if (app.snapshot?.project.id === id) {
        app.snapshot = snapshot
        app.render()
        status(
          app,
          editor.dataset.dirty === 'true' ? 'Unsaved changes' : 'Saved'
        )
      }
    } catch (reason) {
      status(
        app,
        `Not saved: ${reason instanceof Error ? reason.message : 'Try again'}`
      )
      throw reason
    }
  })()
  state.saving = work
  try {
    await work
  } finally {
    state.saving = undefined
  }
}

export const flushNotebookEdits = async (app: AppContext) => {
  const editor = app.root.querySelector<HTMLElement>('[data-notebook-editor]')
  if (editor) await save(app, editor)
}

export const installNotebookEditor = (app: AppContext) => {
  const editorOf = (event: Event) =>
    (event.target as Element).closest<HTMLElement>('[data-notebook-editor]')
  const queue = (editor: HTMLElement) => {
    const state = stateOf(editor)
    clearTimeout(state.timer)
    editor.dataset.dirty = 'true'
    status(app, 'Unsaved changes')
    if (!state.composing)
      state.timer = setTimeout(() => {
        void save(app, editor).catch(() => {})
      }, 800)
  }
  let active: { element: HTMLElement; instance: Editor } | undefined
  const mount = () => {
    if (active && !active.element.isConnected) {
      clearTimeout(stateOf(active.element).timer)
      active.instance.destroy()
      active = undefined
    }
    const element = app.root.querySelector<HTMLElement>(
      '[data-notebook-editor]'
    )
    if (!element) return
    if (editors.has(element)) {
      updateNotebookToolbar(app.root, editors.get(element)!)
      return
    }
    if (loading.has(element)) return
    loading.add(element)
    void loadEditor()
      .then(({ createNotebookEditor }) => {
        loading.delete(element)
        if (!element.isConnected || editors.has(element)) return
        // The rendered notes stay visible until the editor replaces them.
        element.replaceChildren()
        const instance = createNotebookEditor({
          element,
          content: app.snapshot?.project.source || '',
          onUpdate: (editor) => {
            queue(element)
            updateNotebookToolbar(app.root, editor)
          },
          onSelectionUpdate: (editor) => updateNotebookToolbar(app.root, editor)
        })
        editors.set(element, instance)
        active = { element, instance }
        updateNotebookToolbar(app.root, instance)
      })
      .catch((reason) => {
        loading.delete(element)
        app.error(reason)
      })
  }
  new MutationObserver(mount).observe(app.root, {
    childList: true,
    subtree: true
  })
  mount()
  app.root.addEventListener('mousedown', (event) => {
    if ((event.target as Element).closest('[data-note-command]'))
      event.preventDefault()
  })
  app.root.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLElement>(
      '[data-note-command]'
    )
    if (button && active)
      runNotebookCommand(active.instance, button.dataset.noteCommand!)
  })
  app.root.addEventListener('change', (event) => {
    const select = (event.target as Element).closest<HTMLSelectElement>(
      '[data-note-block]'
    )
    if (!select || !active) return
    const chain = active.instance.chain().focus()
    if (select.value === 'paragraph') chain.setParagraph().run()
    else chain.setHeading({ level: Number(select.value) as 1 | 2 | 3 }).run()
    updateNotebookToolbar(app.root, active.instance)
  })
  app.root.addEventListener('compositionstart', (event) => {
    const editor = editorOf(event)
    if (editor) stateOf(editor).composing = true
  })
  app.root.addEventListener('compositionend', (event) => {
    const editor = editorOf(event)
    if (editor) {
      stateOf(editor).composing = false
      queue(editor)
    }
  })
  app.root.addEventListener('focusout', (event) => {
    const editor = editorOf(event)
    if (editor) void save(app, editor).catch(() => {})
  })
  app.root.addEventListener('keydown', (event) => {
    const editor = editorOf(event)
    if (editor && (event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault()
      void save(app, editor).catch(() => {})
    }
  })
  window.addEventListener('beforeunload', (event) => {
    const editor = app.root.querySelector<HTMLElement>('[data-notebook-editor]')
    if (editor?.dataset.dirty === 'true') {
      event.preventDefault()
      event.returnValue = ''
    }
  })
}
