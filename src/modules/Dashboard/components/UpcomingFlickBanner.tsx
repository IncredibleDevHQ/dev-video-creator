import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'
import { Button, Heading, Text } from '../../../components'
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
        <Heading>New flick title</Heading>
        <Text>New flick description</Text>
      </div>
      <Button
        type="button"
        // buttonStyle={randomGradient.type === 'dark' ? 'light' : 'primary'}
        className="border-white h-auto"
        appearance="primary"
      >
        Join
      </Button>
    </div>
  )
}

export default UpcomingFlickBanner
