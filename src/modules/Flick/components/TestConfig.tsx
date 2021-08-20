import { useFormik } from 'formik'
import React from 'react'
import { Checkbox, emitToast, TextField } from '../../../components'
// import { videoJamConfig } from './config'

interface SchemaElementProps {
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
  value: any
) => {
  switch (schema.type) {
    case 'checkbox':
      return (
        <Checkbox
          name={schema.key}
          label={schema.name}
          id={schema.key}
          checked={value}
          onChange={handleChange}
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
          placeholder={schema.description}
          label={schema.name}
        />
      )

    default:
      return <></>
  }
}

const TestConfig = () => {
  const obj: { [key: string]: any } = {}
  videoJamConfig.forEach((code) => {
    obj[code.key] = code.value
  })

  const {
    errors,
    handleChange,
    handleSubmit,
    values,
    handleBlur,
    touched,
    isValid,
    setSubmitting,
  } = useFormik({
    initialValues: obj,
    onSubmit: async (values) => {
      if (!isValid) return
      try {
        setSubmitting(true)
        console.log(values)
      } catch (e: any) {
        emitToast({
          title: 'Something went wrong.',
          description: e.message,
          type: 'error',
        })
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {videoJamConfig.map((attribute) =>
          getSchemaElement(attribute, handleChange, values[attribute.key])
        )}
        <button
          type="submit"
          onClick={(e) => {
            e?.preventDefault()
            handleSubmit()
          }}
        >
          Submit
        </button>
      </form>
    </div>
  )
}

export default TestConfig
