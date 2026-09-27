// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { radioKeys, tabList } from './tabs'

const build = () => {
  document.body.innerHTML = '<div role="tablist"><button role="tab" aria-selected="true">Layout</button><button role="tab" aria-selected="false">Style</button><button role="tab" aria-selected="false" disabled>Logo</button><button role="tab" aria-selected="false">Background</button></div>'
  const list = document.querySelector<HTMLElement>('[role="tablist"]')!
  const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  // As the app's own handlers do: a click chooses the tab.
  tabs.forEach(tab => tab.addEventListener('click', () => tabs.forEach(other => other.setAttribute('aria-selected', String(other === tab)))))
  return { list, tabs }
}
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))

describe('a tab list', () => {
  it('keeps only the chosen tab in the Tab order, and follows a click', () => {
    const { list, tabs } = build()
    tabList(list)
    // The disabled tab is out of the Tab order whatever its index.
    const order = () => tabs.filter(tab => !tab.disabled).map(tab => tab.tabIndex)
    expect(order()).toEqual([0, -1, -1])
    tabs[3].click()
    expect(order()).toEqual([-1, -1, 0])
  })

  it('moves along with the arrows, Home and End, past a disabled tab, and chooses as it goes', () => {
    const { list, tabs } = build()
    tabList(list)
    tabs[0].focus()
    key(tabs[0], 'ArrowRight')
    expect(document.activeElement).toBe(tabs[1])
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    key(tabs[1], 'ArrowRight')
    expect(document.activeElement).toBe(tabs[3])
    key(tabs[3], 'ArrowRight')
    expect(document.activeElement).toBe(tabs[0])
    key(tabs[0], 'End')
    expect(document.activeElement).toBe(tabs[3])
    key(tabs[3], 'Home')
    expect(document.activeElement).toBe(tabs[0])
    expect(tabs.filter(tab => !tab.disabled).map(tab => tab.tabIndex)).toEqual([0, -1, -1])
  })

  it('stands on ↑ and ↓ when it is vertical', () => {
    const { list, tabs } = build()
    tabList(list, { vertical: true })
    expect(list.getAttribute('aria-orientation')).toBe('vertical')
    tabs[0].focus()
    key(tabs[0], 'ArrowRight')
    expect(document.activeElement).toBe(tabs[0])
    key(tabs[0], 'ArrowDown')
    expect(document.activeElement).toBe(tabs[1])
    key(tabs[1], 'ArrowUp')
    expect(document.activeElement).toBe(tabs[0])
  })

  it('as a radio group whose choice costs something, moves the keyboard but chooses only on Enter or Space', () => {
    document.body.innerHTML = '<div role="radiogroup"><button role="radio" aria-checked="false">You</button><button role="radio" aria-checked="true">Generated</button><button role="radio" aria-checked="false">Silent</button></div>'
    const group = document.querySelector<HTMLElement>('[role="radiogroup"]')!
    const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    let chosen = ''
    radios.forEach(radio => radio.addEventListener('click', () => { chosen = radio.textContent || '' }))
    radioKeys(group, { vertical: true })
    expect(radios.map(radio => radio.tabIndex)).toEqual([-1, 0, -1])
    radios[1].focus()
    key(radios[1], 'ArrowDown')
    expect(document.activeElement).toBe(radios[2])
    expect(chosen).toBe('')
  })
})

