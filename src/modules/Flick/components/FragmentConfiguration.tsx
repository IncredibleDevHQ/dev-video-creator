/* eslint-disable react/jsx-pascal-case */
import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { Button, EmptyState, ScreenState, TextField } from '../../../components'
import {
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  useAddConfigurationMutation,
} from '../../../generated/graphql'
import { useUploadFile } from '../../../hooks'
import { fragmentTemplateStore } from '../../../stores/fragment.store'
import TemplateMarket from '../../TemplateMarket/TemplateMarket'

const FragmentConfiguration = ({
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
  const [gistURL, setGistURL] = useState('')
  const [videoURL, setVideoURL] = useState('')
  const [loadingPic, setLoadingPic] = useState(false)

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
    const config = JSON.parse(fragment.configuration || {})

    if (Object.keys(config).length > 0) {
      if (config.gistURL) setGistURL(config.gistURL)
      if (config.videoURL) setVideoURL(config.videoURL)
      setConfigured(true)
    }
  }, [fragment?.configuration])

  const handleConfiguration = async () => {
    if (!fragment) return
    let config = {}
    switch (fragment.type) {
      case Fragment_Type_Enum_Enum.CodeJam:
        config = { gistURL }
        break
      case Fragment_Type_Enum_Enum.Splash:
        config = { displayName, username, picture, template }
        break
      case Fragment_Type_Enum_Enum.Videoshow:
        config = { videoURL }
        break
      default:
        config = {}
    }

    await addConfiguration({
      variables: {
        id: fragment?.id,
        configuration: JSON.stringify(config),
      },
    })
    setConfigured(true)
  }

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  if (!fragment) return <EmptyState text="No fragment Selected" width={400} />
  return (
    <div>
      {/* <TextField type="text" label="Enter Template Id" /> */}
      {fragment.type === Fragment_Type_Enum_Enum.Videoshow && (
        <TextField
          type="text"
          label="Video URL"
          value={videoURL}
          caption="Demo only"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setVideoURL(e.target.value)
          }}
        />
      )}
      {fragment.type === Fragment_Type_Enum_Enum.CodeJam && (
        <TextField
          type="text"
          label="Gist URL"
          value={gistURL}
          caption="Demo only"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setGistURL(e.target.value)
          }}
        />
      )}
      {fragment.type === Fragment_Type_Enum_Enum.Splash && !template && (
        <div className="h-96 flex flex-col items-center justify-center">
          {fragment.configuration ? (
            <div className="flex flex-col items-center">
              <span>Configuration Added!</span>
              <span className="gap-2 flex flex-col p-5 m-2 bg-blue-200">
                <span>
                  Display Name: {JSON.parse(fragment.configuration).displayName}
                </span>
                <span>
                  Username: {JSON.parse(fragment.configuration).username}
                </span>
                <span className="flex">
                  Picture:
                  <img
                    className="h-32 object-contain"
                    src={JSON.parse(fragment.configuration).picture}
                    alt="series pic"
                  />
                </span>
                <span>
                  Template:{' '}
                  {JSON.parse(fragment.configuration).template.template}
                </span>
              </span>
              <Button
                type="button"
                size="small"
                appearance="secondary"
                onClick={() => setOpen(true)}
              >
                Change Configuration
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="medium"
              appearance="secondary"
              onClick={() => setOpen(true)}
            >
              Select a Template
            </Button>
          )}
        </div>
      )}

      {fragment.type === Fragment_Type_Enum_Enum.Splash && template && (
        <div className="flex flex-col mt-2 mb-2 gap-3">
          <TextField
            value={displayName}
            type="text"
            label="Enter Display Name"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setDisplayName(e.target.value)
            }
          />
          <TextField
            value={username}
            type="text"
            label="Enter Username"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setUsername(e.target.value)
            }
          />
          {picture && (
            <img
              className="h-32 object-contain"
              src={picture}
              alt="fragment pic"
            />
          )}
          <input
            type="file"
            className="w-full mb-2"
            accept="image/png, image/jpg"
            onChange={(e) =>
              e.target.files?.[0] && handleClick(e.target.files[0])
            }
            placeholder="Upload a Pic"
          />
        </div>
      )}

      <Button
        disabled={loadingPic || loading}
        loading={loadingPic || loading}
        type="button"
        size="small"
        appearance="secondary"
        onClick={handleConfiguration}
      >
        Add Configuration
      </Button>

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
