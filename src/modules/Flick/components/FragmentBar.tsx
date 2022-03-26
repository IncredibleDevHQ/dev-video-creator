/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import React, { HTMLAttributes, useEffect, useState } from 'react'
import { BiCheck } from 'react-icons/bi'
import { BsCloudCheck, BsCloudUpload } from 'react-icons/bs'
import {
  IoAlbumsOutline,
  IoCheckmark,
  IoDesktopOutline,
  IoPhonePortraitOutline,
  IoPlayOutline,
  IoWarningOutline,
} from 'react-icons/io5'
import { useHistory } from 'react-router-dom'
import { useRecoilState, useRecoilValue } from 'recoil'
import { useDebouncedCallback } from 'use-debounce'
import { FragmentVideoModal } from '.'
import { Branding } from '../..'
import { ReactComponent as BrandIcon } from '../../../assets/BrandIcon.svg'
import { Button, emitToast, Heading, Text, Tooltip } from '../../../components'
import config from '../../../config'
import { ASSETS } from '../../../constants'
import {
  Content_Type_Enum_Enum,
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  ThemeFragment,
  useGetBrandingQuery,
  useSaveFlickMutation,
  useUpdateFlickThemeMutation,
} from '../../../generated/graphql'
import useDidUpdateEffect from '../../../hooks/use-did-update-effect'
import { User, userState } from '../../../stores/user.store'
import { logEvent, logPage } from '../../../utils/analytics'
import {
  PageCategory,
  PageEvent,
  PageTitle,
} from '../../../utils/analytics-types'
import { ViewConfig } from '../../../utils/configTypes'
import { TextEditorParser } from '../editor/utils/helpers'
import { Block, SimpleAST } from '../editor/utils/utils'
import { newFlickStore, View } from '../store/flickNew.store'
import RecordingModal from './RecordingModal'

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
  const { email } = (useRecoilValue(userState) as User) || {}

  const { baseUrl } = config.storage
  const [activeScreen, setActiveScreen] = useState<'theme' | 'themes'>('themes')
  const [tempActiveTheme, setTempActiveTheme] = useState<ThemeFragment | null>(
    activeTheme
  )

  const [updateTheme, { loading }] = useUpdateFlickThemeMutation()

  useEffect(() => {
    if (tempActiveTheme) {
      setActiveScreen('theme')
    } else {
      setActiveScreen('themes')
    }
  }, [tempActiveTheme])

  useEffect(() => {
    if (activeScreen === 'themes') {
      // Segment Tracking
      logPage(PageCategory.Studio, PageTitle.Theme)
    }
  }, [activeScreen])

  const updateFlickTheme = async () => {
    if (!tempActiveTheme) return

    const { data } = await updateTheme({
      variables: {
        id: flickId,
        themeName: tempActiveTheme.name,
      },
    })
    if (data) {
      updateActiveTheme(tempActiveTheme)
      emitToast({
        type: 'success',
        title: 'Theme updated',
        description: `Current theme updated to ${tempActiveTheme.name} successfully`,
      })
      // Segment Tracking
      logEvent(PageEvent.ApplyTheme)
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
      <div className="flex items-center justify-between">
        <h4>
          <span
            className={cx('text-white cursor-pointer', {
              'opacity-70 hover:opacity-100': activeScreen !== 'themes',
              'opacity-100': activeScreen === 'themes',
            })}
            onClick={() => {
              setActiveScreen('themes')
              setTempActiveTheme(null)
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
          {tempActiveTheme?.config?.previewImages?.map((image: string) => (
            <div
              className="flex items-center justify-center flex-shrink-0 px-2 py-4"
              key={image}
            >
              <img
                className="object-cover w-64 border-2 border-gray-600 rounded-md shadow-md hover:border-brand h-36"
                src={image ? baseUrl + image : ASSETS.ICONS.IncredibleLogo}
                alt="incredible"
              />
            </div>
          ))}
        </HorizontalContainer>
      ) : (
        <div className="flex gap-x-4 z-50">
          {themes
            .filter((theme) => {
              if (theme.name === 'Cassidoo') {
                if (
                  email &&
                  (email?.includes('incredible.dev') ||
                    config?.whitelist?.cassidyTheme?.includes(email))
                ) {
                  return true
                }
                return false
              }
              return true
            })
            .map((theme) => (
              <div
                key={theme.name}
                className="relative flex items-center justify-center py-4"
                onClick={() => setTempActiveTheme(theme)}
              >
                <div
                  className="object-cover w-64 border-2 border-gray-600 rounded-md shadow-md hover:border-brand h-36 relative"
                  style={{
                    background: `url(${
                      theme.config.thumbnail
                        ? baseUrl + theme.config.thumbnail
                        : ASSETS.ICONS.IncredibleLogo
                    })`,
                    backgroundSize: '256px 144px',
                  }}
                >
                  {activeTheme?.name === theme.name && (
                    <IoCheckmark
                      size={24}
                      className="absolute p-1 font-bold rounded-md top-2 right-2 text-brand bg-brand-10"
                    />
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

const FragmentBar = ({
  config,
  editorValue,
  setViewConfig,
  simpleAST,
  currentBlock,
  setCurrentBlock,
}: {
  editorValue?: string
  config: ViewConfig
  simpleAST?: SimpleAST
  setViewConfig: React.Dispatch<React.SetStateAction<ViewConfig>>
  currentBlock: Block | undefined
  setCurrentBlock: React.Dispatch<React.SetStateAction<Block | undefined>>
}) => {
  const [fragmentVideoModal, setFragmentVideoModal] = useState(false)
  const [themesModal, setThemesModal] = useState(false)
  const [brandingModal, setBrandingModal] = useState(false)
  const [recordingModal, setRecordingModal] = useState(false)

  const [
    { flick, activeFragmentId, view, themes, activeTheme },
    setFlickStore,
  ] = useRecoilState(newFlickStore)

  const history = useHistory()

  const [fragment, setFragment] = useState<FlickFragmentFragment | undefined>(
    flick?.fragments.find((f) => f.id === activeFragmentId)
  )

  const [saveFlick, { error }] = useSaveFlickMutation()

  const { data: brandingData } = useGetBrandingQuery()

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
  }, [editorValue, config, useBranding, brandingId, simpleAST])

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
        fragment?.type !== Fragment_Type_Enum_Enum.Intro &&
        fragment?.type !== Fragment_Type_Enum_Enum.Outro
      ) {
        if (!editorValue || editorValue?.length === 0) return
        await saveFlick({
          variables: {
            id: flick?.id,
            md: editorValue,
            editorState: simpleAST,
            fragmentId: activeFragmentId,
            configuration: config,
            branding: useBranding,
            brandingId,
          },
        })
        if (flick)
          setFlickStore((store) => ({
            ...store,
            flick: {
              ...flick,
              useBranding,
              brandingId,
              branding: useBranding
                ? brandingData?.Branding.find((b) => b.id === brandingId)
                : null,
              md: editorValue,
              fragments: flick.fragments.map((f) =>
                f.id === activeFragmentId
                  ? {
                      ...f,
                      configuration: config,
                      editorState: simpleAST,
                    }
                  : f
              ),
            },
          }))
      }
    } catch (error) {
      emitToast({
        type: 'error',
        title: 'Error saving flick',
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
    <div className="sticky z-50 flex items-center justify-between w-full px-4 bg-dark-300">
      <div className="flex items-center justify-start py-2 text-dark-title">
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
        {savingConfig && (
          <div className="flex items-center mr-4 text-gray-400">
            <BsCloudUpload className="mr-1" />
            <Text fontSize="small">Saving...</Text>
          </div>
        )}
        {!savingConfig && !error && (
          <div className="flex items-center mr-4 text-gray-400">
            <BsCloudCheck className="mr-1" />
            <Text fontSize="small">Saved</Text>
          </div>
        )}
        {error && (
          <div className="flex items-center mr-4 text-red-400">
            <IoWarningOutline className="mr-1" />
            <Text fontSize="small">Error saving</Text>
          </div>
        )}
        <div className="flex items-stretch justify-end py-2 border-l-2 border-brand-grey text-white">
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
              icon={IoAlbumsOutline}
              onClick={() => setThemesModal(true)}
            >
              <Text className="text-sm text-gray-100 font-main">Theme</Text>
            </Button>
          </Tooltip>
        </div>
        <div className="flex items-center justify-center h-full">
          <Tooltip
            className="p-0 m-0"
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            content={
              <ul
                style={{
                  minWidth: '200px',
                }}
                className="flex flex-col justify-center -mt-1 rounded-md bg-dark-300"
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
                        logEvent(PageEvent.SelectBrand)
                        setBrandingId(branding.id)
                        setUseBranding(true)
                        setIsOpen(false)
                      }}
                    >
                      <BrandIcon className="mr-2" />
                      <Text className="mr-4 text-sm font-body">
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
                  <Text className="mr-4 text-sm font-body">None</Text>
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
                    // Segment Tracking
                    logEvent(PageEvent.OpenBrandingModal)
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
              <Text className="text-sm text-gray-100 font-main">Brand</Text>
            </Button>
          </Tooltip>
        </div>
        {(fragment?.producedLink || fragment?.producedShortsLink) &&
          (mode === Content_Type_Enum_Enum.Video ||
            mode === Content_Type_Enum_Enum.VerticalVideo) && (
            <div className="flex items-stretch justify-end py-2 pl-4 border-l-2 border-brand-grey text-white">
              <Button
                appearance="none"
                size="small"
                type="button"
                className="mr-4"
                icon={IoPlayOutline}
                iconSize={20}
                onClick={() => {
                  setFragmentVideoModal(true)
                }}
              >
                Recordings
              </Button>
            </div>
          )}
        <div className="flex items-stretch justify-end py-2 pl-4 border-l-2 border-brand-grey">
          <Button
            appearance={config.mode === 'Landscape' ? 'gray' : 'none'}
            size="small"
            type="button"
            icon={IoDesktopOutline}
            className="mr-2 transition-colors"
            onClick={() => {
              // Segment Tracking
              logEvent(PageEvent.SelectLandscapeMode)
              setViewConfig({ ...config, mode: 'Landscape' })
            }}
          />
          <Button
            appearance={config.mode === 'Portrait' ? 'gray' : 'none'}
            size="small"
            type="button"
            className="mr-4 transition-colors"
            icon={IoPhonePortraitOutline}
            onClick={() => {
              // Segment Tracking
              logEvent(PageEvent.SelectPortraitMode)
              setViewConfig({ ...config, mode: 'Portrait' })
            }}
          />
          <Button
            appearance="primary"
            size="small"
            type="button"
            disabled={checkDisabledState(fragment, simpleAST)}
            onClick={async () => {
              // Segment Tracking
              logEvent(PageEvent.GoToDeviceSelect)
              // setRecordingModal(true)
              await updateConfig()
              history.push(`/${activeFragmentId}/studio`)
            }}
          >
            {checkHasContent(fragment, mode) ? 'Retake' : 'Record'}
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
          activeBrand={brandingId}
          handleClose={() => {
            setBrandingModal(false)
          }}
        />
      )}
      {recordingModal && (
        <RecordingModal
          open={recordingModal}
          activeFragmentId={activeFragmentId}
          simpleAST={simpleAST}
          currentBlock={currentBlock}
          setCurrentBlock={setCurrentBlock}
          handleClose={() => {
            setRecordingModal(false)
          }}
        />
      )}
    </div>
  )
}

const checkDisabledState = (
  fragment: FlickFragmentFragment | undefined,
  editorValue: SimpleAST | undefined
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
