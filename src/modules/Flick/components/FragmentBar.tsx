/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { BiCheck, BiPlayCircle } from 'react-icons/bi'
import { BsCloudCheck, BsCloudUpload } from 'react-icons/bs'
import { IoDesktopOutline, IoPhonePortraitOutline } from 'react-icons/io5'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { useDebouncedCallback } from 'use-debounce'
import { FragmentVideoModal } from '.'
import { Branding } from '../..'
import { ReactComponent as BrandIcon } from '../../../assets/BrandIcon.svg'
import { Button, emitToast, Heading, Text, Tooltip } from '../../../components'
import { TextEditorParser } from '../editor/utils/helpers'
import {
  Content_Type_Enum_Enum,
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  useGetBrandingQuery,
  useUpdateFlickBrandingMutation,
  useUpdateFlickMarkdownMutation,
  useUpdateFragmentMarkdownMutation,
  useUpdateFragmentStateMutation,
} from '../../../generated/graphql'
import useDidUpdateEffect from '../../../hooks/use-did-update-effect'
import { ViewConfig } from '../../../utils/configTypes'
import { newFlickStore, View } from '../store/flickNew.store'
import { IntroOutroConfiguration } from './IntroOutroView'

// const dashArray = 10 * Math.PI * 2

const FragmentBar = ({
  config,
  markdown,
  editorValue,
  setViewConfig,
  plateValue,
  introConfig,
}: {
  editorValue?: string
  markdown?: string
  config: ViewConfig
  plateValue?: any
  setViewConfig: React.Dispatch<React.SetStateAction<ViewConfig>>
  introConfig: IntroOutroConfiguration
}) => {
  const [fragmentVideoModal, setFragmentVideoModal] = useState(false)
  const [brandingModal, setBrandingModal] = useState(false)
  const [{ flick, activeFragmentId, view }, setFlickStore] =
    useRecoilState(newFlickStore)
  const history = useHistory()

  const [fragment, setFragment] = useState<FlickFragmentFragment | undefined>(
    flick?.fragments.find((f) => f.id === activeFragmentId)
  )

  const [updateFragmentMarkdown] = useUpdateFragmentMarkdownMutation()
  const [updateFlickMarkdown] = useUpdateFlickMarkdownMutation()
  const [updateFlickBranding] = useUpdateFlickBrandingMutation()

  const { data: brandingData } = useGetBrandingQuery()

  const [updateFragmentState, { error }] = useUpdateFragmentStateMutation()

  const [savingConfig, setSavingConfig] = useState(false)

  const [useBranding, setUseBranding] = useState(false)
  const [brandingId, setBrandingId] = useState<string>()

  useEffect(() => {
    if (!flick) return
    setUseBranding(flick.useBranding)
    setBrandingId(flick.brandingId)
  }, [flick?.branding])

  const debounced = useDebouncedCallback(
    // function
    () => {
      updateConfig()
    },
    400
  )

  useDidUpdateEffect(() => {
    debounced()
  }, [editorValue, config, introConfig, markdown, useBranding, brandingId])

  useEffect(() => {
    const f = flick?.fragments.find((f) => f.id === activeFragmentId)
    setFragment(f)
  }, [activeFragmentId, flick])

  useEffect(() => {
    if (!error) return
    emitToast({
      type: 'error',
      title: 'Error saving configuration',
    })
  }, [error])

  const updateConfig = async () => {
    setSavingConfig(true)

    await updateFlickBranding({
      variables: { id: flick?.id, branding: useBranding, brandingId },
    })

    try {
      if (
        fragment &&
        (fragment?.type === Fragment_Type_Enum_Enum.Intro ||
          fragment?.type === Fragment_Type_Enum_Enum.Outro)
      ) {
        await updateFragmentState({
          variables: {
            editorState: {},
            id: activeFragmentId,
            configuration: introConfig,
          },
        })
        if (flick)
          setFlickStore((store) => ({
            ...store,
            flick: {
              ...flick,
              useBranding,

              fragments: flick.fragments.map((f) =>
                f.id === activeFragmentId
                  ? {
                      ...f,
                      configuration: introConfig,
                    }
                  : f
              ),
            },
          }))
      } else {
        if (!editorValue || editorValue?.length === 0) return
        await updateFragmentMarkdown({
          variables: {
            fragmentId: activeFragmentId,
            md: markdown,
          },
        })
        await updateFlickMarkdown({
          variables: {
            id: flick?.id,
            md: editorValue,
          },
        })
        await updateFragmentState({
          variables: {
            editorState: plateValue,
            id: activeFragmentId,
            configuration: config,
          },
        })
        if (flick)
          setFlickStore((store) => ({
            ...store,
            flick: {
              ...flick,
              useBranding,
              brandingId,
              md: editorValue,
              fragments: flick.fragments.map((f) =>
                f.id === activeFragmentId
                  ? {
                      ...f,
                      configuration: config,
                      editorState: editorValue,
                    }
                  : f
              ),
            },
          }))
      }
    } catch (error) {
      emitToast({
        type: 'error',
        title: 'Error updating fragment',
      })
    } finally {
      setSavingConfig(false)
    }
  }

  const [isOpen, setIsOpen] = useState(false)

  const [mode, setMode] = useState<Content_Type_Enum_Enum>(
    Content_Type_Enum_Enum.Video
  )

  useEffect(() => {
    if (config.mode === 'Portrait') {
      setMode(Content_Type_Enum_Enum.VerticalVideo)
    } else {
      setMode(Content_Type_Enum_Enum.Video)
    }
  }, [config.mode])

  return (
    <div className="sticky flex items-center justify-between px-4 bg-dark-300 w-full">
      <div className="flex items-center justify-start text-dark-title py-2">
        <Heading
          className={cx('cursor-pointer hover:text-white', {
            'text-white': view === View.Notebook,
          })}
          onClick={() =>
            setFlickStore((prev) => ({ ...prev, view: View.Notebook }))
          }
        >
          Notebook
        </Heading>
        <Heading
          className={cx('cursor-pointer hover:text-white ml-4', {
            'text-white': view === View.Preview,
          })}
          onClick={() =>
            setFlickStore((prev) => ({ ...prev, view: View.Preview }))
          }
        >
          Preview
        </Heading>
      </div>
      <div className="flex items-center h-full">
        {savingConfig ? (
          <div className="flex text-gray-400 items-center mr-4">
            <BsCloudUpload className="mr-1" />
            <Text fontSize="small">Saving...</Text>
          </div>
        ) : (
          <div className="flex text-gray-400 items-center mr-4">
            <BsCloudCheck className="mr-1" />
            <Text fontSize="small">Saved</Text>
          </div>
        )}
        <div className="flex border-l-2 h-full items-center justify-center border-brand-grey">
          <Tooltip
            className="p-0 m-0"
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            content={
              <ul
                style={{
                  minWidth: '200px',
                }}
                className="bg-dark-300 rounded-md -mt-1 flex flex-col justify-center"
              >
                {brandingData?.Branding.map((branding, index) => {
                  return (
                    <li
                      key={branding.id}
                      className={cx(
                        'hover:bg-dark-100 cursor-pointer text-white flex items-center transition-colors p-3',
                        {
                          'rounded-t-md': index === 0,
                        }
                      )}
                      onClick={() => {
                        setBrandingId(branding.id)
                        setUseBranding(true)
                        setIsOpen(false)
                      }}
                    >
                      <BrandIcon className="mr-2" />
                      <Text className="font-body text-sm mr-4">
                        {branding.name}
                      </Text>
                      {branding.id === brandingId && useBranding && (
                        <BiCheck className="ml-auto" size={20} />
                      )}
                    </li>
                  )
                })}
                <li
                  className={cx(
                    'hover:bg-dark-100 cursor-pointer text-white flex items-center transition-colors p-3'
                  )}
                  onClick={() => {
                    setUseBranding(false)
                    setIsOpen(false)
                  }}
                >
                  <BrandIcon className="mr-2" />
                  <Text className="font-body text-sm mr-4">None</Text>
                  {!useBranding && <BiCheck className="ml-auto" size={20} />}
                </li>
                {brandingData && brandingData.Branding.length > 0 && (
                  <div className="border-t border-gray-600 mx-3 mt-1.5" />
                )}
                <Button
                  appearance="gray"
                  type="button"
                  className="m-3"
                  onClick={() => {
                    setBrandingModal(true)
                    setIsOpen(false)
                  }}
                >
                  <Text className="text-sm">Add new</Text>
                </Button>
              </ul>
            }
            placement="bottom-start"
            triggerOffset={20}
          >
            <Button
              appearance="none"
              type="button"
              className="flex items-center"
              onClick={() => {
                setIsOpen(!isOpen)
              }}
            >
              <BrandIcon className="mr-2" />
              <Text className=" text-sm font-main text-gray-100">Brand</Text>
            </Button>
          </Tooltip>
        </div>
        <div className="flex justify-end items-stretch border-l-2 py-2 pl-4 border-brand-grey">
          <Button
            appearance={config.mode === 'Landscape' ? 'gray' : 'none'}
            size="small"
            type="button"
            icon={IoDesktopOutline}
            className="mr-2 transition-colors"
            onClick={() => setViewConfig({ ...config, mode: 'Landscape' })}
          />
          <Button
            appearance={config.mode === 'Portrait' ? 'gray' : 'none'}
            size="small"
            type="button"
            className="mr-4 transition-colors"
            icon={IoPhonePortraitOutline}
            onClick={() => setViewConfig({ ...config, mode: 'Portrait' })}
          />
          {(fragment?.producedLink || fragment?.producedShortsLink) &&
            (mode === Content_Type_Enum_Enum.Video ||
              mode === Content_Type_Enum_Enum.VerticalVideo) && (
              <Button
                appearance="gray"
                size="small"
                type="button"
                className="mr-4"
                icon={BiPlayCircle}
                iconSize={20}
                onClick={() => {
                  setFragmentVideoModal(true)
                }}
              />
            )}
          <Button
            appearance="primary"
            size="small"
            type="button"
            disabled={checkDisabledState(fragment, plateValue)}
            onClick={async () => {
              await updateConfig()
              history.push(`/${activeFragmentId}/studio`)
            }}
          >
            {checkHasContent(fragment, mode) ? 'Re-take' : 'Record'}
          </Button>
        </div>
      </div>
      {fragmentVideoModal && (
        <FragmentVideoModal
          open={fragmentVideoModal}
          handleClose={() => {
            setFragmentVideoModal(false)
          }}
          contentType={mode}
        />
      )}
      {brandingModal && (
        <Branding
          open={brandingModal}
          handleClose={() => {
            setBrandingModal(false)
          }}
        />
      )}
    </div>
  )
}

const checkDisabledState = (
  fragment: FlickFragmentFragment | undefined,
  editorValue: any
) => {
  if (!fragment) return true
  if (
    fragment.type === Fragment_Type_Enum_Enum.Intro ||
    fragment.type === Fragment_Type_Enum_Enum.Outro
  ) {
    if (fragment.configuration) return false
    return true
  }

  if (
    editorValue &&
    new TextEditorParser(editorValue).isValid() &&
    editorValue.blocks.length > 0
  )
    return false

  return true
}

const checkHasContent = (
  fragment: FlickFragmentFragment | undefined,
  mode: Content_Type_Enum_Enum
) => {
  switch (mode) {
    case Content_Type_Enum_Enum.Video:
      if (fragment?.producedLink) return true
      break

    case Content_Type_Enum_Enum.VerticalVideo:
      if (fragment?.producedShortsLink) return true
      break

    default:
      return false
  }
  return false
}

export default FragmentBar
