import { afterEach, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { installSlidesController } from '../app/slides-controller'
import type { AppContext } from '../app/app-context'
afterEach(() => vi.unstubAllGlobals())

const setup = () => {
  const { document, window } = parseHTML(`<html><body><div id="app">
<header><button role="tab" id="tab">Video</button><button id="make">Make the video</button></header>
<aside class="rail"><button data-action="add">+</button><button class="thumbnail" data-slide="0" id="tile">1</button></aside>
<textarea id="script"></textarea>
</div></body></html>`)
  vi.stubGlobal('document', document)
  vi.stubGlobal('window', window)
  const root = document.querySelector<HTMLElement>('#app')!
  const app = {
    root,
    snapshot: {
      status: 'ready',
      project: { id: 'p', slides: [{ id: 's', title: 'One', svg: '<svg/>' }] }
    },
    stage: 'presentation',
    selected: 0,
    mapCanvas: { isOpen: false },
    error: vi.fn()
  } as unknown as AppContext
  installSlidesController(app)
  const added = vi.fn()
  root.querySelector('[data-action="add"]')!.addEventListener('click', added)
  const press = (id: string, key: string) => {
    const event = new window.Event('keydown', {
      bubbles: true,
      cancelable: true
    })
    Object.assign(event, { key, metaKey: false, ctrlKey: false })
    document.getElementById(id)!.dispatchEvent(event)
    return event
  }
  return { added, press }
}

it('lets Enter press the focused tab or button, not add a wireframe', () => {
  const { added, press } = setup()
  expect(press('tab', 'Enter').defaultPrevented).toBe(false)
  expect(press('make', 'Enter').defaultPrevented).toBe(false)
  expect(press('script', 'Enter').defaultPrevented).toBe(false)
  expect(press('tab', 'Delete').defaultPrevented).toBe(false)
  expect(added).not.toHaveBeenCalled()
})

it('adds a wireframe with Enter when a wireframe in the rail is focused', () => {
  const { added, press } = setup()
  expect(press('tile', 'Enter').defaultPrevented).toBe(true)
  expect(added).toHaveBeenCalledOnce()
})
