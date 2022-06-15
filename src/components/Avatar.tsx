/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import { cx } from '@emotion/css'
import axios from 'axios'
import React, { HTMLProps } from 'react'

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
  if (src && src?.includes('cdn')) {
    return (
      <img className={cx(className)} src={src} alt={alt} onClick={onClick} />
    )
  }

  return (
    <img
      className={cx(className)}
      src={`https://ui-avatars.com/api/?name=${name}`}
      alt={alt}
      onClick={onClick}
    />
  )
}

export default Avatar
