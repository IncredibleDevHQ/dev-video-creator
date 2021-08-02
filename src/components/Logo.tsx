import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'
import { ASSETS } from '../constants'

interface LogoProps {
  size: 'small' | 'medium' | 'large'
}

const Logo = ({
  className,
  size,
}: LogoProps & HTMLAttributes<HTMLImageElement>) => (
  <img
    className={cx(
      {
        'w-8 h-8': size === 'small',
        'w-12 h-12': size === 'medium',
        'w-16 h-16': size === 'large',
      },
      className
    )}
    src={ASSETS.ICONS.LOGO}
    alt="Incredible.dev"
  />
)

export default Logo
