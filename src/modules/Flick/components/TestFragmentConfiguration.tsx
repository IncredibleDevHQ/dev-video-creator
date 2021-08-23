import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { useFormik } from 'formik'
import { Button, emitToast, EmptyState, ScreenState } from '../../../components'
import {
  FlickFragmentFragment,
  useUpdateFragmentConfigurationMutation,
} from '../../../generated/graphql'
import { fragmentTemplateStore } from '../../../stores/fragment.store'
import { getSchemaElement, SchemaElementProps } from './Effects'

const TestFragmentConfiguration = ({
  fragment,
}: {
  fragment?: FlickFragmentFragment
}) => {
  const [selectedTemplates] = useRecoilState(fragmentTemplateStore)
  const [config, setConfig] = useState<SchemaElementProps[]>()
  const [obj, setObj] = useState<{ [key: string]: any }>({})

  const history = useHistory()

  const [isConfigured, setConfigured] = useState(false)
  const [updateFragment, { data, error }] =
    useUpdateFragmentConfigurationMutation()

  useEffect(() => {
    if (!fragment || !fragment.configuration) return
    setConfig(fragment!.configuration.properties)

    console.log(config)
  }, [fragment?.configuration])

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  if (!fragment) return <EmptyState text="No fragment Selected" width={400} />
  console.log('config', config)

  useEffect(() => {
    const objj: { [key: string]: any } = {}
    config?.forEach((code) => {
      objj[code.key] = code.value
    })
    setObj(objj)
  }, [config])

  const {
    errors,
    handleChange,
    handleSubmit,
    values,
    handleBlur,
    touched,
    isValid,
    setFieldValue,
    setSubmitting,
  } = useFormik({
    enableReinitialize: true,
    initialValues: obj,
    onSubmit: async (values) => {
      if (!isValid) return
      try {
        setSubmitting(true)
        console.log(
          'default values',
          Object.entries(values).map((e) => ({
            key: e[0],
            value: e[1],
          }))
        )
        updateFragment({
          variables: {
            fragmentId: fragment?.id,
            items: Object.entries(values).map((e) => ({
              key: e[0],
              value: e[1],
            })),
          },
        })
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

  // const questions = [
  //   {
  //     key: 'questions',
  //     type: 'text[]',
  //     name: 'Please Enter Your Questions',
  //     description: 'Add Your Question',
  //     dirty: false,
  //     required: true,
  //     editable: true,
  //     value: [],
  //   },
  // ]

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {config?.map((attribute) =>
          getSchemaElement(
            attribute,
            handleChange,
            setFieldValue,
            values[attribute.key]
          )
        )}
        <Button
          type="button"
          size="small"
          className="ml-4"
          appearance="secondary"
          onClick={(e) => {
            e?.preventDefault()
            handleSubmit()
          }}
        >
          Save Configuration
        </Button>
      </form>

      <Button
        type="button"
        className="ml-auto"
        size="medium"
        appearance="primary"
        disabled={!isConfigured}
        onClick={() => {
          history.push(`/${fragment.id}/studio`)
        }}
      >
        Record
      </Button>
      {/* <TestConfig /> */}
    </div>
  )
}

TestFragmentConfiguration.defaultProps = {
  fragment: undefined,
}

export default TestFragmentConfiguration
