import { css } from '@emotion/css'
import React, { HTMLAttributes } from 'react'
import { useLayer, Arrow, useHover } from 'react-laag'

export interface TooltipProps extends HTMLAttributes<HTMLElement> {
  content: React.ReactNode
}

const HoverTooltip = ({ content, children }: TooltipProps) => {
  const [isOver, hoverProps] = useHover()
  const { triggerProps, layerProps, arrowProps, renderLayer } = useLayer({
    isOpen: isOver,
    placement: 'bottom-start',
    overflowContainer: false,
    arrowOffset: 10,
    containerOffset: 10,
  })

  return (
    <>
      <span {...triggerProps} {...hoverProps}>
        {children}
      </span>
      {isOver &&
        renderLayer(
          <div className="tooltip" {...layerProps}>
            {content}
            <Arrow
              className={css`
                svg {
                  path {
                    fill: #ffffff;
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

export default HoverTooltip
