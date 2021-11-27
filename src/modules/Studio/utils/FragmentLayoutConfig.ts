import { Layout } from '../../../utils/configTypes2'

export interface ObjectConfig {
  x: number
  y: number
  width: number
  height: number
  borderRadius: number
  color?: string
}

export const FragmentLayoutConfig = ({
  layout,
  isShorts,
}: {
  layout: Layout
  isShorts?: boolean
}): ObjectConfig => {
  if (isShorts) {
    return {
      x: 16,
      y: 16,
      width: 364,
      height: 672,
      borderRadius: 8,
    }
  }
  switch (layout) {
    case 'classic':
      return {
        x: 56,
        y: 32,
        width: 848,
        height: 477,
        borderRadius: 8,
        color: '#182E42',
      }
    case 'float-full-right':
      return {
        x: 32,
        y: 90,
        width: 640,
        height: 360,
        borderRadius: 8,
      }
    case 'float-full-left':
      return {
        x: 288,
        y: 90,
        width: 640,
        height: 360,
        borderRadius: 8,
      }
    case 'float-half-right':
      return {
        x: 32,
        y: 45,
        width: 800,
        height: 450,
        borderRadius: 8,
      }
    case 'padded-bottom-right-tile':
    case 'padded-bottom-right-circle':
      return {
        x: 72,
        y: 41,
        width: 816,
        height: 459,
        borderRadius: 8,
      }
    case 'bottom-right-tile':
    case 'bottom-right-circle':
      return {
        x: 0,
        y: 0,
        width: 960,
        height: 540,
        borderRadius: 0,
      }
    case 'padded-split':
      return {
        x: 40,
        y: 112.5,
        width: 560,
        height: 315,
        borderRadius: 8,
      }
    case 'split':
      return {
        x: 0,
        y: 130,
        width: 480,
        height: 280,
        borderRadius: 0,
      }
    default:
      return {
        x: 288,
        y: 90,
        width: 640,
        height: 360,
        borderRadius: 8,
      }
  }
}
