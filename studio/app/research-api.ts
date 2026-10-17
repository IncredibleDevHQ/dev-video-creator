import { requestJson } from './http'
import type {
  ResearchProjectView,
  ResearchProjectSummary
} from '../shared/research'
export const researchRequest = <T>(path: string, body?: unknown) =>
  requestJson<T>(
    `/api/research-projects${path}`,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
  )
export const researchApi = {
  list: () => researchRequest<ResearchProjectSummary[]>(''),
  create: (body: unknown) => researchRequest<ResearchProjectView>('', body),
  load: (id: string) => researchRequest<ResearchProjectView>(`/${id}`),
  change: (id: string, action: string, body: unknown) =>
    researchRequest<ResearchProjectView>(`/${id}/${action}`, body)
}
