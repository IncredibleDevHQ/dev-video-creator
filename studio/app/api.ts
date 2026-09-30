import {requestJson} from './http'
import type { StudioSettings, VoiceClone } from '../shared/settings'
import type { Voice } from '../shared/model'
import type { VideoSettings, Presence, Transition } from '../shared/model'
import type { Snapshot, NotebookSummary, CreateProject, SlideEdit, ChatRequest, ReplanPreview, RecordedPart } from '../shared/api'
const request = <T>(path:string,method='GET',body?:unknown):Promise<T>=>requestJson(`/api${path}`,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined})
export const api = {
  harnesses:()=>request<import('./choose-ai').HarnessChoices>('/harnesses'),
  notebooks:()=>request<NotebookSummary[]>('/projects'),
  create: (body: CreateProject) => request<Snapshot>('/projects', 'POST', body),
  replaceSource:(id:string,text:string)=>request<Snapshot>(`/projects/${id}/source`,'PATCH',{text}),
  stopSlides:(id:string)=>request<Snapshot>(`/projects/${id}/stop`,'POST',{}),
  retrySlides: (id: string) => request<Snapshot>(`/projects/${id}/retry`,'POST',{}),
  load: (id: string) => request<Snapshot>(`/projects/${id}`),
  slide: (id: string, body: SlideEdit) => request<Snapshot>(`/projects/${id}/slides`, 'PATCH', body),
  chat: (id: string, body: ChatRequest) => request<Snapshot>(`/projects/${id}/chat`, 'POST', body),
  makeVideo: (id: string, body: VideoSettings) => request<Snapshot>(`/projects/${id}/video`, 'POST', body),
  practice:(id:string,sceneId:string,momentId:string)=>request<import('../shared/practice').PracticeTrack>(`/projects/${id}/scenes/${sceneId}/practice?moment=${encodeURIComponent(momentId)}`,'POST',{}),
  produceScene: (id: string, sceneId: string) => request<Snapshot>(`/projects/${id}/scenes/${sceneId}/produce`,'POST',{}),
  produceVideo: (id: string) => request<Snapshot>(`/projects/${id}/produce`,'POST',{}),
  transition: (id: string, index: number, transition: Transition) => request<Snapshot>(`/projects/${id}/transitions`,'PATCH',{index,transition}),
  updateVideo: (id: string, body: VideoSettings) => request<Snapshot>(`/projects/${id}/video`, 'PATCH', body),
  retryScene: (id: string, sceneId: string) => request<Snapshot>(`/projects/${id}/scenes/${sceneId}/retry`, 'POST', {}),
  previewPresence: (id: string, sceneId: string, presence: Presence | null) => request<ReplanPreview>(`/projects/${id}/scenes/${sceneId}/presence-preview`, 'POST', { presence }),
  replan: (id: string, sceneId: string, presence: Presence | null) => request<Snapshot>(`/projects/${id}/scenes/${sceneId}/presence`, 'POST', { presence }),
  saveRecording: async (id: string, sceneId: string, parts: RecordedPart[], blob: Blob): Promise<Snapshot> => {
    return requestJson<Snapshot>(`/api/projects/${id}/scenes/${sceneId}/recordings`, { method: 'PUT', headers: { 'Content-Type': blob.type, 'X-Studio-Parts': JSON.stringify(parts) }, body: blob })
  },
  settings: (refresh=false) => request<StudioSettings>(`/settings${refresh?'?refresh=voices':''}`),
  saveSettings: (body: unknown) => request<StudioSettings>('/settings','POST',body),
  previewVoice: (voice: Voice) => request<{objectKey:string}>('/settings/voice-preview','POST',voice),
  retryClone: (id: string) => request<VoiceClone>(`/settings/voice/${id}/retry`,'POST',{}),
  deleteClone: (id: string) => request<StudioSettings>(`/settings/voice/${id}`,'DELETE'),
  uploadClone: async (blob: Blob,consent: boolean) => {
    return requestJson<VoiceClone>('/api/settings/voice',{method:'PUT',headers:{'Content-Type':blob.type,'X-Studio-Consent':consent?'own-voice':''},body:blob})
  },
  uploadLogo: async (blob: Blob) => {
    return requestJson<{objectKey:string}>('/api/settings/logo',{method:'PUT',headers:{'Content-Type':blob.type},body:blob})
  },
  subscribe: (id: string, update: (snapshot: Snapshot) => void, connected: (value:boolean)=>void = ()=>{}) => {
    let stream:EventSource,closed=false,lastUpdate=Date.now(),lastSnapshot=''
    const open=()=>{
      const source=new EventSource(`/api/projects/${id}/events`);stream=source
      stream.onopen=()=>{if(!closed && stream===source)connected(false)}
      stream.onerror=()=>{if(!closed && stream===source)connected(false)}
      stream.onmessage=event=>{
        if(closed || stream!==source)return
        try{
          const snapshot=JSON.parse(event.data) as Snapshot
          if(snapshot?.project?.id!==id)throw new Error('Invalid notebook update')
          lastUpdate=Date.now();connected(true);if(event.data!==lastSnapshot){lastSnapshot=event.data;update(snapshot)}
        }catch{connected(false)}
      }
    }
    connected(false);open()
    const watchdog=setInterval(()=>{
      if(Date.now()-lastUpdate<15000)return
      connected(false);stream.close();lastUpdate=Date.now();open()
    },5000)
    return ()=>{closed=true;clearInterval(watchdog);stream.close()}
  },
}
