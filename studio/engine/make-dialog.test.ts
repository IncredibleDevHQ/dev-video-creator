import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioSettings } from '../shared/settings'

const { parseHTML } = await import('linkedom')
const { makeVideoDialog } = await import('../app/video-screen')
const { syncMakeDialog } = await import('../app/make-dialog-sync')

afterEach(() => vi.unstubAllGlobals())

/** A form's fields as FormData reads them: a checked radio's value, and
 * nothing from a disabled fieldset. */
class FormShim {
  constructor(private readonly form: HTMLFormElement) {}
  get = (name: string) => {
    const fields = [
      ...this.form.querySelectorAll<HTMLInputElement>(`[name="${name}"]`)
    ].filter(
      (field) =>
        !field.closest('fieldset[disabled]') &&
        (field.type !== 'radio' || field.checked)
    )
    return fields[0]?.value ?? null
  }
}

const settings = {
  voice: {
    selected: { kind: 'ai', id: 'system:Daniel' },
    clones: [],
    choices: [{ id: 'system:Daniel', name: 'Daniel', language: 'en-GB' }]
  }
} as unknown as StudioSettings

describe('the make dialog of a series episode (Jev series run)', () => {
  it('asks one length, the one for how it is made, and no two-voices warning off camera', () => {
    vi.stubGlobal('FormData', FormShim)
    const slides = ['a', 'b', 'c'].map((id) => ({ id, title: id })) as never
    const { document } = parseHTML(
      `<div>${makeVideoDialog(
        settings,
        undefined,
        { slides, selected: null, only: false },
        undefined,
        {
          narrative: 'how-it-works',
          direction: { preset: 'faceless' },
          length: { min: 120, max: 240, strict: false }
        }
      )}</div>`
    )
    // As a browser does: what the markup checks starts checked.
    for (const input of document.querySelectorAll('input'))
      input.checked = input.hasAttribute('checked')
    syncMakeDialog(document)
    const chips = document.querySelector<HTMLElement>('.tpl-length')!
    const range = document.querySelector<HTMLFieldSetElement>('.length-choice')!
    // A storyboard: its own range shows, the template's chips don't.
    expect([chips.hidden, range.hidden]).toEqual([true, false])
    expect(document.querySelector<HTMLElement>('.two-voices')!.hidden).toBe(
      true
    )
    // Scene by scene: the template's chips, and the range neither shows
    // nor sends.
    for (const input of document.querySelectorAll<HTMLInputElement>(
      'input[name="production"]'
    ))
      input.checked = input.value === 'scenes'
    syncMakeDialog(document)
    expect([chips.hidden, range.hidden, range.disabled]).toEqual([
      false,
      true,
      true
    ])
  })
})
