export interface ObjectConfig {
  x: number
  y: number
  width: number
  height: number
  borderRadius: number
  color?: string
}

export const FragmentLayoutConfig = ({
  layoutNumber,
}: {
  layoutNumber: number
}): ObjectConfig => {
  switch (layoutNumber) {
    case 1:
      return {
        x: 56,
        y: 32,
        width: 848,
        height: 477,
        borderRadius: 8,
        color: '#182E42',
      }
    case 2:
      return {
        x: 56,
        y: 32,
        width: 32,
        height: 32,
        borderRadius: 8,
      }
    default:
      return {
        x: 56,
        y: 32,
        width: 32,
        height: 32,
        borderRadius: 8,
      }
  }
}
