import { afterEach, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { showError } from '../app/error-surface'
afterEach(() => vi.unstubAllGlobals())
it('reuses one error surface and treats errors as text, including inside a modal', () => {
  const { document } = parseHTML(
    '<html><body><div id="app"></div><dialog open></dialog></body></html>'
  )
  vi.stubGlobal('document', document)
  showError(new Error('<img src=x onerror=alert(1)>'))
  expect(document.querySelector('dialog #studio-error')).not.toBeNull()
  expect(document.querySelector('#studio-error img')).toBeNull()
  showError(new Error('Try again'))
  expect(document.querySelectorAll('#studio-error').length).toBe(1)
  expect(document.querySelector('#studio-error span')!.textContent).toBe(
    'Try again'
  )
  document.querySelector('dialog')!.remove()
  showError(new Error('The next action failed'))
  expect(document.querySelector('body > #studio-error')).not.toBeNull()
  document.querySelector<HTMLButtonElement>('#studio-error button')!.click()
  expect(document.querySelector('#studio-error')).toBeNull()
})
