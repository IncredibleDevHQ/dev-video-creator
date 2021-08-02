import { cx } from '@emotion/css'
import React, { ReactNode } from 'react'
import { toast } from 'react-toastify'
import {
  FiAlertOctagon,
  FiAlertTriangle,
  FiCheck,
  FiInfo,
} from 'react-icons/fi'

type ToastType = 'success' | 'info' | 'error' | 'warning'

interface ToastProps {
  type: ToastType
  title: string
  description?: string
  autoClose?: number | false
  onClick?: () => void
}

const getStyles = (type: ToastType): ReactNode => {
  switch (type) {
    case 'success':
      return (
        <FiCheck
          className={cx(
            `w-16 h-16 rounded-full flex items-center justify-center bg-green-800 text-green-800 bg-opacity-10`
          )}
          color="green-800"
        />
      )
    case 'info':
      return (
        <FiInfo
          className={cx(
            `w-16 h-16 rounded-full flex items-center justify-center bg-blue-800 text-blue-800 bg-opacity-10`
          )}
          color="blue-800"
        />
      )
    case 'warning':
      return (
        <FiAlertOctagon
          className={cx(
            `w-16 h-16 rounded-full flex items-center justify-center bg-yellow-800 text-yellow-800 bg-opacity-10`
          )}
          color="yellow-800"
        />
      )
    case 'error':
      return (
        <FiAlertTriangle
          className={cx(
            `w-16 h-16 rounded-full flex items-center justify-center bg-red-800 text-red-800 bg-opacity-10`
          )}
          color="red-800"
        />
      )
    default:
      return (
        <FiCheck
          className={cx(
            `w-16 h-16 rounded-full flex items-center justify-center bg-gray-800 text-gray-800 bg-opacity-10`
          )}
          color="gray-800"
        />
      )
  }
}

const Toast = ({
  title,
  description,
  type,
}: Pick<ToastProps, 'description' | 'title' | 'type'>) => {
  return (
    <div className="text-gray-900 bg-gray-50 flex items-center justify-between">
      <div
        className={cx(
          `h-16 flex flex-grow items-center w-1/4 flex-shrink-0 justify-center`
        )}
      >
        {getStyles(type)}
      </div>
      <div className="flex w-3/4 flex-col justify-center mr-2 flex-shrink-1 flex-grow-0">
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

const emitToast = ({
  title,
  type,
  autoClose = 5000,
  description,
  onClick,
}: ToastProps) => {
  return toast(<Toast title={title} description={description} type={type} />, {
    autoClose,
    onClick,
  })
}

const dismissToast = (id: any) => {
  toast.dismiss(id)
}

const updateToast = ({
  id,
  title,
  type,
  autoClose = 5000,
  description,
  onClick,
}: ToastProps & { id: React.ReactText }) => {
  return toast.update(id, {
    render: <Toast title={title} description={description} type={type} />,
    autoClose,
    onClick,
  })
}

export { emitToast, dismissToast, updateToast }
