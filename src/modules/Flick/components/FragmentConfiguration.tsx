import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useFormik } from 'formik'
import { Button, emitToast, EmptyState, ScreenState } from '../../../components'
import {
  FlickFragmentFragment,
  useUpdateFragmentConfigurationMutation,
} from '../../../generated/graphql'
import { getSchemaElement, SchemaElementProps } from './Effects'

const FragmentConfiguration = ({
  fragment,
}: {
  fragment?: FlickFragmentFragment
}) => {
  const [config, setConfig] = useState<SchemaElementProps[]>()
  const [initial, setInitial] = useState<{ [key: string]: any }>({})
  const [isConfigured, setConfigured] = useState(false)
  const [updateFragment, { data, error, loading }] =
    useUpdateFragmentConfigurationMutation()
  const history = useHistory()

  useEffect(() => {
    if (!fragment || !fragment.configuration) return
    setConfig(fragment!.configuration.properties)
  }, [fragment?.configuration])

  useEffect(() => {
    if (config) {
      setConfigured(true)
    }
  }, [config])

  useEffect(() => {
    if (data)
      emitToast({
        title: 'Configuration Added',
        type: 'success',
      })
  }, [data])

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  if (!fragment) return <EmptyState text="No fragment Selected" width={400} />

  useEffect(() => {
    const object: { [key: string]: any } = {}

    config?.forEach((code) => {
      object[code.key] = code.value
    })
    setInitial(object)
  }, [config])

  const {
    handleChange,
    handleSubmit,
    values,
    isValid,
    setFieldValue,
    setSubmitting,
  } = useFormik({
    enableReinitialize: true,
    initialValues: initial,
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
          loading={loading}
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
    </div>
  )
}

FragmentConfiguration.defaultProps = {
  fragment: undefined,
}

export default FragmentConfiguration
