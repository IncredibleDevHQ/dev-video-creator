import { useFormik } from 'formik'
import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { emitToast, ScreenState, EmptyState, Button } from '../../../components'
import { useUpdateFragmentConfigurationMutation } from '../../../generated/graphql'
import { VideoInventoryModal } from '.'
import { SchemaElementProps, GetSchemaElement } from './Effects'
import { FlickConfiguration } from '../NewFlick'
import { newFlickStore } from '../store/flickNew.store'

const FragmentContent = () => {
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)

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

  const fragment = flick?.fragments.find((f) => f.id === activeFragmentId)

  const handleOnSubmit = async (values: { [key: string]: any }) => {
    if (!isValid) return
    try {
      setSubmitting(true)

      const newItems = Object.entries(values).map((entry) => ({
        key: entry[0],
        value: entry[1],
      }))
      await updateFragment({
        variables: {
          fragmentId: fragment?.id,
          items: newItems,
        },
      })

      console.log(fragment?.configuration)

      if (fragment && flick) {
        let temp = { ...fragment }
        const { properties } = fragment.configuration
        temp = {
          ...fragment,
          configuration: {
            ...fragment.configuration,
            properties: newItems.map((item) => {
              const property = properties.find((p: any) => p.key === item.key)
              return {
                ...property,
                value: item.value,
                dirty: true,
              }
            }),
          },
        }
        setFlickStore((prev) => ({
          ...prev,
          flick: {
            ...flick,
            fragments: flick.fragments.map((f) => {
              if (f.id === fragment.id) {
                return temp
              }
              return f
            }),
          },
        }))
      }

      setConfigured(true)
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

    const flickConfig = flick?.configuration as FlickConfiguration

    config.forEach((code) => {
      if (code.key === 'theme') {
        object[code.key] = `${flickConfig.themeId}`
      } else {
        object[code.key] = code.value
      }
    })
    setInitial(object)
    setConfigured(true)
  }, [config])

  useEffect(() => {
    if (!data) return
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
    <div className="w-full rounded-md bg-gray-50 overflow-y-auto pb-32 pt-4">
      <form onSubmit={handleSubmit}>
        {config?.map((attribute) => {
          return (
            attribute.key !== 'theme' && (
              <GetSchemaElement
                schema={attribute}
                setFieldValue={setFieldValue}
                handleChange={handleChange}
                value={values[attribute.key]}
                type={fragment.type}
                setConfigured={setConfigured}
                setLoadingAssets={setLoadingAssets}
                selectedVideoLink={selectedVideoLink}
                setVideoInventoryModal={setVideoInventoryModal}
              />
            )
          )
        })}

        <Button
          type="button"
          size="small"
          appearance={!isConfigured ? 'primary' : 'secondary'}
          className="ml-4 mt-2"
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
    </div>
  )
}

export default FragmentContent
