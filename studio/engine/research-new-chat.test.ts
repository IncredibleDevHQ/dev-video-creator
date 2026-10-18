import { afterEach, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import {
  startResearchChat,
  selectResearchChat
} from '../app/research-session-state'
import {
  rememberNewResearchChat,
  restoreNewResearchChat
} from '../app/research-chat-draft'
import { researchLocation } from '../app/research-navigation'
import { researchWorkspaceItem } from '../app/workspace-state'
import { WorkspaceFocus } from '../app/workspace-focus'
import type { ResearchViewState } from '../app/research-view'
const state = () =>
  ({
    project: {
      id: 'p',
      title: 'Project',
      notebooks: [{ id: 'n', title: 'Notes' }],
      chats: [
        { id: 'old', title: 'Earlier conversation', lastNodeId: 'answer' }
      ],
      nodes: []
    },
    notebook: 'n',
    chat: 'old',
    node: 'answer',
    adapter: 'kimi',
    model: 'kimi-k3',
    repos: [{ path: '/repo', name: 'repo', branch: 'main', base: 'main' }],
    anchor: { text: 'old selection' },
    layout: { notesOpen: true, graphOpen: true, expanded: true }
  }) as unknown as ResearchViewState
const storage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => values.set(k, v)
  }
}
afterEach(() => vi.unstubAllGlobals())
it('starts at an empty composer without inheriting an earlier answer or repository', () => {
  const s = state()
  startResearchChat(s)
  expect(s).toMatchObject({
    chat: null,
    node: null,
    anchor: null,
    repos: [],
    adapter: 'kimi',
    model: 'kimi-k3',
    notebook: 'n'
  })
  expect(s.chatPositions).toEqual({ old: 'answer' })
  expect(s.layout).toMatchObject({
    graphOpen: false,
    notesOpen: false,
    expanded: false
  })
  expect(
    new URL(researchLocation(s), 'http://localhost').searchParams.get('chat')
  ).toBe('new')
  expect(researchWorkspaceItem(s).href).toContain('chat=new')
})
it('restores the explicit unsent conversation, including agent and branch context', () => {
  vi.stubGlobal('sessionStorage', storage())
  const saved = state()
  saved.chat = null
  rememberNewResearchChat(saved)
  const restored = state()
  restored.adapter = 'claude-code'
  selectResearchChat(restored, 'new')
  expect(restored.chat).toBeNull()
  expect(restored.node).toBeNull()
  expect(restored.adapter).toBe('kimi')
  expect(restored.model).toBe('kimi-k3')
  expect(restored.repos).toEqual(saved.repos)
  const other = state()
  other.project.id = 'other'
  other.adapter = 'codex'
  restoreNewResearchChat(other)
  expect(other.adapter).toBe('codex')
})
it('hides navigation without replacing or clearing a draft', () => {
  const { document, window } = parseHTML(
    '<main><section class="project-workspace"><button data-research-action="toggle-sidebar">Menu</button><textarea>Unsent thought</textarea></section></main>'
  )
  vi.stubGlobal('localStorage', storage())
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn()
  }))
  const root = document.querySelector('main')!
  const focus = new WorkspaceFocus(root)
  focus.update()
  const draft = root.querySelector('textarea')!
  root
    .querySelector('button')!
    .dispatchEvent(new window.Event('click', { bubbles: true }))
  expect(root.classList.contains('workspace-focus')).toBe(true)
  expect(root.querySelector('button')!.getAttribute('aria-label')).toBe(
    'Show project navigation'
  )
  expect(root.querySelector('textarea')).toBe(draft)
  expect(draft.value).toBe('Unsent thought')
})
