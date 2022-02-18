import 'gifler'
import React, { useEffect, useState } from 'react'
import { Image } from 'react-konva'

const Gif = ({
  image,
  x,
  y,
  width,
  height,
}: {
  image: HTMLImageElement | undefined
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

  const [startGif, setStartGif] = useState(false)

  useEffect(() => {
    let anim: any
    setTimeout(() => {
      setStartGif(true)
      ;(window as any).gifler(image?.src).get((a: any) => {
        anim = a
        anim.animateInCanvas(canvas)
        anim.onDrawFrame = (ctx: any, frame: any) => {
          ctx.drawImage(frame.buffer, frame.x, frame.y)
          imageRef.current?.getLayer().draw()
        }
      })
    }, 1250)
    return () => anim?.stop()
  }, [image, canvas])

  return startGif ? (
    <>
      <Image image={image} x={x} y={y} width={width} height={height} />
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
    </>
  ) : (
    <Image image={image} x={x} y={y} width={width} height={height} />
  )
}

export default Gif
