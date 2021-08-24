import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useFormik } from 'formik'
import { Button, emitToast, EmptyState, ScreenState } from '../../../components'
import {
  FlickFragmentFragment,
  useUpdateFragmentConfigurationMutation,
} from '../../../generated/graphql'
import { getSchemaElement, SchemaElementProps } from './Effects'
import TemplateMarket from '../../TemplateMarket/TemplateMarket'

const FragmentConfiguration = ({
  fragment,
}: {
  fragment?: FlickFragmentFragment
}) => {
  const [config, setConfig] = useState<SchemaElementProps[]>()
  const [initial, setInitial] = useState<{ [key: string]: any }>({})
  const [isConfigured, setConfigured] = useState(false)
  const [open, setOpen] = useState(false)
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

        updateFragment({
          variables: {
            fragmentId: fragment?.id,
            items: Object.entries(values).map((entry) => ({
              key: entry[0],
              value: entry[1],
            })),
          },
        })
      } catch (error: any) {
        emitToast({
          title: 'Something went wrong.',
          description: error.message,
          type: 'error',
        })
      } finally {
        setSubmitting(false)
      }
    },
  })

  const splashConfig = [
    {
      key: 'displayName',
      type: 'text',
      name: 'Display Name',
      description: 'Please enter your Name',
      dirty: false,
      required: true,
      editable: true,
    },
    {
      key: 'username',
      type: 'text',
      name: 'Username',
      description: 'Please enter your Username',
      dirty: false,
      required: true,
      editable: true,
    },
    {
      key: 'picture',
      type: 'pic', // or file
      name: 'picture',
      description: 'Please select your Picture',
      dirty: false,
      required: true,
      editable: true,
    },
  ]

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
        <span className="ml-4">👇 Only for splash now 👇</span>
        <Button
          type="button"
          size="small"
          className="ml-4 mb-2"
          appearance="danger"
          onClick={() => setOpen(true)}
        >
          Select a Template
        </Button>
        <Button
          type="button"
          size="small"
          appearance="secondary"
          className="ml-4"
          onClick={(e) => {
            e?.preventDefault()
            handleSubmit()
          }}
          loading={loading}
        >
          Save Configuration
        </Button>
      </form>

      <TemplateMarket
        fragmentType={fragment.type}
        fragmentId={fragment?.id}
        open={open}
        setOpen={setOpen}
      />
      <Button
        type="button"
        className="ml-auto"
        size="medium"
        appearance="primary"
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
