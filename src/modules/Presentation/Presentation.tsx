/* eslint-disable jsx-a11y/media-has-caption */
import { css, cx } from '@emotion/css'
import axios from 'axios'
import Konva from 'konva'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BsFullscreen } from 'react-icons/bs'
import { Group, Layer, Stage } from 'react-konva'
import { useParams } from 'react-router-dom'
import useMeasure from 'react-use-measure'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilState,
  useSetRecoilState,
} from 'recoil'
import { ScreenState } from '../../components'
import config from '../../config'
import {
  FragmentPresentationData,
  ThemeFragment,
} from '../../generated/graphql'
import { CONFIG, SHORTS_CONFIG } from './components/Concourse'
import Preload from './components/Preload'
import RecordingControlsBar from './components/RecordingControlsBar'
import UnifiedFragment from './effects/fragments/UnifiedFragment'
import { loadFonts } from './hooks/use-load-font'
import presentationStore from './stores/presentation.store'
import { BrandingJSON, ViewConfig } from './utils/configTypes'
import { SimpleAST, useUtils } from './utils/utils'

const noScrollBar = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

const getIntegerHW = ({
  maxH,
  maxW,
  aspectRatio,
  isShorts,
}: {
  maxH: number
  maxW: number
  aspectRatio: number
  isShorts: boolean
}) => {
  let calWidth = 0
  let calHeight = 0
  if (aspectRatio > maxW / maxH) {
    calWidth = Math.floor(maxW - (!isShorts ? maxW % 16 : maxW % 9))
    calHeight = calWidth * (1 / aspectRatio)
  } else if (aspectRatio <= maxW / maxH) {
    calHeight = Math.floor(maxH - (!isShorts ? maxH % 9 : maxH % 16))
    calWidth = calHeight * aspectRatio
  }
  return { width: calWidth, height: calHeight }
}

const PresentationHoc = () => {
  const [view, setView] = useState<'preload' | 'studio'>('preload')
  const { fragmentId } = useParams<{ fragmentId: string }>()

  const [studio, setStudio] = useRecoilState(presentationStore)

  const [presentationConfig, setPresentationConfig] =
    useState<FragmentPresentationData>()

  useEffect(() => {
    ;(async () => {
      const { data } = await axios.post(
        `${config.hasura.restServer}/getPresentationConfiguration`,
        {
          id: fragmentId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
      if (!data?.errors) {
        const config = data?.GetPresentationConfig?.data
        setPresentationConfig(config)
        setStudio({
          ...studio,
          flickName: config?.flick?.name,
          ownerName: config?.flick?.owner?.user?.displayName,
          ownerDesignation: config?.flick?.owner?.user?.designation,
          ownerOrganization: config?.flick?.owner?.user?.organization,
          theme: {
            name: config?.flick?.themeName,
            config: {},
          },
          branding: config?.flick?.branding,
        })
      }
    })()
  }, [])

  // // useEffect(() => {
  // //   return () => {
  // //     setStudio(null)
  // //   }
  // // }, [])

  if (!fragmentId)
    return (
      <ScreenState
        title="Something went wrong."
        subtitle="Fragment not found. This fragment either does not exist, or you dont have permission to view it."
      />
    )

  if (!presentationConfig)
    return <ScreenState title="Just a jiffy..." loading />

  if (view === 'preload' && presentationConfig)
    return (
      <Preload
        setView={setView}
        branding={presentationConfig?.flick?.branding}
        dataConfig={presentationConfig?.editorState}
        viewConfig={presentationConfig?.configuration}
      />
    )

  if (view === 'studio' && presentationConfig)
    return (
      <Presentation
        theme={{
          name: presentationConfig?.flick?.themeName,
          config: '',
        }}
        branding={presentationConfig?.flick?.branding}
        dataConfig={presentationConfig?.editorState}
        viewConfig={presentationConfig?.configuration}
      />
    )
  return <></>
}

const Presentation = ({
  theme,
  branding,
  dataConfig,
  viewConfig,
}: {
  dataConfig: any
  theme: ThemeFragment
  viewConfig: ViewConfig
  branding?: BrandingJSON | null
}) => {
  const stageRef = useRef<Konva.Stage>(null)
  const layerRef = useRef<Konva.Layer>(null)
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

  // const [currentBlock, setCurrentBlock] = useState<Block>()
  const [mountStage, setMountStage] = useState(false)
  const [shortsMode] = useState(viewConfig?.mode === 'Portrait')
  const [payload, setPayload] = useState<any>({
    activeObjectIndex: 0,
    fragmentState: 'customLayout',
  })
  const [codePayload, setCodePayload] = useState({
    currentIndex: 0,
    prevIndex: -1,
    focusBlockCode: false,
    activeBlockIndex: 0,
    isFocus: false,
  })
  const [listPayload, setListPayload] = useState({
    activePointIndex: 0,
  })
  const [videoPayload, setVideoPayload] = useState({
    currentTime: 0,
    playing: false,
  })

  const [stageBoundingDivRef, bounds] = useMeasure()

  const setStudio = useSetRecoilState(presentationStore)

  const [isFullScreen, setIsFullScreen] = useState(false)
  const [{ height: stageHeight, width: stageWidth }, setStageSize] = useState({
    height: 0,
    width: 0,
  })

  useEffect(() => {
    setStageSize(
      getIntegerHW({
        maxH: bounds.height,
        maxW: bounds.width,
        aspectRatio: shortsMode ? 9 / 16 : 16 / 9,
        isShorts: shortsMode,
      })
    )
  }, [bounds, isFullScreen])

  useEffect(() => {
    if (!stageWidth) return
    Konva.pixelRatio = (shortsMode ? 1080 : 1920) / stageWidth
    setMountStage(true)
  }, [stageWidth])

  useEffect(() => {
    setStudio((prev) => {
      return {
        ...prev,
        payload,
        setPayload,
        codePayload,
        setCodePayload,
        listPayload,
        setListPayload,
        videoPayload,
        setVideoPayload,
      }
    })
  }, [
    payload,
    setPayload,
    codePayload,
    setCodePayload,
    listPayload,
    setListPayload,
    videoPayload,
    setVideoPayload,
  ])

  useEffect(() => {
    if (payload?.activeObjectIndex === undefined) return
    setCodePayload?.({
      currentIndex: 0,
      prevIndex: -1,
      isFocus: false,
      focusBlockCode: false,
      activeBlockIndex: 0,
    })
    setListPayload({ activePointIndex: 0 })
  }, [payload?.activeObjectIndex])

  useMemo(() => {
    if (branding?.font)
      loadFonts([
        {
          family: branding?.font?.heading?.family || '',
          weights: ['400'],
          type: branding?.font?.heading?.type || 'google',
          url: branding?.font?.heading?.url,
        },
        {
          family: branding?.font?.body?.family || '',
          weights: ['400'],
          type: branding?.font?.body?.type || 'google',
          url: branding?.font?.body?.url,
        },
      ])
  }, [branding])

  // const [topLayerChildren, setTopLayerChildren] = useState<{
  //   id: string
  //   state: TopLayerChildren
  // }>({ id: '', state: '' })

  const utils = useUtils()

  const timelineRef = useRef<HTMLDivElement>(null)

  function isInViewport(element: HTMLElement) {
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }

  useEffect(() => {
    const block = dataConfig?.blocks?.[payload?.activeObjectIndex]

    if (!block) return
    // update timeline
    const ele = document.getElementById(`timeline-block-${block.id}`)
    if (!ele) return
    if (!isInViewport(ele) && timelineRef.current) {
      let scrollAmount = 0
      const slideTimer = setInterval(() => {
        if (!timelineRef.current) return
        timelineRef.current.scrollLeft += 100
        scrollAmount += 100
        if (scrollAmount >= 1000) {
          window.clearInterval(slideTimer)
        }
      }, 25)
    }
  }, [payload?.activeObjectIndex])

  /**
   * =======================
   * END EVENT HANDLERS...
   * =======================
   */

  const miniTimeline = (
    <div
      ref={timelineRef}
      style={{
        background: '#27272A',
      }}
      onWheel={(e) => {
        if (timelineRef.current) {
          timelineRef.current.scrollLeft += e.deltaY
        }
      }}
      className={cx(
        'mt-auto flex gap-x-4 px-6 py-3 overflow-x-scroll h-14',
        noScrollBar
      )}
    >
      {dataConfig &&
        (dataConfig as SimpleAST).blocks.map((block, index) => {
          return (
            <button
              key={block.id}
              type="button"
              id={`timeline-block-${block.id}`}
              className={cx(
                'px-3 py-1.5 font-body cursor-pointer text-sm rounded-sm flex items-center justify-center transition-transform duration-500 bg-gray-700 relative text-gray-300 flex-shrink-0'
                // {
                // 	'transform scale-110 border border-green-600':
                // 		payload?.activeObjectIndex === index,
                // 	'bg-gray-900 text-gray-500':
                // 		index !== payload?.activeObjectIndex,
                // }
              )}
              style={{
                transform:
                  payload?.activeObjectIndex === index ? 'scale(1.1)' : '',
                border:
                  payload?.activeObjectIndex === index
                    ? '1px solid #16a34a'
                    : '',
                borderRadius: '4px',
                backgroundColor:
                  index !== payload?.activeObjectIndex ? '#18181b' : '',
                color: index !== payload?.activeObjectIndex ? '#6b7280' : '',
              }}
              onClick={() =>
                setPayload({
                  ...payload,
                  activeObjectIndex: index,
                })
              }
            >
              <span>
                {utils.getBlockTitle(block).substring(0, 40) +
                  (utils.getBlockTitle(block).length > 40 ? '...' : '')}
              </span>
            </button>
          )
        })}
    </div>
  )

  return (
    <div
      style={{
        background: '#18181B',
      }}
      className="flex flex-col w-screen min-h-screen"
    >
      {/* Stage */}
      <div
        className="flex justify-center items-center flex-1 w-full relative"
        ref={stageBoundingDivRef}
        id="canvasDiv"
      >
        {mountStage && (
          <Stage
            ref={stageRef}
            width={stageWidth}
            height={stageHeight}
            scale={{
              x:
                stageHeight /
                (shortsMode ? SHORTS_CONFIG.height : CONFIG.height),
              y: stageWidth / (shortsMode ? SHORTS_CONFIG.width : CONFIG.width),
            }}
          >
            <Bridge>
              <Layer ref={layerRef}>
                {(() => {
                  if (payload) {
                    return (
                      <Group>
                        <UnifiedFragment
                          stageRef={stageRef}
                          // setTopLayerChildren={setTopLayerChildren}
                          config={dataConfig.blocks}
                          layoutConfig={viewConfig}
                          theme={theme}
                        />
                        {/* <GetTopLayerChildren
														key={topLayerChildren?.id}
														topLayerChildrenState={
															topLayerChildren?.state || ''
														}
														setTopLayerChildren={setTopLayerChildren}
														isShorts={shortsMode || false}
														theme={theme}
													/> */}
                      </Group>
                    )
                  }
                  return <></>
                })()}
              </Layer>
            </Bridge>
          </Stage>
        )}
        <RecordingControlsBar
          stageRef={stageRef}
          stageHeight={stageHeight}
          stageWidth={stageWidth}
          shortsMode={shortsMode}
          dataConfig={dataConfig}
          viewConfig={viewConfig}
        />
      </div>
      <div
        className="absolute"
        style={{ right: 4, margin: '4px', cursor: 'pointer' }}
      >
        {!isFullScreen && (
          <BsFullscreen
            size={24}
            color="#fff"
            onClick={() => {
              const canvas = document.getElementById('canvasDiv')
              canvas?.requestFullscreen()
              setIsFullScreen(true)
            }}
          />
        )}
        {/* {isFullScreen && (
          <BsFullscreenExit
            size={24}
            color="#fff"
            onClick={() => {
              document.exitFullscreen()
              setIsFullScreen(false)
            }}
          />
        )} */}
      </div>
      {/* Mini timeline */}
      {miniTimeline}
    </div>
  )
}

export default PresentationHoc
