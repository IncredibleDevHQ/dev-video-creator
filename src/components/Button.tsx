/* eslint-disable react/button-has-type */
import { cx } from '@emotion/css'
import React, { HTMLProps, ReactElement } from 'react'

interface ButtonProps extends HTMLProps<HTMLButtonElement> {
  buttonStyle: 'primary' | 'secondary' | 'light' | 'default'
  type: 'button' | 'reset' | 'submit'
  icon?: ReactElement
  onClick?: (e?: React.MouseEvent<HTMLElement>) => void
}

const Button = ({
  className,
  buttonStyle,
  children,
  onClick,
  type,
  icon,
  ...rest
}: ButtonProps) => {
  return (
    <div
      role="button"
      className={cx(
        'border-2 flex justify-center my-1 p-2 rounded-sm cursor-pointer',
        {
          'border-gray-800 text-gray-700  hover:text-black hover:border-black':
            buttonStyle === 'primary',
          'border-gray-50 text-gray-50  hover:text-white hover:border-white':
            buttonStyle === 'light',
          'border-none': buttonStyle === 'default',
        },
        className
      )}
      onClick={onClick}
      onKeyUp={() => {
        onClick?.()
      }}
      tabIndex={0}
    >
      {icon}
      <button className="w-full font-semibold" type={type} {...rest}>
        {children}
      </button>
    </div>
  )
}

Button.defaultProps = {
  icon: undefined,
  onClick: undefined,
}

export default Button
