import React from 'react'
import { TextField } from '../../../../components'
// eslint-disable-next-line import/namespace
import { GetSchemaElementProps } from '../Effects'

const TextSchema = ({
  schema,
  handleChange,
  value,
  setVideoInventoryModal,
  setConfigured,
}: GetSchemaElementProps) => {
  if (!schema.value || schema.value.length <= 0) {
    setConfigured(false)
  } else {
    setConfigured(true)
  }

  return (
    <TextField
      className="text-lg m-4"
      name={schema.key}
      onChange={handleChange}
      value={value && value.trim()}
      key={schema.key}
      onClick={() => {
        if (schema.key === 'source') {
          if (setVideoInventoryModal) setVideoInventoryModal(true)
        }
      }}
      defaultValue={value}
      placeholder={schema.description}
      label={schema.name}
    />
  )
}

export default TextSchema
