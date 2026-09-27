// A select in the studio's style (the component audit), over the native
// one. The <select> stays as the value: code sets and reads it, its change
// event fires as before, and what finds it by its class still does. It sits
// unseen under a trigger that shows the chosen option — cut with an ellipsis,
// never mid-word — and the list opens on the menu's surface in place of the
// operating system's menu: the arrows, Home and End, a typed letter, Enter,
// Space, Escape and Tab. The list is the select's own, in the page's top
// layer: a menu or panel holding the select counts a click on it as inside,
// and the keys it answers go no further.
import './menu.css'
import { icon } from './icons'

let closeOpen: ((restore: boolean) => void) | null = null

export const enhanceSelect = (select: HTMLSelectElement): HTMLElement => {
  if (select.parentElement?.classList.contains('ui-select')) return select.parentElement
  const wrap = document.createElement('span')
  wrap.className = 'ui-select'
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = 'ui-select-trigger'
  trigger.setAttribute('aria-haspopup', 'listbox')
  trigger.setAttribute('aria-expanded', 'false')
  const value = document.createElement('span')
  value.className = 'ui-select-value'
  trigger.append(value, icon('chevron-down', 'ui-icon ui-select-caret'))
  // The app puts the keyboard back by data-focus after it redraws: the
  // trigger is what holds the keyboard now.
  if (select.dataset.focus) {
    trigger.dataset.focus = select.dataset.focus
    select.dataset.nativeFocus = select.dataset.focus
    delete select.dataset.focus
  }
  if (select.parentNode) select.replaceWith(wrap)
  select.classList.add('ui-select-native')
  select.tabIndex = -1
  select.setAttribute('aria-hidden', 'true')
  wrap.append(select, trigger)

  const name = () => select.getAttribute('aria-label') || ''
  const sync = () => {
    const chosen = select.options[select.selectedIndex]?.textContent?.trim() || ''
    value.textContent = chosen
    trigger.disabled = select.disabled
    trigger.setAttribute('aria-label', name() ? `${name()}: ${chosen}` : chosen)
    // The whole choice on hover, where the trigger cuts it short.
    const said = select.getAttribute('title')
    if (said) trigger.title = said
    else if (value.scrollWidth > value.clientWidth + 1) trigger.title = chosen
    else trigger.removeAttribute('title')
  }
  sync()
  select.addEventListener('change', sync)
  // Code that sets the value outright, with no change event, shows on the
  // trigger too.
  for (const key of ['value', 'selectedIndex'] as const) {
    const own = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, key)
    if (!own?.get || !own.set) continue
    const { get, set } = own
    Object.defineProperty(select, key, {
      configurable: true,
      get() { return get.call(this) },
      set(next) {
        set.call(this, next)
        sync()
      },
    })
  }
  new MutationObserver(sync).observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'title', 'aria-label'] })
  window.requestAnimationFrame(sync)

  const open = () => {
    if (select.disabled) return
    closeOpen?.(false)
    const list = document.createElement('div')
    list.className = 'ui-select-list'
    list.setAttribute('role', 'listbox')
    if (name()) list.setAttribute('aria-label', name())
    const layered = 'popover' in list
    if (layered) list.setAttribute('popover', 'manual')
    const options = [...select.options]
    let active = Math.max(0, select.selectedIndex)
    const rows = options.map((option, index) => {
      const row = document.createElement('div')
      row.className = 'ui-select-option'
      row.setAttribute('role', 'option')
      row.id = `ui-select-option-${index}`
      row.setAttribute('aria-selected', String(option.selected))
      if (option.disabled) row.setAttribute('aria-disabled', 'true')
      if (option.selected) row.append(icon('check', 'ui-icon ui-select-check'))
      const words = document.createElement('span')
      words.textContent = option.textContent || ''
      row.append(words)
      row.addEventListener('pointermove', () => mark(index))
      row.addEventListener('click', () => choose(index))
      return row
    })
    list.append(...rows)
    list.tabIndex = -1
    wrap.append(list)
    const mark = (index: number) => {
      active = index
      rows.forEach((row, at) => row.classList.toggle('is-active', at === index))
      list.setAttribute('aria-activedescendant', rows[index]?.id || '')
      // Scrolled within the list only: the page behind it stays where it is.
      const row = rows[index]
      if (!row) return
      if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop
      else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight
    }
    const step = (from: number, by: number) => {
      for (let at = from + by; at >= 0 && at < options.length; at += by) if (!options[at].disabled) return at
      return from
    }
    const choose = (index: number) => {
      const option = options[index]
      if (!option || option.disabled) return
      close(true)
      if (select.value === option.value) return
      select.value = option.value
      select.dispatchEvent(new Event('input', { bubbles: true }))
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
    let typed = ''
    let typedAt = 0
    const onKey = (event: KeyboardEvent) => {
      const moves: Record<string, () => number> = {
        ArrowDown: () => step(active, 1),
        ArrowUp: () => step(active, -1),
        Home: () => step(-1, 1),
        End: () => step(options.length, -1),
        PageDown: () => step(active, 1),
        PageUp: () => step(active, -1),
      }
      // Tab leaves from the trigger, on to the control after it.
      if (event.key === 'Tab') {
        close(true)
        return
      }
      // A key with ⌘, Ctrl or Alt is the app's or the browser's.
      if (event.metaKey || event.ctrlKey || event.altKey) return
      // A space while a search is being typed is part of it, not a choice.
      const searching = typed && performance.now() - typedAt < 600
      if (event.key === ' ' && searching) {
        typed += ' '
        typedAt = performance.now()
      } else if (event.key in moves) mark(moves[event.key]())
      else if (event.key === 'Enter' || event.key === ' ') choose(active)
      else if (event.key === 'Escape') close(true)
      else if (event.key.length === 1) {
        // A typed letter finds the next option that starts with what was typed.
        typed = performance.now() - typedAt > 600 ? event.key.toLowerCase() : typed + event.key.toLowerCase()
        typedAt = performance.now()
        const found = options.findIndex((option, at) => at !== active && !option.disabled && (option.textContent || '').trim().toLowerCase().startsWith(typed))
        if (found >= 0) mark(found)
      } else return
      // The list answered it: not the menu, the stage or the dialog behind.
      event.preventDefault()
      event.stopPropagation()
    }
    const onOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || list.contains(event.target) || trigger.contains(event.target)) return
      close(false)
    }
    const place = () => {
      const around = trigger.getBoundingClientRect()
      list.style.minWidth = `${Math.round(around.width)}px`
      const own = list.getBoundingClientRect()
      const below = window.innerHeight - around.bottom - 8
      const top = own.height <= below || around.top < own.height + 8 ? around.bottom + 4 : around.top - own.height - 4
      const left = Math.min(Math.max(8, around.left), window.innerWidth - own.width - 8)
      list.style.top = `${Math.round(top)}px`
      list.style.left = `${Math.round(left)}px`
    }
    const close = (restore: boolean) => {
      if (closeOpen !== close) return
      closeOpen = null
      document.removeEventListener('pointerdown', onOutside, true)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', onScroll, true)
      // Hidden now, gone once this event is over: a menu or panel holding the
      // select still finds the click that chose as a click inside it.
      list.hidden = true
      window.setTimeout(() => list.remove(), 0)
      trigger.setAttribute('aria-expanded', 'false')
      trigger.removeAttribute('aria-controls')
      if (restore) trigger.focus({ preventScroll: true })
    }
    const dismiss = () => close(false)
    const onScroll = (event: Event) => { if (!(event.target instanceof Node && list.contains(event.target))) close(false) }
    closeOpen = close
    list.id = `ui-select-list-${Math.random().toString(36).slice(2, 8)}`
    trigger.setAttribute('aria-expanded', 'true')
    trigger.setAttribute('aria-controls', list.id)
    list.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onOutside, true)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', onScroll, true)
    if (layered) {
      try { list.showPopover() } catch { /* shown in the page instead */ }
    }
    place()
    mark(select.selectedIndex >= 0 && !options[select.selectedIndex]?.disabled ? select.selectedIndex : step(-1, 1))
    list.focus({ preventScroll: true })
  }

  trigger.addEventListener('click', () => (trigger.getAttribute('aria-expanded') === 'true' ? closeOpen?.(true) : open()))
  trigger.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || !['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    open()
  })
  return wrap
}
