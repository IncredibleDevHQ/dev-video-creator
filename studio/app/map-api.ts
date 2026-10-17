// The content map's requests: the map's view, notes, topics, the series made
// from it, and its episodes' copies, beside api.ts and studio-api.ts.
import type { Snapshot } from '../shared/api'
import type { MapView } from '../shared/content-map'
import type { Series } from '../shared/series'
import type { MapComment } from '../shared/voice'
import { studioApi } from './studio-api'

const { request } = studioApi

export const mapApi = {
  view: (id: string) => request<MapView>(`/projects/${id}/map`),
  note: (id: string, text: string, gap?: string) =>
    request<Snapshot>(`/projects/${id}/notes`, 'POST', { text, gap }),
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
  planSeries: (
    series: string,
    body: {
      ideas?: string
      length?: { min: number; max: number; strict: boolean }
      organize?: boolean
    }
  ) => request<Series>(`/series/${series}/plan`, 'POST', body),
  /** A direction for the plan: new, reworded, wired or moved. */
  direction: (
    series: string,
    body: {
      id?: string
      text?: string
      to?: { episode?: string; pages?: string[] } | null
      spot?: { x: number; y: number }
    }
  ) => request<Series>(`/series/${series}/directions`, 'POST', body),
  removeDirection: (series: string, id: string) =>
    request<Series>(`/series/${series}/direction-remove`, 'POST', { id }),
  brief: (
    series: string,
    body: {
      outcome?: string
      audience?: string
      organize?: boolean
      length?: { min: number; max: number; strict: boolean }
    }
  ) => request<Series>(`/series/${series}/brief`, 'POST', body),
  gap: (
    series: string,
    id: string,
    state: 'explained' | 'ignored' | 'open' | 'covered'
  ) => request<Series>(`/series/${series}/gap`, 'POST', { id, state }),
  undoOrganize: (series: string, run: string) =>
    request<Series>(`/series/${series}/organize-undo`, 'POST', { run }),
  /** Organises the cards not placed yet, again. */
  organize: (series: string) =>
    request<Series>(`/series/${series}/organize`, 'POST', {}),
  /** Puts an episode right after another (null: first). */
  placeAfter: (series: string, episode: string, after: string | null) =>
    request<Series>(`/series/${series}/episode-order`, 'POST', {
      episode,
      after
    }),
  addEpisode: (
    series: string,
    body: { title?: string; about?: string; slides: string[]; only?: boolean }
  ) =>
    request<{ series: Series; notebook: Snapshot }>(
      `/series/${series}/map-episodes`,
      'POST',
      body
    ),
  /** A card added, moved (the copy it became, or whether its segues are
   * being rewritten), removed or updated (and how many were). */
  copies: (episode: string, body: Record<string, unknown>) =>
    request<{
      as?: string
      shared?: boolean
      cut?: boolean
      rewriting?: boolean
      updated?: number
    }>(`/projects/${episode}/copies`, 'POST', body),
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
  /** A flagged line kept as it is, or written again alone (review 8). */
  segueCheck: (
    episode: string,
    check: { slide: string; line: 'bridge' | 'outro'; keep?: boolean }
  ) => request<Snapshot>(`/projects/${episode}/segues`, 'POST', { check }),
  teaser: (episode: string) =>
    request<Snapshot>(`/projects/${episode}/teasers`, 'POST', {
      channel: 'x',
      aspect: '9:16'
    }),
  posts: (episode: string) =>
    request<Snapshot>(`/projects/${episode}/posts`, 'POST', {}),
  /** A typed comment, a reply, or resolving, reopening or removing one. */
  comments: (id: string, body: Record<string, unknown>) =>
    request<{ comments: MapComment[] }>(
      `/projects/${id}/comments`,
      'POST',
      body
    )
}
