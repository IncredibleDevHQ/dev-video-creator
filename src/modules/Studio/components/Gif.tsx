import React, { useEffect, useState } from 'react'
import { Image } from 'react-konva'
import useEdit from '../hooks/use-edit'
import 'gifler'

const Gif = ({
  src,
  // maxWidth,
  // maxHeight,
  // availableWidth,
  // availableHeight,
  x,
  y,
  width,
  height,
}: {
  src: HTMLImageElement | undefined | string
  // maxWidth: number
  // maxHeight: number
  // availableWidth: number
  // availableHeight: number
  x: number
  y: number
  width: number
  height: number
}) => {
  const imageRef = React.useRef<any>(null)
  const canvas = React.useMemo(() => {
    const node = document.createElement('canvas')
    return node
  }, [])
  // const { getImageDimensions } = useEdit()
  // const [imgDim, setImgDim] = useState<{
  //   width: number
  //   height: number
  //   x: number
  //   y: number
  // }>({ width: 0, height: 0, x: 0, y: 0 })

  useEffect(() => {
    let anim: any
    ;(window as any).gifler(src).get((a: any) => {
      anim = a
      anim.animateInCanvas(canvas)
      anim.onDrawFrame = (ctx: any, frame: any) => {
        ctx.drawImage(frame.buffer, frame.x, frame.y)
        imageRef.current.getLayer().draw()
      }
    })
    return () => anim.stop()
  }, [src, canvas])

  // useEffect(() => {
  //   setImgDim(
  //     getImageDimensions(
  //       {
  //         w: (canvas && canvas.width) || 0,
  //         h: (canvas && canvas.height) || 0,
  //       },
  //       maxWidth,
  //       maxHeight,
  //       availableWidth,
  //       availableHeight,
  //       x,
  //       y
  //     )
  //   )
  // }, [canvas])

  return (
    <Image
      image={canvas}
      ref={imageRef}
      x={x}
      y={y}
      width={width}
      height={height}
      // shadowOpacity={0.3}
      // shadowOffset={{ x: 0, y: 1 }}
      // shadowBlur={2}
    />
  )
}

export default Gif
