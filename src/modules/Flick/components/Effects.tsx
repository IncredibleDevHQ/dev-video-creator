/* eslint-disable no-case-declarations */
import { FormikErrors } from 'formik'
import React from 'react'
import {
  CheckboxSchema,
  FileArraySchema,
  JsonSchema,
  PicSchema,
  TextArraySchema,
  TextSchema,
} from './ConfigComponents/index'

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

export interface GetSchemaElementProps {
  schema: SchemaElementProps
  handleChange: (e: React.ChangeEvent<any>) => void
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
      >
  value: any
  setLoadingAssets: React.Dispatch<React.SetStateAction<boolean>>
  setConfigured: React.Dispatch<React.SetStateAction<boolean>>
}

export const GetSchemaElement = ({
  schema,
  handleChange,
  setFieldValue,
  value,
  setLoadingAssets,
  setConfigured,
}: GetSchemaElementProps) => {
  switch (schema.type) {
    case 'boolean':
      return (
        <CheckboxSchema
          schema={schema}
          handleChange={handleChange}
          setFieldValue={setFieldValue}
          value={value}
          setLoadingAssets={setLoadingAssets}
          setConfigured={setConfigured}
        />
      )

    case 'text':
      if (!value || (value && value.length <= 0)) {
        setConfigured(false)
      }
      return (
        <TextSchema
          schema={schema}
          handleChange={handleChange}
          setFieldValue={setFieldValue}
          value={value}
          setLoadingAssets={setLoadingAssets}
          setConfigured={setConfigured}
        />
      )

    case 'json':
      return (
        <JsonSchema
          schema={schema}
          handleChange={handleChange}
          setFieldValue={setFieldValue}
          value={value}
          setLoadingAssets={setLoadingAssets}
          setConfigured={setConfigured}
        />
      )

    case 'text[]':
      return (
        <TextArraySchema
          schema={schema}
          handleChange={handleChange}
          setFieldValue={setFieldValue}
          value={value}
          setLoadingAssets={setLoadingAssets}
          setConfigured={setConfigured}
        />
      )

    case 'file[]':
      return (
        <FileArraySchema
          schema={schema}
          handleChange={handleChange}
          setFieldValue={setFieldValue}
          value={value}
          setLoadingAssets={setLoadingAssets}
          setConfigured={setConfigured}
        />
      )
    case 'pic':
      return (
        <PicSchema
          schema={schema}
          handleChange={handleChange}
          setFieldValue={setFieldValue}
          value={value}
          setLoadingAssets={setLoadingAssets}
          setConfigured={setConfigured}
        />
      )

    default:
      return null
  }
}
