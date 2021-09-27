export interface ClipConfig {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

const useEdit = () => {
  const clipRect = (ctx: any, clipConfig: ClipConfig) => {
    const { x } = clipConfig
    const { y } = clipConfig
    const w = clipConfig.width
    const h = clipConfig.height
    const r = clipConfig.radius
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  const clipCircle = (ctx: any, clipConfig: ClipConfig) => {
    ctx.arc(
      clipConfig.width / 2,
      clipConfig.height / 2,
      clipConfig.width > clipConfig.height
        ? clipConfig.height / 2
        : clipConfig.width / 2,
      0,
      Math.PI * 2,
      true
    )
  }

  const getImageDimensions = (
    img: { w: number; h: number },
    maxW: number,
    maxH: number,
    availableW: number,
    availableH: number,
    x: number,
    y: number
  ) => {
    let calWidth = 0
    let calHeight = 0
    let calX = 0
    let calY = 0
    const aspectRatio = img.w / img.h
    if (aspectRatio > maxW / maxH) {
      // horizontal img
      calHeight = maxW * (1 / aspectRatio)
      calWidth = maxW
      calX = (availableW - calWidth) / 2
      calY = y + (availableH - calHeight) / 2
    } else if (aspectRatio <= maxW / maxH) {
      // sqr or vertical image
      calHeight = maxH
      calWidth = maxH * aspectRatio
      calX = (availableW - calWidth) / 2
      calY = y + (availableH - calHeight) / 2
    }
    return { width: calWidth, height: calHeight, x: calX, y: calY }
  }

  return { clipRect, clipCircle, getImageDimensions }
}

export default useEdit
