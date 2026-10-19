import { isReasoningEffort } from '../shared/reasoning-effort'
import type { ResearchViewState } from './research-view'
const key = (s: ResearchViewState) => `research-new-chat:${s.project.id}`
export const rememberNewResearchChat = (s: ResearchViewState) => {
  if (s.chat) return
  try {
    sessionStorage.setItem(
      key(s),
      JSON.stringify({
        adapter: s.adapter,
        model: s.model,
        effort: s.effort,
        repos: s.repos
      })
    )
  } catch {
    /* The in-memory conversation remains usable. */
  }
}
export const restoreNewResearchChat = (s: ResearchViewState) => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key(s)) || 'null')
    if (!saved || !['kimi', 'claude-code', 'codex'].includes(saved.adapter))
      return
    s.adapter = saved.adapter
    s.model = typeof saved.model === 'string' ? saved.model : ''
    s.effort = isReasoningEffort(saved.effort) ? saved.effort : undefined
    s.repos = Array.isArray(saved.repos)
      ? saved.repos
          .filter(
            (r: Record<string, unknown>) =>
              r &&
              ['path', 'name', 'branch', 'base'].every(
                (k) => typeof r[k] === 'string'
              )
          )
          .slice(0, 4)
      : []
  } catch {
    /* Ignore unavailable or malformed browser storage. */
  }
}
