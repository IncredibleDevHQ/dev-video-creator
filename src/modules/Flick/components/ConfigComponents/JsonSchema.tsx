import React, { useEffect, useState } from 'react'
import { IoRemoveSharp } from 'react-icons/io5'
import { Button, FileDropzone, TextField } from '../../../../components'
import { useUploadFile } from '../../../../hooks'
import { AllowedFileExtensions } from '../../../../hooks/use-upload-file'
import { GetSchemaElementProps } from '../Effects'

const JsonSchema = ({
  schema,
  handleChange,
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
  const [uploadFile] = useUploadFile()
  interface Question {
    text?: string
    image?: string
  }

  const [question, setQuestion] = useState<Question>()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setQuestions(value || [])
  }, [value])

  const addQuestion = async (file: File) => {
    setLoadingAssets(true)
    setLoading(true)
    const pic = await uploadFile({
      extension: file.name.split('.').pop() as AllowedFileExtensions,
      file,
    })
    setLoadingAssets(false)
    setLoading(false)
    setQuestion({ text: question?.text || '', image: pic.url })
  }

  const handleOnClick = () => {
    if (!question?.text) return

    setQuestions((questions) => [...questions, question])
    const questionArray = [...questions, question]
    addToFormik(questionArray)
    setQuestion({ text: '', image: '' })
  }

  const handleDeleteQuestion = (text?: string) => {
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
            className="text-lg"
            name={schema.key}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setQuestion({ ...question, text: e.target.value })
            }
            value={question?.text}
            placeholder={schema.description}
            label="Add a Question"
          />

          <FileDropzone
            className="text-lg m-4"
            key={`${schema.key}`}
            onChange={(e) =>
              // @ts-ignore
              e.target.files?.[0] && addQuestion(e.target.files[0])
            }
            typeof="image/*"
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
            {ques.text && (
              <Button
                onClick={() => handleDeleteQuestion(ques.text)}
                type="button"
                appearance="danger"
                size="extraSmall"
              >
                <IoRemoveSharp />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default JsonSchema
