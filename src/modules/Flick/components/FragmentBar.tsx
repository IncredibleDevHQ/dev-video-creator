/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import React, { HTMLAttributes, useEffect, useState } from 'react'
import { BiPlayCircle } from 'react-icons/bi'
import { BsCloudCheck, BsCloudUpload } from 'react-icons/bs'
import {
  IoCheckmark,
  IoAlbumsOutline,
  IoDesktopOutline,
  IoPhonePortraitOutline,
} from 'react-icons/io5'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { useDebouncedCallback } from 'use-debounce'
import { FragmentVideoModal } from '.'
import { Button, emitToast, Heading, Text, Tooltip } from '../../../components'
import { TextEditorParser } from '../../../components/TempTextEditor/utils'
import config from '../../../config'
import { ASSETS } from '../../../constants'
import {
  Content_Type_Enum_Enum,
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  ThemeFragment,
  useUpdateFlickMarkdownMutation,
  useUpdateFlickThemeMutation,
  useUpdateFragmentMarkdownMutation,
  useUpdateFragmentStateMutation,
} from '../../../generated/graphql'
import useDidUpdateEffect from '../../../hooks/use-did-update-effect'
import { ViewConfig } from '../../../utils/configTypes'
import { newFlickStore, View } from '../store/flickNew.store'
import { IntroOutroConfiguration } from './IntroOutroView'

// const dashArray = 10 * Math.PI * 2

const HorizontalContainer = ({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cx(
      'flex items-center overflow-x-scroll overflow-y-hidden w-full',
      css`
        -ms-overflow-style: none;
        scrollbar-width: none;
        ::-webkit-scrollbar {
          display: none;
        }
      `,
      className
    )}
    {...rest}
  />
)

const ThemeTooltip = ({
  themes,
  flickId,
  activeTheme,
  handleClose,
  updateActiveTheme,
}: {
  flickId: string
  themes: ThemeFragment[]
  activeTheme: ThemeFragment | null
  handleClose: () => void
  updateActiveTheme: (theme: ThemeFragment) => void
}) => {
  const { baseUrl } = config.storage
  const [activeScreen, setActiveScreen] = useState<'theme' | 'themes'>('themes')
  const [tempActiveTheme, setTempActiveTheme] = useState<ThemeFragment>()

  const [updateTheme, { loading }] = useUpdateFlickThemeMutation()

  useEffect(() => {
    if (tempActiveTheme) {
      setActiveScreen('theme')
    } else {
      setActiveScreen('themes')
    }
  }, [tempActiveTheme])

  const updateFlickTheme = async () => {
    if (!tempActiveTheme) return
    const { data } = await updateTheme({
      variables: {
        id: flickId,
        theme: tempActiveTheme.name,
      },
    })
    if (data) {
      updateActiveTheme(tempActiveTheme)
      emitToast({
        type: 'success',
        title: 'Theme updated',
        description: `Current theme updated to ${tempActiveTheme.name} successfully`,
      })
      handleClose()
    } else {
      emitToast({
        type: 'error',
        title: 'Error saving theme',
      })
    }
  }

  return (
    <div
      className={cx(
        'bg-gray-800 text-white rounded-md p-4 mx-2 max-h-screen',
        css`
          width: 70vw;
        `
      )}
    >
      <div className="flex justify-between items-center">
        <h4>
          <span
            className={cx('text-white cursor-pointer', {
              'opacity-70 hover:opacity-100': activeScreen !== 'themes',
              'opacity-100': activeScreen === 'themes',
            })}
            onClick={() => {
              setActiveScreen('themes')
              setTempActiveTheme(undefined)
            }}
          >
            Themes
          </span>
          {tempActiveTheme && (
            <>
              <span className="mx-2">&gt;</span>
              <span className="text-white cursor-pointer">
                {tempActiveTheme.name}
              </span>{' '}
            </>
          )}
        </h4>
        {activeScreen === 'theme' && (
          <Button
            appearance="gray"
            size="small"
            type="button"
            loading={loading}
            onClick={updateFlickTheme}
          >
            Use Theme
          </Button>
        )}
      </div>
      {activeScreen === 'theme' ? (
        <HorizontalContainer>
          <div className="flex flex-shrink-0 items-center justify-center py-4 px-2">
            <img
              className="border-2 border-gray-600 hover:border-brand rounded-md object-cover w-64 h-36 shadow-md"
              src={
                tempActiveTheme?.config?.previewImages?.intro
                  ? baseUrl + tempActiveTheme?.config?.previewImages?.intro
                  : ASSETS.ICONS.IncredibleLogo
              }
              alt="incredible"
            />
          </div>
          <div className="flex flex-shrink-0 items-center justify-center py-4 px-2">
            <img
              className="border-2 border-gray-600 hover:border-brand rounded-md object-cover w-64 h-36 shadow-md"
              src={
                tempActiveTheme?.config?.previewImages?.['points-ur']
                  ? baseUrl +
                    tempActiveTheme?.config?.previewImages?.['points-ur']
                  : ASSETS.ICONS.IncredibleLogo
              }
              alt="incredible"
            />
          </div>
          <div className="flex flex-shrink-0 items-center justify-center py-4 px-2">
            <img
              className="border-2 border-gray-600 hover:border-brand rounded-md object-cover w-64 h-36 shadow-md"
              src={
                tempActiveTheme?.config?.previewImages?.points
                  ? baseUrl + tempActiveTheme?.config?.previewImages?.points
                  : ASSETS.ICONS.IncredibleLogo
              }
              alt="incredible"
            />
          </div>
          <div className="flex flex-shrink-0 items-center justify-center py-4 px-2">
            <img
              className="border-2 border-gray-600 hover:border-brand rounded-md object-cover w-64 h-36 shadow-md"
              src={
                tempActiveTheme?.config?.previewImages?.code
                  ? baseUrl + tempActiveTheme?.config?.previewImages?.code
                  : ASSETS.ICONS.IncredibleLogo
              }
              alt="incredible"
            />
          </div>
          <div className="flex flex-shrink-0 items-center justify-center py-4 px-2">
            <img
              className="border-2 border-gray-600 hover:border-brand rounded-md object-cover w-64 h-36 shadow-md"
              src={
                tempActiveTheme?.config?.previewImages?.lowerThird
                  ? baseUrl + tempActiveTheme?.config?.previewImages?.lowerThird
                  : ASSETS.ICONS.IncredibleLogo
              }
              alt="incredible"
            />
          </div>
          <div className="flex flex-shrink-0 items-center justify-center py-4 px-2">
            <img
              className="border-2 border-gray-600 hover:border-brand rounded-md object-cover w-64 h-36 shadow-md"
              src={
                tempActiveTheme?.config?.previewImages?.image
                  ? baseUrl + tempActiveTheme?.config?.previewImages?.image
                  : ASSETS.ICONS.IncredibleLogo
              }
              alt="incredible"
            />
          </div>
          <div className="flex flex-shrink-0 items-center justify-center py-4 px-2">
            <img
              className="border-2 border-gray-600 hover:border-brand rounded-md object-cover w-64 h-36 shadow-md"
              src={
                tempActiveTheme?.config?.previewImages?.outro
                  ? baseUrl + tempActiveTheme?.config?.previewImages?.outro
                  : ASSETS.ICONS.IncredibleLogo
              }
              alt="incredible"
            />
          </div>
        </HorizontalContainer>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {themes.map((theme) => (
            <div
              key={theme.name}
              className="flex items-center justify-center py-4 relative"
              onClick={() => setTempActiveTheme(theme)}
            >
              {activeTheme?.name === theme.name && (
                <IoCheckmark
                  size={24}
                  className="absolute top-6 right-2 text-brand font-bold bg-brand-10 p-1 rounded-md"
                />
              )}
              <img
                className="border-2 border-gray-600 hover:border-brand rounded-md object-cover w-64 h-36 shadow-md"
                src={
                  theme.config.thumbnail
                    ? baseUrl + theme.config.thumbnail
                    : ASSETS.ICONS.IncredibleLogo
                }
                alt="incredible"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
  const [themesModal, setThemesModal] = useState(false)

  const [
    { flick, activeFragmentId, view, themes, activeTheme },
    setFlickStore,
  ] = useRecoilState(newFlickStore)
  const history = useHistory()

  const [fragment, setFragment] = useState<FlickFragmentFragment | undefined>(
    flick?.fragments.find((f) => f.id === activeFragmentId)
  )

  const [updateFragmentMarkdown] = useUpdateFragmentMarkdownMutation()
  const [updateFlickMarkdown] = useUpdateFlickMarkdownMutation()

  const [updateFragmentState, { error }] = useUpdateFragmentStateMutation()

  const [savingConfig, setSavingConfig] = useState(false)

  const debounced = useDebouncedCallback(
    // function
    () => {
      updateConfig()
    },
    400
  )

  useDidUpdateEffect(() => {
    debounced()
  }, [editorValue, config, introConfig, markdown])

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

  const updateActiveTheme = (theme: ThemeFragment) => {
    setFlickStore((prev) => {
      return { ...prev, activeTheme: theme }
    })
  }

  const updateConfig = async () => {
    setSavingConfig(true)
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
      <div className="flex items-center">
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
        <div className="flex justify-end items-stretch border-l-2 py-2 pl-4 border-brand-grey">
          <Tooltip
            isOpen={themesModal}
            setIsOpen={setThemesModal}
            content={
              <ThemeTooltip
                themes={themes}
                flickId={flick?.id}
                activeTheme={activeTheme}
                handleClose={() => setThemesModal(false)}
                updateActiveTheme={updateActiveTheme}
              />
            }
            placement="bottom-center"
            triggerOffset={16}
          >
            <Button
              appearance="none"
              size="small"
              type="button"
              className="mr-4"
              icon={IoAlbumsOutline}
              onClick={() => setThemesModal(true)}
            >
              Theme
            </Button>
          </Tooltip>
        </div>
        <div className="flex justify-end items-stretch border-l-2 py-2 pl-4 border-brand-grey">
          <Button
            appearance="gray"
            size="small"
            type="button"
            className="mr-4"
            icon={IoDesktopOutline}
            onClick={() => setViewConfig({ ...config, mode: 'Landscape' })}
          />
          <Button
            appearance="none"
            size="small"
            type="button"
            className="mr-4"
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
