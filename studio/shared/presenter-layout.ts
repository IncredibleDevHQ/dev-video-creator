import type { Moment } from './model'
export type FrameRect = { x: number; y: number; width: number; height: number }
/** One 1080p composition geometry for the editor and exported video. */
export function presenterLayout(layout: Moment['layout']): {
  content: FrameRect
  camera: FrameRect
} {
  const width = layout === 'corner' ? 1480 : 1240
  const height = Math.round((width * 1080) / 1920 / 2) * 2
  return {
    content: { x: 20, y: (1080 - height) / 2, width, height },
    camera:
      layout === 'full-screen'
        ? { x: 0, y: 0, width: 1920, height: 1080 }
        : layout === 'corner'
          ? { x: 1520, y: 660, width: 360, height: 360 }
          : { x: 1280, y: 60, width: 600, height: 960 }
  }
}
export function presenterLayoutStyle(layout: Moment['layout']) {
  return Object.entries(presenterLayout(layout))
    .flatMap(([name, rect]) =>
      Object.entries(rect).map(
        ([key, value]) =>
          `--${name}-${key}:${(value / (key === 'x' || key === 'width' ? 1920 : 1080)) * 100}%`
      )
    )
    .join(';')
}
