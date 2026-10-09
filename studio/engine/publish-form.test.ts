import { expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'

// The YouTube form's privacy choice and its publish time (review 6, REL-4).
vi.mock('../app/studio-api', () => ({ studioApi: { request: vi.fn() } }))

it('holds the privacy at private while a time is set, and gives the choice back when it is cleared', async () => {
  const { syncPublishForm } = await import('../app/release-controller')
  const { document } = parseHTML(
    '<form><select name="privacy"><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select><input name="publishAt" value=""></form>'
  )
  const form = document.querySelector('form')!
  const privacy = form.querySelector('select')!
  const at = form.querySelector('input')!
  const choose = (value: string) => {
    const option = [...privacy.querySelectorAll('option')].find(
      (item) => item.value === value
    )
    if (option) option.selected = true
  }
  const chosen = () =>
    [...privacy.querySelectorAll('option')].find((option) => option.selected)
      ?.value
  choose('public')
  at.value = '2026-11-01T09:00'
  syncPublishForm(form)
  expect(privacy.disabled).toBe(true)
  expect(chosen()).toBe('private')
  at.value = ''
  syncPublishForm(form)
  expect(privacy.disabled).toBe(false)
  expect(chosen()).toBe('public')
})
