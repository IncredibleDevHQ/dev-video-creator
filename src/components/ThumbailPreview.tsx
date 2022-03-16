/* eslint-disable consistent-return */
import { cx, css } from '@emotion/css'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ASSETS } from '../constants'
import { OrientationEnum } from '../generated/graphql'
import { isImageLoaded } from './Image'

const hoverImageCSS = ({
  width,
  height,
  source,
  scale,
}: {
  scale: number
  width: number
  height: number
  source: string
}) => css`
  background: url(${source}) no-repeat;
  background-size: cover;
  background-position: 0 0;
`

const cursor = css`
  cursor: ew-resize;
`

const ThumbnailPreview = ({
  scale = 1,
  useInternalScaling = false,
  className,
  totalImages = 50,
  markerWidth = 4,
  backgroundImageSource = ASSETS.ICONS.FLICK,
  posterImageSource = ASSETS.ICONS.FLICK,
  size = { width: 150, height: 84 },
  orientation,
}: {
  scale?: number
  useInternalScaling?: boolean
  className?: string
  totalImages?: number
  markerWidth?: number
  backgroundImageSource?: string
  posterImageSource?: string
  size?: { width: number; height: number }
  orientation?: OrientationEnum
}) => {
  const divRef = useRef<HTMLDivElement | null>(null)
  const markerRef = useRef<HTMLDivElement | null>(null)
  const [x, setX] = useState(0)
  const [isThumbnailAvailable, setThumbnailAvailable] = useState(false)

  const mouseEvtListener = useCallback(
    (e: MouseEvent) => {
      if (!divRef.current || !markerRef.current) return
      const bounds = divRef.current.getBoundingClientRect()
      const x = e.clientX - bounds.x
      const partSize = divRef.current.clientWidth / totalImages
      const activeImage = Math.floor(x / partSize)
      divRef.current.style.backgroundPosition = `0 -${
        activeImage *
        (useInternalScaling ? bounds.width / 150 : scale) *
        (orientation === OrientationEnum.Landscape ? size.height : size.width)
      }px`
      setX(x)
    },
    [divRef, markerRef, totalImages]
  )

  useEffect(() => {
    if (!divRef.current) return
    if (!useInternalScaling) {
      divRef.current.style.width =
        orientation === OrientationEnum.Landscape
          ? `${size.width * scale}px`
          : `${size.height * scale}px`
      divRef.current.style.height =
        orientation === OrientationEnum.Landscape
          ? `${size.height * scale}px`
          : `${size.width * scale}px`
    }
    divRef.current.addEventListener('mousemove', mouseEvtListener)
    return () => {
      divRef.current?.removeEventListener('mouseleave', mouseEvtListener)
      divRef.current = null
    }
  }, [divRef, isThumbnailAvailable])

  useEffect(() => {
    ;(async () => {
      if (await isImageLoaded(backgroundImageSource))
        setThumbnailAvailable(true)
      else setThumbnailAvailable(false)
    })()
  }, [backgroundImageSource, posterImageSource])

  if (!isThumbnailAvailable)
    return (
      <img
        src={ASSETS.ICONS.FLICK}
        alt="thumbnail"
        className={className}
        style={{
          width:
            orientation === OrientationEnum.Landscape
              ? size.width * scale
              : size.height * scale,
          height:
            orientation === OrientationEnum.Landscape
              ? size.height * scale
              : size.width * scale,
        }}
      />
    )

  return (
    <div
      ref={divRef}
      className={cx(
        'mx-auto relative overflow-hidden group',
        hoverImageCSS({
          width:
            orientation === OrientationEnum.Landscape
              ? size.width
              : size.height,
          height:
            orientation === OrientationEnum.Landscape
              ? size.height
              : size.width,
          source: backgroundImageSource,
          scale,
        }),
        cursor,
        className
      )}
    >
      <div
        ref={markerRef}
        className={cx(
          'absolute h-full w-1 top-0 bg-transparent group-hover:bg-brand'
        )}
        style={{
          width: `${markerWidth}px`,
          left: `${x}px`,
        }}
      />
      <img
        src={posterImageSource}
        alt="poster"
        className="w-full h-full z-10 block group-hover:hidden"
      />
    </div>
  )
}

export default ThumbnailPreview
