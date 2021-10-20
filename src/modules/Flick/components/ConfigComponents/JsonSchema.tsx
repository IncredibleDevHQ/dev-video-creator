import React, { ChangeEvent, useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import { cx } from '@emotion/css'
import { FiX } from 'react-icons/fi'
import { useDropzone } from 'react-dropzone'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from 'react-beautiful-dnd'
import { Button, Checkbox, TextArea } from '../../../../components'
import { GetSchemaElementProps } from '../Effects'
import { useUploadFile } from '../../../../hooks'
import { AllowedFileExtensions } from '../../../../hooks/use-upload-file'

interface Question {
  id: string
  text?: string
  image?: string
}

const reorder = (list: any[], startIndex: number, endIndex: number) => {
  const results = Array.from(list)
  const [removed] = results.splice(startIndex, 1)
  results.splice(endIndex, 0, removed)

  return results.map((result, index) => ({ ...result, order: index }))
}

const QuestionEditor = ({
  onlyText,
  questions,
  updateQuestions,
}: {
  onlyText: boolean
  questions: Question[]
  updateQuestions: (questions: Question[]) => void
}) => {
  const [editor, setEditor] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)

  const [uploadFile] = useUploadFile()
  const { acceptedFiles, getRootProps, getInputProps } = useDropzone({
    accept: 'image/*',
  })

  useEffect(() => {
    setPreviewLoading(true)
    ;(async () => {
      try {
        const imageQuestionsPromises = acceptedFiles.map(async (file) => {
          const { url } = await uploadFile({
            extension: file.name.split('.').pop() as AllowedFileExtensions,
            file,
          })
          return {
            id: nanoid(),
            text: file.name,
            image: url,
          }
        })

        const imageQuestions = await Promise.all(imageQuestionsPromises)
        updateQuestions([...questions, ...imageQuestions])
        setPreviewLoading(false)
      } catch (error) {
        console.error(error)
        setPreviewLoading(false)
      }
    })()
  }, [acceptedFiles])

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const items = reorder(
      questions,
      result.source.index,
      result.destination.index
    )
    updateQuestions(items)
  }

  const editQuestion = (id: string, text: string) => {
    updateQuestions(
      questions.map((question) => {
        if (question.id === id) {
          return { ...question, text }
        }
        return question
      })
    )
  }

  const convertToQuestions = () => {
    const convertedQuestions = editor
      .split('\n')
      .filter((text) => text.length > 0)
      .map((question) => {
        return {
          id: nanoid(),
          text: question,
        }
      })
    updateQuestions([...questions, ...convertedQuestions])
  }

  const deleteQuestion = (id: string) => {
    const updatedQuestions = questions.filter((question) => question.id !== id)
    updateQuestions([...updatedQuestions])
  }

  return (
    <div>
      {onlyText ? (
        <>
          <TextArea
            label="Add Questions"
            value={editor}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setEditor(e.target.value)
            }
            rows={6}
          />
          <Button
            className="my-2 ml-auto"
            type="button"
            appearance="secondary"
            size="small"
            onClick={convertToQuestions}
          >
            Convert to questions
          </Button>
        </>
      ) : (
        <div
          {...getRootProps({ className: 'dropzone' })}
          className="bg-white border border-brand p-4 rounded-md"
        >
          <input accept="image/*" {...getInputProps()} />
          <p>
            {previewLoading
              ? 'Loading...'
              : 'Drag n drop some files here, or click to select files'}
          </p>
        </div>
      )}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="droppable">
          {(provided) => (
            <div
              className="flex flex-col"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {questions.map(({ id, image, text }, index) => (
                <Draggable draggableId={id} key={id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      className={cx(
                        'relative bg-white py-2 px-6 rounded-md my-2 flex justify-between items-stretch',
                        {
                          'border border-brand': snapshot.isDragging,
                        }
                      )}
                      key={id}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      {image && (
                        <img
                          src={image}
                          alt={image || text || id}
                          className="w-16 h-auto mr-2"
                        />
                      )}
                      <TextArea
                        value={text}
                        className="ml-2"
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                          editQuestion(id, e.target.value)
                        }
                      />
                      <FiX
                        className="text-error w-4 h-4 bg-white absolute top-1 right-1 cursor-pointer"
                        onClick={() => deleteQuestion(id)}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  )
}

const JsonSchema = ({
  schema,
  handleChange,
  value,
  setConfigured,
}: GetSchemaElementProps) => {
  const [onlyText, setOnlyText] = useState(false)
  const [questions, setQuestions] = useState<Question[]>(value || [])
  const [imageQuestions, setImageQuestions] = useState<Question[]>([])

  const handleOnDatachange = (schemaValue: Question[], value: Question[]) => {
    if (
      schemaValue.length === value.length &&
      schemaValue.every((v, i) => v === value[i])
    ) {
      setConfigured(true)
    } else if (
      schemaValue.length === value.length &&
      schemaValue.every((v, i) => v !== value[i])
    ) {
      setConfigured(false)
    } else if (schemaValue.length !== value.length) {
      setConfigured(false)
    }
  }

  const addToFormik = (valueArray: any) => {
    const event = new Event('input', { bubbles: true })
    dispatchEvent(event)
    // @ts-ignore
    event.target.name = schema.key
    // @ts-ignore
    event.target.value = valueArray
    handleChange(event as any)
    handleOnDatachange(schema.value, valueArray)
  }

  useEffect(() => {
    if (!value) {
      setConfigured(false)
    }
    setQuestions(value || [])
    setImageQuestions(value?.filter((question: any) => question.image))
  }, [value])

  useEffect(() => {
    if (onlyText) {
      setImageQuestions(questions.filter((question) => question.image))
      setQuestions(questions.filter((question) => !question.image))
    } else {
      setQuestions([...questions, ...imageQuestions])
    }
  }, [onlyText])

  return (
    <div className="overflow-y-auto">
      <Checkbox
        name="onlyText"
        label="Show Only Text"
        checked={onlyText}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setOnlyText(e.target.checked)
        }
        className="flex-wrap text-lg px-4 py-2"
      />
      <div className="px-4">
        <QuestionEditor
          onlyText={onlyText}
          questions={questions}
          updateQuestions={setQuestions}
        />
        <Button
          type="button"
          appearance="primary"
          size="small"
          onClick={() => addToFormik(questions)}
        >
          Add
        </Button>
      </div>
    </div>
  )
}

export default JsonSchema
