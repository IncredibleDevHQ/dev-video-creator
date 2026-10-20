import { afterEach, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 20))
  vi.unstubAllGlobals()
})
it('mounts actual Animate UI and retains editor identity, value and event listeners across release', async () => {
  const { window, document } = parseHTML(
    '<html><body><section id="panel"><textarea>draft</textarea></section></body></html>'
  )
  vi.stubGlobal('window', window)
  vi.stubGlobal('document', document)
  vi.stubGlobal('HTMLElement', window.HTMLElement)
  vi.stubGlobal('SVGElement', window.SVGElement)
  vi.stubGlobal('Element', window.Element)
  vi.stubGlobal('Event', window.Event)
  vi.stubGlobal('reportError', (error: unknown) => {
    console.error(error)
  })
  window.matchMedia = () =>
    ({
      matches: true,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {}
    }) as unknown as MediaQueryList
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  vi.resetModules()
  const { revealResearchSurface, releaseResearchSurface } =
    await import('../app/research-motion')
  const panel = document.getElementById('panel')! as unknown as HTMLElement
  const editor = panel.querySelector('textarea')!
  const input = vi.fn()
  editor.addEventListener('input', input)
  revealResearchSurface(panel, 'sheet', false)
  expect(panel.querySelector('[data-animate-ui="Slide"]')).not.toBeNull()
  expect(panel.querySelector('textarea')).toBe(editor)
  expect(editor.value).toBe('draft')
  releaseResearchSurface(panel)
  expect(panel.querySelector('textarea')).toBe(editor)
  editor.dispatchEvent(new window.Event('input'))
  expect(input).toHaveBeenCalledOnce()
  revealResearchSurface(panel, 'pop', false)
  expect(panel.querySelector('[data-animate-ui="Fade"]')).not.toBeNull()
  expect(panel.querySelector('textarea')).toBe(editor)
  releaseResearchSurface(panel)
})
