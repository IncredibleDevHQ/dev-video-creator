import { cx } from '@emotion/css'
import React, { HTMLProps } from 'react'

interface TextProps extends HTMLProps<HTMLParagraphElement> {
  fontSize?: 'small' | 'normal'
}

const Text = ({ fontSize, className, children, ...rest }: TextProps) => {
  switch (fontSize) {
    case 'normal':
      return (
        <p className={cx('text-sm', className)} {...rest}>
          {children}
        </p>
      )
    case 'small':
      return (
        <p className={cx('text-xs leading-3', className)} {...rest}>
          {children}
        </p>
      )
    default:
      return (
        <p className={cx(className)} {...rest}>
          {children}
        </p>
      )
  }
}

Text.defaultProps = {
  fontSize: undefined,
}

export default Text
