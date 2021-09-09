import { FormikErrors } from 'formik'
import React from 'react'
import { Checkbox, TextField } from '../../../../components'
import { SchemaElementProps, GetSchemaElementProps } from '.././Effects'

const TextSchema = ({
  schema,
  handleChange,
  setFieldValue,
  value,
  setLoadingAssets,

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
      value={value}
      key={schema.key}
      defaultValue={value}
      placeholder={schema.description}
      label={schema.name}
    />
  )
}

export default TextSchema
