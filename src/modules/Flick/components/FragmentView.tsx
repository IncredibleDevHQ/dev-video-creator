import { css, cx } from '@emotion/css'
import Konva from 'konva'
import React, { createRef, useEffect, useState } from 'react'
import { FiLayout, FiRefreshCcw } from 'react-icons/fi'
import { HiOutlineUser } from 'react-icons/hi'
import {
  IoEyeOffOutline,
  IoEyeOutline,
  IoReloadOutline,
  IoSearchOutline,
} from 'react-icons/io5'
import { Layer, Stage } from 'react-konva'
import { Html } from 'react-konva-utils'
import useMeasure, { RectReadOnly } from 'react-use-measure'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilState,
  useRecoilValue,
} from 'recoil'
import {
  dismissToast,
  emitToast,
  FileDropzone,
  Tab,
  TabBar,
  Text,
} from '../../../components'
import appConfig from '../../../config'
import {
  Asset_Source_Enum_Enum,
  Asset_Type_Enum_Enum,
  useAddAssetMutation,
  useGetImagesFromUnsplashLazyQuery,
  useGetUserImageAssetsQuery,
} from '../../../generated/graphql'
import { useUploadFile } from '../../../hooks'
import { AllowedFileExtensions } from '../../../hooks/use-upload-file'
import { Config, ConfigType, GradientConfig } from '../../../utils/configTypes'
import { CONFIG, SHORTS_CONFIG } from '../../Studio/components/Concourse'
import TitleSplash from '../../Studio/components/TitleSplash'
import UnifiedFragment from '../../Studio/effects/fragments/UnifiedFragment'
import { StudioProviderProps, studioStore } from '../../Studio/stores'
import { newFlickStore } from '../store/flickNew.store'
import LayoutGeneric from './LayoutGeneric'

const scrollStyle = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

const useGetHW = ({
  maxH,
  maxW,
  aspectRatio,
}: {
  maxH: number
  maxW: number
  aspectRatio: number
}) => {
  let calWidth = 0
  let calHeight = 0
  if (aspectRatio > maxW / maxH) {
    calHeight = maxW * (1 / aspectRatio)
    calWidth = maxW
  } else if (aspectRatio <= maxW / maxH) {
    calHeight = maxH
    calWidth = maxH * aspectRatio
  }
  return { width: calWidth, height: calHeight }
}

function FragmentView({
  config,
  selectedLayoutId,
  setConfig,
  setSelectedLayoutId,
}: {
  config: Config
  setConfig: React.Dispatch<React.SetStateAction<Config>>
  selectedLayoutId: string
  setSelectedLayoutId: React.Dispatch<React.SetStateAction<string>>
}) {
  const [ref, bounds] = useMeasure()

  return (
    <div className="p-4 flex flex-1 overflow-scroll" ref={ref}>
      <div className="w-min">
        <Preview config={config} bounds={bounds} />
        <Layouts
          config={config}
          setConfig={setConfig}
          selectedLayoutId={selectedLayoutId}
          setSelectedLayoutId={setSelectedLayoutId}
        />
      </div>
      <Configurations
        config={config}
        setConfig={setConfig}
        selectedLayoutId={selectedLayoutId}
      />
    </div>
  )
}

const Preview = ({
  config,
  bounds,
}: {
  config: Config
  bounds: RectReadOnly
}) => {
  const stageRef = createRef<Konva.Stage>()
  const layerRef = createRef<Konva.Layer>()
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

  const { payload, shortsMode } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const { flick, activeFragmentId } = useRecoilValue(newFlickStore)

  Konva.pixelRatio = 2

  const { height: divHeight, width: divWidth } = useGetHW({
    maxH: bounds.height / 1.25,
    maxW: bounds.width / 1.25,
    aspectRatio: 16 / 9,
  })

  const { height, width } = useGetHW({
    maxH: bounds.height / 1.25,
    maxW: bounds.width / 1.25,
    aspectRatio: shortsMode ? 9 / 16 : 16 / 9,
  })

  return (
    <div
      style={{
        height: divHeight,
        width: divWidth,
      }}
      className="flex justify-center border"
    >
      <Stage
        ref={stageRef}
        height={height}
        width={width}
        scale={{
          x: height / (shortsMode ? SHORTS_CONFIG.height : CONFIG.height),
          y: width / (shortsMode ? SHORTS_CONFIG.width : CONFIG.width),
        }}
      >
        <Bridge>
          <Layer ref={layerRef}>
            {payload?.fragmentState === 'titleSplash' &&
              !config.viewConfig.hasTitleSplash && (
                <Html>
                  <div
                    style={{
                      height: shortsMode ? SHORTS_CONFIG.height : CONFIG.height,
                      width: shortsMode ? SHORTS_CONFIG.width : CONFIG.width,
                    }}
                    className="w-full h-full flex items-center justify-center bg-gray-200"
                  >
                    <IoEyeOffOutline size={54} className="text-gray-400" />
                  </div>
                </Html>
              )}
            {payload?.fragmentState === 'titleSplash' &&
              config.viewConfig.hasTitleSplash && (
                <TitleSplash
                  isShorts={shortsMode}
                  stageConfig={{
                    height: shortsMode ? SHORTS_CONFIG.height : CONFIG.height,
                    width: shortsMode ? SHORTS_CONFIG.width : CONFIG.width,
                  }}
                  titleSplashData={{
                    enable: true,
                    title:
                      flick?.fragments?.find((f) => f.id === activeFragmentId)
                        ?.name || '',
                    titleSplashConfig: config.viewConfig.titleSplashConfig,
                  }}
                />
              )}
            {payload?.fragmentState !== 'titleSplash' && (
              <UnifiedFragment
                stageRef={stageRef}
                layerRef={layerRef}
                config={config}
              />
            )}
          </Layer>
        </Bridge>
      </Stage>
    </div>
  )
}

const Layouts = ({
  config,
  setConfig,
  selectedLayoutId,
  setSelectedLayoutId,
}: {
  config: Config
  setConfig: React.Dispatch<React.SetStateAction<Config>>
  selectedLayoutId: string
  setSelectedLayoutId: React.Dispatch<React.SetStateAction<string>>
}) => {
  const [showSplashSetting, setShowSplashSetting] = useState(false)

  const [{ payload, updatePayload, shortsMode }, setStudio] =
    useRecoilState(studioStore)

  return (
    <div className="flex mt-2">
      {/* Shorts toggle */}
      <div className="h-20 ">
        <div className="flex items-center justify-center h-full w-28 p-2 gap-x-2 bg-white">
          <Text
            className={cx(
              'cursor-pointer bg-gray-200 text-gray-50 px-2.5 py-1 rounded-sm text-sm ',
              {
                'bg-gray-800 text-gray-100': !shortsMode,
              }
            )}
            onClick={() =>
              setStudio((store) => ({ ...store, shortsMode: false }))
            }
          >
            16:9
          </Text>
          <Text
            className={cx(
              'cursor-pointer bg-gray-200 text-gray-50 h-full rounded-sm text-sm flex px-1 items-center',
              {
                'bg-gray-800 text-gray-100': shortsMode,
              }
            )}
            onClick={() => {
              setStudio((store) => ({ ...store, shortsMode: true }))
              // Default to the first object of any type other than videojam, if the selected object is videojam while changing to shorts mode
              if (
                config.dataConfig.find((c) => c.id === selectedLayoutId)
                  ?.type === ConfigType.VIDEOJAM
              ) {
                const firstObjectIndex = config.dataConfig.findIndex(
                  (conf) => conf.type !== ConfigType.VIDEOJAM
                )
                if (firstObjectIndex !== -1) {
                  updatePayload?.({
                    activeObjectIndex: firstObjectIndex,
                    fragmentState: 'customLayout',
                  })
                  setSelectedLayoutId(config.dataConfig[firstObjectIndex].id)
                }
              }
            }}
          >
            9:16
          </Text>
        </div>
      </div>
      {/* TitleSplash */}
      <div
        className="h-20 cursor-pointer"
        onMouseEnter={() => setShowSplashSetting(true)}
        onMouseLeave={() => setShowSplashSetting(false)}
        role="button"
        tabIndex={-1}
        onKeyUp={() => {}}
        onClick={() =>
          updatePayload?.({
            fragmentState: 'titleSplash',
          })
        }
      >
        <div className="w-28 h-full p-2.5 bg-gray-50 flex justify-end">
          {showSplashSetting && (
            <div
              role="button"
              tabIndex={-1}
              onKeyUp={() => {}}
              className="absolute bg-white p-1.5 rounded-md shadow-md -mr-1 -mt-1.5"
              onClick={(e) => {
                e.stopPropagation()
                setConfig({
                  ...config,
                  viewConfig: {
                    ...config.viewConfig,
                    hasTitleSplash: !config.viewConfig.hasTitleSplash,
                  },
                })
              }}
            >
              {config.viewConfig.hasTitleSplash ? (
                <IoEyeOutline size={16} className="text-gray-600" />
              ) : (
                <IoEyeOffOutline size={16} className="text-gray-300" />
              )}
            </div>
          )}
          <div
            className={cx(
              'h-full w-full bg-white flex items-center justify-center border border-gray-200 text-gray-200 rounded-md',
              {
                'text-gray-500': config.viewConfig.hasTitleSplash,
                'border border-brand': payload?.fragmentState === 'titleSplash',
              }
            )}
          >
            <Text className="text-sm">Title</Text>
          </div>
        </div>
      </div>
      {/* UserMedia */}
      <div
        className="h-20 bg-gray-100"
        role="button"
        tabIndex={-1}
        onKeyUp={() => {}}
        onClick={() =>
          updatePayload?.({
            fragmentState: 'onlyUserMedia',
          })
        }
      >
        <div className="h-full flex items-center justify-center w-28 p-2.5">
          <div
            className={cx(
              'h-full w-full p-2 border border-gray-200 rounded-md cursor-pointer bg-white',
              {
                'border border-brand':
                  payload?.fragmentState === 'onlyUserMedia',
              }
            )}
          >
            <div className="flex items-center justify-center bg-gray-500 w-full h-full rounded-md">
              <HiOutlineUser className="text-gray-300" size={24} />
            </div>
          </div>
        </div>
      </div>
      {/* Divider */}
      <div>
        <div
          className={cx(
            'h-full flex flex-col items-center justify-center px-3 bg-gray-100 relative',
            {
              'pr-0': config.dataConfig.length === 0,
            }
          )}
        >
          <div className="h-full w-px bg-gray-200" />
          <div className="absolute bg-white p-1.5 rounded-md shadow-md">
            <FiRefreshCcw size={16} className="text-gray-600" />
          </div>
        </div>
      </div>
      {/* Layouts */}
      <div className="grid grid-cols-1 w-full border-t border-b border-gray-100 h-20">
        <div className={cx('flex h-full overflow-x-scroll', scrollStyle)}>
          {config.viewConfig.configs
            .filter((c) => {
              if (shortsMode) {
                return c.type !== ConfigType.VIDEOJAM
              }
              return true
            })
            .map((c, index) => {
              return (
                <div
                  role="button"
                  tabIndex={-1}
                  onKeyUp={() => {}}
                  onClick={() => {
                    updatePayload?.({
                      activeObjectIndex: index,
                      fragmentState: 'customLayout',
                    })
                    setSelectedLayoutId(c.id)
                  }}
                >
                  <div className="h-full flex items-center justify-center w-28 p-2.5 bg-gray-100">
                    <LayoutGeneric
                      layoutId={c.layoutNumber}
                      type={c.type}
                      isSelected={
                        selectedLayoutId === c.id &&
                        payload?.fragmentState === 'customLayout'
                      }
                    />
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}

const Configurations = ({
  config,
  selectedLayoutId,
  setConfig,
}: {
  config: Config
  setConfig: React.Dispatch<React.SetStateAction<Config>>
  selectedLayoutId: string
}) => {
  enum Configuration {
    Layouts = 'layouts',
    Background = 'background',
  }

  const [currentConfiguration, setCurrentConfiguration] =
    useState<Configuration>(Configuration.Layouts)

  const { payload, shortsMode } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  useEffect(() => {
    if (
      payload?.fragmentState === 'titleSplash' ||
      payload?.fragmentState === 'onlyUserMedia'
    ) {
      setCurrentConfiguration(Configuration.Background)
    }
  }, [payload?.fragmentState])

  return (
    <div className="flex flex-col ml-4 h-full">
      {/* Configs */}
      <div className="flex gap-x-3">
        {payload?.fragmentState === 'customLayout' && !shortsMode && (
          <div
            role="button"
            tabIndex={-1}
            onKeyUp={() => {}}
            onClick={() => setCurrentConfiguration(Configuration.Layouts)}
            className={cx(
              'border border-gray-300 bg-gray-100 p-2 rounded-lg h-9 w-9 flex items-center justify-center',
              {
                'border-brand': currentConfiguration === Configuration.Layouts,
              }
            )}
          >
            <FiLayout className="text-gray-600" size={21} />
          </div>
        )}
        <div
          role="button"
          tabIndex={-1}
          onKeyUp={() => {}}
          onClick={() => setCurrentConfiguration(Configuration.Background)}
          className={cx(
            'border border-gray-300 bg-gray-100 p-2 rounded-lg h-9 w-9 flex items-center justify-center',
            {
              'border-brand': currentConfiguration === Configuration.Background,
            }
          )}
        >
          <div className="bg-blue-400 h-full w-full rounded-md" />
        </div>
      </div>
      {/* Selected Config */}
      {currentConfiguration === Configuration.Layouts && (
        <LayoutsConfguration
          config={config}
          setConfig={setConfig}
          selectedLayoutId={selectedLayoutId}
        />
      )}
      {currentConfiguration === Configuration.Background && (
        <BackgroundConfiguration
          config={config}
          setConfig={setConfig}
          selectedLayoutId={selectedLayoutId}
        />
      )}
    </div>
  )
}

const LayoutsConfguration = ({
  config,
  selectedLayoutId,
  setConfig,
}: {
  config: Config
  setConfig: React.Dispatch<React.SetStateAction<Config>>
  selectedLayoutId: string
}) => {
  const selectedLayoutNumber = config.viewConfig.configs.find(
    (c) => c.id === selectedLayoutId
  )?.layoutNumber

  const tabs: Tab[] = [
    {
      name: 'Layout',
      value: 'Layout',
    },
  ]

  const [currentTab, setCurrentTab] = useState<Tab>(tabs[0])

  return (
    <div className="border mt-4 rounded-lg shadow-md h-4/6 border-gray-300 w-60 overflow-hidden">
      <TabBar
        tabs={tabs}
        current={currentTab}
        onTabChange={setCurrentTab}
        className="text-black gap-2 w-auto ml-4 mt-4"
      />
      <div className={cx('h-full w-full overflow-y-scroll pb-16', scrollStyle)}>
        <div className="grid grid-cols-2 p-4 gap-4">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <div className="w-full h-16">
              <LayoutGeneric
                layoutId={n}
                isSelected={selectedLayoutNumber === n}
                onClick={() => {
                  setConfig({
                    ...config,
                    viewConfig: {
                      ...config.viewConfig,
                      configs: config.viewConfig.configs.map((c) => {
                        if (c.id === selectedLayoutId) {
                          return {
                            ...c,
                            layoutNumber: n,
                          }
                        }
                        return c
                      }),
                    },
                  })
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const BackgroundConfiguration = ({
  config,
  selectedLayoutId,
  setConfig,
}: {
  config: Config
  setConfig: React.Dispatch<React.SetStateAction<Config>>
  selectedLayoutId: string
}) => {
  const tabs: Tab[] = [
    {
      name: 'Gradient',
      value: 'Gradient',
    },
    {
      name: 'Image',
      value: 'Image',
    },
  ]

  const [currentTab, setCurrentTab] = useState<Tab>(tabs[0])

  return (
    <div className="border mt-4 rounded-lg shadow-md border-gray-300 w-60 h-4/6 overflow-hidden">
      <TabBar
        tabs={tabs}
        current={currentTab}
        onTabChange={setCurrentTab}
        className="text-black gap-2 w-auto ml-4 mt-4"
      />
      {currentTab.value === 'Gradient' && (
        <GradientPicker
          config={config}
          setConfig={setConfig}
          selectedLayoutId={selectedLayoutId}
        />
      )}
      {currentTab.value === 'Image' && (
        <ImagePicker
          config={config}
          setConfig={setConfig}
          selectedLayoutId={selectedLayoutId}
        />
      )}
    </div>
  )
}

const GradientPicker = ({
  config,
  selectedLayoutId,
  setConfig,
}: {
  config: Config
  setConfig: React.Dispatch<React.SetStateAction<Config>>
  selectedLayoutId: string
}) => {
  interface Gradient {
    angle: number
    values: (number | string)[]
    cssString: string
  }

  const { payload } = (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const gradients: Gradient[] = [
    {
      angle: 90,
      values: [0, '#D397FA', 0.0001, '#D397FA', 1, '#8364E8'],
      cssString:
        'linear-gradient(90deg, #D397FA 0%, #D397FA 0.01%, #8364E8 100%)',
    },
    {
      angle: 90,
      values: [0.0001, '#FFAFBD', 1, '#FFC3A0'],
      cssString: 'linear-gradient(90deg, #FFAFBD 0.01%, #FFC3A0 100%)',
    },
    {
      angle: 90,
      values: [0.0001, '#8879B2', 1, '#EAAFC8'],
      cssString: 'linear-gradient(90deg, #8879B2 0.01%, #EAAFC8 100%)',
    },
    {
      angle: 90,
      values: [0.0001, '#8BC6EC', 1, '#9599E2'],
      cssString: 'linear-gradient(90deg, #8BC6EC 0.01%, #9599E2 100%)',
    },
    {
      angle: 43.58,
      values: [0.424, '#FBDA61', 0.9792, '#FF5ACD'],
      cssString: 'linear-gradient(43.58deg, #FBDA61 4.24%, #FF5ACD 97.92%)',
    },
    {
      angle: 180,
      values: [0.0001, '#A9C9FF', 1, '#FFBBEC'],
      cssString: 'linear-gradient(180deg, #A9C9FF 0.01%, #FFBBEC 100%)',
    },
    {
      angle: 226.32,
      values: [0.0001, '#FF3CAC', 0.524, '#784BA0', 1, '#2B86C5'],
      cssString:
        'linear-gradient(226.32deg, #FF3CAC -25.84%, #784BA0 40.09%, #2B86C5 100%)',
    },
    {
      angle: 47.5,
      values: [0, '#74EBD5', 0.96, '#9FACE6'],
      cssString: 'linear-gradient(47.5deg, #74EBD5 0%, #9FACE6 96%)',
    },
    {
      angle: 46.2,
      values: [0, '#85FFBD', 0.9802, '#FFFED3'],
      cssString: 'linear-gradient(46.2deg, #85FFBD 0%, #FFFED3 98.02%)',
    },
    {
      angle: 42.22,
      values: [0.278, '#FBAB7E', 0.9837, '#F7CE68'],
      cssString: 'linear-gradient(42.22deg, #FBAB7E 2.78%, #F7CE68 98.37%)',
    },
    {
      angle: 90,
      values: [0.0001, '#43CEA2', 1, '#548AC0'],
      cssString: 'linear-gradient(90deg, #43CEA2 0.01%, #548AC0 100%)',
    },
    {
      angle: 226.32,
      values: [
        0.0001,
        '#FFCC70',
        0.0812,
        '#F6B97C',
        0.5829,
        '#CE74C8',
        1,
        '#2B86C5',
      ],
      cssString:
        'linear-gradient(226.32deg, #FFCC70 -25.84%, #F6B97C -15.62%, #CE74C8 47.51%, #2B86C5 100%)',
    },
  ]

  const getGradientConfig = (gradient: Gradient) => {
    const { width, height } = CONFIG
    // Specify angle in degrees
    const angleInDeg = gradient.angle

    // Compute angle in radians - CSS starts from 180 degrees and goes clockwise
    // Math functions start from 0 and go anti-clockwise so we use 180 - angleInDeg to convert between the two
    const angle = ((180 - angleInDeg) / 180) * Math.PI

    // This computes the length such that the start/stop points will be at the corners
    const length =
      Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle))

    // Compute the actual x,y points based on the angle, length of the gradient line and the center of the div
    const halfx = (Math.sin(angle) * length) / 2.0
    const halfy = (Math.cos(angle) * length) / 2.0
    const cx = width / 2.0
    const cy = height / 2.0
    const x1 = cx - halfx
    const y1 = cy - halfy
    const x2 = cx + halfx
    const y2 = cy + halfy

    return {
      cssString: gradient.cssString,
      values: gradient.values,
      startIndex: { x: x1, y: y1 },
      endIndex: { x: x2, y: y2 },
    } as GradientConfig
  }

  return (
    <div
      className={cx(
        'grid grid-cols-2 p-4 gap-4 overflow-scroll w-full h-full pb-16',
        scrollStyle
      )}
    >
      {Array.from({ length: gradients.length }, (_, i) => i + 1).map((n) => (
        <div
          role="button"
          tabIndex={-1}
          onKeyUp={() => {}}
          className={cx(
            'h-16 w-full p-1 rounded-md border border-gray-200 cursor-pointer',
            {
              'border-gray-600':
                config.viewConfig.configs.find((c) => c.id === selectedLayoutId)
                  ?.background.gradient?.cssString ===
                gradients[n - 1].cssString,
            }
          )}
          onClick={() => {
            if (payload?.fragmentState === 'titleSplash')
              setConfig({
                ...config,
                viewConfig: {
                  ...config.viewConfig,
                  titleSplashConfig: getGradientConfig(gradients[n - 1]),
                },
              })
            else
              setConfig({
                ...config,
                viewConfig: {
                  ...config.viewConfig,
                  configs: config.viewConfig.configs.map((c) => {
                    if (c.id === selectedLayoutId) {
                      return {
                        ...c,
                        background: {
                          type: 'color',
                          gradient: getGradientConfig(gradients[n - 1]),
                        },
                      }
                    }
                    return c
                  }),
                },
              })
          }}
        >
          <div
            style={{
              background: gradients[n - 1].cssString,
            }}
            className="h-full w-full bg-gray-100 rounded-md"
          />
        </div>
      ))}
    </div>
  )
}

const ImagePicker = ({
  config,
  selectedLayoutId,
  setConfig,
}: {
  config: Config
  setConfig: React.Dispatch<React.SetStateAction<Config>>
  selectedLayoutId: string
}) => {
  const tabs: Tab[] = [
    {
      name: 'Assets',
      value: 'Assets',
    },
    {
      name: 'Wallpapers',
      value: 'Wallpapers',
    },
  ]

  const [currentTab, setCurrentTab] = useState<Tab>(tabs[0])
  const [search, setSearch] = useState('')

  return (
    <div className="p-4 h-full">
      <div className="flex items-center w-full gap-x-2 border border-gray-300 rounded-md">
        <IoSearchOutline size={24} className="ml-4" />
        <input
          className="w-full py-2 pr-4 placeholder-gray-400 focus:outline-none"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearch(e.target.value)
          }
          placeholder="Search"
        />
      </div>
      <TabBar
        tabs={tabs}
        current={currentTab}
        onTabChange={setCurrentTab}
        className="text-black gap-2 w-auto mt-4"
      />
      {currentTab.value === 'Assets' && (
        <AssetsTab
          config={config}
          setConfig={setConfig}
          selectedLayoutId={selectedLayoutId}
        />
      )}
      {currentTab.value === 'Wallpapers' && (
        <WallpapersTab
          config={config}
          setConfig={setConfig}
          selectedLayoutId={selectedLayoutId}
          search={search}
        />
      )}
    </div>
  )
}

const AssetsTab = ({
  config,
  selectedLayoutId,
  setConfig,
}: {
  config: Config
  setConfig: React.Dispatch<React.SetStateAction<Config>>
  selectedLayoutId: string
}) => {
  const [uploadPic] = useUploadFile()

  const { data, error, refetch } = useGetUserImageAssetsQuery()
  const [addAsset] = useAddAssetMutation()
  const [uploading, setUploading] = useState(false)

  const handleUploadAsset = async (file: File) => {
    if (!file) return
    setUploading(true)

    const toast = emitToast({
      title: 'Uploading asset...',
      type: 'info',
      autoClose: false,
    })

    try {
      const { uuid } = await uploadPic({
        extension: file.name.split('.').pop() as AllowedFileExtensions,
        file,
      })

      const res = await addAsset({
        variables: {
          displayName: file.name,
          objectLink: uuid,
          source: Asset_Source_Enum_Enum.WebClient,
          type: Asset_Type_Enum_Enum.Image,
        },
      })

      if (res.errors) throw res.errors[0]

      refetch()
      dismissToast(toast)
      emitToast({
        title: 'Uploaded asset',
        type: 'success',
        autoClose: 3000,
      })
    } catch (e) {
      dismissToast(toast)
      emitToast({
        title: 'Something went wrong while updating the thumbnail.',
        type: 'error',
      })
    } finally {
      setUploading(false)
    }
    setUploading(false)
  }

  return error ? (
    <div className="flex flex-col items-center justify-center w-full mt-8">
      <IoReloadOutline className="text-gray-400" />
      <Text
        className="cursor-pointer text-sm text-blue-700 hover:underline"
        onClick={() => refetch()}
      >
        Retry
      </Text>
    </div>
  ) : (
    <div
      className={cx(
        'grid grid-cols-2 mt-4 gap-4 w-full h-full pb-40 overflow-scroll',
        scrollStyle
      )}
    >
      <FileDropzone
        className="col-span-2 cursor-pointer w-full border border-dashed border-gray-300 bg-gray-50 py-4 flex flex-col items-center justify-center rounded-sm gap-y-2"
        text="Drag and drop or Browse"
        overrideClassNames
        onChange={(e) =>
          // @ts-ignore
          e.target.files?.[0] && handleUploadAsset(e.target.files[0])
        }
        disabled={uploading}
      />
      {data &&
        data.Asset.map((asset) => {
          return (
            <div
              role="button"
              tabIndex={-1}
              onKeyUp={() => {}}
              className={cx(
                'h-16 w-full p-1 rounded-md border border-gray-200 cursor-pointer',
                {
                  'border-gray-600':
                    config.viewConfig.configs.find(
                      (c) => c.id === selectedLayoutId
                    )?.background.image ===
                    appConfig.storage.baseUrl + asset.objectLink,
                }
              )}
              onClick={() =>
                setConfig({
                  ...config,
                  viewConfig: {
                    ...config.viewConfig,
                    configs: config.viewConfig.configs.map((c) => {
                      if (c.id === selectedLayoutId) {
                        return {
                          ...c,
                          background: {
                            type: 'image',
                            image: appConfig.storage.baseUrl + asset.objectLink,
                          },
                        }
                      }
                      return c
                    }),
                  },
                })
              }
            >
              <img
                src={appConfig.storage.baseUrl + asset.objectLink}
                alt={asset.displayName || ''}
                className="w-full h-full object-cover rounded-md"
              />
            </div>
          )
        })}
    </div>
  )
}

const WallpapersTab = ({
  config,
  selectedLayoutId,
  setConfig,
  search,
}: {
  config: Config
  setConfig: React.Dispatch<React.SetStateAction<Config>>
  selectedLayoutId: string
  search: string
}) => {
  const [getImages, { data, error, refetch }] =
    useGetImagesFromUnsplashLazyQuery()

  useEffect(() => {
    getImages({
      variables: {
        query: search === '' ? 'wallpapers' : search,
      },
    })
  }, [search])

  return error ? (
    <div className="flex flex-col items-center justify-center w-full mt-8">
      <IoReloadOutline className="text-gray-400" />
      <Text
        className="cursor-pointer text-sm text-blue-700 hover:underline"
        onClick={() => refetch?.()}
      >
        Retry
      </Text>
    </div>
  ) : (
    <div
      className={cx(
        'grid grid-cols-2 mt-4 gap-4 w-full h-full pb-40 overflow-scroll',
        scrollStyle
      )}
    >
      {data &&
        data.SearchUnsplash?.results.map((r: any) => {
          return (
            <div
              role="button"
              tabIndex={-1}
              onKeyUp={() => {}}
              className={cx(
                'h-16 w-full p-1 rounded-md border border-gray-200 cursor-pointer',
                {
                  'border-gray-600':
                    config.viewConfig.configs.find(
                      (c) => c.id === selectedLayoutId
                    )?.background.image === r.urls.regular,
                }
              )}
              onClick={() =>
                setConfig({
                  ...config,
                  viewConfig: {
                    ...config.viewConfig,
                    configs: config.viewConfig.configs.map((c) => {
                      if (c.id === selectedLayoutId) {
                        return {
                          ...c,
                          background: {
                            type: 'image',
                            image: r.urls.regular,
                          },
                        }
                      }
                      return c
                    }),
                  },
                })
              }
            >
              <img
                src={r.urls.thumb}
                alt={r.alt_description || ''}
                className="w-full h-full object-cover rounded-md"
              />
            </div>
          )
        })}
    </div>
  )
}

export default FragmentView