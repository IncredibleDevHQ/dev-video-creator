import { cx } from '@emotion/css'
import React, { HTMLProps } from 'react'

const Separator = ({ className, ...rest }: HTMLProps<HTMLSpanElement>) => {
  return (
    <span
      className={cx('w-px bg-gray-300 opacity-70 h-full', className)}
      {...rest}
    />
  )
}

export default Separator
