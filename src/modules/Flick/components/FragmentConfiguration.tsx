/* eslint-disable react/jsx-pascal-case */
import React, { useEffect, useState } from 'react'
import { useRecoilState } from 'recoil'
import { Button, EmptyState, ScreenState, TextField } from '../../../components'
import {
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  useAddConfigurationMutation,
} from '../../../generated/graphql'
import { useUploadFile } from '../../../hooks'
// import { BasicTemplate } from '../../Studio/effects/Templates/SplashTemplates'
import { fragmentTemplateStore } from '../../../stores/fragment.store'
import TemplateMarket from '../../TemplateMarket/TemplateMarket'

const FragmentConfiguration = ({
  fragment,
}: {
  fragment: FlickFragmentFragment | undefined
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

  const [uploadFile] = useUploadFile()

  const handleClick = async (file: File | Blob) => {
    if (!file) return

    setLoadingPic(true)
    const pic = await uploadFile({
      extension: file.name.split('.')[1],
      file,
    })
    setLoadingPic(false)
    setPicture(pic.url)
  }

  const [AddConfiguration, { loading, error }] = useAddConfigurationMutation()

  useEffect(() => {
    setTemplate(selectedTemplates.find((t) => t.id === fragment?.id))
  }, [selectedTemplates])

  const handleConfiguration = () => {
    const config = { displayName, username, picture, template }

    AddConfiguration({
      variables: {
        id: fragment?.id,
        configuration: JSON.stringify(config),
      },
    })
  }

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  if (!fragment) return <EmptyState text="No fragment Selected" width={400} />
  return (
    <div>
      {/* <span>{fragment?.type}</span> */}
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
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <TextField
            value={username}
            type="text"
            label="Enter Username"
            onChange={(e) => setUsername(e.target.value)}
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
            accept="image/*"
            onChange={(e) => handleClick(e.target.files[0])}
            placeholder="Upload a Pic"
          />
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
        </div>
      )}

      <TemplateMarket
        fragmentType={fragment.type}
        fragmentId={fragment?.id}
        open={open}
        setOpen={setOpen}
      />
    </div>
  )
}

export default FragmentConfiguration
