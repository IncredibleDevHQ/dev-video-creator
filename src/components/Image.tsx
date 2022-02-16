import axios from 'axios'
import React, { HTMLAttributes } from 'react'

export const isImageLoaded = async (src: string) => {
  try {
    const { status } = await axios.get(src)
    if (status === 200) return true
    return false
  } catch (e) {
    console.error(e)
    return false
  }
}

const Image = ({
  alt,
  mainSrc,
  fallbackSrc,
  ...rest
}: {
  alt: string
  mainSrc: string
  fallbackSrc: string
} & HTMLAttributes<HTMLImageElement>) => {
  const [src, setSrc] = React.useState(fallbackSrc)

  React.useEffect(() => {
    ;(async () => {
      if (await isImageLoaded(mainSrc)) setSrc(mainSrc)
      else setSrc(fallbackSrc)
    })()
  }, [mainSrc])

  return <img src={src} alt={alt} {...rest} />
}

export default Image
