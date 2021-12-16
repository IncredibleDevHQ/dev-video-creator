/* eslint-disable no-nested-ternary */
import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Image, Rect, Text } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { ImageBlockProps } from '../../../../components/TextEditor/utils'
import { ConfigType } from '../../../../utils/configTypes'
import { BlockProperties } from '../../../../utils/configTypes2'
import Concourse, {
  CONFIG,
  SHORTS_CONFIG,
  TitleSplashProps,
} from '../../components/Concourse'
import Gif from '../../components/Gif'
import { FragmentState } from '../../components/RenderTokens'
import useEdit from '../../hooks/use-edit'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import { TrianglePathTransition } from '../FragmentTransitions'

const TriviaFragment = ({
  viewConfig,
  dataConfig,
  dataConfigLength,
  topLayerChildren,
  setTopLayerChildren,
  titleSplashData,
  fragmentState,
  setFragmentState,
  stageRef,
  layerRef,
  shortsMode,
}: {
  viewConfig: BlockProperties
  dataConfig: ImageBlockProps
  dataConfigLength: number
  topLayerChildren: JSX.Element[]
  setTopLayerChildren: React.Dispatch<React.SetStateAction<JSX.Element[]>>
  titleSplashData?: TitleSplashProps | undefined
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  layerRef: React.RefObject<Konva.Layer>
  shortsMode: boolean
}) => {
  const { fragment, payload, state, addMusic } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [studio, setStudio] = useRecoilState(studioStore)

  // const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0)
  const [triviaData, setTriviaData] =
    useState<{ text: string; image?: string }>()

  const { getImageDimensions } = useEdit()

  const [qnaImage] = useImage(
    triviaData && triviaData.image ? triviaData.image : '',
    'anonymous'
  )

  // const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')

  const [isGif, setIsGif] = useState(false)
  const [gifUrl, setGifUrl] = useState('')

  const [imgDim, setImgDim] = useState<{
    width: number
    height: number
    x: number
    y: number
  }>({ width: 0, height: 0, x: 0, y: 0 })

  // ref to the object grp
  const customLayoutRef = useRef<Konva.Group>(null)

  const [objectConfig, setObjectConfig] = useState<ObjectConfig>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    borderRadius: 0,
  })

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  useEffect(() => {
    if (!shortsMode) setStageConfig(CONFIG)
    else setStageConfig(SHORTS_CONFIG)
  }, [shortsMode])

  useEffect(() => {
    if (!dataConfig) return
    setObjectConfig(
      FragmentLayoutConfig({
        layout: viewConfig.layout || 'classic',
        isShorts: shortsMode || false,
      })
    )
    setTriviaData({
      image: dataConfig?.imageBlock.url || '',
      text: dataConfig?.imageBlock.title || '',
    })
    setStudio({
      ...studio,
      controlsConfig: {
        fragmentState,
        type: ConfigType.TRIVIA,
        dataConfigLength,
      },
    })
    setTopLayerChildren([])
  }, [dataConfig, shortsMode, viewConfig])

  useEffect(() => {
    setStudio({
      ...studio,
      controlsConfig: {
        fragmentState,
        type: ConfigType.TRIVIA,
        dataConfigLength,
      },
    })
  }, [state, fragmentState])

  useEffect(() => {
    if (qnaImage?.src.split('.').pop() === 'gif') {
      setIsGif(true)
      setGifUrl(qnaImage.src)
    } else {
      setIsGif(false)
    }
    if (triviaData?.text)
      setImgDim(
        getImageDimensions(
          {
            w: (qnaImage && qnaImage.width) || 0,
            h: (qnaImage && qnaImage.height) || 0,
          },
          objectConfig.width - 30,
          objectConfig.height - 140,
          objectConfig.width - 40,
          objectConfig.height,
          20,
          0
        )
      )
    else
      setImgDim(
        getImageDimensions(
          {
            w: (qnaImage && qnaImage.width) || 0,
            h: (qnaImage && qnaImage.height) || 0,
          },
          objectConfig.width - 30,
          objectConfig.height - 30,
          objectConfig.width - 40,
          objectConfig.height,
          20,
          0
        )
      )
  }, [qnaImage, objectConfig])

  // useEffect(() => {
  //   // setActiveQuestionIndex(payload?.activeQuestion)
  //   setFragmentState(payload?.fragmentState)
  // }, [payload])

  useEffect(() => {
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (payload?.fragmentState === 'customLayout') {
      setTopLayerChildren([
        <TrianglePathTransition isShorts={shortsMode} direction="right" />,
      ])
      addMusic()
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 1,
          duration: 0.2,
        })
      }, 800)
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (payload?.fragmentState === 'onlyUserMedia') {
      setTopLayerChildren([
        <TrianglePathTransition isShorts={shortsMode} direction="left" />,
      ])
      addMusic()
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 0,
          duration: 0.2,
        })
      }, 800)
    }
  }, [payload?.fragmentState])

  const layerChildren: any[] = [
    <Group x={0} y={0}>
      {/* {viewConfig.background.type === 'color' ? ( */}
      <Rect
        x={0}
        y={0}
        width={stageConfig.width}
        height={stageConfig.height}
        fillLinearGradientColorStops={viewConfig.gradient?.values}
        fillLinearGradientStartPoint={viewConfig.gradient?.startIndex}
        fillLinearGradientEndPoint={viewConfig.gradient?.endIndex}
      />
      {/* ) : (
        <Image
          x={0}
          y={0}
          width={stageConfig.width}
          height={stageConfig.height}
          image={bgImage}
        />
      )} */}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
      <Rect
        x={objectConfig.x}
        y={objectConfig.y}
        width={objectConfig.width}
        height={objectConfig.height}
        fill={viewConfig.bgColor || '#1F2937'}
        cornerRadius={objectConfig.borderRadius}
      />
      <Group x={objectConfig.x} y={objectConfig.y} key="group1">
        {triviaData?.image ? (
          isGif ? (
            <>
              <Text
                x={10}
                y={20}
                align="center"
                fontSize={32}
                fill={viewConfig.bgColor === '#ffffff' ? '#1F2937' : '#E5E7EB'}
                width={objectConfig.width - 20}
                lineHeight={1.2}
                text={triviaData?.text}
                fontStyle="bold"
                fontFamily="Poppins"
                textTransform="capitalize"
              />
              <Gif
                src={gifUrl}
                x={imgDim.x}
                y={imgDim.y}
                width={imgDim.width}
                height={imgDim.height}
              />
            </>
          ) : (
            <>
              <Text
                x={10}
                y={20}
                align="center"
                fontSize={32}
                fill={viewConfig.bgColor === '#ffffff' ? '#1F2937' : '#E5E7EB'}
                width={objectConfig.width - 20}
                lineHeight={1.2}
                text={triviaData?.text}
                fontStyle="bold"
                fontFamily="Poppins"
                textTransform="capitalize"
              />
              <Image
                image={qnaImage}
                y={imgDim.y}
                x={imgDim.x}
                width={imgDim.width}
                height={imgDim.height}
                // shadowOpacity={0.3}
                // shadowOffset={{ x: 0, y: 1 }}
                // shadowBlur={2}
              />
            </>
          )
        ) : (
          <Text
            x={10}
            fontSize={32}
            fill={viewConfig.bgColor === '#ffffff' ? '#1F2937' : '#E5E7EB'}
            width={objectConfig.width - 20}
            height={objectConfig.height}
            text={triviaData?.text}
            fontStyle="bold"
            fontFamily="Poppins"
            align="center"
            verticalAlign="middle"
            lineHeight={1.3}
            textTransform="capitalize"
          />
        )}
      </Group>
    </Group>,
  ]

  const studioUserConfig = StudioUserConfiguration({
    layout: viewConfig.layout || 'classic',
    fragment,
    fragmentState,
    isShorts: shortsMode || false,
    bgGradientId: viewConfig.gradient?.id || 1,
  })

  return (
    <Concourse
      layerChildren={layerChildren}
      stageRef={stageRef}
      layerRef={layerRef}
      titleSplashData={titleSplashData}
      studioUserConfig={studioUserConfig}
      topLayerChildren={topLayerChildren}
      isShorts={shortsMode}
    />
  )
}

export default TriviaFragment
