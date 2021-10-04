import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { FiLoader } from 'react-icons/fi'
import { IoRemoveSharp } from 'react-icons/io5'
import { Button, FileDropzone } from '../../../../components'
import { useUploadFile } from '../../../../hooks'
import { AllowedFileExtensions } from '../../../../hooks/use-upload-file'
import { GetSchemaElementProps } from '../Effects'

const FileArraySchema = ({
  schema,
  handleChange,
  value,
  setLoadingAssets,
  setConfigured,
}: GetSchemaElementProps) => {
  const [uploadSlides] = useUploadFile()
  const [loadingSlide, setLoadingSlide] = useState<boolean>(false)
  const [slides, setSlides] = useState<string[]>([])
  const addToFormik = (valueArray: any) => {
    const event = new Event('input', { bubbles: true })
    dispatchEvent(event)
    // @ts-ignore
    event.target.name = schema.key
    // @ts-ignore
    event.target.value = valueArray
    handleChange(event as any)
  }
  useEffect(() => {
    if (!schema.value || schema.value.length <= 0) {
      setConfigured(false)
    } else {
      setConfigured(true)
    }
  }, [schema])

  useEffect(() => {
    if (!value) {
      return
    }
    setSlides(value || [])
  }, [value])

  const handleDeleteSlide = (text: string) => {
    const slideArray = slides.filter((slide) => slide !== text)
    setSlides(slideArray)
    addToFormik(slideArray)
  }

  const handlePhotoClick = async (file: File) => {
    if (!file) return

    setLoadingAssets(true)
    setLoadingSlide(true)
    const pic = await uploadSlides({
      extension: file.name.split('.').pop() as AllowedFileExtensions,
      file,
    })
    setLoadingAssets(false)
    setLoadingSlide(false)
    const slideArray = [...slides, pic.url]
    setSlides(slideArray)
    addToFormik(slideArray)
  }
  return (
    <div className="flex flex-col gap-1 m-4" key={schema.key}>
      <div className="flex flex-col gap-2 ">
        <div className="flex flex-row gap-2">
          <FileDropzone
            className="text-lg m-4"
            key={`${schema.key}`}
            onChange={async (e) => {
              setConfigured(false)
              // @ts-ignore
              await handlePhotoClick(e.target.files?.[0])
            }}
          />
        </div>
        <FiLoader
          className={cx('absolute animate-spin ', {
            'invisible ': !loadingSlide,
          })}
        />
        {slides.map((slide, index) => (
          <div
            key={slide}
            className="border-blue-50 px-4 py-2 m-1 flex items-center justify-between gap-2"
          >
            <img className="h-20 mb-2 object-contain" alt={slide} src={slide} />

            <div className="flex flex-col">
              <span className="font-bold">Slide {index + 1}:</span>
            </div>
            <Button
              onClick={() => handleDeleteSlide(slide)}
              type="button"
              className=""
              appearance="secondary"
              size="extraSmall"
            >
              <IoRemoveSharp />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default FileArraySchema
