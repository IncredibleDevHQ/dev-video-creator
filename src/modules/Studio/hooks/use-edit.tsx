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

  return { clipRect, clipCircle }
}

export default useEdit
