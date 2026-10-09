// The content map's requests: the map's view, notes, topics, the series made
// from it, and its episodes' copies, beside api.ts and studio-api.ts.
import type { Snapshot } from '../shared/api'
import type { MapView } from '../shared/content-map'
import type { Series } from '../shared/series'
import { studioApi } from './studio-api'

const { request } = studioApi

export const mapApi = {
  view: (id: string) => request<MapView>(`/projects/${id}/map`),
  note: (id: string, text: string) =>
    request<Snapshot>(`/projects/${id}/notes`, 'POST', { text }),
  resortNote: (id: string, note: string) =>
    request<Snapshot>(`/projects/${id}/notes`, 'POST', { retry: note }),
  pick: (episode: string) =>
    request<Snapshot>(`/projects/${episode}/pick`, 'POST', {}),
  topics: (id: string) =>
    request<Snapshot>(`/projects/${id}/topics`, 'POST', {}),
  startSeries: (id: string, title?: string) =>
    request<Series>(
      `/projects/${id}/map-series`,
      'POST',
      title ? { title } : {}
    ),
  addEpisode: (
    series: string,
    body: { title?: string; about?: string; slides: string[]; only?: boolean }
  ) =>
    request<{ series: Series; notebook: Snapshot }>(
      `/series/${series}/map-episodes`,
      'POST',
      body
    ),
  copies: (episode: string, body: Record<string, unknown>) =>
    request<Record<string, boolean>>(
      `/projects/${episode}/copies`,
      'POST',
      body
    ),
  renameEpisode: (episode: string, title: string) =>
    request<Snapshot>(`/projects/${episode}/episode-title`, 'POST', { title }),
  renameSeries: (series: string, title: string) =>
    request<unknown>(`/series/${series}`, 'POST', { title }),
  removeEpisode: (series: string, episode: string) =>
    request<Series>(`/series/${series}/episode-remove`, 'POST', { episode }),
  moveEpisode: (series: string, episode: string, by: -1 | 1) =>
    request<Series>(`/series/${series}/episode-order`, 'POST', {
      episode,
      by
    }),
  aside: (id: string, slide: string, aside: boolean) =>
    request<Snapshot>(`/projects/${id}/aside`, 'POST', { slide, aside }),
  segues: (episode: string) =>
    request<{ writing: boolean }>(`/projects/${episode}/segues`, 'POST', {}),
  teaser: (episode: string) =>
    request<Snapshot>(`/projects/${episode}/teasers`, 'POST', {
      channel: 'x',
      aspect: '9:16'
    }),
  posts: (episode: string) =>
    request<Snapshot>(`/projects/${episode}/posts`, 'POST', {})
}
