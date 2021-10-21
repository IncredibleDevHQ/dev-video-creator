import React, { useEffect } from 'react'
import { FormikErrors } from 'formik'
import {
  CodeEditor,
  CheckboxSchema,
  FileArraySchema,
  JsonSchema,
  PicSchema,
  TextArraySchema,
  TextSchema,
} from './ConfigComponents/index'
import { Fragment_Type_Enum_Enum } from '../../../generated/graphql'

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
  setFieldValue?: (
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
  type?: Fragment_Type_Enum_Enum
  setLoadingAssets: React.Dispatch<React.SetStateAction<boolean>>

  selectedVideoLink?: string
  setVideoInventoryModal?: React.Dispatch<React.SetStateAction<boolean>>

  setConfigured: React.Dispatch<React.SetStateAction<boolean>>
}

export const GetSchemaElement = ({
  schema,
  handleChange,
  setFieldValue,
  value,
  setLoadingAssets,
  selectedVideoLink,
  setVideoInventoryModal,
  setConfigured,
  type,
}: GetSchemaElementProps) => {
  useEffect(() => {
    if (setFieldValue && schema.key === 'source') {
      setFieldValue(schema.key, selectedVideoLink)
      setConfigured(false)
    }
  }, [selectedVideoLink])

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
      return (
        <TextSchema
          schema={schema}
          handleChange={handleChange}
          value={value}
          type={type}
          setLoadingAssets={setLoadingAssets}
          setConfigured={setConfigured}
          setVideoInventoryModal={setVideoInventoryModal}
        />
      )

    case 'code':
      return (
        <CodeEditor
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
