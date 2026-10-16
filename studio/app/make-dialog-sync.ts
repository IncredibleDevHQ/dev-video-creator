// The make dialog's parts that follow its choices, from the moment it opens:
// the two-voices warning, and the one length it asks for. A storyboard asks
// its own range; a template's length chips are for scene by scene (the Jev
// series run showed both, disagreeing, and the warning with "Not on camera").
export const syncMakeDialog = (root: ParentNode) => {
  const form = root.querySelector<HTMLFormElement>(
    '#video-form, #video-settings-form'
  )
  if (!form) return
  const values = new FormData(form)
  const warning = form.querySelector<HTMLElement>('.two-voices')
  if (warning)
    warning.hidden =
      !String(values.get('voice')).startsWith('ai:') ||
      (values.get('presence') ?? values.get('oncamera')) === 'off' ||
      values.get('oncamera') === 'none'
  const chips = form.querySelector<HTMLElement>('.tpl-length')
  const range = form.querySelector<HTMLFieldSetElement>('.length-choice')
  if (!chips || !range) return
  const storyboard = values.get('production') === 'storyboard'
  chips.hidden = storyboard
  range.hidden = !storyboard
  range.disabled = !storyboard
}
