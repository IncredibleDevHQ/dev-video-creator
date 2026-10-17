import { html } from '../shared/html'
import { recentResearchChats } from '../shared/research-chats'
import type { ResearchViewState } from './research-view'
import { escape } from './ui'
import { workbenchToolbar } from './research-workbench-view'

export const chatSwitcher = (s: ResearchViewState) =>
  html` <div class="research-session-bar">
    <div class="research-session-picker">
      <label class="sr" for="research-chat-picker">Project chats</label>
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
        + New chat
      </button>
    </div>
    ${s.chat
      ? '<button type="button" class="research-chat-rename" data-research-action="rename-chat" aria-label="Rename chat" title="Rename chat">···</button>'
      : ''}
    ${workbenchToolbar(s.layout)}
  </div>`
