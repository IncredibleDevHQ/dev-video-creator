import { css } from '@emotion/css'
import React, { HTMLAttributes } from 'react'
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
}: TooltipProps) => {
  const { triggerProps, layerProps, arrowProps, renderLayer } = useLayer({
    isOpen,
    placement,
    overflowContainer: false,
    arrowOffset,
    triggerOffset,
    onDisappear: (disappearType) => {
      if (disappearType === 'full') {
        setIsOpen?.(false)
      }
    },
    onOutsideClick: () => {
      setIsOpen?.(false)
    },
  })

  return (
    <>
      <span {...triggerProps}>{children}</span>
      {isOpen &&
        renderLayer(
          <div className="tooltip" {...layerProps}>
            {content}
            <Arrow
              className={css`
                svg {
                  path {
                    fill: ${fill};
                  }
                }
              `}
              {...arrowProps}
            />
          </div>
        )}
    </>
  )
}

export default Tooltip
