import { expect, it } from 'vitest'
import { figuresIn, unsupportedFigures } from './figures'

const source = `We switched to flagging when 12% of the text or 30% of the shape is
covered. The first live run found five problems in one scene; the agent
fixed three on its next attempt. It seeks a fifth of a second before the end.
At 14:02 the API failed for 41% of requests, for five minutes.`

it('reads figures in digits and in words, with their units', () => {
  expect(
    figuresIn('twelve percent, twenty-two of the chip, 6.0s, five point eight')
  ).toEqual([
    { value: 12, unit: true, said: 'twelve percent' },
    { value: 22, unit: false, said: 'twenty two' },
    { value: 6, unit: true, said: '6.0 s' },
    { value: 5.8, unit: false, said: 'five point eight' }
  ])
  expect(figuresIn('one hundred and twenty requests')[0]).toMatchObject({
    value: 120,
    unit: true
  })
})

it('finds the figures a script says that the source does not give', () => {
  // Seen live: invented measurements said as fact.
  expect(
    unsupportedFigures(
      'Flag only when twelve percent of the text, or thirty percent of the shape, is covered. This frame reads four percent of the title and twenty-two of the chip.',
      source
    )
  ).toEqual(['four percent', 'twenty two'])
  // The source's own figures, counts and a marked example are fine.
  expect(
    unsupportedFigures(
      'It found five problems and fixed three. It refuses four things. At 14:02, 41% failed for five minutes. Say a moment runs six seconds: it stops at five point eight.',
      source
    )
  ).toEqual([])
  expect(unsupportedFigures('It took 90 seconds.', source)).toEqual([
    '90 seconds'
  ])
})
