import React from 'react'
import loadingImg from '../assets/loading.svg'
import Button from './Button'

const ScreenState = ({
  title,
  subtitle,
  button,
  handleClick,
  loading,
}: {
  title?: string
  subtitle?: string
  button?: string
  handleClick?: () => void
  loading?: boolean
}) => {
  return (
    <div className="z-10 p-4 flex flex-col items-center justify-center fixed w-screen left-0 top-0 min-h-screen">
      <img src={loadingImg} className="w-14" alt="Logo" />

      <div style={{ maxWidth: 256 }}>
        {title && (
          <h2 className="text-gray-800 text-center text-xl font-bold mt-8 mb-2">
            {title}
          </h2>
        )}
        {subtitle && (
          <h4 className="text-gray-600 text-xs text-center">{subtitle}</h4>
        )}
      </div>

      {button && (
        <Button
          appearance="primary"
          type="button"
          className="mt-12"
          onClick={() => {
            handleClick?.()
          }}
        >
          {button}
        </Button>
      )}
    </div>
  )
}

ScreenState.defaultProps = {
  subtitle: undefined,
  button: undefined,
  handleClick: undefined,
  loading: undefined,
}

export default ScreenState
