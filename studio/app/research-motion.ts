import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Fade } from '@animate-ui/react/primitives/effects/fade'
import { Slide } from '@animate-ui/react/primitives/effects/slide'

const surfaces = new Map<HTMLElement, Root>()
/** React owns the animated shell; Studio owns the existing editor DOM inside it.
 * Moving those nodes preserves input values, listeners and selection offsets. */
export const releaseResearchSurface = (element: HTMLElement) => {
  const root = surfaces.get(element)
  if (!root) return
  const content = element.firstElementChild
  const children = content ? [...content.childNodes] : []
  children.forEach((child) => element.append(child))
  flushSync(() => root.unmount())
  element.replaceChildren(...children)
  surfaces.delete(element)
}
export const releaseResearchPanels = (root: HTMLElement) => {
  for (const element of surfaces.keys()) {
    if (
      !element.isConnected ||
      (root.contains(element) && element.id !== 'research-selection')
    )
      releaseResearchSurface(element)
  }
}
export const revealResearchSurface = (
  element: HTMLElement,
  kind: 'pop' | 'sheet',
  enter = true
) => {
  if (surfaces.has(element)) return
  const active = element.contains(document.activeElement)
    ? (document.activeElement as HTMLTextAreaElement)
    : null
  const selection =
    active && 'selectionStart' in active
      ? [active.selectionStart, active.selectionEnd]
      : null
  const children = [...element.childNodes]
  const root = createRoot(element)
  surfaces.set(element, root)
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const props = {
    className:
      kind === 'sheet' ? 'research-animated-panel' : 'research-animated-popup',
    'data-animate-ui': kind === 'sheet' ? 'Slide' : 'Fade',
    ...(enter && !reduce ? {} : { initial: false as const }),
    ref: (host: HTMLElement | null) => {
      if (host) host.append(...children)
    }
  }
  flushSync(() =>
    root.render(
      kind === 'sheet'
        ? createElement(Slide, { ...props, direction: 'left', offset: 12 })
        : createElement(Fade, props)
    )
  )
  active?.focus({ preventScroll: true })
  if (active && selection) active.setSelectionRange(selection[0], selection[1])
}
export const researchSurfaces = (root: HTMLElement) => {
  const columns = root.querySelector('.research-columns')
  const visible = (id: string) => {
    const el = root.querySelector<HTMLElement>(id)
    return Boolean(
      el &&
      el.getClientRects().length &&
      getComputedStyle(el).display !== 'none'
    )
  }
  return {
    graph: visible('#research-graph-panel')
      ? columns?.className.match(/graph-(pip|drawer|full)/)?.[0] || 'graph'
      : '',
    notes: visible('#research-notes-panel')
  }
}
export const animateResearchSurfaces = (
  root: HTMLElement,
  before: ReturnType<typeof researchSurfaces>
) => {
  const after = researchSurfaces(root)
  if (after.graph)
    revealResearchSurface(
      root.querySelector<HTMLElement>('#research-graph-panel')!,
      'sheet',
      after.graph !== before.graph
    )
  if (after.notes)
    revealResearchSurface(
      root.querySelector<HTMLElement>('#research-notes-panel')!,
      'sheet',
      !before.notes
    )
}
