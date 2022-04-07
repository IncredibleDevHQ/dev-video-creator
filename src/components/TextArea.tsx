import { cx } from '@emotion/css'
import React, { HTMLProps } from 'react'
import { nanoid } from 'nanoid'
import { Label } from '.'

interface TextAreaProps extends HTMLProps<HTMLTextAreaElement> {
  label?: string
  accessories?: JSX.Element[]
  caption?: JSX.Element | string
}

const TextArea = ({
  className,
  label,
  accessories,
  caption: C,
  ...rest
}: TextAreaProps) => {
  return (
    <div className={cx('flex flex-col w-full ', className)}>
      <Label>{label}</Label>
      <div className="focus-within:border-brand border border-gray-300 rounded-md flex justify-between items-center p-2 bg-background">
        <textarea
          className="rounded-sm border-none outline-none flex-1 focus:ring-0 p-0"
          {...rest}
        />
        <div className="flex justify-between items-center">
          {accessories?.map((accessory) => {
            return <span key={nanoid()}>{accessory}</span>
          })}
        </div>
      </div>
      {C}
    </div>
  )
}

TextArea.defaultProps = {
  caption: undefined,
  accessories: undefined,
}

export default TextArea
