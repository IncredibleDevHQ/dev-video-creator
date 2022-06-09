/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import { cx } from '@emotion/css'
import axios from 'axios'
import React, { HTMLProps } from 'react'
import Gravatar from 'react-gravatar'

export const isImageLoaded = async (src: string) => {
  try {
    const { status } = await axios.get(src)
    if (status === 200) return true
    return false
  } catch (e) {
    return false
  }
}

const Avatar = ({
  className,
  alt,
  src,
  name,
  onClick,
}: { name: string } & HTMLProps<HTMLImageElement>) => {
  const [imageSrc, setImageSrc] = React.useState<string>()

  React.useEffect(() => {
    if (!src) return
    ;(async () => {
      if (await isImageLoaded(src)) setImageSrc(src)
    })()
  }, [src])

  if (!imageSrc && name !== undefined && name !== null && name !== '')
    return (
      <img
        className={cx(className)}
        src={`https://ui-avatars.com/api/?name=${name}`}
        alt={alt}
        onClick={onClick}
      />
    )

  if (!imageSrc)
    return (
      <Gravatar
        className={cx(className)}
        alt={alt}
        email=""
        default="retro"
        onClick={onClick}
      />
    )
  return <img className={cx(className)} src={src} alt={alt} onClick={onClick} />
}

export default Avatar
