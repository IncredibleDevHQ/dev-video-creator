// Templates where a video is set up and shown: the choice in the make-video
// and notebook-settings dialogs, and the chip that says which slot a scene
// plays, with the menu that moves it to another.
import { escape, html } from './ui'
import { lookStyle } from './template-gallery-view'
import { templateSketch } from './template-sketches'
import type { Project } from '../shared/model'
import type { Branding } from '../shared/settings'
import {
  SLOT_TYPES,
  TEMPLATE_STORIES,
  VIDEO_TEMPLATES,
  assignSlots,
  coverIndex,
  sceneTemplateSlot,
  storyById,
  templateById,
  templateTitle,
  type SlotType
} from '../shared/video-templates'

const dot = (type: SlotType) =>
  `<i class="tpl-type-dot" data-type="${type}"></i>`
const minutes = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

// A template chosen in the gallery waits here for the dialog that uses it.
let picked: string | undefined
export const pickTemplate = (id: string | undefined) => {
  picked = id
}
export const takePickedTemplate = () => {
  const id = picked
  picked = undefined
  return id
}

/** A small grid, for the card that opens the gallery. */
const browseMark = `<svg viewBox="0 0 320 180"><g class="tpl-browse-mark">${[
  0, 1, 2, 3
]
  .map(
    (i) =>
      `<rect x="${92 + (i % 2) * 72}" y="${34 + Math.floor(i / 2) * 58}" width="64" height="50" rx="8"/>`
  )
  .join('')}</g></svg>`

/**
 * The template choice in the make-video and notebook-settings dialogs: no
 * template, the one chosen, and the way to the gallery, where they are
 * chosen.
 */
export const templatePicker = (
  selected: string | undefined,
  look?: Branding
) => {
  const chosen = templateById(selected)
  return html`<fieldset class="tpl-picker" style="${lookStyle(look)}">
    <legend>Template</legend>
    <div class="tpl-picker-grid">
      <label class="tpl-option tpl-option-none">
        <input
          type="radio"
          name="template"
          value=""
          ${chosen ? '' : 'checked'}
        />
        <span class="tpl-option-thumb" aria-hidden="true">
          <svg viewBox="0 0 320 180">
            <path d="M120 90h80M160 50v80" class="tpl-none-mark" />
          </svg>
        </span>
        <span class="tpl-option-text"
          ><b>No template</b
          ><small>Each scene is planned on its own</small></span
        >
      </label>
      ${chosen
        ? html`<label class="tpl-option">
            <input type="radio" name="template" value="${chosen.id}" checked />
            <span class="tpl-option-thumb" aria-hidden="true"
              >${templateSketch(chosen.slots[coverIndex(chosen)].sketch)}</span
            >
            <span class="tpl-option-text"
              ><b>${escape(storyById(chosen.story).name)}</b
              ><small
                >${escape(chosen.name)} · ${minutes(chosen.seconds)}</small
              ></span
            >
          </label>`
        : ''}
      <button
        type="button"
        class="tpl-option tpl-option-browse"
        data-action="open-templates"
      >
        <span class="tpl-option-thumb" aria-hidden="true">${browseMark}</span>
        <span class="tpl-option-text"
          ><b>${chosen ? 'Choose another' : 'Browse templates'}</b
          ><small
            >${VIDEO_TEMPLATES.length} ways to tell ${TEMPLATE_STORIES.length}
            stories</small
          ></span
        >
      </button>
    </div>
  </fieldset>`
}

/** Which slot a scene plays, in the scene's header; empty without a template. */
export const sceneSlotChip = (project: Project, sceneId: string) => {
  const shape = sceneTemplateSlot(project.video, sceneId)
  if (!shape) return ''
  const index = shape.template.slots.indexOf(shape.slot)
  return html`<button
    type="button"
    class="tpl-scene-chip"
    data-action="scene-slot"
    data-popover="scene-slot"
    data-scene-id="${escape(sceneId)}"
    aria-label="${escape(
      `Slot: ${shape.slot.role}, ${index + 1} of ${shape.template.slots.length} in ${templateTitle(shape.template)}. Change slot`
    )}"
  >
    ${dot(shape.slot.type)}<span>${escape(shape.slot.role)}</span
    ><small>${index + 1}/${shape.template.slots.length}</small>
  </button>`
}

/** The menu that moves a scene to another slot of the video's template. */
export const sceneSlotMenu = (project: Project, sceneId: string) => {
  const video = project.video
  const shape = sceneTemplateSlot(video, sceneId)
  if (!video || !shape) return ''
  const index = video.scenes.findIndex((scene) => scene.id === sceneId)
  const chosen = video.scenes[index].slot || null
  const inOrder = assignSlots(shape.template, video.scenes.length)[index]
  const option = (slot: string, label: string, note: string, type?: SlotType) =>
    html`<button
      type="button"
      role="radio"
      aria-checked="${(chosen || '') === slot}"
      data-action="scene-slot-set"
      data-slot="${slot}"
      data-scene-id="${escape(sceneId)}"
    >
      ${type
        ? dot(type)
        : '<i class="tpl-type-dot" data-type="order"></i>'}<span
        >${escape(label)}</span
      ><small>${escape(note)}</small>
    </button>`
  return html`<p class="popover-title">
      ${escape(templateTitle(shape.template))}
    </p>
    <p class="popover-note">
      Which slot this scene plays. Changing it plans the scene again.
    </p>
    <div class="tpl-slot-menu" role="radiogroup" aria-label="Slot">
      ${option('', 'Its place in order', inOrder.role)}
      ${shape.template.slots
        .map((slot) =>
          option(slot.id, slot.role, SLOT_TYPES[slot.type].label, slot.type)
        )
        .join('')}
    </div>`
}
