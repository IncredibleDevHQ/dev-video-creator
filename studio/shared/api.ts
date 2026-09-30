import type { ChatAnchor, Project, ProjectEvent, SceneView, VideoView, MomentView, Slide, Presence, Scene, Transition } from './model'
export type Snapshot = { tokenUsage?:import('./usage').NotebookUsage; stopping?:boolean; readOnly?:boolean; plannedSlides?:number; progress?: {label:string;startedAt:string}; project: Project; status: 'building' | 'ready' | 'failed'; sourceFailure?: 'blocked'; error: string | null; events: ProjectEvent[]; views?: { scenes: Record<string, SceneView>; moments: Record<string, MomentView>; video: VideoView }; deletedSlide?: { slide: Slide; index: number; scene?: Scene; seams?: Array<{ left: string; right: string; transition: Transition }> } }
export type CreateProject = { source: string; harness?: import('./model').HarnessSelection }
export type SlideEdit = { action: 'add' | 'duplicate' | 'delete' | 'move' | 'undo-delete'; slideId?: string; index?: number }
export type ChatRequest = { anchor: ChatAnchor; instruction: string }

export type ReplanPreview = { sceneId: string; from: Presence; to: Presence | null; recordings: number; message: string }

export type RecordedPart = { momentId: string; recordingKey: string; from: number; to: number }

export type NotebookSummary={id:string;title:string;status:Snapshot['status'];hasVideo:boolean;updatedAt:string|null}
