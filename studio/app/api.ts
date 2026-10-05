import { uploadRecording } from './recording-upload'
import { requestJson } from './http'
import { liveNotebook } from './live-notebook'
import type { StudioSettings, VoiceClone } from '../shared/settings'
import type { Voice } from '../shared/model'
import type { VideoSettings, Presence, Transition } from '../shared/model'
import type {
  Snapshot,
  NotebookSummary,
  CreateProject,
  SlideEdit,
  ChatRequest,
  ReplanPreview,
  RecordedPart
} from '../shared/api'
const request = <T>(path: string, method = 'GET', body?: unknown): Promise<T> =>
  requestJson(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
export const api = {
  saveLibraryBrand: (body: unknown) =>
    request<import('../shared/settings').SavedBrand>(
      '/settings/brands',
      'POST',
      body
    ),
  redetectBrand: (id: string) =>
    request<import('../engine/source-document').SourceRead>(
      `/projects/${id}/brand-detection`,
      'POST',
      {}
    ),
  detectedBrand: (id: string) =>
    request<import('../engine/source-document').SourceRead>(
      `/projects/${id}/source`
    ),
  extension: (
    id: string,
    scene: string,
    moment: string,
    text: string,
    recordingKey: string
  ) =>
    request<Snapshot>(
      `/projects/${id}/scenes/${scene}/moments/${moment}/extension`,
      'POST',
      { text, recordingKey }
    ),
  suggestExtension: (
    id: string,
    scene: string,
    moment: string,
    text: string,
    seconds: number,
    recordingKey: string
  ) =>
    request<{ text: string }>(
      `/projects/${id}/scenes/${scene}/moments/${moment}/extension/suggest`,
      'POST',
      { text, seconds, recordingKey }
    ),
  harnesses: (
    adapter?: import('../shared/model').HarnessSelection['adapter']
  ) =>
    request<import('../shared/api').HarnessChoices>(
      `/harnesses${adapter ? `?adapter=${adapter}` : ''}`
    ),
  createPresentation: (
    id: string,
    harness?: import('../shared/model').HarnessSelection
  ) => request<Snapshot>(`/projects/${id}/slides`, 'POST', { harness }),
  notebooks: () => request<NotebookSummary[]>('/projects'),
  create: (body: CreateProject) => request<Snapshot>('/projects', 'POST', body),
  replaceSource: (id: string, text: string) =>
    request<Snapshot>(`/projects/${id}/source`, 'PATCH', { text }),
  refreshSource: (id: string) =>
    request<Snapshot>(`/projects/${id}/source`, 'POST', {}),
  editSource: (id: string, text: string, title: string) =>
    request<Snapshot>(`/projects/${id}/source`, 'PATCH', {
      action: 'edit',
      text,
      title
    }),
  stopSlides: (id: string) =>
    request<Snapshot>(`/projects/${id}/stop`, 'POST', {}),
  retrySlides: (id: string) =>
    request<Snapshot>(`/projects/${id}/retry`, 'POST', {}),
  load: (id: string) => request<Snapshot>(`/projects/${id}`),
  slide: (id: string, body: SlideEdit) =>
    request<Snapshot>(`/projects/${id}/slides`, 'PATCH', body),
  chat: (id: string, body: ChatRequest) =>
    request<Snapshot>(`/projects/${id}/chat`, 'POST', body),
  makeVideo: (id: string, body: VideoSettings) =>
    request<Snapshot>(`/projects/${id}/video`, 'POST', body),
  produceScene: (id: string, sceneId: string) =>
    request<Snapshot>(`/projects/${id}/scenes/${sceneId}/produce`, 'POST', {}),
  produceVideo: (id: string) =>
    request<Snapshot>(`/projects/${id}/produce`, 'POST', {}),
  transition: (id: string, index: number, transition: Transition) =>
    request<Snapshot>(`/projects/${id}/transitions`, 'PATCH', {
      index,
      transition
    }),
  updateVideo: (id: string, body: VideoSettings) =>
    request<Snapshot>(`/projects/${id}/video`, 'PATCH', body),
  retryScene: (id: string, sceneId: string) =>
    request<Snapshot>(`/projects/${id}/scenes/${sceneId}/retry`, 'POST', {}),
  previewPresence: (id: string, sceneId: string, presence: Presence | null) =>
    request<ReplanPreview>(
      `/projects/${id}/scenes/${sceneId}/presence-preview`,
      'POST',
      { presence }
    ),
  replan: (id: string, sceneId: string, presence: Presence | null) =>
    request<Snapshot>(`/projects/${id}/scenes/${sceneId}/presence`, 'POST', {
      presence
    }),
  saveRecording: uploadRecording,
  settings: (refresh = false) =>
    request<StudioSettings>(`/settings${refresh ? '?refresh=voices' : ''}`),
  saveSettings: (body: unknown) =>
    request<StudioSettings>('/settings', 'POST', body),
  previewVoice: (voice: Voice) =>
    request<{ objectKey: string }>('/settings/voice-preview', 'POST', voice),
  retryClone: (id: string) =>
    request<VoiceClone>(`/settings/voice/${id}/retry`, 'POST', {}),
  deleteClone: (id: string) =>
    request<StudioSettings>(`/settings/voice/${id}`, 'DELETE'),
  uploadClone: async (blob: Blob, consent: boolean) => {
    return requestJson<VoiceClone>('/api/settings/voice', {
      method: 'PUT',
      headers: {
        'Content-Type': blob.type,
        'X-Studio-Consent': consent ? 'own-voice' : ''
      },
      body: blob
    })
  },
  uploadLogo: async (blob: Blob) => {
    return requestJson<{ objectKey: string }>('/api/settings/logo', {
      method: 'PUT',
      headers: { 'Content-Type': blob.type },
      body: blob
    })
  },
  subscribe: liveNotebook
}
