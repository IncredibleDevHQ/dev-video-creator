// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enhanceSelect } from './select'

const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
// The open list: a closed one is hidden at once and gone after the event.
const shown = () => document.querySelector<HTMLElement>('.ui-select-list:not([hidden])')
const build = () => {
  document.body.innerHTML = '<main></main>'
  const select = document.createElement('select')
  select.className = 'ws-voice'
  select.setAttribute('aria-label', 'Who speaks in this scene')
  select.dataset.focus = 'voice:s1'
  for (const [value, text, disabled] of [['', 'Voice: decide later', true], ['human', 'Voice: you present it', false], ['generated', 'Voice: generated voice', false], ['silent', 'Voice: silent', false]] as const) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = text
    option.disabled = disabled
    select.append(option)
  }
  select.value = 'human'
  document.querySelector('main')!.append(select)
  const wrap = enhanceSelect(select)
  return { select, wrap, trigger: wrap.querySelector<HTMLButtonElement>('.ui-select-trigger')! }
}

describe('a select in the studio\'s style', () => {
  beforeEach(() => document.querySelectorAll('.ui-select-list').forEach(list => list.remove()))

  it('keeps the native select as the value, under a trigger that shows it', () => {
    const { select, wrap, trigger } = build()
    expect(wrap.contains(select)).toBe(true)
    expect(select.classList.contains('ws-voice')).toBe(true)
    expect(trigger.textContent).toBe('Voice: you present it')
    expect(trigger.getAttribute('aria-label')).toBe('Who speaks in this scene: Voice: you present it')
    // The keyboard comes back to the trigger when the app redraws.
    expect(trigger.dataset.focus).toBe('voice:s1')
    expect(select.dataset.focus).toBeUndefined()
  })

  it('opens a list, walks it with the arrows past disabled options, and chooses with Enter', () => {
    const { select, trigger } = build()
    const changed = vi.fn()
    select.addEventListener('change', changed)
    trigger.click()
    const list = shown()!
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect([...list.querySelectorAll('[role="option"]')].map(row => row.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false'])
    key(list, 'ArrowDown')
    key(list, 'Enter')
    expect(select.value).toBe('generated')
    expect(changed).toHaveBeenCalledOnce()
    expect(trigger.textContent).toBe('Voice: generated voice')
    expect(shown()).toBeNull()
    trigger.click()
    const again = shown()!
    key(again, 'Home')
    key(again, 'Enter')
    // "decide later" is disabled: Home stops at the first choice that can be made.
    expect(select.value).toBe('human')
  })

  it('closes on Escape without choosing, and finds an option by a typed letter', () => {
    const { select, trigger } = build()
    trigger.click()
    key(shown()!, 'Escape')
    expect(shown()).toBeNull()
    expect(select.value).toBe('human')
    trigger.click()
    const list = shown()!
    for (const letter of 'voice: s') key(list, letter)
    key(list, 'Enter')
    expect(select.value).toBe('silent')
  })

  it('follows the value when code sets it, with or without a change event', async () => {
    const { select, trigger } = build()
    select.value = 'silent'
    select.dispatchEvent(new Event('change'))
    expect(trigger.textContent).toBe('Voice: silent')
    select.value = 'generated'
    expect(trigger.textContent).toBe('Voice: generated voice')
    expect(select.value).toBe('generated')
    select.selectedIndex = 1
    expect(trigger.textContent).toBe('Voice: you present it')
    select.disabled = true
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(trigger.disabled).toBe(true)
  })

  it('keeps its list inside it, and the keys it answers to itself', async () => {
    const { select, wrap, trigger } = build()
    const panel = document.querySelector('main')!
    const heard = vi.fn()
    panel.addEventListener('keydown', event => heard(event.key))
    trigger.click()
    expect(wrap.contains(shown())).toBe(true)
    // A menu holding the select counts a click that chooses as inside it.
    let inside: boolean | null = null
    document.addEventListener('click', event => { inside = panel.contains(event.target as Node) }, { once: true })
    ;(shown()!.querySelectorAll<HTMLElement>('[role="option"]')[3]).click()
    expect(select.value).toBe('silent')
    expect(inside).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(document.querySelector('.ui-select-list')).toBeNull()
    // Opened from the keyboard, walked and closed: none of it reaches the panel.
    key(trigger, 'ArrowDown')
    key(shown()!, 'ArrowUp')
    key(shown()!, 'Escape')
    expect(heard).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
    // Tab closes it and leaves from the trigger.
    key(trigger, 'Enter')
    key(shown()!, 'Tab')
    expect(shown()).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(heard).toHaveBeenCalledWith('Tab')
  })
})
