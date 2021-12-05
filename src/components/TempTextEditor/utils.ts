export function getCursorCoordinates(
  elem: HTMLDivElement,
  x: number,
  y: number
) {
  const { left, top } = elem.getBoundingClientRect()

  return { x: x - left, y: y - top }
}
