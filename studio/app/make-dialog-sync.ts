// The make dialog's parts that follow its choices, from the moment it opens:
// what they ask the creator to record, the two-voices warning, and the one
// length it asks for. A storyboard asks its own range; a template's length
// chips are for scene by scene (the Jev series run showed both, disagreeing,
// and the warning with "Not on camera").

/** What the camera and the voice chosen ask the creator to record, said
 * before the video is made (review 8: the defaults asked for both). */
export const toRecord = (onCamera: boolean, voice: string | null) =>
  voice === null
    ? ''
    : voice === 'record'
      ? onCamera
        ? 'You record yourself on camera, and the narration.'
        : 'You record the narration for each scene.'
      : onCamera
        ? 'You record yourself on camera.'
        : 'Nothing for you to record.'

export const syncMakeDialog = (root: ParentNode) => {
  const form = root.querySelector<HTMLFormElement>(
    '#video-form, #video-settings-form'
  )
  if (!form) return
  const values = new FormData(form)
  const camera = values.get('presence') ?? values.get('oncamera')
  const voice = values.get('voice')
  const records = form.querySelector<HTMLElement>('.make-records')
  if (records) {
    records.textContent = toRecord(
      camera !== null && camera !== 'off' && camera !== 'none',
      voice === null ? null : String(voice)
    )
    records.hidden = !records.textContent
  }
  const warning = form.querySelector<HTMLElement>('.two-voices')
  if (warning)
    warning.hidden =
      !String(voice).startsWith('ai:') ||
      camera === 'off' ||
      values.get('oncamera') === 'none'
  const chips = form.querySelector<HTMLElement>('.tpl-length')
  const range = form.querySelector<HTMLFieldSetElement>('.length-choice')
  if (!chips || !range) return
  const storyboard = values.get('production') === 'storyboard'
  chips.hidden = storyboard
  range.hidden = !storyboard
  range.disabled = !storyboard
}
