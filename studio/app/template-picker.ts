// Templates where a video is set up and shown: the picker in the make-video
// and notebook-settings dialogs, and the chip that says which slot a scene
// plays, with the menu that moves it to another.
import { escape, html } from './ui'
import { lookStyle } from './template-gallery-view'
import { templateSketch } from './template-sketches'
import type { Project } from '../shared/model'
import type { Branding } from '../shared/settings'
import {
  SLOT_TYPES,
  TEMPLATE_FAMILIES,
  VIDEO_TEMPLATES,
  assignSlots,
  familyById,
  sceneTemplateSlot,
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

/** The template choice in the make-video and notebook-settings dialogs. */
export const templatePicker = (selected: string | undefined, look?: Branding) =>
  html`<fieldset class="tpl-picker" style="${lookStyle(look)}">
    <legend>
      Template
      <button type="button" class="quiet" data-action="open-templates">
        Browse templates
      </button>
    </legend>
    <div class="tpl-picker-grid">
      <label class="tpl-option tpl-option-none">
        <input
          type="radio"
          name="template"
          value=""
          ${selected ? '' : 'checked'}
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
      ${TEMPLATE_FAMILIES.flatMap((family) =>
        VIDEO_TEMPLATES.filter((item) => item.family === family.id).map(
          (template) =>
            html`<label class="tpl-option">
              <input
                type="radio"
                name="template"
                value="${template.id}"
                ${selected === template.id ? 'checked' : ''}
              />
              <span class="tpl-option-thumb" aria-hidden="true"
                >${templateSketch(template.slots[0].sketch)}</span
              >
              <span class="tpl-option-text"
                ><b>${escape(template.name)}</b
                ><small
                  >${escape(family.short)} · ${minutes(template.seconds)} ·
                  ${template.slots.length} slots</small
                ></span
              >
            </label>`
        )
      ).join('')}
    </div>
  </fieldset>`

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
      `Slot: ${shape.slot.role}, ${index + 1} of ${shape.template.slots.length} in ${shape.template.name}. Change slot`
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
  return html`<p class="popover-title">${escape(shape.template.name)}</p>
    <p class="popover-note">
      ${escape(familyById(shape.template.family).short)} · Which slot this scene
      plays. Changing it plans the scene again.
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
