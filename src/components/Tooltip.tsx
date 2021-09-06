import { css } from '@emotion/css'
import React, { HTMLAttributes, useEffect } from 'react'
import { useLayer, Arrow } from 'react-laag'
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
}

const Tooltip = ({
  content,
  children,
  isOpen,
  setIsOpen,
  arrowOffset = 0,
  triggerOffset = 0,
  placement = 'bottom-start',
  fill = '#ffffff',
  autoDismiss,
  autoPosition = true,
  overflowContainer = false,
  hideOnOutsideClick = true,
}: TooltipProps) => {
  const { triggerProps, layerProps, arrowProps, renderLayer } = useLayer({
    isOpen,
    placement,
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
      <span {...triggerProps}>{children}</span>
      {isOpen &&
        renderLayer(
          <div className="tooltip" {...layerProps}>
            {content}
            <Arrow backgroundColor={fill} {...arrowProps} />
          </div>
        )}
    </>
  )
}

export default Tooltip
