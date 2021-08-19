import { cx } from '@emotion/css'
import React, { HTMLProps } from 'react'

interface CheckBoxProps extends HTMLProps<HTMLInputElement> {
  name: string
  label: string
}

const Checkbox = ({
  name,
  label,
  className,
  onChange,
  ...rest
}: CheckBoxProps) => {
  return (
    <div className={cx(className)}>
      <input
        onChange={onChange}
        type="checkbox"
        name={name}
        id={label}
        {...rest}
      />
      <label htmlFor={label}>{label}</label>
    </div>
  )
}

export default Checkbox
