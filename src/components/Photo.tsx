import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'

const Photo = ({
  className,
  onChange,
  ...rest
}: HTMLAttributes<HTMLInputElement>) => {
  return (
    <input
      type="file"
      className={cx(className)}
      accept="image/*"
      onChange={onChange}
      {...rest}
    />
  )
}

export default Photo
