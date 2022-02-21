import { cx } from '@emotion/css'
import React, { HTMLAttributes, useEffect } from 'react'
import { useLayer } from 'react-laag'
import { PlacementType } from 'react-laag/dist/PlacementType'

export interface TooltipProps extends HTMLAttributes<HTMLElement> {
  content: React.ReactNode
  isOpen: boolean
  setIsOpen?: (val: boolean) => void
  placement?: PlacementType
  arrowOffset?: number
  triggerOffset?: number
  fill?: string
  autoDismiss?: number
  autoPosition?: boolean
  overflowContainer?: boolean
  hideOnOutsideClick?: boolean
  containerOffset?: number
  className?: string
}

const Tooltip = ({
  content,
  children,
  isOpen,
  setIsOpen,
  arrowOffset = 0,
  triggerOffset = 0,
  placement = 'bottom-start',
  autoDismiss,
  containerOffset = 0,
  autoPosition = true,
  overflowContainer = false,
  hideOnOutsideClick = true,
  className,
}: TooltipProps) => {
  const { triggerProps, layerProps, renderLayer } = useLayer({
    isOpen,
    placement,
    containerOffset,
    auto: autoPosition,
    overflowContainer,
    arrowOffset,
    triggerOffset,
    onDisappear: (disappearType) => {
      if (disappearType === 'full') {
        setIsOpen?.(false)
      }
    },
    onOutsideClick: () => {
      if (hideOnOutsideClick) setIsOpen?.(false)
    },
  })

  useEffect(() => {
    if (!autoDismiss) return
    const timer = setTimeout(() => setIsOpen?.(false), autoDismiss)

    // eslint-disable-next-line consistent-return
    return () => {
      clearTimeout(timer)
    }
  }, [autoDismiss])

  return (
    <>
      <span className={cx(className)} {...triggerProps}>
        {children}
      </span>
      {isOpen &&
        renderLayer(
          <div className="tooltip" {...layerProps}>
            {content}
          </div>
        )}
    </>
  )
}

export default Tooltip
