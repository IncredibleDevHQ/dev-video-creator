// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { hydrateIcons } from './icons'
it('draws icons in place of their glyphs', () => {
  document.body.innerHTML = '<button id="a" data-icon="x">×</button><button id="b" data-icon="play">▶ Rehearse</button><span id="c" data-icon="layout-grid">▦</span><button id="d" data-icon="chevron-right" data-icon-end>Beat →</button><button id="e" data-icon="user">♙</button>'
  hydrateIcons(document)
  expect(document.getElementById('a')!.textContent).toBe('')
  expect(document.getElementById('b')!.textContent).toBe('Rehearse')
  expect(document.getElementById('c')!.textContent).toBe('')
  expect(document.getElementById('d')!.textContent).toBe('Beat')
  expect(document.getElementById('d')!.lastElementChild!.tagName.toLowerCase()).toBe('svg')
  expect(document.getElementById('e')!.querySelector('svg')).not.toBeNull()
})
