import { cx } from '@emotion/css'
import React, { ReactNode } from 'react'
import { toast } from 'react-toastify'
import {
  FiAlertOctagon,
  FiAlertTriangle,
  FiCheck,
  FiInfo,
} from 'react-icons/fi'
import { IconType } from 'react-icons/lib'

type ToastType = 'success' | 'info' | 'error' | 'warning'

interface ToastProps {
  type: ToastType
  title: string
  description?: string
  autoClose?: number | false
  onClick?: () => void
}

const getStyles = (type: ToastType): { color: string; icon: IconType } => {
  switch (type) {
    case 'success':
      return { color: 'green-800', icon: FiCheck }
    case 'info':
      return { color: 'blue-800', icon: FiInfo }
    case 'warning':
      return { color: 'yellow-800', icon: FiAlertOctagon }
    case 'error':
      return { color: 'red-800', icon: FiAlertTriangle }
    default:
      return { color: 'gray-800', icon: FiAlertTriangle }
  }
}

const Toast = ({
  title,
  description,
  type,
}: Pick<ToastProps, 'description' | 'title' | 'type'>) => {
  const { color, icon: I } = getStyles(type)
  return (
    <div className="text-gray-900 bg-gray-200 flex items-center justify-between">
      <div
        className={cx(
          `h-16 flex flex-grow items-center w-1/4 flex-shrink-0 justify-center`
        )}
      >
        <div
          className={cx(
            `w-16 h-16 rounded-full flex items-center justify-center bg-${color} text-${color} bg-opacity-10`
          )}
        >
          <I size={24} />
        </div>
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
