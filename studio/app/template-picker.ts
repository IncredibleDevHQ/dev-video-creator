// Templates where a video is set up and shown: the choice in the make-video
// and notebook-settings dialogs (the template, the way to tell it, and how
// long, always a range), and the chip that says which beats a scene carries,
// with the menu that gives it another.
import { escape, html } from './ui'
import { beatDot, lookStyle } from './template-gallery-parts'
import { templateSketch } from './template-sketches'
import type { Presence, Project } from '../shared/model'
import type { Branding } from '../shared/settings'
import {
  AUDIENCE_LABELS,
  DRAMA_LABELS,
  ELABORATION_LABELS,
  EVIDENCE_LABELS,
  FUNCTION_LABELS,
  LENGTHS,
  NARRATIVES,
  ON_CAMERA_LABELS,
  STRUCTURE_LABELS,
  allowedPresets,
  directionSettings,
  lengthLabel,
  narrativeById,
  presenceFor,
  presetFor,
  plannedPages,
  sceneNarrative,
  type Direction,
  type EvidenceKind,
  type LengthRange,
  type Narrative,
  type OnCamera
} from '../shared/narratives'

/** A template and its direction, as a dialog starts from. */
export type TemplateChoice = { narrative?: string; direction?: Direction }

// A template chosen in the gallery waits here for the dialog that uses it.
let picked: TemplateChoice | undefined
export const pickTemplate = (choice: TemplateChoice | undefined) => {
  picked = choice
}
/** The make dialog's choices, kept while the gallery is open (review 6:
 * picking a template reset them): every field, by name and value. */
type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
let kept: {
  narrative: string
  checked: string[]
  values: [string, string][]
  open: boolean[]
} | null = null
const fieldsOf = (form: HTMLFormElement) => [
  ...form.querySelectorAll<Field>('input[name], select[name], textarea[name]')
]
const toggles = (field: Field): field is HTMLInputElement =>
  field.type === 'radio' || field.type === 'checkbox'
const narrativeOf = (form: HTMLFormElement) =>
  form.querySelector<HTMLInputElement>('input[name="narrative"]:checked')
export const keepMakeChoices = (dialog: ParentNode) => {
  const form = dialog.querySelector<HTMLFormElement>('#video-form')
  if (!form) return false
  const fields = fieldsOf(form)
  kept = {
    narrative: narrativeOf(form)?.value ?? '',
    checked: fields
      .filter((field) => toggles(field) && field.checked)
      .map((field) => `${field.name}=${field.value}`),
    values: fields
      .filter((field) => !toggles(field))
      .map((field) => [field.name, field.value]),
    open: [...form.querySelectorAll('details')].map((item) => item.open)
  }
  return true
}
/** Whether the gallery was opened from the make dialog. */
export const keptMakeChoices = () => kept !== null
/**
 * Back from the gallery, the dialog as it was left. A different story
 * picked there brings its own direction; the scenes, the camera and the
 * voice stay as chosen.
 */
export const restoreMakeChoices = (dialog: ParentNode) => {
  const form = dialog.querySelector<HTMLFormElement>('#video-form')
  const was = kept
  kept = null
  if (!form || !was) return
  const same = (narrativeOf(form)?.value ?? '') === was.narrative
  const own = ['scene', 'presence', 'voice', was.narrative ? 'oncamera' : '']
  const fields = fieldsOf(form).filter(
    (field) => same || own.includes(field.name)
  )
  const chosen = (field: Field) =>
    was.checked.includes(`${field.name}=${field.value}`)
  for (const field of fields) {
    if (!toggles(field)) {
      const value = was.values.find(([name]) => name === field.name)?.[1]
      if (value === undefined) continue
      if (field.tagName === 'SELECT')
        field
          .querySelectorAll('option')
          .forEach((option) => (option.selected = option.value === value))
      else field.value = value
    } else if (
      field.type === 'checkbox' ||
      // A radio group changes only when its chosen value is still there.
      fields.some(
        (other) =>
          other.type === 'radio' &&
          other.name === field.name &&
          !(other as HTMLInputElement).disabled &&
          chosen(other)
      )
    )
      field.checked = chosen(field)
  }
  if (same)
    form
      .querySelectorAll('details')
      .forEach((item, i) => (item.open = was.open[i] ?? item.open))
  // From no template, the presence chosen there becomes the story's camera.
  const presence = was.checked
    .find((choice) => choice.startsWith('presence='))
    ?.slice(9) as Presence | undefined
  const cameras = [
    ...form.querySelectorAll<HTMLInputElement>('input[name="oncamera"]')
  ]
  const camera = cameras.find((radio) => radio.checked)?.value as OnCamera
  if (!was.narrative && presence && camera && presenceFor(camera) !== presence)
    for (const radio of cameras)
      radio.checked = radio.value === CAMERA_FOR[presence]
  syncTemplateFields(form, narrativeOf(form))
}
const CAMERA_FOR: Record<Presence, OnCamera> = {
  off: 'none',
  low: 'ends',
  high: 'leads'
}

export const takePickedTemplate = () => {
  const choice = picked
  picked = undefined
  return choice
}

/** The material a creator can ask to lead. */
const LEADS: EvidenceKind[] = ['code', 'demo', 'numbers', 'diagram']

const option = (value: string, label: string, selected: boolean) =>
  `<option value="${escape(value)}"${selected ? ' selected' : ''}>${escape(label)}</option>`
const select = (
  name: string,
  label: string,
  labels: Record<string, string>,
  value: string
) =>
  `<label>${label}<select name="${name}">${Object.entries(labels)
    .map(([key, text]) => option(key, text, key === value))
    .join('')}</select></label>`

/** The lengths offered: the usual ones, each direction's, and the video's. */
const lengthsFor = (narrative: Narrative, current: LengthRange) =>
  [
    ...new Map(
      [
        ...LENGTHS,
        ...allowedPresets(narrative).map(
          (item) => directionSettings(narrative, { preset: item.id }).length
        ),
        current
      ].map((range) => [range.join(','), range])
    ).values()
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1])

/**
 * How to tell it: the directions as chips, the length, and the rest folded
 * away. Each chip carries its own settings, which the dialog takes on when
 * it is picked.
 */
const directionFields = (narrative: Narrative, chosen?: Direction) => {
  const preset = presetFor(narrative, chosen?.preset)
  const settings = directionSettings(narrative, { ...chosen, preset })
  const length = settings.length.join(',')
  return html`<fieldset class="tpl-direction" aria-label="How to tell it">
    <div class="tpl-chips">
      ${allowedPresets(narrative)
        .map(
          (item) =>
            `<label class="tpl-chip"><input type="radio" name="preset" value="${item.id}"${item.id === preset ? ' checked' : ''} data-settings="${escape(JSON.stringify(directionSettings(narrative, { preset: item.id })))}"><span>${escape(item.name)}</span></label>`
        )
        .join('')}
    </div>
    <div class="tpl-length">
      <span class="tpl-length-label" id="tpl-length-label">Length</span>
      <div
        class="tpl-chips"
        role="radiogroup"
        aria-labelledby="tpl-length-label"
      >
        ${
          // The studio's own chips, not a browser select (review 6).
          [
            ...lengthsFor(narrative, settings.length).map((range) => ({
              value: range.join(','),
              label: lengthLabel(range)
            })),
            { value: 'own', label: 'Your own range…' }
          ]
            .map(
              (item) =>
                `<label class="tpl-length-chip"><input type="radio" name="length" value="${item.value}"${item.value === length ? ' checked' : ''}><span>${escape(item.label)}</span></label>`
            )
            .join('')
        }
      </div>
      <span class="tpl-length-own" hidden
        ><input
          type="number"
          name="length-from"
          min="0.25"
          step="any"
          aria-label="Shortest"
        />
        to
        <input
          type="number"
          name="length-to"
          min="0.25"
          step="any"
          aria-label="Longest"
        /><select name="length-unit" aria-label="Unit">
          <option value="60">min</option>
          <option value="1">s</option>
        </select></span
      >
    </div>
    <details class="tpl-more">
      <summary>More direction</summary>
      <div class="tpl-more-grid">
        ${select(
          'elaboration',
          'Elaboration',
          ELABORATION_LABELS,
          settings.elaboration
        )}${select('drama', 'Drama', DRAMA_LABELS, settings.drama)}${select(
          'structure',
          'Order',
          STRUCTURE_LABELS,
          settings.structure
        )}${select(
          'audience',
          'For',
          { '': narrative.audience, ...AUDIENCE_LABELS },
          settings.audience || ''
        )}
      </div>
      <p class="tpl-leads">
        <span>Material that leads</span>${LEADS.map(
          (kind) =>
            `<label><input type="checkbox" name="leads" value="${kind}"${settings.leads.includes(kind) ? ' checked' : ''}> ${EVIDENCE_LABELS[kind]}</label>`
        ).join('')}
      </p>
    </details>
  </fieldset>`
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
 * template, the one chosen with how to tell it, and the way to the gallery,
 * where they are chosen.
 */
export const templatePicker = (
  choice: TemplateChoice | undefined,
  look?: Branding,
  /** The notebook's first wireframe, shown in the chosen template's card. */
  preview?: string
) => {
  const narrative = narrativeById(choice?.narrative)
  return html`<fieldset class="tpl-picker" style="${lookStyle(look)}">
    <legend>Template</legend>
    <div class="tpl-picker-grid">
      <label class="tpl-option tpl-option-none">
        <input
          type="radio"
          name="narrative"
          value=""
          ${narrative ? '' : 'checked'}
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
      ${narrative
        ? html`<label class="tpl-option">
            <input
              type="radio"
              name="narrative"
              value="${narrative.id}"
              checked
            />
            <span
              class="tpl-option-thumb${preview ? ' is-page' : ''}"
              aria-hidden="true"
              >${
                // This notebook's own page, never another story's sample
                // (review 6); the gallery keeps the samples.
                preview || templateSketch(narrative.beats[0].example)
              }</span
            >
            <span class="tpl-option-text"
              ><b>${escape(narrative.name)}</b
              ><small>${escape(narrative.line)}</small></span
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
          ><b>${narrative ? 'Choose another' : 'Browse templates'}</b
          ><small>${NARRATIVES.length} stories, each told your way</small></span
        >
      </button>
    </div>
    ${narrative ? directionFields(narrative, choice?.direction) : ''}
  </fieldset>`
}

/** With a template, how much the creator is on camera is its direction's. */
export const onCameraChoice = (choice: TemplateChoice | undefined) => {
  const narrative = narrativeById(choice?.narrative)
  const value = narrative
    ? directionSettings(narrative, choice?.direction).onCamera
    : 'ends'
  return `<fieldset class="tpl-on-camera"${narrative ? '' : ' hidden disabled'}><legend>You on camera</legend>${(
    Object.keys(ON_CAMERA_LABELS) as OnCamera[]
  )
    .map(
      (key) =>
        `<label><input type="radio" name="oncamera" value="${key}"${key === value ? ' checked' : ''}> ${ON_CAMERA_LABELS[key]}</label>`
    )
    .join('')}</fieldset>`
}

/** The length a dialog asks for, always a range, the shorter end first. */
const lengthFrom = (values: FormData): LengthRange | null => {
  const value = String(values.get('length') || '')
  if (value !== 'own') {
    const range = value.split(',').map(Number)
    return range.length === 2 && range.every(Number.isFinite)
      ? (range as LengthRange)
      : null
  }
  const unit = Number(values.get('length-unit')) || 60
  const [from, to] = ['length-from', 'length-to'].map(
    (name) => Number(values.get(name)) * unit
  )
  if (!(from > 0 && to > from))
    throw new Error('Give the length as a range, the shorter end first')
  return [Math.round(from), Math.round(to)]
}

/**
 * The template, direction and presence a dialog chose. Only what differs
 * from the chosen direction is kept, so the direction stays a preset.
 */
export const templateFromForm = (
  values: FormData
): { narrative?: string; direction?: Direction; presence?: Presence } => {
  const narrative = narrativeById(String(values.get('narrative') || ''))
  if (!narrative) return {}
  const preset = presetFor(narrative, String(values.get('preset') || ''))
  const base = directionSettings(narrative, { preset })
  const direction: Direction = { preset }
  const length = lengthFrom(values) ?? base.length
  if (length.join() !== base.length.join()) direction.length = length
  const picked = {
    elaboration: values.get('elaboration'),
    drama: values.get('drama'),
    structure: values.get('structure'),
    onCamera: values.get('oncamera')
  }
  for (const [key, value] of Object.entries(picked))
    if (value && value !== base[key as keyof typeof picked])
      Object.assign(direction, { [key]: String(value) })
  const audience = String(values.get('audience') || '')
  if (audience) Object.assign(direction, { audience })
  if (values.has('elaboration')) {
    const leads = values.getAll('leads').map(String) as EvidenceKind[]
    if ([...leads].sort().join() !== [...base.leads].sort().join())
      direction.leads = leads
  }
  return {
    narrative: narrative.id,
    direction,
    presence: presenceFor(directionSettings(narrative, direction).onCamera)
  }
}

/**
 * Keeps a dialog's template fields in step: no template hides how to tell
 * it, a direction sets every field to its own, and your own length opens
 * its two fields.
 */
export const syncTemplateFields = (
  form: HTMLFormElement,
  target: EventTarget | null
) => {
  const field = target as HTMLInputElement | null
  const hide = (selector: string, hidden: boolean) =>
    form.querySelectorAll<HTMLFieldSetElement>(selector).forEach((item) => {
      item.hidden = hidden
      item.toggleAttribute('disabled', hidden)
    })
  if (field?.name === 'narrative') {
    const none = !field.value
    hide('.tpl-direction, .tpl-on-camera', none)
    hide('.tpl-presence', !none)
  }
  if (field?.name === 'preset' && field.dataset.settings) {
    const settings = JSON.parse(field.dataset.settings)
    // Picking an option deselects the rest of a single select; the length
    // is a set of chips.
    const set = (name: string, value: string) => {
      const item = form.querySelector<HTMLOptionElement>(
        `select[name="${name}"] option[value="${value}"]`
      )
      if (item) item.selected = true
      const chip = form.querySelector<HTMLInputElement>(
        `input[name="${name}"][value="${value}"]`
      )
      if (chip) chip.checked = true
    }
    set('length', settings.length.join(','))
    set('elaboration', settings.elaboration)
    set('drama', settings.drama)
    set('structure', settings.structure)
    form
      .querySelectorAll<HTMLInputElement>('input[name="oncamera"]')
      .forEach((radio) => (radio.checked = radio.value === settings.onCamera))
    form
      .querySelectorAll<HTMLInputElement>('input[name="leads"]')
      .forEach((box) => (box.checked = settings.leads.includes(box.value)))
  }
  const own = form.querySelector<HTMLElement>('.tpl-length-own')
  const length = [
    ...form.querySelectorAll<HTMLInputElement>('input[name="length"]')
  ].find((input) => input.checked)
  if (own) own.hidden = length?.value !== 'own'
}

/** Which beats a scene carries, in the scene's header; empty without a template. */
export const sceneBeatChip = (project: Project, sceneId: string) => {
  const shape = sceneNarrative(project.video, sceneId, plannedPages(project))
  if (!shape) return ''
  const names = shape.beats.map((plan) => plan.beat.name)
  return html`<button
    type="button"
    class="tpl-scene-chip"
    data-action="scene-beats"
    data-popover="scene-beats"
    data-scene-id="${escape(sceneId)}"
    aria-label="${escape(
      `Carries ${names.join(' and ')}, in ${shape.narrative.name}. Change`
    )}"
  >
    ${beatDot(shape.beats[0].beat.function)}<span
      >${escape(names.join(' · '))}</span
    >
  </button>`
}

/** The menu that gives a scene another beat of the video's template. */
export const sceneBeatMenu = (project: Project, sceneId: string) => {
  const video = project.video
  const shape = sceneNarrative(video, sceneId, plannedPages(project))
  if (!video || !shape) return ''
  const own = video.scenes[shape.index].beats
  const chosen = own?.length === 1 ? own[0] : own?.length ? null : ''
  const inOrder = shape.layout[shape.index].map(
    (id) => shape.plans.find((plan) => plan.beat.id === id)!.beat.name
  )
  const choice = (beat: string, label: string, note: string, fn: string) =>
    html`<button
      type="button"
      role="radio"
      aria-checked="${chosen === beat}"
      data-action="scene-beats-set"
      data-beat="${beat}"
      data-scene-id="${escape(sceneId)}"
    >
      ${beatDot(fn)}<span>${escape(label)}</span><small>${escape(note)}</small>
    </button>`
  return html`<p class="popover-title">${escape(shape.narrative.name)}</p>
    <p class="popover-note">
      Which beat this scene carries. Changing it plans the scene again.
    </p>
    <div class="tpl-slot-menu" role="radiogroup" aria-label="Beat">
      ${choice(
        '',
        plannedPages(project)?.[shape.index]?.length
          ? 'As its wireframe plans'
          : 'Its share in order',
        inOrder.join(' · '),
        'order'
      )}
      ${shape.plans
        .map((plan) =>
          choice(
            plan.beat.id,
            plan.beat.name,
            plan.told
              ? FUNCTION_LABELS[plan.beat.function]
              : 'Left out of this telling',
            plan.beat.function
          )
        )
        .join('')}
    </div>`
}
