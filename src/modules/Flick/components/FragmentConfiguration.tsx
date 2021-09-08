import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useFormik } from 'formik'
import { Button, emitToast, EmptyState, ScreenState } from '../../../components'
import {
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  useUpdateFragmentConfigurationMutation,
} from '../../../generated/graphql'
import { GetSchemaElement, SchemaElementProps } from './Effects'
import { VideoInventoryModal } from './index'
import { FiPlus } from 'react-icons/fi'

const FragmentConfiguration = ({
  fragment,
  handleRefetch,
}: {
  handleRefetch: (refresh?: boolean) => void
  fragment?: FlickFragmentFragment
}) => {
  const [config, setConfig] = useState<SchemaElementProps[]>()
  const [initial, setInitial] = useState<{ [key: string]: any }>({})
  const [isConfigured, setConfigured] = useState(false)
  const [updateFragment, { data, error, loading }] =
    useUpdateFragmentConfigurationMutation()
  const [loadingAssets, setLoadingAssets] = useState<boolean>(false)
  const history = useHistory()
  const [videoInventoryModal, setVideoInventoryModal] = useState<boolean>(false)
  const [selectedVideoLink, setSelectedVideoLink] = useState<string>(' ')

  useEffect(() => {
    if (!fragment || !fragment.configuration) return
    setConfig(fragment!.configuration.properties)
  }, [fragment?.configuration])

  useEffect(() => {
    if (config) {
      setConfigured(true)
    }
    const object: { [key: string]: any } = {}
    config?.forEach((code) => {
      object[code.key] = code.value || ''
    })
    setInitial(object)
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

  const handleOnSubmit = async (values: { [key: string]: any }) => {
    if (!isValid) return
    try {
      setSubmitting(true)

      await updateFragment({
        variables: {
          fragmentId: fragment?.id,
          items: Object.entries(values).map((entry) => ({
            key: entry[0],
            value: entry[1],
          })),
        },
      })
      handleRefetch(true)
    } catch (error: any) {
      emitToast({
        title: 'Something went wrong.',
        description: error.message,
        type: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

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
    onSubmit: handleOnSubmit,
  })

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {config?.map((attribute) => (
          <GetSchemaElement
            schema={attribute}
            setFieldValue={setFieldValue}
            handleChange={handleChange}
            value={values[attribute.key]}
            setLoadingAssets={setLoadingAssets}
            selectedVideoLink={selectedVideoLink}
            setVideoInventoryModal={setVideoInventoryModal}
          />
        ))}

        <Button
          type="button"
          size="small"
          appearance="secondary"
          className="ml-4"
          onClick={(e) => {
            e?.preventDefault()
            handleSubmit()
          }}
          disabled={loadingAssets}
          loading={loadingAssets || loading}
        >
          Save Configuration
        </Button>
      </form>
      {fragment.type === Fragment_Type_Enum_Enum.Videoshow && (
        <VideoInventoryModal
          open={videoInventoryModal}
          handleClose={() => {
            setVideoInventoryModal(false)
          }}
          setSelectedVideoLink={setSelectedVideoLink}
        />
      )}
      {isConfigured && (
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
      )}
    </div>
  )
}

FragmentConfiguration.defaultProps = {
  fragment: undefined,
}

export default FragmentConfiguration
