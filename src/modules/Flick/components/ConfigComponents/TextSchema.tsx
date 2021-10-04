import React, { useEffect } from 'react'
import { TextField } from '../../../../components'
import { Fragment_Type_Enum_Enum } from '../../../../generated/graphql'
import { GetSchemaElementProps } from '../Effects'

const TextSchema = ({
  schema,
  handleChange,
  value,
  setVideoInventoryModal,
  setConfigured,
  type,
}: GetSchemaElementProps) => {
  useEffect(() => {
    if (type === Fragment_Type_Enum_Enum.Splash && schema.key !== 'theme') {
      setConfigured(true)
    } else if (!schema.value || schema.value?.length <= 0) {
      setConfigured(false)
    } else {
      setConfigured(true)
    }
  }, [schema])

  // Remove the trim
  return (
    <TextField
      className="text-lg m-4"
      name={schema.key}
      onChange={(e) => {
        setConfigured(false)
        handleChange(e)
      }}
      value={value}
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
