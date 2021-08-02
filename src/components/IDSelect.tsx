import React, { FunctionComponent } from 'react'
import Select from 'react-select'

export interface Option {
  label: string
  value: string | number | Date | boolean
}

interface IDSelectProps {
  label: string
  options: Option[]
  errorMessage?: string
}

const IDSelect: FunctionComponent<IDSelectProps> = ({
  label,
  options,
  errorMessage,
}: IDSelectProps) => {
  return (
    <div>
      <small>{label}</small>
      <Select options={options} />
      {errorMessage && <small>{errorMessage}</small>}
    </div>
  )
}

IDSelect.defaultProps = {
  errorMessage: undefined,
}

export default IDSelect
