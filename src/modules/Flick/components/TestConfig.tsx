import { useFormik } from 'formik'
import React from 'react'
import { emitToast } from '../../../components'

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
