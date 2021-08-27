/* eslint-disable no-case-declarations */
import { FormikErrors } from 'formik'
import React, { useState } from 'react'
import { Checkbox, Photo, Text, TextField } from '../../../components'
import { useUploadFile } from '../../../hooks'

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

interface GetSchemaElementProps {
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
}

export const GetSchemaElement = ({
  schema,
  handleChange,
  setFieldValue,
  value,
  setLoadingAssets,
}: GetSchemaElementProps) => {
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
      const [uploadIamgeFile] = useUploadFile()

      const [question, setQuestion] =
        useState<{ text: string; image?: string }>()

      const handleOnClick = async (file: File) => {
        if (!question?.text) if (!file) return
        setLoadingAssets(true)
        const pic = await uploadIamgeFile({
          extension: file.name.split('.')[1] as any,
          file,
        })
        setLoadingAssets(false)
        setQuestion({
          text: question?.text as string,
          image: pic.url as string,
        })

        const event = new Event('input', { bubbles: true })
        // dispatchEvent(event)
        // @ts-ignore
        event.target.name = schema.key
        // @ts-ignore
        event.target.value = question
        console.log('value', event)

        console.log('question', question)
        handleChange(event as any)
      }

      return (
        <div className="flex flex-col gap-1 m-4" key={schema.key}>
          <div className="flex flex-col gap-2 items-end">
            {Array(value ? value?.length + 1 : 1)
              .fill('')
              .map((_, index) => (
                <div className="flex flex-row">
                  <TextField
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${schema.key}[${index}]`}
                    className="text-lg"
                    name={`${schema.key}[${index}]`}
                    onChange={(e) =>
                      setQuestion({ ...question, text: e.target.value })
                    }
                    value={value ? value[index] : ''}
                    placeholder={schema.description}
                    label={`Question ${index + 1}`}
                  />

                  <Photo
                    className="text-lg m-4"
                    key={`${schema.key}`}
                    onChange={(e) =>
                      // @ts-ignore
                      e.target.files?.[0] && handleOnClick(e.target.files[0])
                    }
                  />
                  {value ||
                    (value && (
                      <img
                        className="h-32 m-4 object-contain"
                        alt="hhh"
                        key={`${schema.key}`}
                      />
                    ))}
                </div>
              ))}
          </div>
        </div>
      )

    case 'pic':
      const [uploadFile] = useUploadFile()
      const [picture, setPicture] = useState<string>()

      const handleClick = async (file: File) => {
        if (!file) return
        setLoadingAssets(true)
        const pic = await uploadFile({
          extension: file.name.split('.')[1] as any,
          file,
        })
        setLoadingAssets(false)
        setPicture(pic.url)

        const event = new Event('input', { bubbles: true })
        dispatchEvent(event)
        // @ts-ignore
        event.target.name = schema.key
        // @ts-ignore
        event.target.value = question
        handleChange(event as any)
      }
      return (
        <>
          <Text className="ml-4">{schema.description}</Text>
          <Photo
            className="text-lg m-4"
            onChange={(e) =>
              // @ts-ignore
              e.target.files?.[0] && handleClick(e.target.files[0])
            }
          />
          {picture ||
            (value && (
              <img
                className="h-32 m-4 object-contain"
                src={picture || value}
                alt={value}
              />
            ))}
        </>
      )

    default:
      return <></>
  }
}
