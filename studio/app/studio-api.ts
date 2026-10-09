// The studio's requests for repos, series, demos and release, beside api.ts.
import type { Snapshot } from '../shared/api'
import type { RepoInspection, RepoLink } from '../shared/repos'
import { requestJson } from './http'

const request = <T>(path: string, method = 'GET', body?: unknown): Promise<T> =>
  requestJson(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
const notebook = (id: string, action: string, body: unknown = {}) =>
  request<Snapshot>(`/projects/${id}/${action}`, 'POST', body)

export const studioApi = {
  request,
  notebook,
  inspectRepo: (path: string) =>
    request<RepoInspection>('/repos/inspect', 'POST', { path }),
  setRepos: (id: string, repos: Array<Partial<RepoLink>>) =>
    notebook(id, 'repos', { repos }),
  askRepo: (
    id: string,
    body: { slideId: string; what: string; prompt?: string }
  ) => notebook(id, 'repo-answers', body),
  captureDemo: (
    id: string,
    body: { slideId: string; url: string; steps?: string }
  ) => notebook(id, 'captures', body)
}
