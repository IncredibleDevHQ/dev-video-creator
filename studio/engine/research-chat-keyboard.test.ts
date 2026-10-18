import { expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { installChatKeyboard } from '../app/research-chat-keyboard'
it('sends Enter only, preserving newlines, IME input, empty drafts and disabled sends', () => {
  const { document, Event } = parseHTML(
    '<main><form id="f"><textarea id="research-question"></textarea></form><button class="research-send" form="f">Send</button></main>'
  )
  const root = document.querySelector('main')!
  const input = document.querySelector('textarea')!
  const send = document.querySelector('button')!
  const submit = vi.fn()
  Object.defineProperty(input, 'form', { value: { requestSubmit: submit } })
  installChatKeyboard(root)
  const press = (extra = {}) => {
    const event = new Event('keydown', { bubbles: true, cancelable: true })
    Object.assign(event, { key: 'Enter', ...extra })
    input.dispatchEvent(event)
  }
  input.value = 'A follow-up'
  press({ shiftKey: true })
  press({ isComposing: true })
  expect(submit).not.toHaveBeenCalled()
  press()
  expect(submit).toHaveBeenCalledWith(send)
  submit.mockClear()
  send.disabled = true
  press()
  send.disabled = false
  input.value = '  '
  press()
  expect(submit).not.toHaveBeenCalled()
})
