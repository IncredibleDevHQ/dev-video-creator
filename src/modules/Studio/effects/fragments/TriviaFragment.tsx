/* eslint-disable no-nested-ternary */
import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Image, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import {
  BlockProperties,
  TopLayerChildren,
} from '../../../../utils/configTypes'
import { ImageBlockProps } from '../../../Flick/editor/utils/utils'
import Concourse, { TitleSplashProps } from '../../components/Concourse'
import FragmentBackground from '../../components/FragmentBackground'
import Gif from '../../components/Gif'
import { FragmentState } from '../../components/RenderTokens'
import useEdit from '../../hooks/use-edit'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import { ObjectRenderConfig, ThemeLayoutConfig } from '../../utils/ThemeConfig'

const TriviaFragment = ({
  viewConfig,
  dataConfig,
  topLayerChildren,
  titleSplashData,
  fragmentState,
  setFragmentState,
  stageRef,
  shortsMode,
}: {
  viewConfig: BlockProperties
  dataConfig: ImageBlockProps
  topLayerChildren: {
    id: string
    state: TopLayerChildren
  }
  titleSplashData?: TitleSplashProps | undefined
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  shortsMode: boolean
}) => {
  const { fragment, payload, branding } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

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

  const [objectRenderConfig, setObjectRenderConfig] =
    useState<ObjectRenderConfig>({
      startX: 0,
      startY: 0,
      availableWidth: 0,
      availableHeight: 0,
      textColor: '',
    })

  useEffect(() => {
    if (!dataConfig) return
    setObjectConfig(
      FragmentLayoutConfig({
        layout: viewConfig?.layout || 'classic',
        isShorts: shortsMode || false,
      })
    )
    setTriviaData({
      image: dataConfig?.imageBlock.url || '',
      text: dataConfig?.imageBlock.title || '',
    })
  }, [dataConfig, shortsMode, viewConfig])

  useEffect(() => {
    setObjectRenderConfig(
      ThemeLayoutConfig({ theme: 'glassy', layoutConfig: objectConfig })
    )
  }, [objectConfig])

  useEffect(() => {
    if (qnaImage?.src.split('.').pop() === 'gif') {
      setIsGif(true)
      setGifUrl(qnaImage.src)
    } else {
      setIsGif(false)
    }
    if (triviaData?.text) {
      if (shortsMode) {
        setImgDim(
          getImageDimensions(
            {
              w: (qnaImage && qnaImage.width) || 0,
              h: (qnaImage && qnaImage.height) || 0,
            },
            objectRenderConfig.availableWidth - 30,
            objectRenderConfig.availableHeight - 140,
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight,
            20,
            0
          )
        )
      } else {
        setImgDim(
          getImageDimensions(
            {
              w: (qnaImage && qnaImage.width) || 0,
              h: (qnaImage && qnaImage.height) || 0,
            },
            objectRenderConfig.availableWidth - 30,
            objectRenderConfig.availableHeight - 140,
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight - 110,
            20,
            80
          )
        )
      }
    } else
      setImgDim(
        getImageDimensions(
          {
            w: (qnaImage && qnaImage.width) || 0,
            h: (qnaImage && qnaImage.height) || 0,
          },
          objectRenderConfig.availableWidth - 30,
          objectRenderConfig.availableHeight - 30,
          objectRenderConfig.availableWidth - 40,
          objectRenderConfig.availableHeight,
          20,
          0
        )
      )
  }, [qnaImage, objectRenderConfig])

  // useEffect(() => {
  //   // setActiveQuestionIndex(payload?.activeQuestion)
  //   setFragmentState(payload?.fragmentState)
  // }, [payload])

  useEffect(() => {
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (payload?.fragmentState === 'customLayout') {
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
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
      <FragmentBackground
        theme="glassy"
        objectConfig={objectConfig}
        backgroundRectColor={
          branding?.colors?.primary ? branding?.colors?.primary : '#151D2C'
        }
      />
      <Group
        x={objectRenderConfig.startX}
        y={objectRenderConfig.startY}
        key="group1"
      >
        {triviaData?.image ? (
          isGif ? (
            <>
              <Text
                x={10}
                y={20}
                align="center"
                fontSize={32}
                fill={
                  branding?.colors?.text
                    ? branding?.colors?.text
                    : objectRenderConfig.textColor
                }
                width={objectRenderConfig.availableWidth - 20}
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
                fill={
                  branding?.colors?.text
                    ? branding?.colors?.text
                    : objectRenderConfig.textColor
                }
                width={objectRenderConfig.availableWidth - 20}
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
            fill={
              branding?.colors?.text
                ? branding?.colors?.text
                : objectRenderConfig.textColor
            }
            width={objectRenderConfig.availableWidth - 20}
            height={objectRenderConfig.availableHeight}
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
    layout: viewConfig?.layout || 'classic',
    fragment,
    fragmentState,
    theme: 'glassy',
  })

  return (
    <Concourse
      layerChildren={layerChildren}
      viewConfig={viewConfig}
      stageRef={stageRef}
      titleSplashData={titleSplashData}
      studioUserConfig={studioUserConfig}
      topLayerChildren={topLayerChildren}
      isShorts={shortsMode}
      blockType={dataConfig.type}
    />
  )
}

export default TriviaFragment
