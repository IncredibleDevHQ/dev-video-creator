import {
  PositionerPortal,
  useEditorFocus,
  usePositioner,
} from '@remirror/react'
import { getPositioner } from 'remirror/extensions'
import React, { useMemo, FC, useEffect } from 'react'
import { TextEditorProvider } from '.'

export type Position = {
  height: number
  left: number
  top: number
  width: number
}

export const Positioner: FC<any> = (props): JSX.Element => {
  const {
    positioner = 'always',
    blurOnInactive = false,
    ignoredElements = [],
    enabled = true,
    renderOutsideEditor = false,
  } = props

  const [isFocused] = useEditorFocus({ blurOnInactive, ignoredElements })
  const {
    ref,
    height,
    x: left,
    y: top,
    width,
  } = usePositioner(() => {
    return getPositioner(positioner)
  }, [isFocused, enabled, renderOutsideEditor])

  const { handleUpdatePosition } = React.useContext(TextEditorProvider)

  const position = useMemo(
    () => ({ height, left, top, width }),
    [height, left, top, width]
  )

  useEffect(() => {
    handleUpdatePosition?.(position)
  }, [position])

  return (
    <PositionerPortal>
      <span
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
          height: position.height,
        }}
        ref={ref}
      />
    </PositionerPortal>
  )
}

export default Positioner
