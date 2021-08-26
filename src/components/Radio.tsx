import React from 'react'

const Radio = ({
  value,
  name,
  label,
}: {
  value: string
  name: string
  label: string
}) => {
  return (
    <>
      <input type="radio" name={name} value={value} id={label} />
      <label htmlFor={label}>{label}</label>
    </>
  )
}

export default Radio
