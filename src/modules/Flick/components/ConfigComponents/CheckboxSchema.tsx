import { FormikErrors } from 'formik'
import React from 'react'
import { Checkbox } from '../../../../components'
import { SchemaElementProps, GetSchemaElementProps } from '.././Effects'

export const CheckboxSchema = ({
  schema,
  handleChange,
  setFieldValue,
  value,
  setLoadingAssets,
}: GetSchemaElementProps) => {
  return (
    <Checkbox
      name={schema.key}
      label={schema.name}
      id={schema.key}
      value={value}
      key={schema.key}
      checked={value}
      onChange={() => setFieldValue(schema.key, !value)}
      className="flex flex-wrap lg:align-middle gap-3 text-lg text-black ml-4 lg:capitalize p-4"
    />
  )
}
export default CheckboxSchema
