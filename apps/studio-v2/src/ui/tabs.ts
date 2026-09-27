// The keys of a tab list or a radio group (the component audit): ← and →
// (↑ and ↓ for a list that stands), Home and End move along it, and only the
// chosen item is in the Tab order, so Tab goes on to what it shows. A tab is
// chosen as the keys reach it — its own click does the rest; a radio whose
// choice costs something (a save, a plan made again) waits for Enter or
// Space. Their look is tabs.css, which the app loads after its own styles.

type Keys = { vertical?: boolean }

const roving = (list: HTMLElement, role: 'tab' | 'radio', chooseOnMove: boolean, { vertical = false }: Keys) => {
  const state = role === 'tab' ? 'aria-selected' : 'aria-checked'
  const items = () => [...list.querySelectorAll<HTMLElement>(`[role="${role}"]`)].filter(item => !item.hidden && !(item as HTMLButtonElement).disabled)
  const settle = () => {
    const all = items()
    const on = all.find(item => item.getAttribute(state) === 'true') || all[0]
    all.forEach(item => { item.tabIndex = item === on ? 0 : -1 })
  }
  list.addEventListener('keydown', event => {
    const all = items()
    const at = all.indexOf(event.target as HTMLElement)
    if (at < 0 || event.altKey || event.ctrlKey || event.metaKey) return
    const back = vertical ? 'ArrowUp' : 'ArrowLeft'
    const on = vertical ? 'ArrowDown' : 'ArrowRight'
    const to = event.key === on ? at + 1 : event.key === back ? at - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? all.length - 1 : null
    if (to === null) return
    event.preventDefault()
    const next = all[(to + all.length) % all.length]
    next.focus()
    if (chooseOnMove) next.click()
  })
  // After the item's own click has chosen it.
  list.addEventListener('click', settle)
  if (vertical) list.setAttribute('aria-orientation', 'vertical')
  settle()
  return { settle }
}

export const tabList = (list: HTMLElement, keys: Keys = {}) => roving(list, 'tab', true, keys)
export const radioKeys = (group: HTMLElement, keys: Keys = {}) => roving(group, 'radio', false, keys)
