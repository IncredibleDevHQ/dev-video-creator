import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { closePopover, openPopover } from '../app/popover'

afterEach(() => {
  closePopover()
  vi.unstubAllGlobals()
})

/** A window of the given width, a 300-wide panel (linkedom lays nothing
 * out), and a control whose box is given. */
const at = (width: number, box: { left: number; right: number }) => {
  const { document, window } = parseHTML('<html><body></body></html>')
  for (const [name, value] of [
    ['offsetWidth', 300],
    ['offsetHeight', 200]
  ] as const)
    Object.defineProperty(window.HTMLElement.prototype, name, {
      configurable: true,
      get: () => value
    })
  vi.stubGlobal('document', document)
  vi.stubGlobal(
    'window',
    Object.assign(window, { innerWidth: width, innerHeight: 900 })
  )
  const anchor = document.createElement('button')
  anchor.getBoundingClientRect = () =>
    ({
      ...box,
      top: 100,
      bottom: 130,
      width: box.right - box.left,
      height: 30
    }) as DOMRect
  document.body.append(anchor)
  return anchor as unknown as HTMLElement
}

describe('a popover near an edge (UX-9)', () => {
  it('opens inside the window on the right as on the left', () => {
    // A control running past the right edge: the panel ends 12 inside it.
    const right = openPopover(at(1440, { left: 1400, right: 1500 }), 'a', '')!
    expect(right.style.left).toBe(`${1440 - 300 - 12}px`)
    closePopover()
    // Near the left edge it starts at the control, as before.
    const left = openPopover(at(1440, { left: 20, right: 120 }), 'b', '')!
    expect(left.style.left).toBe('20px')
  })
})
