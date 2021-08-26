import { cx } from '@emotion/css'
import React, { HTMLProps, useMemo } from 'react'

interface AvatarProps extends HTMLProps<HTMLLIElement> {
  color: 'green' | 'red' | 'blue' | 'yellow' | 'orange' | 'purple' | 'pink'
}

const Avatar = ({ className, color, ...rest }: AvatarProps) => {
  const border = useMemo(() => {
    switch (color) {
      case 'green':
        return 'border-green-400'
      case 'red':
        return 'border-red-400'
      case 'blue':
        return 'border-blue-400'
      case 'yellow':
        return 'border-yellow-400'
      case 'orange':
        return 'border-orange-400'
      case 'purple':
        return 'border-purple-400'
      case 'pink':
        return 'border-pink-400'
      default:
        return ''
    }
  }, [])
  return (
    <li
      className={cx('border-2 w-9 h-9 rounded-full', border, className)}
      {...rest}
    >
      <img
        src="https://placekitten.com/200/200"
        alt="kitten"
        className="rounded-full"
      />
    </li>
  )
}

export default Avatar
