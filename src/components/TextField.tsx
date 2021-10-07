import { cx } from '@emotion/css'
import React, { HTMLProps } from 'react'
import { nanoid } from 'nanoid'

interface TextFieldProps extends HTMLProps<HTMLInputElement> {
  label?: string
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
      <small className="text-xs uppercase mb-1">
        {label}
        {rest.required && '*'}
      </small>
      <div className="flex rounded-md justify-between border-2 border-background-alt transition-all focus-within:border-brand items-center p-2 bg-background">
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
      {typeof C === 'string' ? (
        <span className="text-sm mt-1 font-semibold text-red-600">{C}</span>
      ) : (
        C
      )}
    </div>
  )
}

TextField.defaultProps = {
  label: '',
  caption: undefined,
  accessories: undefined,
}

export default TextField
