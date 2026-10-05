import { expect, test } from 'vitest'
import { themeChoices, readableInk, titlePreview } from '../app/brand-theme'
test('brand variants exchange colour roles with readable foregrounds', () => {
  const choices = themeChoices({ground:'#ffffff', text:'#111719', accent:'#8cdfad', secondary:'#ffd9d9'})
  expect(choices[2]).toMatchObject({ground:'#8cdfad', text:'#111719', accent:'#111719'})
  expect(choices[1].text).toBe('#ffffff')
  expect(readableInk('#000000')).toBe('#ffffff')
  expect(titlePreview('<script>', 'A&B', choices[0])).toContain('&lt;script&gt;')
})
