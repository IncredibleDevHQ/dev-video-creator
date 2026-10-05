// What the practice panel is told about the moment on show, and what it
// asks of the page around it.
import type { Scene } from '../shared/model'

export type Context = {
  projectId: string
  scene: Scene
  index: number
  second: number
  busy: boolean
  recording: boolean
  label: string
  /** The scene's animation: not made yet, being made, or ready to play. */
  animation?: 'none' | 'making' | 'ready'
  /** In practice, what Play plays: this moment, or the whole scene. */
  scope?: Scope
}
export type Scope = 'moment' | 'scene'
/** What the studio asks of the page around it. */
export type Host = {
  /** Choose what Play plays. */
  scope: (next: Scope) => void
  /**
   * Playing the whole scene, the moment on show changed: the page shows its
   * number and overlay without drawing everything again.
   */
  moment: (index: number) => void
}
