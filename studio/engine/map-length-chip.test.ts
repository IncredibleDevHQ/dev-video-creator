import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { markRuns } from '../app/map-length'
import { lengthChip } from '../app/map-nodes'

describe('the length chips (Jev series run)', () => {
  it('say the window as it moves, the plan bar’s as well as the series’', () => {
    // The series head's chip and the plan bar's, both drawn at 45–120 s.
    const { document } = parseHTML(
      `<div><header>${lengthChip()}</header><form data-map-form="plan">${lengthChip()}</form></div>`
    )
    const root = document.querySelector('div')!
    markRuns(root, { min: 120, max: 240, strict: false })
    expect(
      [...root.querySelectorAll('.map-length')].map((chip) => chip.textContent)
    ).toEqual(['2–4 min each', '2–4 min each'])
    markRuns(root, { min: 60, max: 90, strict: true })
    expect(root.querySelector('form .map-length')?.textContent).toBe(
      '60–90 s each · must fit'
    )
  })
})
