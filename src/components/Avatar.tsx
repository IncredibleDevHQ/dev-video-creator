/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import { cx } from '@emotion/css'
import React, { HTMLProps } from 'react'
import Gravatar from 'react-gravatar'

const Avatar = ({
  className,
  alt,
  src,
  email,
  onClick,
}: { email?: string } & HTMLProps<HTMLImageElement>) => {
  if (!src)
    return (
      <Gravatar
        className="w-6 h-6 rounded-full bg-gray-100"
        email={email}
        alt={alt}
        onClick={onClick}
      />
    )
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <img className={cx(className)} src={src} alt={alt} onClick={onClick} />
  )
}

Avatar.defaultProps = {
  email: undefined,
}

export default Avatar
