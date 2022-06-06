/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import React, { HTMLAttributes, useEffect, useRef, useState } from 'react'
import { BiCheck } from 'react-icons/bi'
import { BsCloudCheck, BsCloudUpload } from 'react-icons/bs'
import { HiOutlineUpload } from 'react-icons/hi'
import {
  IoAlbumsOutline,
  IoCheckmark,
  IoImageOutline,
  IoPlayOutline,
  IoWarningOutline,
} from 'react-icons/io5'
import { useHistory } from 'react-router-dom'
import { useRecoilState, useRecoilValue } from 'recoil'
import { useDebouncedCallback } from 'use-debounce'
import { FragmentVideoModal, ThumbnailModal } from '.'
import { Branding } from '../..'
import { ReactComponent as BrandIcon } from '../../../assets/BrandIcon.svg'
import { ReactComponent as Transition } from '../../../assets/Transition.svg'
import { Button, emitToast, Heading, Text, Tooltip } from '../../../components'
import config from '../../../config'
import { ASSETS } from '../../../constants'
import {
  Content_Type_Enum_Enum,
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  ThemeFragment,
  TransitionFragment,
  useGetBrandingQuery,
  useGetTransitionsQuery,
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
import { horizontalCustomScrollBar } from '../../../utils/globalStyles'
import { TextEditorParser } from '../editor/utils/helpers'
import { Block, SimpleAST } from '../editor/utils/utils'
import { newFlickStore, View } from '../store/flickNew.store'
import RecordingModal from './RecordingModal'
import ViewRecordingsModal from './ViewRecordingsModal'

const HorizontalContainer = ({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cx(
      'flex items-center overflow-x-scroll overflow-y-hidden w-full',
      horizontalCustomScrollBar,
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
        'text-white rounded-md p-4 mx-4 max-h-screen',
        css`
          width: 70vw;
          background-color: #27272a;
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
        <div
          className={cx(
            'flex gap-x-4 z-50 overflow-x-scroll',
            horizontalCustomScrollBar
          )}
        >
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

export interface TransitionConfig {
  swapTransition?: TransitionFragment
  blockTransition?: TransitionFragment
}

const TransitionTooltip = ({
  transitions,
  handleClose,
  transitionConfig,
  updateTransitions,
}: {
  transitions: TransitionFragment[]
  transitionConfig: TransitionConfig | undefined
  updateTransitions: (config: TransitionConfig) => void
  handleClose: () => void
}) => {
  const [tab, setTab] = useState<'block' | 'swap'>('block')

  return (
    <div
      className={cx(
        'text-white rounded-md p-4 max-h-screen mx-4',
        css`
          background-color: #27272a;
          width: 70vw;
        `
      )}
    >
      <div className="flex items-center text-xs gap-x-4">
        <button
          className={cx({
            'text-dark-title': tab !== 'block',
          })}
          type="button"
          onClick={() => {
            setTab('block')
          }}
        >
          Block transitions
        </button>
        <button
          className={cx({
            'text-dark-title': tab !== 'swap',
          })}
          type="button"
          onClick={() => {
            setTab('swap')
          }}
        >
          Swap transitions
        </button>
      </div>
      <div
        className={cx(
          'flex gap-x-4 z-50 overflow-x-scroll mt-4',
          horizontalCustomScrollBar
        )}
      >
        {transitions.map((transition) => (
          <TransitionCard
            tab={tab}
            active={
              tab === 'block'
                ? transitionConfig?.blockTransition?.name === transition.name
                : transitionConfig?.swapTransition?.name === transition.name
            }
            transition={transition}
            transitionConfig={transitionConfig}
            updateTransitions={updateTransitions}
          />
        ))}
      </div>
    </div>
  )
}

const TransitionCard = ({
  transition,
  active,
  tab,
  transitionConfig,
  updateTransitions,
}: {
  transition: TransitionFragment
  active: boolean
  tab: 'block' | 'swap'
  transitionConfig: TransitionConfig | undefined
  updateTransitions: (config: TransitionConfig) => void
}) => {
  const imageSrc = transition.config.thumbnail
    ? config.storage.baseUrl + transition.config.thumbnail
    : ASSETS.ICONS.IncredibleLogo

  const gifSrc = transition.config.gif
    ? config.storage.baseUrl + transition.config.gif
    : ASSETS.ICONS.IncredibleLogo

  const [src, setSrc] = useState<string>(imageSrc)

  return (
    <div
      key={transition.name}
      className="relative flex items-center justify-center py-4 group"
      onMouseEnter={() => {
        setSrc(gifSrc)
      }}
      onMouseLeave={() => {
        setSrc(imageSrc)
      }}
      onClick={() => {
        if (tab === 'block') {
          updateTransitions({
            ...transitionConfig,
            blockTransition: transition,
          })
        } else {
          updateTransitions({
            ...transitionConfig,
            swapTransition: transition,
          })
        }
      }}
    >
      <div
        className="object-cover w-64 border-2 border-gray-600 rounded-md shadow-md hover:border-brand h-36 relative"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: '256px 144px',
        }}
      >
        {active && (
          <IoCheckmark
            size={24}
            className="absolute p-1 font-bold rounded-md top-2 right-2 text-brand bg-brand-10"
          />
        )}
      </div>
    </div>
  )
}

const FragmentBar = ({
  editorValue,
  simpleAST,
  currentBlock,
  viewConfig,
  setCurrentBlock,
  togglePublishModal,
}: {
  viewConfig: ViewConfig
  editorValue?: string
  simpleAST?: SimpleAST
  currentBlock: Block | undefined
  setCurrentBlock: React.Dispatch<React.SetStateAction<Block | undefined>>
  togglePublishModal: () => void
}) => {
  const [fragmentVideoModal, setFragmentVideoModal] = useState(false)
  const [themesModal, setThemesModal] = useState(false)
  const [brandingModal, setBrandingModal] = useState(false)
  const [thumbnailModal, setThumbnailModal] = useState(false)
  const [recordingModal, setRecordingModal] = useState(false)
  const [viewRecordingModal, setViewRecordingModal] = useState(false)

  const [
    { flick, activeFragmentId, view, themes, activeTheme },
    setFlickStore,
  ] = useRecoilState(newFlickStore)

  const history = useHistory()

  const [fragment, setFragment] = useState<FlickFragmentFragment | undefined>(
    flick?.fragments.find((f) => f.id === activeFragmentId)
  )

  const { data: transitionsData } = useGetTransitionsQuery()
  const [transitionsModal, setTransitionsModal] = useState(false)

  const [transitionConfig, setTransitionConfig] = useState(
    flick?.configuration?.transitions
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

  // useEffect(() => {
  //   console.log('useEffect', editorValue)
  // }, [editorValue])

  const initialLoad = useRef<boolean>(true)

  useDidUpdateEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false
      return
    }
    debounced()
  }, [
    editorValue,
    config,
    useBranding,
    brandingId,
    simpleAST,
    transitionConfig,
  ])

  useEffect(() => {
    initialLoad.current = true
  }, [activeFragmentId])

  useEffect(() => {
    const f = flick?.fragments.find((f) => f.id === activeFragmentId)
    setFragment(f)
  }, [activeFragmentId, flick])

  const updateActiveTheme = (theme: ThemeFragment) => {
    setFlickStore((prev) => {
      return { ...prev, activeTheme: theme }
    })
  }

  const updateConfig = async () => {
    setSavingConfig(true)

    try {
      const encodedEditorValue = Buffer.from(
        JSON.stringify(editorValue)
      ).toString('base64')
      if (
        fragment &&
        fragment?.type !== Fragment_Type_Enum_Enum.Intro &&
        fragment?.type !== Fragment_Type_Enum_Enum.Outro
      ) {
        if (!editorValue || editorValue?.length === 0) return
        await saveFlick({
          variables: {
            id: flick?.id,
            encodedEditorValue,
            editorState: simpleAST,
            fragmentId: activeFragmentId,
            branding: useBranding,
            brandingId: useBranding ? brandingId : undefined,
            flickConfiguration: {
              ...flick?.configuration,
              transitions: transitionConfig,
            },
          },
        })
        if (flick) {
          setFlickStore((store) => ({
            ...store,
            flick: store.flick
              ? {
                  ...store.flick,
                  useBranding,
                  configuration: {
                    ...store.flick.configuration,
                    transitions: transitionConfig,
                  },
                  brandingId: useBranding ? brandingId : undefined,
                  branding: useBranding
                    ? brandingData?.Branding.find((b) => b.id === brandingId)
                    : null,
                  fragments: flick.fragments.map((f) =>
                    f.id === activeFragmentId
                      ? {
                          ...f,
                          flick: {
                            ...f.flick,
                            name: flick.name,
                          },
                          editorState: simpleAST,
                          encodedEditorValue,
                        }
                      : f
                  ),
                }
              : null,
          }))
        }
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
    if (viewConfig.mode === 'Portrait') {
      setMode(Content_Type_Enum_Enum.VerticalVideo)
    } else {
      setMode(Content_Type_Enum_Enum.Video)
    }
  }, [viewConfig.mode])

  return (
    <div className="sticky z-40 flex items-center justify-between w-full px-4 bg-dark-300">
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
        {fragment?.type !== Fragment_Type_Enum_Enum.Blog && (
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
        )}
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
            placement="bottom-start"
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
        <div className="flex items-center justify-center h-full text-white">
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
          <Tooltip
            isOpen={transitionsModal}
            setIsOpen={setTransitionsModal}
            content={
              transitionsData ? (
                <TransitionTooltip
                  transitions={transitionsData.Transition}
                  transitionConfig={transitionConfig}
                  handleClose={() => setTransitionsModal(false)}
                  updateTransitions={setTransitionConfig}
                />
              ) : null
            }
            placement="bottom-start"
            triggerOffset={16}
          >
            <Button
              appearance="none"
              type="button"
              className="flex items-center"
              onClick={() => {
                setTransitionsModal(!isOpen)
              }}
            >
              <Transition className="mr-2" />
              <Text className="text-sm text-gray-100 font-main">
                Transition
              </Text>
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
                className="mx-1"
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
        <div className="flex items-stretch justify-end py-2  border-l-2 border-brand-grey text-white">
          {fragment?.blocks && fragment?.blocks?.length > 0 && (
            <Button
              appearance="none"
              size="small"
              type="button"
              className="mx-1"
              icon={IoPlayOutline}
              iconSize={20}
              onClick={() => {
                setViewRecordingModal(true)
              }}
            >
              <Text className="text-sm text-gray-100 font-main">Recording</Text>
            </Button>
          )}
          <Button
            appearance="none"
            size="small"
            type="button"
            className="mx-1"
            icon={IoImageOutline}
            iconSize={20}
            onClick={() => {
              setThumbnailModal(true)
            }}
          >
            <Text className="text-sm text-gray-100 font-main">Thumbnail</Text>
          </Button>
        </div>
        <div className="flex items-center gap-x-3 justify-end py-2 pl-4 border-l-2 border-brand-grey text-gray-400">
          {fragment?.type !== Fragment_Type_Enum_Enum.Presentation && (
            <Button
              appearance="gray"
              type="button"
              onClick={togglePublishModal}
              size="small"
              icon={HiOutlineUpload}
              iconSize={20}
            >
              Publish
            </Button>
          )}
          <Button
            appearance="primary"
            size="small"
            type="button"
            disabled={checkDisabledState(fragment, simpleAST, viewConfig)}
            onClick={async () => {
              // Segment Tracking
              logEvent(PageEvent.GoToDeviceSelect)
              // setRecordingModal(true)
              await updateConfig()
              if (fragment?.type !== Fragment_Type_Enum_Enum.Presentation)
                history.push(`/${activeFragmentId}/studio`)
              else history.push(`/present/${activeFragmentId}`)
            }}
          >
            {fragment?.type !== Fragment_Type_Enum_Enum.Presentation
              ? 'Record'
              : 'Present'}
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
      {thumbnailModal && (
        <ThumbnailModal
          open={thumbnailModal}
          handleClose={() => {
            setThumbnailModal(false)
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
          config={viewConfig}
          handleClose={() => {
            setRecordingModal(false)
          }}
        />
      )}
      {viewRecordingModal && (
        <ViewRecordingsModal
          open={viewRecordingModal}
          handleClose={() => {
            setViewRecordingModal(false)
          }}
          simpleAST={simpleAST}
        />
      )}
    </div>
  )
}

const checkDisabledState = (
  fragment: FlickFragmentFragment | undefined,
  editorValue: SimpleAST | undefined,
  viewConfig: ViewConfig | undefined
) => {
  if (!fragment) return true

  if (
    viewConfig?.continuousRecording &&
    viewConfig?.selectedBlocks.length < 1
  ) {
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

export default FragmentBar
