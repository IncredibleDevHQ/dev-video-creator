import { useFormik } from 'formik'
import React from 'react'
import { Checkbox, emitToast, TextField } from '../../../components'

export interface SchemaElementProps {
  key: string
  type: string
  name: string
  description?: string
  value?: any
  dirty: boolean
  required: boolean
  editable: boolean
}

export const getSchemaElement = (
  schema: SchemaElementProps,
  handleChange: (e: React.ChangeEvent<any>) => void,
  value: any
) => {
  switch (schema.type) {
    case 'checkbox':
      return (
        <Checkbox
          name={schema.key}
          label={schema.name}
          id={schema.key}
          checked={value}
          onChange={handleChange}
          className="flex flex-wrap lg:align-middle gap-3 text-lg text-black ml-4 lg:capitalize p-4"
        />
      )

    case 'text':
      return (
        <TextField
          className="text-lg m-4"
          name={schema.key}
          onChange={handleChange}
          value={value}
          placeholder={schema.description}
          label={schema.name}
        />
      )

    default:
      return <></>
  }
}
