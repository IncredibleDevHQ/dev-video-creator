/* eslint-disable no-nested-ternary */
import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Image, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import {
  BlockProperties,
  CaptionTitleView,
  ImageBlockView,
  ImageBlockViewProps,
} from '../../../../utils/configTypes'
import { ImageBlockProps } from '../../../Flick/editor/utils/utils'
import Concourse from '../../components/Concourse'
import FragmentBackground from '../../components/FragmentBackground'
import Gif from '../../components/Gif'
import { FragmentState } from '../../components/RenderTokens'
import { usePoint } from '../../hooks'
import useEdit from '../../hooks/use-edit'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import {
  ShortsStudioUserConfiguration,
  StudioUserConfiguration,
} from '../../utils/StudioUserConfig'
import { ObjectRenderConfig, ThemeLayoutConfig } from '../../utils/ThemeConfig'

const ImageFragment = ({
  viewConfig,
  dataConfig,
  fragmentState,
  setFragmentState,
  stageRef,
  shortsMode,
}: {
  viewConfig: BlockProperties
  dataConfig: ImageBlockProps
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  shortsMode: boolean
}) => {
  const { fragment, payload, branding, theme } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [imageFragmentData, setImageFragmentData] =
    useState<{ title: string; image?: string; caption: string }>()

  const { getImageDimensions } = useEdit()

  const [qnaImage] = useImage(
    imageFragmentData && imageFragmentData.image ? imageFragmentData.image : '',
    'anonymous'
  )
  const [isGif, setIsGif] = useState(false)
  const [renderMode, setRenderMode] = useState<CaptionTitleView>('titleOnly')

  const { getNoOfLinesOfText } = usePoint()

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
      surfaceColor: '',
    })

  useEffect(() => {
    if (!dataConfig) return
    setObjectConfig(
      FragmentLayoutConfig({
        theme,
        layout: viewConfig?.layout || 'classic',
        isShorts: shortsMode || false,
      })
    )
    setImageFragmentData({
      image: dataConfig?.imageBlock.url || '',
      title: dataConfig?.imageBlock.title || '',
      caption: dataConfig?.imageBlock.caption || '',
    })
    const imageBlockViewProps: ImageBlockViewProps = (
      viewConfig?.view as ImageBlockView
    )?.image
    setRenderMode(imageBlockViewProps?.captionTitleView || 'titleOnly')
    if (dataConfig?.imageBlock.type === 'gif') setIsGif(true)
    else setIsGif(false)
  }, [dataConfig, shortsMode, viewConfig])

  useEffect(() => {
    setObjectRenderConfig(
      ThemeLayoutConfig({ theme, layoutConfig: objectConfig })
    )
  }, [objectConfig])

  useEffect(() => {
    const noOfLinesOfTitle = getNoOfLinesOfText({
      text: imageFragmentData?.title || '',
      availableWidth: objectRenderConfig.availableWidth - 20,
      fontSize: 24,
      fontFamily: branding?.font?.body?.family || 'Gilroy',
      fontStyle: 'bold',
    })

    if (imageFragmentData?.title) {
      if (renderMode === 'titleOnly') {
        setImgDim(
          getImageDimensions(
            {
              w: (qnaImage && qnaImage.width) || 0,
              h: (qnaImage && qnaImage.height) || 0,
            },
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight - (noOfLinesOfTitle * 38 + 60),
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight - (noOfLinesOfTitle * 38 + 60),
            20,
            noOfLinesOfTitle * 38 + 40
          )
        )
      }
      if (renderMode === 'captionOnly') {
        setImgDim(
          getImageDimensions(
            {
              w: (qnaImage && qnaImage.width) || 0,
              h: (qnaImage && qnaImage.height) || 0,
            },
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight - 100,
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight - 100,
            20,
            20
          )
        )
      }
      if (renderMode === 'none') {
        setImgDim(
          getImageDimensions(
            {
              w: (qnaImage && qnaImage.width) || 0,
              h: (qnaImage && qnaImage.height) || 0,
            },
            objectRenderConfig.availableWidth - 20,
            objectRenderConfig.availableHeight - 20,
            objectRenderConfig.availableWidth - 20,
            objectRenderConfig.availableHeight - 20,
            10,
            10
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
          objectRenderConfig.availableWidth,
          objectRenderConfig.availableHeight,
          0,
          0
        )
      )
  }, [qnaImage, objectRenderConfig, renderMode, imageFragmentData, shortsMode])

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
        theme={theme}
        objectConfig={objectConfig}
        backgroundRectColor={
          branding?.colors?.primary
            ? branding?.colors?.primary
            : objectRenderConfig.surfaceColor
        }
      />
      <Group
        x={objectRenderConfig.startX}
        y={objectRenderConfig.startY}
        key="group1"
      >
        {imageFragmentData?.image ? (
          <>
            {isGif ? (
              <Gif
                image={qnaImage}
                x={imgDim.x}
                y={imgDim.y}
                width={imgDim.width}
                height={imgDim.height}
              />
            ) : (
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
            )}
            {(renderMode === 'titleOnly' ||
              renderMode === 'titleAndCaption') && (
              <Text
                x={10}
                y={20}
                align="center"
                fontSize={24}
                fill={
                  branding?.colors?.text
                    ? branding?.colors?.text
                    : objectRenderConfig.textColor
                }
                width={objectRenderConfig.availableWidth - 20}
                lineHeight={1.2}
                text={imageFragmentData?.title}
                fontStyle="bold"
                fontFamily={branding?.font?.body?.family || 'Gilroy'}
                textTransform="capitalize"
              />
            )}

            {(renderMode === 'captionOnly' ||
              renderMode === 'titleAndCaption') && (
              <Text
                x={!shortsMode ? 110 : 20}
                y={objectRenderConfig.availableHeight - 60}
                align="center"
                fontSize={16}
                fill={
                  branding?.colors?.text
                    ? branding?.colors?.text
                    : objectRenderConfig.textColor
                }
                width={
                  !shortsMode
                    ? objectRenderConfig.availableWidth - 220
                    : objectRenderConfig.availableWidth - 40
                }
                lineHeight={1.2}
                text={imageFragmentData?.caption}
                fontFamily={branding?.font?.body?.family || 'GilroyRegular'}
              />
            )}
          </>
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
            text={imageFragmentData?.title}
            fontStyle="bold"
            fontFamily={branding?.font?.body?.family || 'Inter'}
            align="center"
            verticalAlign="middle"
            lineHeight={1.3}
            textTransform="capitalize"
          />
        )}
      </Group>
    </Group>,
  ]

  const studioUserConfig = !shortsMode
    ? StudioUserConfiguration({
        layout: viewConfig?.layout || 'classic',
        fragment,
        fragmentState,
        theme,
      })
    : ShortsStudioUserConfiguration({
        layout: viewConfig?.layout || 'classic',
        fragment,
        fragmentState,
        theme,
      })

  return (
    <Concourse
      layerChildren={layerChildren}
      viewConfig={viewConfig}
      stageRef={stageRef}
      studioUserConfig={studioUserConfig}
      isShorts={shortsMode}
      blockType={dataConfig.type}
    />
  )
}

export default ImageFragment
