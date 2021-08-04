import { cx } from '@emotion/css'
import React, { HTMLProps } from 'react'

interface HeadingProps extends HTMLProps<HTMLHeadingElement> {
  fontSize?: 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large'
}

const Heading = ({ fontSize, children, className, ...rest }: HeadingProps) => {
  switch (fontSize) {
    case 'extra-large':
      return (
        <h1 className={cx('text-6xl font-bold', className)} {...rest}>
          {children}
        </h1>
      )
    case 'large':
      return (
        <h2 className={cx('text-4xl font-semibold', className)} {...rest}>
          {children}
        </h2>
      )
    case 'medium':
      return (
        <h3 className={cx('text-base font-medium', className)} {...rest}>
          {children}
        </h3>
      )
    case 'small':
      return (
        <h4 className={cx('text-sm font-light', className)} {...rest}>
          {children}
        </h4>
      )
    case 'extra-small':
      return (
        <h5 className={cx('text-xs font-extralight', className)} {...rest}>
          {children}
        </h5>
      )
    default:
      return (
        <h6 className={cx(className)} {...rest}>
          {children}
        </h6>
      )
  }
}

Heading.defaultProps = {
  fontSize: undefined,
}

export default Heading
