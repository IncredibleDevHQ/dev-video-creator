import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { constSelector, useRecoilState } from 'recoil'
import { Button, EmptyState, ScreenState, TextField } from '../../../components'
import {
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  useAddConfigurationMutation,
} from '../../../generated/graphql'
import { useUploadFile } from '../../../hooks'
import { fragmentTemplateStore } from '../../../stores/fragment.store'
import TemplateMarket from '../../TemplateMarket/TemplateMarket'
import TestConfig from './TestConfig'
import { SchemaElementProps } from './Effects'

const TestFragmentConfiguration = ({
  fragment,
}: {
  fragment?: FlickFragmentFragment
}) => {
  const [selectedTemplates] = useRecoilState(fragmentTemplateStore)
  const [template, setTemplate] = useState<{
    id: string
    template: string
  }>()
  const [displayName, setDisplayName] = useState<string>()
  const [username, setUsername] = useState<string>()
  const [open, setOpen] = useState(false)
  const [picture, setPicture] = useState<string>()
  const [loadingPic, setLoadingPic] = useState(false)
  const [config, setConfig] = useState<SchemaElementProps>()

  const history = useHistory()

  const [isConfigured, setConfigured] = useState(false)

  const [uploadFile] = useUploadFile()

  const handleClick = async (file: File) => {
    if (!file) return

    setLoadingPic(true)
    const pic = await uploadFile({
      extension: file.name.split('.')[1] as any,
      file,
    })
    setLoadingPic(false)
    setPicture(pic.url)
  }

  const [addConfiguration, { loading, error }] = useAddConfigurationMutation()

  useEffect(() => {
    setTemplate(selectedTemplates.find((t) => t.id === fragment?.id))
  }, [selectedTemplates])

  useEffect(() => {
    if (!fragment || !fragment.configuration) return
    setConfig(fragment!.configuration.properties)

    // if (Object.keys(config).length > 0) {
    //   if (config.gistURL) setGistURL(config.gistURL)
    //   if (config.videoURL) setVideoURL(config.videoURL)
    //   setConfigured(true)
    // }
  }, [fragment?.configuration])

  console.log('configuration', config)

  // const handleConfiguration = async () => {
  //   if (!fragment) return
  //   let config = {}
  //   switch (fragment.type) {
  //     case Fragment_Type_Enum_Enum.CodeJam:
  //       config = {}
  //       break
  //     case Fragment_Type_Enum_Enum.Splash:
  //       config = { displayName, username, picture, template }
  //       break
  //     case Fragment_Type_Enum_Enum.Videoshow:
  //       config = {}
  //       break
  //     default:
  //       config = {}
  //   }

  //   await addConfiguration({
  //     variables: {
  //       id: fragment?.id,
  //       configuration: JSON.stringify(config),
  //     },
  //   })
  //   setConfigured(true)
  // }

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  if (!fragment) return <EmptyState text="No fragment Selected" width={400} />

  return (
    <div>
      {/* <Button
        disabled={loadingPic || loading}
        loading={loadingPic || loading}
        type="button"
        size="small"
        appearance="secondary"
        onClick={handleConfiguration}
      >
        Add Configuration
      </Button> */}

      {/* <TemplateMarket
        fragmentType={fragment.type}
        fragmentId={fragment?.id}
        open={open}
        setOpen={setOpen}
      /> */}
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
