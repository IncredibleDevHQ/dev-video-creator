/* eslint-disable no-case-declarations */
import { FormikErrors } from 'formik'
import React, { ChangeEvent, useEffect, useState } from 'react'
import { Button, Checkbox, Photo, Text, TextField } from '../../../components'
import { useUploadFile } from '../../../hooks'
import { FiLoader } from 'react-icons/fi'
import { cx } from '@emotion/css'
import { IoRemoveSharp } from 'react-icons/io5'

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
  const addToFormik = (valueArray: any) => {
    const event = new Event('input', { bubbles: true })
    dispatchEvent(event)
    // @ts-ignore
    event.target.name = schema.key
    // @ts-ignore
    event.target.value = valueArray
    handleChange(event as any)
  }

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

    case 'json':
      const [uploadFile] = useUploadFile()
      interface Question {
        text: string
        image?: string
      }

      const [question, setQuestion] = useState<Question>()
      const [questions, setQuestions] = useState<Question[]>([])
      const [loading, setLoading] = useState(false)

      useEffect(() => {
        setQuestions(value || [])
      }, [value])

      const addQuestion = async (file: File) => {
        if (!question?.text) return

        if (!file) return
        setLoadingAssets(true)
        setLoading(true)
        const pic = await uploadFile({
          extension: file.name.split('.')[1] as any,
          file,
        })
        setLoadingAssets(false)
        setLoading(false)
        setQuestion({ text: question?.text, image: pic.url })
      }

      const handleOnClick = () => {
        if (!question?.text) return

        setQuestions((questions) => [...questions, question])
        const questionArray = [...questions, question]
        addToFormik(questionArray)
        setQuestion({ text: '', image: '' })
      }

      const handleDeleteQuestion = (text: string) => {
        const questionArray = questions.filter((ques) => ques.text !== text)
        setQuestions(questionArray)

        addToFormik(questionArray)
      }

      return (
        <div className="flex flex-col gap-1 m-4" key={schema.key}>
          <div className="flex gap-2 items-end">
            <div
              className="flex flex-col md:flex-row items-center"
              key={schema.key}
            >
              <TextField
                // eslint-disable-next-line react/no-array-index-key
                className="text-lg"
                name={schema.key}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setQuestion({ ...question, text: e.target.value })
                }
                value={question?.text}
                placeholder={schema.description}
                label="Add a Question"
              />

              <Photo
                className="text-lg m-4"
                key={`${schema.key}`}
                onChange={(e) =>
                  // @ts-ignore
                  e.target.files?.[0] && addQuestion(e.target.files[0])
                }
              />
              {question?.image && (
                <img
                  className="h-32 m-4 object-contain"
                  alt={question?.text}
                  src={question?.image}
                />
              )}

              <Button
                onClick={handleOnClick}
                appearance="secondary"
                type="button"
                className="w-full md:w-28"
                loading={loading}
              >
                Add
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            {questions.map((ques, index) => (
              <div
                key={ques.image}
                className="border-blue-200 px-4 py-2 m-1 flex items-center justify-between gap-2"
              >
                {ques?.image && (
                  <img
                    className="h-20 mb-2 object-contain"
                    alt={ques?.text}
                    src={ques?.image}
                  />
                )}
                <div className="flex flex-col">
                  <span className="font-bold">Question {index + 1}:</span>
                  <span className="capitalize text-justify">{ques.text}</span>
                </div>
                <Button
                  onClick={() => handleDeleteQuestion(ques?.text)}
                  type="button"
                  appearance="danger"
                  size="extraSmall"
                >
                  <IoRemoveSharp />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )

    case 'text[]':
      const [uploadSlides] = useUploadFile()
      const [loadingSlide, setLoadingSlide] = useState<boolean>(false)
      const [slides, setSlides] = useState<string[]>([])
      const [slideImage, setSlideImage] = useState<string>()

      useEffect(() => {
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
          extension: file.name.split('.')[1] as any,
          file,
        })
        setLoadingAssets(false)
        setLoadingSlide(false)
        const slideArray = [...slides, pic.url]
        setSlideImage(pic.url)
        setSlides(slideArray)
        addToFormik(slideArray)
      }
      return (
        <div className="flex flex-col gap-1 m-4" key={schema.key}>
          <div className="flex flex-col gap-2 ">
            <div className="flex flex-row gap-2">
              <Photo
                className="text-lg m-4"
                key={`${schema.key}`}
                onChange={async (e) => {
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
                <img
                  className="h-20 mb-2 object-contain"
                  alt={slide}
                  src={slide}
                />

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
    case 'pic':
      const [uploadPic] = useUploadFile()

      const [picture, setPicture] = useState<string>()

      const handleClick = async (file: File) => {
        if (!file) return
        setLoadingAssets(true)
        const pic = await uploadPic({
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
        event.target.value = pic.url
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
