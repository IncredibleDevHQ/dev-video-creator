import React, { useEffect } from 'react'
import { FormikErrors } from 'formik'
import {
  CheckboxSchema,
  FileArraySchema,
  JsonSchema,
  PicSchema,
  TextArraySchema,
  TextSchema,
} from './ConfigComponents/index'
import {
  Fragment_Type_Enum,
  Fragment_Type_Enum_Enum,
  Fragment_Type_Enum_Enum_Comparison_Exp,
} from '../../../generated/graphql'

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
      if (type === Fragment_Type_Enum_Enum.Splash) {
        setConfigured(true)
      } else if (!schema.value || (schema.value && schema.value.length <= 0)) {
        setConfigured(false)
      }

      useEffect(() => {
        if (setFieldValue && schema.key === 'source') {
          setFieldValue(schema.key, selectedVideoLink)
        }
      }, [selectedVideoLink])

      return (
        <>
          <TextSchema
            schema={schema}
            handleChange={handleChange}
            value={value}
            type={type}
            setLoadingAssets={setLoadingAssets}
            setConfigured={setConfigured}
            setVideoInventoryModal={setVideoInventoryModal}
          />
        </>
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
