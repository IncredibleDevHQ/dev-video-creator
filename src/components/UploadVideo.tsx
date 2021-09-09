import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'
import { FilterProps } from 'react-table'

const UploadVideo = ({
  className,
  onChange,
  ...rest
}: HTMLAttributes<HTMLInputElement>) => {
  return (
    <input
      type="file"
      className={cx(className)}
      accept="video/*"
      onChange={onChange}
      {...rest}
    />
  )
}

export default UploadVideo
