import { Layout } from '../../../utils/configTypes'

export interface PointsConfig {
  bulletWidth: number
  bulletHeight: number
  bulletFontSize: number
  textFontSize: number
  paddingBtwBulletText: number
  noOfPoints: number
  noForSpacing: number
}

export const getPointsConfig = ({
  layout,
}: {
  layout: Layout
}): PointsConfig => {
  switch (layout) {
    case 'classic':
      return {
        bulletWidth: 64,
        bulletHeight: 64,
        bulletFontSize: 32,
        paddingBtwBulletText: 26,
        textFontSize: 16,
        noOfPoints: 3,
        noForSpacing: 4,
      }
    case 'float-full-right':
    case 'float-full-left':
      return {
        bulletWidth: 48,
        bulletHeight: 48,
        bulletFontSize: 24,
        paddingBtwBulletText: 26,
        textFontSize: 16,
        noOfPoints: 2,
        noForSpacing: 3,
      }
    case 'float-half-right':
    case 'padded-bottom-right-tile':
    case 'padded-bottom-right-circle':
    case 'bottom-right-tile':
    case 'bottom-right-circle':
      return {
        bulletWidth: 64,
        bulletHeight: 64,
        bulletFontSize: 32,
        paddingBtwBulletText: 26,
        textFontSize: 16,
        noOfPoints: 2,
        noForSpacing: 4,
      }
    case 'padded-split':
    case 'split':
    case 'full':
      return {
        bulletWidth: 36,
        bulletHeight: 36,
        bulletFontSize: 18,
        paddingBtwBulletText: 26,
        textFontSize: 12,
        noOfPoints: 1,
        noForSpacing: 2,
      }
    default:
      return {
        bulletWidth: 64,
        bulletHeight: 64,
        bulletFontSize: 32,
        paddingBtwBulletText: 26,
        textFontSize: 16,
        noOfPoints: 3,
        noForSpacing: 4,
      }
  }
}
