import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'
import { ASSETS } from '../constants'

interface LogoProps {
  size: 'small' | 'medium' | 'large'
  theme: 'dark' | 'light'
}

const Logo = ({
  className,
  theme,
  size,
}: LogoProps & HTMLAttributes<HTMLImageElement>) => (
  <img
    className={cx(
      'w-auto',
      {
        'h-8': size === 'small',
        'h-10': size === 'medium',
        'h-14': size === 'large',
      },
      className
    )}
    src={
      theme === 'light'
        ? ASSETS.ICONS.IncredibleLogo
        : ASSETS.ICONS.IncredibleLogoDark
    }
    alt="Incredible.dev"
  />
)

export default Logo
