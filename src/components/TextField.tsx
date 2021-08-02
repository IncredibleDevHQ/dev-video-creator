import { cx } from '@emotion/css'
import React, { HTMLProps } from 'react'
import { nanoid } from 'nanoid'

interface TextFieldProps extends HTMLProps<HTMLInputElement> {
  label: string
  accessories?: JSX.Element[]
  caption?: JSX.Element | string
}

const TextField = ({
  className,
  label,
  accessories,
  caption: C,
  ...rest
}: TextFieldProps) => {
  return (
    <div className={cx('flex flex-col w-full', className)}>
      <small className="text-xs">{label}</small>
      <div className="flex justify-between items-center p-2 bg-brand-background">
        <input
          className="rounded-sm border-none outline-none flex-1"
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

TextField.defaultProps = {
  caption: undefined,
  accessories: undefined,
}

export default TextField
