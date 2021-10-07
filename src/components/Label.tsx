import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'

const Label = ({
  className,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) => {
  return <small className={cx('text-xs mb-1 uppercase', className)} {...rest} />
}

export default Label
