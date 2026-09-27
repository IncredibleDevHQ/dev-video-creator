// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createToaster } from './toast'
import { installTooltips, type Tooltips } from './tooltip'

const pointer = (type: string, target: Element, relatedTarget: Element | null = null) =>
  target.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { pointerType: 'mouse', relatedTarget }))

describe('the studio\'s toasts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = '<main></main><div id="toast" role="status" aria-live="polite" hidden></div>'
  })
  afterEach(() => vi.useRealTimers())

  it('keeps #toast as the newest card, its words the message', () => {
    const show = createToaster(document.getElementById('toast')!)
    show('Saved')
    const toast = document.getElementById('toast')!
    expect(toast.hidden).toBe(false)
    expect(toast.textContent).toBe('Saved')
    show('Exported')
    expect(document.getElementById('toast')!.textContent).toBe('Exported')
    expect([...document.querySelectorAll('.ui-toast:not(#toast)')].map(card => card.textContent)).toEqual(['Saved'])
  })

  it('stacks three at most, the oldest leaving first', () => {
    const show = createToaster(document.getElementById('toast')!)
    for (const message of ['One', 'Two', 'Three', 'Four', 'Five']) show(message)
    vi.advanceTimersByTime(200)
    const cards = [...document.querySelectorAll<HTMLElement>('.ui-toast:not([hidden])')].map(card => card.textContent)
    expect(cards).toEqual(['Three', 'Four', 'Five'])
  })

  it('keeps one card for the same news said again, its time started over', () => {
    const show = createToaster(document.getElementById('toast')!)
    show('Could not copy', { tone: 'bad' })
    vi.advanceTimersByTime(3000)
    show('Could not copy', { tone: 'bad' })
    show('Could not copy', { tone: 'bad' })
    expect([...document.querySelectorAll('.ui-toast:not([hidden])')].map(card => card.textContent)).toEqual(['Could not copy'])
    vi.advanceTimersByTime(3000)
    expect(document.getElementById('toast')!.hidden).toBe(false)
    // The same words in another tone are other news.
    show('Could not copy')
    expect(document.querySelectorAll('.ui-toast:not([hidden])').length).toBe(2)
  })

  it('sits inside an open modal dialog, whose page takes no clicks, and comes back when it closes', () => {
    const show = createToaster(document.getElementById('toast')!)
    const dialog = document.createElement('dialog')
    document.body.append(dialog)
    dialog.setAttribute('open', '')
    dialog.matches = ((selector: string) => selector === ':modal' || Element.prototype.matches.call(dialog, selector)) as typeof dialog.matches
    show('Exported', { action: { label: 'Show', run: () => undefined } })
    const region = document.querySelector('.ui-toasts')!
    expect(region.parentElement).toBe(dialog)
    expect(dialog.contains(document.getElementById('toast'))).toBe(true)
    dialog.removeAttribute('open')
    dialog.dispatchEvent(new Event('close'))
    expect(region.parentElement).toBe(document.body)
    expect(document.getElementById('toast')!.hidden).toBe(false)
  })

  it('runs its one action, and is dismissed or times out', () => {
    const show = createToaster(document.getElementById('toast')!)
    const run = vi.fn()
    show('Export ready', { action: { label: 'Download', run } })
    const toast = document.getElementById('toast')!
    ;(toast.querySelector('.ui-toast-action') as HTMLButtonElement).click()
    expect(run).toHaveBeenCalledOnce()
    expect(toast.hidden).toBe(true)
    show('Saved')
    ;(toast.querySelector('.ui-toast-dismiss') as HTMLButtonElement).click()
    expect(toast.hidden).toBe(true)
    show('Saved again')
    vi.advanceTimersByTime(4300)
    expect(toast.hidden).toBe(true)
  })
})

describe('the studio\'s tooltips', () => {
  let tooltips: Tooltips | null = null
  const install = () => (tooltips = installTooltips(document))
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = '<button id="all" title="All scenes at once (O)" aria-keyshortcuts="O">All</button><button id="play" title="Play">▶</button><p id="away">away</p>'
  })
  afterEach(() => {
    tooltips?.dispose()
    tooltips = null
    vi.useRealTimers()
  })

  it('lends a title while the pointer is over the control, and gives it back', () => {
    install()
    const all = document.getElementById('all')!
    pointer('pointerover', all)
    // Lent at once, so the operating system's tooltip never shows.
    expect(all.hasAttribute('title')).toBe(false)
    const tip = document.getElementById('ui-tooltip')!
    expect(tip.hidden).toBe(true)
    vi.advanceTimersByTime(500)
    expect(tip.hidden).toBe(false)
    expect(tip.querySelector('span')!.textContent).toBe('All scenes at once (O)')
    // The key is in the words already: not said twice.
    expect(tip.querySelector('kbd')!.hidden).toBe(true)
    pointer('pointerout', all, document.getElementById('away'))
    expect(all.getAttribute('title')).toBe('All scenes at once (O)')
    expect(tip.hidden).toBe(true)
  })

  it('follows a title changed while it is lent', async () => {
    install()
    const play = document.getElementById('play')!
    pointer('pointerover', play)
    vi.advanceTimersByTime(500)
    play.setAttribute('title', 'Pause')
    await vi.advanceTimersByTimeAsync(0)
    const tip = document.getElementById('ui-tooltip')!
    expect(tip.querySelector('span')!.textContent).toBe('Pause')
    expect(play.hasAttribute('title')).toBe(false)
    pointer('pointerout', play, document.getElementById('away'))
    expect(play.getAttribute('title')).toBe('Pause')
  })

  it('shows on keyboard focus only where the control is an icon', () => {
    document.body.insertAdjacentHTML('beforeend', '<button id="close" title="Close the panel"><svg></svg></button>')
    install()
    const tip = document.getElementById('ui-tooltip')!
    const focusVisible = (element: HTMLElement) => {
      element.matches = ((selector: string) => selector === ':focus-visible' || Element.prototype.matches.call(element, selector)) as typeof element.matches
      element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    }
    focusVisible(document.getElementById('all')!)
    expect(tip.hidden).toBe(true)
    focusVisible(document.getElementById('close')!)
    expect(tip.hidden).toBe(false)
    expect(tip.querySelector('span')!.textContent).toBe('Close the panel')
  })

  it('moves on to the next control at once', () => {
    install()
    const all = document.getElementById('all')!
    const play = document.getElementById('play')!
    pointer('pointerover', all)
    vi.advanceTimersByTime(500)
    pointer('pointerout', all, play)
    pointer('pointerover', play)
    const tip = document.getElementById('ui-tooltip')!
    expect(tip.hidden).toBe(false)
    expect(tip.querySelector('span')!.textContent).toBe('Play')
    expect(all.getAttribute('title')).toBe('All scenes at once (O)')
  })
})
