import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'
import { useHistory } from 'react-router-dom'
import { Button, Text } from '../../../components'
import { getRandomGradient } from '../../../utils/globalStyles'

const randomGradient = getRandomGradient()

const NewFlickBanner = ({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) => {
  const history = useHistory()

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
        <Text fontSize="normal">Create a new flick to get started</Text>
      </div>
      <Button
        type="button"
        buttonStyle={randomGradient.type === 'dark' ? 'light' : 'primary'}
        className="border-white h-auto"
        onClick={() => history.push('/new-flick')}
      >
        Create
      </Button>
    </div>
  )
}

export default NewFlickBanner
