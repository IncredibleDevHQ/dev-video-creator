import { css, cx } from '@emotion/css'
import Konva from 'konva'
import React, { createRef, useEffect, useState } from 'react'
import { FaDiscord } from 'react-icons/fa'
import { HiOutlineUser } from 'react-icons/hi'
import { IoPerson, IoPlayOutline } from 'react-icons/io5'
import { Layer, Stage } from 'react-konva'
import useMeasure, { RectReadOnly } from 'react-use-measure'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilValue,
} from 'recoil'
import layoutLink from '../../../assets/linkpreview.svg'
import { Tab, TabBar, Text } from '../../../components'
import { Fragment_Type_Enum_Enum } from '../../../generated/graphql'
import { GradientConfig } from '../../../utils/configTypes'
import { CONFIG, SHORTS_CONFIG } from '../../Studio/components/Concourse'
import IntroFragment from '../../Studio/effects/fragments/IntroFragment'
import OutroFragment from '../../Studio/effects/fragments/OutroFragment'
import { StudioProviderProps, studioStore } from '../../Studio/stores'
import { newFlickStore } from '../store/flickNew.store'

const scrollStyle = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

export enum SplashThemes {
  GraphQL = '0',
  Astro = '1',
  TensorFlow = '2',
  Lines = '3',
  Shapes = '4',
  Abstract = '5',
}

export enum DiscordThemes {
  BlueOnWhite = 'blue-on-white',
  WhiteOnBlue = 'white-on-blue',
  MidnightOnWhite = 'midnight-on-white',
  WhiteOnMidnight = 'white-on-midnight',
}

export interface DiscordConfig {
  theme: DiscordThemes
  backgroundColor: string
  textColor: string
}

export interface IntroOutroConfiguration {
  theme: SplashThemes
  discord: DiscordConfig
  mode: 'Portrait' | 'Landscape'
  gradient: GradientConfig
}

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

function IntroOutroView({
  config,
  setConfig,
}: {
  config: IntroOutroConfiguration
  setConfig: React.Dispatch<React.SetStateAction<IntroOutroConfiguration>>
}) {
  const [ref, bounds] = useMeasure()

  return (
    <div className="py-2 ml-6 w-full h-full">
      <div className="flex flex-1 h-full w-full overflow-hidden" ref={ref}>
        <div className="w-min">
          {config && <Preview config={config} bounds={bounds} />}
          <Layouts />
        </div>
        <Configurations config={config} setConfig={setConfig} />
      </div>
    </div>
  )
}

const Preview = ({
  config,
  bounds,
}: {
  config: IntroOutroConfiguration
  bounds: RectReadOnly
}) => {
  const stageRef = createRef<Konva.Stage>()
  const layerRef = createRef<Konva.Layer>()
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()
  const { flick, activeFragmentId } = useRecoilValue(newFlickStore)

  const [splash, setSplash] = useState(config.theme)

  useEffect(() => {
    setSplash(config.theme)
  }, [config.theme])

  Konva.pixelRatio = 2

  const { height: divHeight, width: divWidth } = useGetHW({
    maxH: bounds.height / 1.25,
    maxW: bounds.width / 1.25,
    aspectRatio: 16 / 9,
  })

  const { height, width } = useGetHW({
    maxH: bounds.height / 1.255,
    maxW: bounds.width / 1.25,
    aspectRatio: config.mode === 'Portrait' ? 9 / 16 : 16 / 9,
  })

  return (
    <div
      style={{
        height: divHeight,
        width: divWidth,
      }}
      className="flex justify-center"
    >
      <Stage
        ref={stageRef}
        height={height}
        width={width}
        className="border"
        scale={{
          x:
            height /
            (config.mode === 'Portrait' ? SHORTS_CONFIG.height : CONFIG.height),
          y:
            width /
            (config.mode === 'Portrait' ? SHORTS_CONFIG.width : CONFIG.width),
        }}
      >
        <Bridge>
          <Layer ref={layerRef}>
            {flick?.fragments.find((f) => f.id === activeFragmentId)?.type ===
            Fragment_Type_Enum_Enum.Intro ? (
              <IntroFragment
                themeNumber={splash}
                discordConfig={config.discord}
                gradientConfig={config.gradient}
                viewMode
              />
            ) : (
              <OutroFragment
                themeNumber={splash}
                gradientConfig={config.gradient}
                viewMode
              />
            )}
          </Layer>
        </Bridge>
      </Stage>
    </div>
  )
}

const Layouts = () => {
  const { payload, updatePayload } = useRecoilValue(studioStore)
  const { flick, activeFragmentId } = useRecoilValue(newFlickStore)

  return (
    <div
      className={cx(
        'flex flex-row mt-2 border border-gray-200 rounded-md bg-white shadow-md',
        {
          'flex-row-reverse justify-end':
            flick?.fragments.find((f) => f.id === activeFragmentId)?.type ===
            Fragment_Type_Enum_Enum.Outro,
        }
      )}
    >
      {/* Splash */}
      <div
        className="h-20 cursor-pointer bg-gray-50"
        role="button"
        tabIndex={-1}
        onKeyUp={() => {}}
        onClick={() =>
          updatePayload?.({
            fragmentState: 'customLayout',
          })
        }
      >
        <div className="h-full flex items-center justify-center w-28 p-2.5">
          <div
            className={cx(
              'h-full w-full p-2 border border-gray-200 rounded-md cursor-pointer bg-white',
              {
                'border border-brand':
                  payload?.fragmentState === 'customLayout',
              }
            )}
          >
            <div className="flex items-center justify-center bg-gray-200 w-full h-full rounded-md">
              <IoPlayOutline className="text-gray-400" size={24} />
            </div>
          </div>
        </div>
      </div>
      {/* Discord */}
      {flick?.fragments.find((f) => f.id === activeFragmentId)?.type ===
        Fragment_Type_Enum_Enum.Intro && (
        <div
          className="h-20 cursor-pointer bg-gray-50"
          role="button"
          tabIndex={-1}
          onKeyUp={() => {}}
          onClick={() =>
            updatePayload?.({
              fragmentState: 'discord',
            })
          }
        >
          <div className="h-full flex items-center justify-center w-28 p-2.5">
            <div
              className={cx(
                'h-full w-full p-2 border border-gray-200 rounded-md cursor-pointer bg-white',
                {
                  'border border-brand': payload?.fragmentState === 'discord',
                }
              )}
            >
              <div className="flex items-center justify-center bg-gray-200 w-full h-full rounded-md">
                <img src={layoutLink} alt="link" className="w-8" />
              </div>
            </div>
          </div>
        </div>
      )}
      {/* UserMedia */}
      <div
        className="h-20 bg-gray-50"
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
    </div>
  )
}

const Configurations = ({
  config,
  setConfig,
}: {
  config: IntroOutroConfiguration
  setConfig: React.Dispatch<React.SetStateAction<IntroOutroConfiguration>>
}) => {
  enum Configuration {
    Splash = 'splash',
    Discord = 'discord',
    UserMedia = 'onlyUserMedia',
  }

  const [currentConfiguration, setCurrentConfiguration] =
    useState<Configuration>(Configuration.Splash)

  const { payload } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const { flick, activeFragmentId } = useRecoilValue(newFlickStore)

  useEffect(() => {
    if (payload?.fragmentState === 'customLayout')
      setCurrentConfiguration(Configuration.Splash)
    else if (payload?.fragmentState === 'discord')
      setCurrentConfiguration(Configuration.Discord)
    else if (payload?.fragmentState === 'onlyUserMedia')
      setCurrentConfiguration(Configuration.UserMedia)
  }, [payload?.fragmentState])

  return (
    <div className="flex flex-col ml-4 h-full">
      {/* Configs */}
      <div className="flex gap-x-3">
        {payload?.fragmentState === 'customLayout' &&
          flick?.fragments.find((f) => f.id === activeFragmentId)?.type ===
            Fragment_Type_Enum_Enum.Intro && (
            <div
              role="button"
              tabIndex={-1}
              onKeyUp={() => {}}
              onClick={() => setCurrentConfiguration(Configuration.Splash)}
              className={cx(
                'border border-gray-300 bg-gray-100 p-2 rounded-md h-9 w-9 flex items-center justify-center',
                {
                  'border-brand': currentConfiguration === Configuration.Splash,
                }
              )}
            >
              <IoPlayOutline className="text-gray-600" size={21} />
            </div>
          )}
        {payload?.fragmentState === 'discord' && (
          <div
            role="button"
            tabIndex={-1}
            onKeyUp={() => {}}
            onClick={() => setCurrentConfiguration(Configuration.Discord)}
            className={cx(
              'border border-gray-300 bg-gray-100 p-2 rounded-md h-9 w-9 flex items-center justify-center',
              {
                'border-brand': currentConfiguration === Configuration.Discord,
              }
            )}
          >
            <img src={layoutLink} alt="link" />
          </div>
        )}
        {payload?.fragmentState === 'onlyUserMedia' && (
          <div
            role="button"
            tabIndex={-1}
            onKeyUp={() => {}}
            onClick={() => setCurrentConfiguration(Configuration.Discord)}
            style={{
              background: config.gradient.cssString,
            }}
            className={cx(
              'border border-gray-300 p-2 rounded-md h-9 w-9 flex items-center justify-center',
              {
                'border-brand': currentConfiguration === Configuration.Discord,
              }
            )}
          >
            <IoPerson className="text-gray-700" />
          </div>
        )}
      </div>
      {/* Selected Config */}
      {currentConfiguration === Configuration.Splash &&
        flick?.fragments.find((f) => f.id === activeFragmentId)?.type ===
          Fragment_Type_Enum_Enum.Intro && (
          <SplashConfiguration config={config} setConfig={setConfig} />
        )}
      {currentConfiguration === Configuration.Discord && (
        <DiscordConfiguration config={config} setConfig={setConfig} />
      )}
      {currentConfiguration === Configuration.UserMedia && (
        <GradientPicker config={config} setConfig={setConfig} />
      )}
    </div>
  )
}

const SplashConfiguration = ({
  config,
  setConfig,
}: {
  config: IntroOutroConfiguration
  setConfig: React.Dispatch<React.SetStateAction<IntroOutroConfiguration>>
}) => {
  const tabs: Tab[] = [
    {
      name: 'Splash',
      value: 'Splash',
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
          {Object.values(SplashThemes).map((key, index) => {
            return (
              <button
                onClick={() => {
                  setConfig((prev) => ({
                    ...prev,
                    theme: key,
                  }))
                }}
                key={key}
                className={cx(
                  'bg-gray-100 p-4 rounded-md border border-transparent',
                  {
                    'border-brand': config.theme === `${index}`,
                  }
                )}
                type="button"
              >
                <Text className="font-base text-xs text-gray-800">
                  {
                    Object.keys(SplashThemes)[
                      Object.values(SplashThemes).indexOf(key)
                    ]
                  }
                </Text>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const DiscordConfiguration = ({
  config,
  setConfig,
}: {
  config: IntroOutroConfiguration
  setConfig: React.Dispatch<React.SetStateAction<IntroOutroConfiguration>>
}) => {
  const tabs: Tab[] = [
    {
      name: 'Join Community',
      value: 'Join Community',
    },
  ]

  const discordConfigs: DiscordConfig[] = [
    {
      backgroundColor: '#1F2937',
      textColor: '#ffffff',
      theme: DiscordThemes.WhiteOnMidnight,
    },
    {
      backgroundColor: '#ffffff',
      textColor: '#1F2937',
      theme: DiscordThemes.MidnightOnWhite,
    },
    {
      backgroundColor: '#ffffff',
      textColor: '#404FED',
      theme: DiscordThemes.BlueOnWhite,
    },

    {
      backgroundColor: '#404FED',
      textColor: '#ffffff',
      theme: DiscordThemes.WhiteOnBlue,
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
      <div className={cx('h-full w-full overflow-y-scroll pb-16', scrollStyle)}>
        <div className="grid grid-cols-2 p-4 gap-4">
          {discordConfigs.map((discordConfig) => {
            return (
              <button
                type="button"
                key={discordConfig.theme}
                style={{
                  backgroundColor: discordConfig.backgroundColor,
                  color: discordConfig.textColor,
                }}
                className={cx(
                  'h-16 flex cursor-pointer items-center p-6 justify-center ring-1 ring-offset-2 ring-gray-200 rounded-sm',
                  {
                    'ring-brand': config.discord.theme === discordConfig.theme,
                  }
                )}
                onClick={() => {
                  setConfig({
                    ...config,
                    discord: discordConfig,
                  })
                }}
              >
                <FaDiscord className="w-full h-full" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const GradientPicker = ({
  config,
  setConfig,
}: {
  config: IntroOutroConfiguration
  setConfig: React.Dispatch<React.SetStateAction<IntroOutroConfiguration>>
}) => {
  interface Gradient {
    angle: number
    values: (number | string)[]
    cssString: string
  }

  const tabs: Tab[] = [
    {
      name: 'Background',
      value: 'Background',
    },
  ]
  const [currentTab, setCurrentTab] = useState<Tab>(tabs[0])

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
    <div className="border mt-4 rounded-lg shadow-md border-gray-300 w-60 h-4/6 overflow-hidden">
      <TabBar
        tabs={tabs}
        current={currentTab}
        onTabChange={setCurrentTab}
        className="text-black gap-2 w-auto ml-4 mt-4"
      />
      <div className={cx('h-full w-full overflow-y-scroll pb-16', scrollStyle)}>
        <div
          className={cx(
            'grid grid-cols-2 p-4 gap-4 overflow-scroll w-full h-full pb-16',
            scrollStyle
          )}
        >
          {Array.from({ length: gradients.length }, (_, i) => i + 1).map(
            (n) => (
              <div
                role="button"
                tabIndex={-1}
                onKeyUp={() => {}}
                className={cx(
                  'h-16 w-full p-1 rounded-md border border-gray-200 cursor-pointer',
                  {
                    'border-gray-600':
                      config.gradient?.cssString === gradients[n - 1].cssString,
                  }
                )}
                onClick={() => {
                  setConfig({
                    ...config,
                    gradient: getGradientConfig(gradients[n - 1]),
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
            )
          )}
        </div>
      </div>
    </div>
  )
}

// const ImagePicker = ({
//   config,
//   selectedLayoutId,
//   setConfig,
// }: {
//   config: Config
//   setConfig: React.Dispatch<React.SetStateAction<Config>>
//   selectedLayoutId: string
// }) => {
//   const tabs: Tab[] = [
//     {
//       name: 'Assets',
//       value: 'Assets',
//     },
//     {
//       name: 'Wallpapers',
//       value: 'Wallpapers',
//     },
//   ]

//   const [currentTab, setCurrentTab] = useState<Tab>(tabs[0])
//   const [search, setSearch] = useState('')

//   return (
//     <div className="p-4 h-full">
//       <div className="flex items-center w-full gap-x-2 border border-gray-300 rounded-md">
//         <IoSearchOutline size={24} className="ml-4" />
//         <input
//           className="w-full py-2 pr-4 placeholder-gray-400 focus:outline-none"
//           onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
//             setSearch(e.target.value)
//           }
//           placeholder="Search"
//         />
//       </div>
//       <TabBar
//         tabs={tabs}
//         current={currentTab}
//         onTabChange={setCurrentTab}
//         className="text-black gap-2 w-auto mt-4"
//       />
//       {currentTab.value === 'Assets' && (
//         <AssetsTab
//           config={config}
//           setConfig={setConfig}
//           selectedLayoutId={selectedLayoutId}
//         />
//       )}
//       {currentTab.value === 'Wallpapers' && (
//         <WallpapersTab
//           config={config}
//           setConfig={setConfig}
//           selectedLayoutId={selectedLayoutId}
//           search={search}
//         />
//       )}
//     </div>
//   )
// }

// const AssetsTab = ({
//   config,
//   selectedLayoutId,
//   setConfig,
// }: {
//   config: Config
//   setConfig: React.Dispatch<React.SetStateAction<Config>>
//   selectedLayoutId: string
// }) => {
//   const [uploadPic] = useUploadFile()

//   const { data, error, refetch } = useGetUserImageAssetsQuery()
//   const [addAsset] = useAddAssetMutation()
//   const [uploading, setUploading] = useState(false)

//   const handleUploadAsset = async (file: File) => {
//     if (!file) return
//     setUploading(true)

//     const toast = emitToast({
//       title: 'Uploading asset...',
//       type: 'info',
//       autoClose: false,
//     })

//     try {
//       const { uuid } = await uploadPic({
//         extension: file.name.split('.').pop() as AllowedFileExtensions,
//         file,
//       })

//       const res = await addAsset({
//         variables: {
//           displayName: file.name,
//           objectLink: uuid,
//           source: Asset_Source_Enum_Enum.WebClient,
//           type: Asset_Type_Enum_Enum.Image,
//         },
//       })

//       if (res.errors) throw res.errors[0]

//       refetch()
//       dismissToast(toast)
//       emitToast({
//         title: 'Uploaded asset',
//         type: 'success',
//         autoClose: 3000,
//       })
//     } catch (e) {
//       dismissToast(toast)
//       emitToast({
//         title: 'Something went wrong while updating the thumbnail.',
//         type: 'error',
//       })
//     } finally {
//       setUploading(false)
//     }
//     setUploading(false)
//   }

//   return error ? (
//     <div className="flex flex-col items-center justify-center w-full mt-8">
//       <IoReloadOutline className="text-gray-400" />
//       <Text
//         className="cursor-pointer text-sm text-blue-700 hover:underline"
//         onClick={() => refetch()}
//       >
//         Retry
//       </Text>
//     </div>
//   ) : (
//     <div
//       className={cx(
//         'grid grid-cols-2 mt-4 gap-4 w-full h-full pb-40 overflow-scroll',
//         scrollStyle
//       )}
//     >
//       <FileDropzone
//         className="col-span-2 cursor-pointer w-full border border-dashed border-gray-300 bg-gray-50 py-4 flex flex-col items-center justify-center rounded-sm gap-y-2"
//         text="Drag and drop or Browse"
//         overrideClassNames
//         onChange={(e) =>
//           // @ts-ignore
//           e.target.files?.[0] && handleUploadAsset(e.target.files[0])
//         }
//         disabled={uploading}
//       />
//       {data &&
//         data.Asset.map((asset) => {
//           return (
//             <div
//               role="button"
//               tabIndex={-1}
//               onKeyUp={() => {}}
//               className={cx(
//                 'h-16 w-full p-1 rounded-md border border-gray-200 cursor-pointer',
//                 {
//                   'border-gray-600':
//                     config.viewConfig.configs.find(
//                       (c) => c.id === selectedLayoutId
//                     )?.background.image ===
//                     appConfig.storage.baseUrl + asset.objectLink,
//                 }
//               )}
//               onClick={() =>
//                 setConfig({
//                   ...config,
//                   viewConfig: {
//                     ...config.viewConfig,
//                     configs: config.viewConfig.configs.map((c) => {
//                       if (c.id === selectedLayoutId) {
//                         return {
//                           ...c,
//                           background: {
//                             type: 'image',
//                             image: appConfig.storage.baseUrl + asset.objectLink,
//                           },
//                         }
//                       }
//                       return c
//                     }),
//                   },
//                 })
//               }
//             >
//               <img
//                 src={appConfig.storage.baseUrl + asset.objectLink}
//                 alt={asset.displayName || ''}
//                 className="w-full h-full object-cover rounded-md"
//               />
//             </div>
//           )
//         })}
//     </div>
//   )
// }

// const WallpapersTab = ({
//   config,
//   selectedLayoutId,
//   setConfig,
//   search,
// }: {
//   config: Config
//   setConfig: React.Dispatch<React.SetStateAction<Config>>
//   selectedLayoutId: string
//   search: string
// }) => {
//   const [getImages, { data, error, refetch }] =
//     useGetImagesFromUnsplashLazyQuery()

//   useEffect(() => {
//     getImages({
//       variables: {
//         query: search === '' ? 'wallpapers' : search,
//       },
//     })
//   }, [search])

//   return error ? (
//     <div className="flex flex-col items-center justify-center w-full mt-8">
//       <IoReloadOutline className="text-gray-400" />
//       <Text
//         className="cursor-pointer text-sm text-blue-700 hover:underline"
//         onClick={() => refetch?.()}
//       >
//         Retry
//       </Text>
//     </div>
//   ) : (
//     <div
//       className={cx(
//         'grid grid-cols-2 mt-4 gap-4 w-full h-full pb-40 overflow-scroll',
//         scrollStyle
//       )}
//     >
//       {data &&
//         data.SearchUnsplash?.results.map((r: any) => {
//           return (
//             <div
//               role="button"
//               tabIndex={-1}
//               onKeyUp={() => {}}
//               className={cx(
//                 'h-16 w-full p-1 rounded-md border border-gray-200 cursor-pointer',
//                 {
//                   'border-gray-600':
//                     config.viewConfig.configs.find(
//                       (c) => c.id === selectedLayoutId
//                     )?.background.image === r.urls.regular,
//                 }
//               )}
//               onClick={() =>
//                 setConfig({
//                   ...config,
//                   viewConfig: {
//                     ...config.viewConfig,
//                     configs: config.viewConfig.configs.map((c) => {
//                       if (c.id === selectedLayoutId) {
//                         return {
//                           ...c,
//                           background: {
//                             type: 'image',
//                             image: r.urls.regular,
//                           },
//                         }
//                       }
//                       return c
//                     }),
//                   },
//                 })
//               }
//             >
//               <img
//                 src={r.urls.thumb}
//                 alt={r.alt_description || ''}
//                 className="w-full h-full object-cover rounded-md"
//               />
//             </div>
//           )
//         })}
//     </div>
//   )
// }

export default IntroOutroView