import { FormikErrors } from 'formik'
import React from 'react'
import { Checkbox, TextField } from '../../../components'

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
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean | undefined
  ) =>
    | Promise<void>
    | Promise<
        FormikErrors<{
          [key: string]: any
        }>
      >,
  value: any
) => {
  console.log('value', value)
  console.log('schema', schema)
  switch (schema.type) {
    case 'boolean':
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

    case 'text':
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

    case 'text[]':
      return (
        <div className="flex flex-col gap-1 m-4" key={schema.key}>
          <div className="flex flex-col gap-2 items-end">
            {Array(value?.length + 1)
              .fill('')
              .map((_, index) => (
                <TextField
                  // eslint-disable-next-line react/no-array-index-key
                  key={`${schema.key}[${index}]`}
                  className="text-lg"
                  name={`${schema.key}[${index}]`}
                  onKeyDown={(e) => {
                    if (e.keyCode === 13) {
                      e.preventDefault()
                      handleChange(e)
                    }
                  }}
                  value={value[index]}
                  placeholder={schema.description}
                  label=""
                />
              ))}
          </div>
        </div>
      )

    default:
      return <></>
  }
}
