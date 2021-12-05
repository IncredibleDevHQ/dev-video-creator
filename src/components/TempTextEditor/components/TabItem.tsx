/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import React from 'react'
import { IconType } from 'react-icons'
import { cx } from '@emotion/css'

const TabItem = ({
  label,
  appearance = 'full',
  handleClick,
  icon: I,
  active,
  className,
}: {
  label: string
  icon?: IconType
  appearance?: 'icon' | 'full' | 'text'
  handleClick?: () => void
  active?: boolean
  className?: string
}) => {
  return (
    <li
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick?.()
      }}
      tabIndex={-1}
      onClick={handleClick}
      className={cx(
        'flex items-center text-xs rounded px-2 py-1 cursor-pointer transition-colors',
        {
          'bg-brand hover:bg-brand-darker text-gray-100': active,
          'bg-gray-100 hover:bg-gray-200 text-gray-800': !active,
        },
        className
      )}
    >
      {appearance !== 'text' && I && (
        <I className={cx({ 'mr-1': appearance === 'full' })} />
      )}
      {appearance !== 'icon' && label}
    </li>
  )
}

export default TabItem
