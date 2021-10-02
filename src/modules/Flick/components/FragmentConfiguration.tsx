import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useFormik } from 'formik'
import { atom, useRecoilState } from 'recoil'
import { Button, emitToast, EmptyState, ScreenState } from '../../../components'
import {
  FlickFragmentFragment,
  useUpdateFragmentConfigurationMutation,
} from '../../../generated/graphql'
import { GetSchemaElement, SchemaElementProps } from './Effects'
import { VideoInventoryModal } from './index'

const FragmentConfiguration = ({
  fragment,
  handleRefetch,
}: {
  handleRefetch: (refresh?: boolean) => void
  fragment?: FlickFragmentFragment
}) => {
  const [config, setConfig] = useState<SchemaElementProps[]>()
  const [initial, setInitial] = useState<{ [key: string]: any }>({})
  const [isConfigured, setConfigured] = useState<boolean>(false)
  // const [count, setCount] = useRecoilState(counter);
  const [updateFragment, { data, error, loading }] =
    useUpdateFragmentConfigurationMutation()
  const [loadingAssets, setLoadingAssets] = useState<boolean>(false)
  const history = useHistory()
  const [videoInventoryModal, setVideoInventoryModal] = useState<boolean>(false)
  const [selectedVideoLink, setSelectedVideoLink] = useState<string>(' ')

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

  useEffect(() => {
    if (!fragment || !fragment.configuration) return

    setConfig(fragment.configuration.properties)
  }, [fragment?.configuration])

  useEffect(() => {
    if (!config) return

    const object: { [key: string]: any } = {}
    config.forEach((code) => {
      object[code.key] = code.value
    })
    setInitial(object)
    setConfigured(true)
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

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {config?.map((attribute) => (
          <GetSchemaElement
            schema={attribute}
            setFieldValue={setFieldValue}
            handleChange={handleChange}
            value={values[attribute.key]}
            setConfigured={setConfigured}
            setLoadingAssets={setLoadingAssets}
            selectedVideoLink={selectedVideoLink}
            setVideoInventoryModal={setVideoInventoryModal}
          />
        ))}

        <Button
          type="button"
          size="small"
          appearance={!isConfigured ? 'primary' : 'secondary'}
          className="ml-4"
          onClick={(e) => {
            e?.preventDefault()
            handleSubmit()
          }}
          disabled={isConfigured}
          loading={loadingAssets || loading}
        >
          {!isConfigured ? 'Save Configuration' : 'Saved'}
        </Button>
      </form>

      <VideoInventoryModal
        open={videoInventoryModal}
        handleClose={() => {
          setVideoInventoryModal(false)
        }}
        setSelectedVideoLink={setSelectedVideoLink}
      />

      <Button
        type="button"
        className="ml-auto -mt-10"
        size="medium"
        appearance="primary"
        disabled={!isConfigured}
        onClick={() => {
          history.push(`/${fragment.id}/studio`)
        }}
      >
        Launch studio
      </Button>
    </div>
  )
}

FragmentConfiguration.defaultProps = {
  fragment: undefined,
}

export default FragmentConfiguration
