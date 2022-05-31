/* eslint-disable no-param-reassign */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import { Listbox, Popover } from '@headlessui/react'
import * as Sentry from '@sentry/react'
import produce from 'immer'
import Konva from 'konva'
import React, { createRef, useEffect, useMemo, useState } from 'react'
import { BiCheck } from 'react-icons/bi'
import { FiLoader } from 'react-icons/fi'
import {
  IoCheckmark,
  IoChevronDownOutline,
  IoChevronForwardOutline,
  IoChevronUpOutline,
} from 'react-icons/io5'
import { Layer, Stage } from 'react-konva'
import { usePopper } from 'react-popper'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilValue,
  useSetRecoilState,
} from 'recoil'
import { ReactComponent as BrandIcon } from '../../assets/BrandIcon.svg'
import { emitToast, Heading, Text } from '../../components'
import config from '../../config'
import { ASSETS } from '../../constants'
import {
  StudioFragmentFragment,
  ThemeFragment,
  useGetThemesQuery,
  useGetUserPreferencesQuery,
  useUpdateFlickPreferencesMutation,
} from '../../generated/graphql'
import { useCanvasRecorder } from '../../hooks'
import { User, userState } from '../../stores/user.store'
import { Layout, ViewConfig } from '../../utils/configTypes'
import { verticalCustomScrollBar } from '../../utils/globalStyles'
import { BrandingInterface } from '../Branding/BrandingPage'
import { LayoutSelector } from '../Flick/components/BlockPreview'
import { VideoBlockProps } from '../Flick/editor/utils/utils'
import { useLocalPayload } from '../Flick/Flick'
import { CONFIG } from '../Studio/components/Concourse'
import UnifiedFragment from '../Studio/effects/fragments/UnifiedFragment'
import { studioStore } from '../Studio/stores'

interface IPreferences {
  theme?: ThemeFragment
  brandingId?: string
  branding?: BrandingInterface
  screenRecordingLayout?: Layout
}

const Preferences = ({
  blocks,
  fragment,
  viewConfig,
  handleClose,
  setFragment,
}: {
  blocks: VideoBlockProps[]
  viewConfig: ViewConfig
  fragment: StudioFragmentFragment
  setFragment: (fragment: StudioFragmentFragment) => void
  handleClose: () => void
}) => {
  const [preferences, setPreferences] = useState<IPreferences>()

  const [tab, setTab] = useState<'theme' | 'layout'>('layout')

  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(
    null
  )
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null)
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom',
  })

  const { sub } = useRecoilValue(userState) || {}
  const { data, loading, error } = useGetUserPreferencesQuery({
    variables: {
      sub,
    },
  })

  const [updatePreferences, { loading: saving }] =
    useUpdateFlickPreferencesMutation()

  useEffect(() => {
    setPreferences({
      brandingId: fragment.flick.brandingId,
      screenRecordingLayout: viewConfig.blocks[blocks[0].id].layout,
      theme: fragment.flick.theme,
    })
  }, [viewConfig, fragment.flick])

  const savePreferences = async () => {
    try {
      if (!preferences) return
      const frag = produce(fragment, (draftFragment) => {
        draftFragment.configuration = produce(viewConfig, (draftViewConfig) => {
          Object.keys(draftViewConfig.blocks).forEach((id) => {
            if (blocks.map((b) => b.id).includes(id)) {
              draftViewConfig.blocks[id].layout =
                preferences.screenRecordingLayout
            }
          })
        })
        draftFragment.flick.brandingId = preferences.brandingId
        draftFragment.flick.branding = preferences.branding
        draftFragment.flick.theme =
          preferences.theme || draftFragment.flick.theme
      })
      await updatePreferences({
        variables: {
          id: fragment.flick.id,
          fragmentId: fragment.id,
          configuration: frag.configuration,
          themeName: frag.flick.theme.name,
          brandingId: frag.flick.brandingId,
          useBranding: !!frag.flick.brandingId,
        },
      })
      setFragment(frag)
      handleClose()
    } catch (e) {
      Sentry.captureException(`Failed to save preferences ${e}`)
      emitToast({
        type: 'error',
        title: 'Could not save preferences',
      })
    }
  }

  if (loading && !data) return <div>Loading...</div>

  if (error) return <div>Error</div>

  return (
    <div className="flex flex-col">
      <div className="flex w-full items-center text-xs gap-x-4 pt-2 px-3 pl-4 border-b border-dark-100 pb-2">
        <button
          className={cx({
            'text-dark-title': tab !== 'layout',
          })}
          type="button"
          onClick={() => {
            setTab('layout')
          }}
        >
          Layout
        </button>
        <button
          className={cx({
            'text-dark-title': tab !== 'theme',
          })}
          type="button"
          onClick={() => {
            setTab('theme')
          }}
        >
          Theme & brand
        </button>
        <button
          type="button"
          className="flex items-center gap-x-2 ml-auto bg-incredible-green-500 rounded-sm text-xs p-2 px-4 -mr-2"
          onClick={() => savePreferences()}
        >
          {saving && <FiLoader className="animate-spin" />}
          {saving ? 'Saving' : 'Save changes'}
        </button>
        <button
          type="button"
          className="flex items-center gap-x-2 bg-dark-100 rounded-sm text-xs p-2 px-4"
          onClick={() => handleClose()}
        >
          Discard
        </button>
      </div>
      <div
        style={{
          width: '460px',
        }}
        className="flex flex-col items-start mb-12 px-8 pb-8"
      >
        {tab === 'theme' && (
          <>
            <Popover className="relative mt-8">
              <Popover.Button className="flex flex-col">
                <Heading
                  fontSize="small"
                  ref={(ref) => setReferenceElement(ref)}
                >
                  Theme
                </Heading>
                <div className="flex items-center justify-center relative group">
                  <img
                    src={
                      preferences?.theme?.config?.thumbnail
                        ? `${config.storage.baseUrl}${preferences?.theme?.config?.thumbnail}`
                        : `${config.storage.baseUrl}themes/DarkGradient/thumbnail.png`
                    }
                    alt={preferences?.theme?.name || 'DarkGradient'}
                    className="w-full mt-2 rounded-md"
                  />
                  <button
                    type="button"
                    className="absolute bottom-0 hidden group-hover:flex bg-black w-full h-full items-center justify-center bg-opacity-40 rounded-md"
                  >
                    <div className="bg-dark-100 rounded-sm text-sm px-4 py-2.5 shadow-sm">
                      Change theme
                    </div>
                  </button>
                </div>
              </Popover.Button>
              <ThemesPopover
                attributes={attributes}
                setPopperElement={setPopperElement}
                styles={styles}
                preferences={preferences}
                setPreferences={setPreferences}
              />
            </Popover>

            <Heading className="mt-6 mb-2" fontSize="small">
              Brand
            </Heading>
            <Listbox
              value={preferences?.brandingId}
              onChange={(value) =>
                setPreferences({
                  ...preferences,
                  brandingId: value,
                  branding: data?.Branding.find((b) => b.id === value),
                })
              }
            >
              {({ open }) => (
                <div className="relative mt-1 w-full">
                  <Listbox.Button className="w-full flex gap-x-4 text-left items-center justify-between rounded-sm bg-dark-400 shadow-sm py-2 px-3 pr-8 relative">
                    <div className="flex items-center w-full gap-x-2">
                      <BrandIcon className="flex-shrink-0" />
                      <span className="block text-sm truncate">
                        {data?.Branding?.find(
                          (b) => b.id === preferences?.brandingId
                        )?.name || 'None'}
                      </span>
                    </div>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none ">
                      {open ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
                    </span>
                  </Listbox.Button>
                  <Listbox.Options
                    style={{
                      maxHeight: '200px',
                    }}
                    className="mt-2 rounded-md bg-dark-400 p-1 absolute w-full overflow-y-auto"
                  >
                    {data?.Branding.map((brand) => (
                      <Listbox.Option
                        className={({ active }) =>
                          cx(
                            'flex items-center gap-x-2 py-2 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer rounded-md',
                            {
                              'bg-dark-100': active,
                            }
                          )
                        }
                        key={brand.id}
                        value={brand.id}
                      >
                        {({ selected }) => (
                          <>
                            <BrandIcon className="flex-shrink-0" />
                            <Text className="block text-sm truncate ">
                              {brand.name}
                            </Text>
                            {selected && (
                              <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                <BiCheck size={20} />
                              </span>
                            )}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                    <Listbox.Option
                      className={({ active }) =>
                        cx(
                          'flex items-center gap-x-4 py-2 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer rounded-md',
                          {
                            'bg-dark-100': active,
                          }
                        )
                      }
                      value={undefined}
                    >
                      {({ selected }) => (
                        <>
                          <Text className="block text-sm truncate ">None</Text>
                          {selected && (
                            <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                              <BiCheck size={20} />
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  </Listbox.Options>
                </div>
              )}
            </Listbox>
          </>
        )}
      </div>
      {tab === 'layout' && (
        <Canvas
          block={blocks[0]}
          viewConfig={viewConfig}
          preferences={preferences}
          setPreferences={setPreferences}
        />
      )}
    </div>
  )
}

const Canvas = ({
  block,
  viewConfig,
  preferences,
  setPreferences,
}: {
  block: VideoBlockProps
  viewConfig: ViewConfig
  preferences: IPreferences | undefined
  setPreferences: React.Dispatch<React.SetStateAction<IPreferences | undefined>>
}) => {
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()
  const stageRef = createRef<Konva.Stage>()

  Konva.pixelRatio = 2

  const { updatePayload } = useLocalPayload()
  const { addMusic, stopMusic } = useCanvasRecorder({})
  const setStudio = useSetRecoilState(studioStore)

  useEffect(() => {
    setStudio((store) => ({
      ...store,
      payload: {
        activeObjectIndex: 0,
      },
      updatePayload,
      addMusic,
      stopMusic,
      theme: preferences?.theme || {
        name: 'DarkGradient',
        config: {},
      },
      config: viewConfig,
    }))
  }, [])

  const child = useMemo(() => {
    return (
      <div className="flex items-center justify-center gap-x-12 relative group -mt-16">
        <Stage
          ref={stageRef}
          height={258.75}
          width={460}
          className={cx(
            'mt-4',
            css`
              margin-top: -0.125rem;
            `
          )}
          scale={{
            x: 258.75 / CONFIG.height,
            y: 450 / CONFIG.width,
          }}
        >
          <Bridge>
            <Layer>
              <UnifiedFragment
                stageRef={stageRef}
                layoutConfig={{
                  ...viewConfig,
                  blocks: {
                    [block.id]: {
                      ...viewConfig.blocks[block.id],
                      layout: preferences?.screenRecordingLayout,
                    },
                  },
                }}
                config={[block]}
                branding={preferences?.branding?.branding || undefined}
                theme={preferences?.theme}
              />
            </Layer>
          </Bridge>
        </Stage>
        <div>
          <LayoutSelector
            updateLayout={(layout) => {
              setPreferences({
                ...preferences,
                screenRecordingLayout: layout,
              })
            }}
            theme={preferences?.theme}
            layout={preferences?.screenRecordingLayout || 'classic'}
            mode="Landscape"
            type="videoBlock"
            darkMode
          />
        </div>
      </div>
    )
  }, [block, preferences])

  return child
}

const ThemesPopover = ({
  setPopperElement,
  attributes,
  styles,
  preferences,
  setPreferences,
}: {
  preferences: IPreferences | undefined
  setPreferences: React.Dispatch<React.SetStateAction<IPreferences | undefined>>
  setPopperElement: React.Dispatch<React.SetStateAction<HTMLElement | null>>
  styles: {
    [key: string]: React.CSSProperties
  }
  attributes: {
    [key: string]:
      | {
          [key: string]: string
        }
      | undefined
  }
}) => {
  const { email } = (useRecoilValue(userState) as User) || {}
  const { baseUrl } = config.storage

  const { data } = useGetThemesQuery()

  const [tempActiveTheme, setTempActiveTheme] = useState<ThemeFragment | null>()
  const [activeScreen, setActiveScreen] = useState<'theme' | 'themes'>('themes')

  useEffect(() => {
    if (tempActiveTheme) {
      setActiveScreen('theme')
    } else {
      setActiveScreen('themes')
    }
  }, [tempActiveTheme])

  return (
    <Popover.Panel
      ref={(ref: any) => setPopperElement(ref)}
      style={styles.popper}
      {...attributes.popper}
      className="absolute z-10"
    >
      {({ close }) => (
        <div
          style={{
            height: '500px',
            width: '590px',
          }}
          className="flex flex-col rounded-md py-4 mt-6 overflow-hidden bg-dark-400"
        >
          <div className="flex items-center justify-between px-6">
            <div className="flex items-center gap-x-2 text-sm">
              <span
                className={cx('text-white cursor-pointer py-1', {
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
                  <IoChevronForwardOutline className="text-gray-300" />
                  <span className="text-white cursor-pointer">
                    {tempActiveTheme.name}
                  </span>
                  <button
                    type="button"
                    className="text-sm bg-dark-100 rounded-sm py-1 p-2 ml-2"
                    onClick={() => {
                      setPreferences({
                        ...preferences,
                        theme: tempActiveTheme,
                      })
                      close()
                    }}
                  >
                    Select theme
                  </button>
                </>
              )}
            </div>
          </div>
          {activeScreen === 'theme' ? (
            <div
              className={cx(
                'grid grid-cols-2 gap-4 px-6 mt-4 overflow-y-auto',
                verticalCustomScrollBar
              )}
            >
              {tempActiveTheme?.config?.previewImages?.map((image: string) => (
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  key={image}
                >
                  <img
                    className="object-cover w-64 border-2 border-gray-600 rounded-md shadow-md hover:border-brand h-36"
                    src={image ? baseUrl + image : ASSETS.ICONS.IncredibleLogo}
                    alt="incredible"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div
              className={cx(
                'grid grid-cols-2 gap-4 gap-y-6 overflow-y-auto h-full mt-4 px-6',
                verticalCustomScrollBar
              )}
            >
              {data?.Theme?.filter((theme) => {
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
              }).map((theme) => (
                <div
                  key={theme.name}
                  className="relative flex items-center justify-center"
                  onClick={(e) => {
                    setTempActiveTheme(theme)
                  }}
                >
                  <div
                    className="object-cover w-64 border-2 border-gray-600 rounded-md shadow-md hover:border-brand h-36 flex-shrink-0 relative"
                    style={{
                      background: `url(${
                        theme.config.thumbnail
                          ? baseUrl + theme.config.thumbnail
                          : ASSETS.ICONS.IncredibleLogo
                      })`,
                      backgroundSize: '256px 144px',
                    }}
                  >
                    {preferences?.theme?.name === theme.name && (
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
      )}
    </Popover.Panel>
  )
}

export default Preferences
