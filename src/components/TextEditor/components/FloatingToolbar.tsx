import React from 'react'
import { FloatingWrapper } from '@remirror/react'
import { IconType } from 'react-icons'
import { BiBrain } from 'react-icons/bi'
import { cx } from '@emotion/css'
import { ComponentsTheme } from 'remirror'

const FloatingToolbarItem = ({
  icon: I,
  label,
  disabled,
}: {
  label: string
  icon: IconType
  disabled?: boolean
}) => {
  return (
    <div
      aria-describedby={label}
      className={cx('hover:bg-gray-100 transition-colors rounded-md p-2', {
        'opacity-50 cursor-not-allowed': disabled,
      })}
    >
      <I />
    </div>
  )
}

export const FloatingToolbar = (props: any): JSX.Element => {
  const {
    placement,
    positioner,
    animated = 200,
    animatedClass = ComponentsTheme.ANIMATED_POPOVER,
    containerClass,
    blurOnInactive,
    enabled,
    floatingLabel,
    ignoredElements,
  } = props
  const floatingWrapperProps = {
    placement,
    positioner,
    animated,
    animatedClass,
    containerClass,
    blurOnInactive,
    enabled,
    floatingLabel,
    ignoredElements,
  }

  return (
    <FloatingWrapper renderOutsideEditor {...floatingWrapperProps}>
      <div className="p-1 grid gap-x-2 rounded-md bg-white shadow-md">
        <FloatingToolbarItem
          disabled
          label="Generate suggestions"
          icon={BiBrain}
        />
      </div>
    </FloatingWrapper>
  )
}
