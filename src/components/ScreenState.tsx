import React from 'react'
import logo from '../assets/logo.svg'
import Button from './Button'
import Loader from './Loader'

const ScreenState = ({
  title,
  subtitle,
  button,
  handleClick,
  loading,
}: {
  title: string
  subtitle?: string
  button?: string
  handleClick?: () => void
  loading?: boolean
}) => {
  return (
    <div className="z-10 p-4 flex flex-col items-center justify-center fixed w-screen left-0 top-0 min-h-screen">
      <img src={logo} className="w-24 mb-6 animate-bounce" alt="Logo" />

      <h2 className="text-center text-4xl font-extrabold">{title}</h2>
      {subtitle && (
        <h4 color="gray-400" className="mt-3 text-xl text-center">
          {subtitle}
        </h4>
      )}

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
