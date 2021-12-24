import React from 'react'
import { IconType } from 'react-icons'
import { Button } from '../../../components'

const PermissionError = ({
  button,
  byline,
  image,
  description,
  heading,
  handleClick,
  icon: I,
}: {
  icon?: IconType
  heading?: JSX.Element
  description?: JSX.Element
  image?: string
  byline?: JSX.Element
  button?: JSX.Element
  handleClick?: () => void
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-sm flex items-center flex-col gap-y-8 justify-center">
        {I && <I size={32} />}
        <div>
          {heading && <h1 className="text-2xl font-bold">{heading}</h1>}
          {description && (
            <p className="text-gray-600 text-sm mt-2">{description}</p>
          )}
        </div>
        {image && <img className="w-80" src={image} alt="Permission Error" />}
        <div className="flex items-stretch flex-col justify-center w-full">
          {byline && <p className="text-sm">{byline}</p>}
          {button && (
            <Button
              className="mt-2"
              onClick={handleClick}
              appearance="primary"
              type="button"
            >
              {button}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default PermissionError
