/* eslint-disable no-nested-ternary */
import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Text, Image, Rect } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import useImage from 'use-image'
import {
  ConfigType,
  LayoutConfig,
  TriviaConfig,
} from '../../../../utils/configTypes'
import {
  MutipleRectMoveLeft,
  MutipleRectMoveRight,
} from '../FragmentTransitions'
import useEdit from '../../hooks/use-edit'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import Concourse, { CONFIG, TitleSplashProps } from '../../components/Concourse'
import Gif from '../../components/Gif'
import { FragmentState } from '../../components/RenderTokens'

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
}: {
  viewConfig: LayoutConfig
  dataConfig: TriviaConfig
  dataConfigLength: number
  topLayerChildren: JSX.Element[]
  setTopLayerChildren: React.Dispatch<React.SetStateAction<JSX.Element[]>>
  titleSplashData?: TitleSplashProps | undefined
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  layerRef: React.RefObject<Konva.Layer>
}) => {
  const { fragment, payload, state } =
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

  const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')

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

  useEffect(() => {
    if (!dataConfig) return
    setObjectConfig(
      FragmentLayoutConfig({ layoutNumber: viewConfig.layoutNumber })
    )
    setTriviaData(dataConfig.value)
    setStudio({
      ...studio,
      controlsConfig: {
        fragmentState,
        type: ConfigType.TRIVIA,
        dataConfigLength,
      },
    })
  }, [dataConfig, viewConfig])

  useEffect(() => {
    setStudio({
      ...studio,
      controlsConfig: {
        fragmentState,
        type: ConfigType.TRIVIA,
        dataConfigLength,
      },
    })
  }, [fragmentState])

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
          objectConfig.height - 110,
          20,
          100
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
          objectConfig.height - 40,
          20,
          20
        )
      )
  }, [qnaImage, objectConfig])

  useEffect(() => {
    // setActiveQuestionIndex(payload?.activeQuestion)
    setFragmentState(payload?.fragmentState)
  }, [payload])

  useEffect(() => {
    if (!customLayoutRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (fragmentState === 'customLayout') {
      setTopLayerChildren([
        <MutipleRectMoveRight
          rectOneColors={['#651CC8', '#9561DA']}
          rectTwoColors={['#FF5D01', '#B94301']}
          rectThreeColors={['#1F2937', '#778496']}
        />,
      ])
      customLayoutRef.current.to({
        opacity: 1,
        duration: 0.2,
      })
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (fragmentState === 'onlyUserMedia') {
      setTopLayerChildren([
        <MutipleRectMoveLeft
          rectOneColors={['#651CC8', '#9561DA']}
          rectTwoColors={['#FF5D01', '#B94301']}
          rectThreeColors={['#1F2937', '#778496']}
        />,
      ])
      customLayoutRef.current.to({
        opacity: 0,
        duration: 0.2,
      })
    }
  }, [fragmentState])

  const layerChildren: any[] = [
    <Group x={0} y={0}>
      {viewConfig.background.type === 'color' ? (
        <Rect
          x={0}
          y={0}
          width={CONFIG.width}
          height={CONFIG.height}
          fillLinearGradientColorStops={viewConfig.background.gradient?.values}
          fillLinearGradientStartPoint={
            viewConfig.background.gradient?.startIndex
          }
          fillLinearGradientEndPoint={viewConfig.background.gradient?.endIndex}
        />
      ) : (
        <Image
          x={0}
          y={0}
          width={CONFIG.width}
          height={CONFIG.height}
          image={bgImage}
        />
      )}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
      <Rect
        x={objectConfig.x}
        y={objectConfig.y}
        width={objectConfig.width}
        height={objectConfig.height}
        fill="#ffffff"
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
                fill="#1F2937"
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
                fill="#1F2937"
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
                shadowOpacity={0.3}
                shadowOffset={{ x: 0, y: 1 }}
                shadowBlur={2}
              />
            </>
          )
        ) : (
          <Text
            x={10}
            fontSize={32}
            fill="#1F2937"
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
    layoutNumber: viewConfig.layoutNumber,
    fragment,
    fragmentState,
  })

  return (
    <Concourse
      layerChildren={layerChildren}
      stageRef={stageRef}
      layerRef={layerRef}
      titleSplashData={titleSplashData}
      studioUserConfig={studioUserConfig}
      topLayerChildren={topLayerChildren}
    />
  )
}

export default TriviaFragment
