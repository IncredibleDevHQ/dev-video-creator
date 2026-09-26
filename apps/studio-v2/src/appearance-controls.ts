import { controlValue, type AppearanceControl } from './object-behavior'

/** Edit only declared visual properties; facts, counts and narration have no controls. */
export function applyAppearanceControl(svg: string, ownerId: string, parts: Record<string, string>, control: AppearanceControl, raw: unknown): string {
  const value = controlValue(control, raw)
  if (control.property === 'durationMs') throw new Error('Duration changes require recompiling the behavior schedule')
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const owner = doc.getElementById(ownerId)
  if (!owner) throw new Error('The controlled object is missing')
  for (const part of control.parts) {
    const node = doc.getElementById(parts[part])
    if (!node || !owner.contains(node)) throw new Error(`Control ${control.id}: missing owned part ${part}`)
    if (control.property === 'accent') {
      // CSS custom properties can represent shared material across many parts.
      for (const painted of [node, ...Array.from(node.querySelectorAll('[fill]'))]) {
        if (painted.getAttribute('fill') === 'none') continue
        painted.setAttribute('fill', String(value))
        ;(painted as unknown as SVGElement).style.fill = String(value)
      }
    } else if (control.property === 'emphasis' || control.property === 'scale') {
      const marker = `${ownerId}:${control.id}:${part}`
      let wrapper = node.parentElement
      if (wrapper?.getAttribute('data-appearance-control') !== marker) {
        wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'g') as unknown as HTMLElement
        wrapper.setAttribute('data-appearance-control', marker)
        node.parentNode!.insertBefore(wrapper, node)
        wrapper.append(node)
      }
      if (control.property === 'scale') wrapper.setAttribute('transform', `scale(${value})`)
      else wrapper.setAttribute('opacity', String(value))
    }
  }
  owner.setAttribute(`data-control-${control.id}`, String(value))
  return new XMLSerializer().serializeToString(doc.documentElement)
}
