import React, { useState } from 'react'
import { FileDropzone, Text } from '../../../../components'
import { useUploadFile } from '../../../../hooks'
import { AllowedFileExtensions } from '../../../../hooks/use-upload-file'
// eslint-disable-next-line import/namespace
import { GetSchemaElementProps } from '../Effects'

export const PicSchema = ({
  schema,
  handleChange,
  value,
  setConfigured,
  setLoadingAssets,
}: GetSchemaElementProps) => {
  const [uploadPic] = useUploadFile()

  const [picture, setPicture] = useState<string>()

  const handleClick = async (file: File) => {
    setConfigured(false)
    if (!file) return
    setLoadingAssets(true)
    const pic = await uploadPic({
      extension: file.name.split('.').pop() as AllowedFileExtensions,
      file,
    })
    setLoadingAssets(false)
    setPicture(pic.url)

    const event = new Event('input', { bubbles: true })
    dispatchEvent(event)
    // @ts-ignore
    event.target.name = schema.key
    // @ts-ignore
    event.target.value = pic.url
    handleChange(event as any)
  }
  return (
    <>
      <Text className="ml-4">{schema.description}</Text>
      <FileDropzone
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
}

export default PicSchema
