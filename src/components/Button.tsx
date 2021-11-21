/* eslint-disable react/button-has-type */
import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'
import { IconType } from 'react-icons'
import { FiLoader } from 'react-icons/fi'

interface ButtonProps extends HTMLAttributes<HTMLButtonElement> {
  appearance: 'primary' | 'secondary' | 'link' | 'danger' | 'link-danger'
  type: 'button' | 'reset' | 'submit'
  icon?: IconType
  iconPosition?: 'left' | 'right'
  onClick?: (e?: React.MouseEvent<HTMLElement>) => void
  stretch?: boolean
  size?: 'extraSmall' | 'small' | 'medium' | 'large'
  loading?: boolean
  disabled?: boolean
}

const Button = ({
  className,
  appearance,
  children,
  onClick,
  type,
  loading,
  disabled,
  size = 'medium',
  icon: I,
  iconPosition = 'left',
  stretch,
  ...rest
}: ButtonProps) => {
  return (
    <button
      className={cx(
        'font-semibold group border-2 transition-all flex justify-center items-center rounded-md cursor-pointer',
        {
          'border-brand bg-brand text-white hover:shadow-lg hover:bg-brand-dark hover:border-brand-dark active:bg-brand-darker active:border-brand-darker':
            appearance === 'primary',
          'border-brand text-brand': appearance === 'secondary',
          'border-transparent text-brand hover:text-brand-dark':
            appearance === 'link',
          'border-transparent text-red-600 hover:text-red-700':
            appearance === 'link-danger',
          'border-red-600 bg-red-600 text-white hover:shadow-lg hover:bg-red-700 hover:border-red-700 active:bg-red-800 active:border-red-800':
            appearance === 'danger',
          'w-full': stretch,
          'opacity-70 cursor-not-allowed': disabled,
        },
        {
          'text-2xl py-2 px-6': size === 'large',
          'text-lg py-1.5 px-4': size === 'medium',
          'text-base py-1 px-2': size === 'small',
          'text-small py-0.5 px-1': size === 'extraSmall',
        },
        className
      )}
      type={type}
      disabled={disabled || loading}
      onClick={(e) => !(disabled || loading) && onClick?.(e)}
      {...rest}
    >
      <FiLoader
        className={cx(
          'absolute animate-spin ',
          {
            'invisible ': !loading,
          },
          {
            'text-xl group-hover:-translate-x-1': size === 'large',
            'text-lg group-hover:-translate-x-1': size === 'medium',
            'text-base group-hover:-translate-x-0.5': size === 'small',
          }
        )}
      />
      <span
        className={cx(
          'flex justify-center items-center transform duration-300 transition-all',
          {
            'scale-0': loading,
            'scale-100': !loading,
          }
        )}
      >
        {iconPosition === 'left' && I && (
          <I
            className={cx('mr-2 transition-all transform', {
              'text-xl group-hover:-translate-x-1': size === 'large',
              'text-lg group-hover:-translate-x-1': size === 'medium',
              'text-base group-hover:-translate-x-0.5': size === 'small',
            })}
          />
        )}

        {children}

        {iconPosition === 'right' && I && (
          <I
            className={cx('ml-2 transition-all transform', {
              'text-xl group-hover:translate-x-1': size === 'large',
              'text-lg group-hover:translate-x-1': size === 'medium',
              'text-base group-hover:translate-x-0.5': size === 'small',
            })}
          />
        )}
      </span>
    </button>
  )
}

Button.defaultProps = {
  icon: undefined,
  onClick: undefined,
  size: 'medium',
  iconPosition: 'left',
  stretch: undefined,
  loading: undefined,
  disabled: undefined,
}

export default Button