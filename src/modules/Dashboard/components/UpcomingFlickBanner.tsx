import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'
import { Button } from '../../../components'
import { getRandomGradient } from '../../../utils/globalStyles'

const randomGradient = getRandomGradient()

const UpcomingFlickBanner = ({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cx(
        'flex justify-between items-center py-4 px-8 w-full shadow-md',
        {
          'text-black': randomGradient.type === 'light',
          'text-white': randomGradient.type === 'dark',
        },
        randomGradient.style,
        className
      )}
      {...rest}
    >
      <div className="flex-1">
        <h2>New flick title</h2>
        <p>New flick description</p>
      </div>
      <Button
        type="button"
        buttonStyle={randomGradient.type === 'dark' ? 'light' : 'primary'}
        className="border-white h-auto"
      >
        Join
      </Button>
    </div>
  )
}

export default UpcomingFlickBanner
