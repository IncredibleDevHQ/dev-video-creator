// Who draws a video's next step (the Open Slide pass): one owner, never two.
// In the Scenes view the scene workspace's row owns the scene's action. In
// the notebook, the header's context row does — the scene's review beside
// the stage keeps its own actions secondary — and it draws the steps that
// belong to no scene, the brief and the export, in either view.
export type StepOwner = 'workspace' | 'context'
export type StepOwnerInput = {
  video: boolean
  // The scene the step is for; none for the brief or the export.
  stepScene: string | null
  // The Scenes view is on.
  workspace: boolean
}
export const nextStepOwner = ({ video, stepScene, workspace }: StepOwnerInput): StepOwner =>
  video && stepScene && workspace ? 'workspace' : 'context'
