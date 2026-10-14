import { expect, it } from 'vitest'
import { contentBox } from './fill'

// A light picture with a dark block from (x0, y0) to (x1, y1).
const picture = (block?: [number, number, number, number]) => {
  const width = 100
  const height = 100
  const data = Buffer.alloc(width * height * 3, 250)
  if (block)
    for (let y = block[1]; y < block[3]; y++)
      data.fill(20, (y * width + block[0]) * 3, (y * width + block[2]) * 3)
  return { width, height, data }
}

it('measures how much of the picture the content spans above the captions', () => {
  // 50 of 100 across; 30 of the 83 rows above the caption band.
  expect(contentBox(picture([10, 20, 60, 50]))).toEqual({
    width: 0.5,
    height: 0.36,
    area: 0.18
  })
  expect(contentBox(picture())).toEqual({ width: 0, height: 0, area: 0 })
  // What sits in the caption band is not the frame's content.
  expect(contentBox(picture([10, 90, 60, 95])).area).toBe(0)
})
