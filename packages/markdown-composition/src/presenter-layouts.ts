import type { PresenterLayoutMode, ThemeBlockKind } from './types'

export type NormalizedLayoutRect = {
  left: number
  top: number
  width: number
  height: number
}

export type PresenterLayoutGeometry = {
  camera: NormalizedLayoutRect
  content: NormalizedLayoutRect | null
}

const geometry = (
  camera: NormalizedLayoutRect,
  content: NormalizedLayoutRect | null,
): PresenterLayoutGeometry => ({ camera, content })

const BASE_PRESENTER_LAYOUT_GEOMETRY: Record<
  PresenterLayoutMode,
  PresenterLayoutGeometry
> = {
  'information-circle': geometry(
    { left: 77.083, top: 53.704, width: 17.188, height: 30.556 },
    { left: 6.875, top: 16, width: 66, height: 68 },
  ),
  'information-tile': geometry(
    { left: 73.958, top: 56.481, width: 20.313, height: 27.778 },
    { left: 6.875, top: 16, width: 63, height: 68 },
  ),
  'portrait-overlay': geometry(
    { left: 71.25, top: 19.907, width: 24.479, height: 60.185 },
    { left: 6.875, top: 16, width: 60, height: 68 },
  ),
  'portrait-rail': geometry(
    { left: 66.188, top: 5, width: 31, height: 90 },
    { left: 6.875, top: 16, width: 55, height: 68 },
  ),
  split: geometry(
    { left: 50, top: 0, width: 50, height: 100 },
    { left: 5, top: 16, width: 40, height: 68 },
  ),
  'person-background-left': geometry(
    { left: 0, top: 0, width: 100, height: 100 },
    { left: 5, top: 18, width: 42, height: 64 },
  ),
  'person-background-right': geometry(
    { left: 0, top: 0, width: 100, height: 100 },
    { left: 53, top: 18, width: 42, height: 64 },
  ),
  'person-only': geometry(
    { left: 0, top: 0, width: 100, height: 100 },
    null,
  ),
}

const CODE_PRESENTER_LAYOUT_OVERRIDES: Partial<
  Record<PresenterLayoutMode, PresenterLayoutGeometry>
> = {
  'portrait-rail': geometry(
    { left: 74.188, top: 5, width: 23, height: 90 },
    { left: 3.75, top: 19.444, width: 68.125, height: 61.111 },
  ),
}

export const presenterLayoutGeometry = (
  mode: PresenterLayoutMode,
  blockKind: ThemeBlockKind,
) =>
  blockKind === 'code' && CODE_PRESENTER_LAYOUT_OVERRIDES[mode]
    ? CODE_PRESENTER_LAYOUT_OVERRIDES[mode]!
    : BASE_PRESENTER_LAYOUT_GEOMETRY[mode]

export const normalizedRectStyle = (rect: NormalizedLayoutRect) =>
  `left:${rect.left}%;top:${rect.top}%;right:auto;bottom:auto;width:${rect.width}%;height:${rect.height}%;translate:none`

