import { html } from '../shared/html'
import { recentResearchChats } from '../shared/research-chats'
import type { ResearchViewState } from './research-view'
import { escape } from './ui'

export const chatSwitcher = (s: ResearchViewState) =>
  html` <div class="research-session-bar">
    <div class="research-session-picker">
      <label for="research-chat-picker">Project chats</label>
      <select id="research-chat-picker" ${s.pending ? 'disabled' : ''}>
        ${!s.chat ? '<option value="">Your first chat</option>' : ''}
        ${recentResearchChats(s.project.chats)
          .map(
            (c) =>
              html` <option
                value="${c.id}"
                ${s.chat === c.id ? 'selected' : ''}
              >
                ${escape(c.title)}${s.project.nodes.some(
                  (n) => n.chatId === c.id && n.state === 'working'
                )
                  ? ' · Researching…'
                  : ''}
              </option>`
          )
          .join('')}
      </select>
      <button
        type="button"
        data-research-action="new-chat"
        ${s.pending ? 'disabled' : ''}
      >
        ＋ New chat
      </button>
    </div>
    <div class="research-loop-nav" aria-label="Research to content">
      <span aria-current="step">Research</span><span aria-hidden="true">→</span>
      <button type="button" data-research-action="tab-notes">Keep notes</button
      ><span aria-hidden="true">→</span>
      <button type="button" data-research-action="tab-canvas">
        Create a series ↗
      </button>
    </div>
  </div>`
export const collaborationLoop = (s: ResearchViewState) => {
  const count = s.project.notebooks.reduce((sum, n) => sum + n.blocks.length, 0)
  return html`<div class="research-capture-guide">
    <strong>Your knowledge, taking shape</strong>
    <p>
      Select an answer to keep an extract here. Its question, agent and source
      stay connected.
    </p>
    <button type="button" data-research-action="tab-canvas">
      ${count} saved ${count === 1 ? 'note' : 'notes'} · Shape into content →
    </button>
  </div>`
}
