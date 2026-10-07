// The orchestrator's shot on a scene: a chip in the scene's header naming
// how the scene is built, and the menu that gives it another.
import { escape, html } from './ui'
import type { Project } from '../shared/model'
import { SHOTS, orchestrate } from '../shared/orchestration'

const SHOT_MARK =
  '<svg class="shot-mark" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="3.5" width="13" height="9" rx="2"/><path d="M6.5 6v4l3.5-2z"/></svg>'

const sceneShot = (project: Project, sceneId: string) =>
  orchestrate(project)?.find((scene) => scene.sceneId === sceneId)

/** The shot a scene is built as; empty without a template. */
export const sceneShotChip = (project: Project, sceneId: string) => {
  const shot = sceneShot(project, sceneId)
  if (!shot) return ''
  return html`<button
    type="button"
    class="tpl-scene-chip shot-chip"
    data-action="scene-shot"
    data-popover="scene-shot"
    data-scene-id="${escape(sceneId)}"
    aria-label="${escape(`Shot: ${shot.shot.name}. Change`)}"
  >
    ${SHOT_MARK}<span>${escape(shot.shot.name)}</span>
  </button>`
}

/** The shots a scene can be built as, the orchestrator's first. */
export const sceneShotMenu = (project: Project, sceneId: string) => {
  const shot = sceneShot(project, sceneId)
  if (!shot) return ''
  const choice = (id: string, label: string, note: string, checked: boolean) =>
    html`<button
      type="button"
      role="radio"
      aria-checked="${checked}"
      data-action="scene-shot-set"
      data-shot="${id}"
      data-scene-id="${escape(sceneId)}"
    >
      <span>${escape(label)}</span><small>${escape(note)}</small>
    </button>`
  return html`<p class="popover-title">Shot</p>
    <p class="popover-note">
      How this scene is built. The orchestrator chose
      ${escape(shot.suggested.name)}, because ${escape(shot.why)}.
    </p>
    <div class="tpl-slot-menu shot-menu" role="radiogroup" aria-label="Shot">
      ${choice(
        '',
        'The orchestrator’s choice',
        shot.suggested.name,
        shot.chosenBy === 'orchestrator'
      )}
      ${SHOTS.filter((item) => item.id !== 'title-reveal' || shot.index === 0)
        .map((item) =>
          choice(
            item.id,
            item.name,
            item.line,
            shot.chosenBy === 'creator' && shot.shot.id === item.id
          )
        )
        .join('')}
    </div>`
}
