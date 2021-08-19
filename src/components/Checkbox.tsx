import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'

interface CheckBoxProps extends HTMLAttributes<HTMLInputElement> {
  value: string
  name: string
  label: string
  checked: boolean
}

const Checkbox = ({
  value,
  name,
  label,
  className,
  onChange,
  checked,
  ...rest
}: CheckBoxProps) => {
  return (
    <div className={cx(className)}>
      <input
        onChange={onChange}
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        id={label}
        {...rest}
      />
      <label htmlFor={label}>{label}</label>
    </div>
  )
}

export default Checkbox
