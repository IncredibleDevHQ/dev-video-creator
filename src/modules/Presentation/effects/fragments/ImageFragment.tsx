/* eslint-disable no-nested-ternary */
import Konva from 'konva'
import { nanoid } from 'nanoid'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Image, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import Concourse from '../../components/Concourse'
import FragmentBackground from '../../components/FragmentBackground'
import Gif from '../../components/Gif'
import { FragmentState } from '../../components/RenderTokens'
import { usePoint } from '../../hooks'
import useEdit from '../../hooks/use-edit'
import { presentationStore } from '../../stores'
import { PresentationProviderProps } from '../../stores/presentation.store'
import {
  BlockProperties,
  CaptionTitleView,
  ImageBlockView,
  ImageBlockViewProps,
} from '../../utils/configTypes'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { ObjectRenderConfig, ThemeLayoutConfig } from '../../utils/ThemeConfig'
import { ImageBlockProps } from '../../utils/utils'

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
  const { branding, theme, preloadedBlobUrls } =
    (useRecoilValue(presentationStore) as PresentationProviderProps) || {}

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

  const [noOfLinesOfText, setNoOfLinesOfText] = useState<{
    noOfLinesOfTitle: number
    noOfLinesOfCaption: number
  }>({ noOfLinesOfCaption: 0, noOfLinesOfTitle: 0 })

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
        layout: 'classic',
        isShorts: shortsMode || false,
      })
    )
    setImageFragmentData({
      image:
        preloadedBlobUrls?.[dataConfig.id] || dataConfig?.imageBlock.url || '',
      title: dataConfig?.imageBlock.title || '',
      caption: dataConfig?.imageBlock.caption || '',
    })
    const imageBlockViewProps: ImageBlockViewProps = (
      viewConfig?.view as ImageBlockView
    )?.image
    setRenderMode(imageBlockViewProps?.captionTitleView || 'titleOnly')
    if (dataConfig?.imageBlock.type === 'gif') setIsGif(true)
    else setIsGif(false)
  }, [dataConfig, shortsMode, viewConfig, theme])

  useEffect(() => {
    setObjectRenderConfig(
      ThemeLayoutConfig({ theme, layoutConfig: objectConfig })
    )
  }, [objectConfig, theme])

  useEffect(() => {
    const noOfLinesOfTitle = getNoOfLinesOfText({
      text: imageFragmentData?.title || '',
      availableWidth: objectRenderConfig.availableWidth - 20,
      fontSize: 24,
      fontFamily:
        branding?.font?.heading?.family ||
        objectRenderConfig.titleFont ||
        'Gilroy',
      fontStyle: 'bold',
    })
    const noOfLinesOfCaption = getNoOfLinesOfText({
      text: imageFragmentData?.caption || '',
      availableWidth: !shortsMode
        ? objectRenderConfig.availableWidth - 220
        : objectRenderConfig.availableWidth - 40,
      fontSize: 16,
      fontFamily:
        branding?.font?.body?.family || objectRenderConfig.bodyFont || 'Gilroy',
      fontStyle: 'normal',
    })
    setNoOfLinesOfText({ noOfLinesOfCaption, noOfLinesOfTitle })

    if (imageFragmentData?.title) {
      if (renderMode === 'titleOnly') {
        setImgDim(
          getImageDimensions(
            {
              w: (qnaImage && qnaImage.width) || 0,
              h: (qnaImage && qnaImage.height) || 0,
            },
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight -
              48 -
              noOfLinesOfTitle * (24 + 0.2),
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight -
              48 -
              noOfLinesOfTitle * (24 + 0.2),
            20,
            16 + noOfLinesOfTitle * (24 + 0.2) + 16
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
            objectRenderConfig.availableHeight -
              16 -
              noOfLinesOfCaption * (16 + 0.2) -
              32,
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight -
              16 -
              noOfLinesOfCaption * (16 + 0.2) -
              32,
            20,
            16
          )
        )
      }
      if (renderMode === 'titleAndCaption') {
        setImgDim(
          getImageDimensions(
            {
              w: (qnaImage && qnaImage.width) || 0,
              h: (qnaImage && qnaImage.height) || 0,
            },
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight -
              16 -
              noOfLinesOfTitle * (24 + 0.2) -
              16 -
              16 -
              noOfLinesOfCaption * (16 + 0.2) -
              16,
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight -
              16 -
              noOfLinesOfTitle * (24 + 0.2) -
              16 -
              16 -
              noOfLinesOfCaption * (16 + 0.2) -
              16,
            20,
            16 + noOfLinesOfTitle * (24 + 0.2) + 16
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

  const layerChildren: any[] = [
    <Group x={0} y={0} opacity={1} ref={customLayoutRef} key={0}>
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
                key={nanoid()}
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
                alt="image"
              />
            )}
            {(renderMode === 'titleOnly' ||
              renderMode === 'titleAndCaption') && (
              <Text
                x={10}
                y={16}
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
                fontFamily={
                  branding?.font?.heading?.family ||
                  objectRenderConfig.titleFont ||
                  'Gilroy'
                }
                textTransform="capitalize"
              />
            )}

            {(renderMode === 'captionOnly' ||
              renderMode === 'titleAndCaption') && (
              <Text
                x={!shortsMode ? 110 : 20}
                y={
                  objectRenderConfig.availableHeight -
                  noOfLinesOfText.noOfLinesOfCaption * (16 + 0.2) -
                  8
                }
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
                height={noOfLinesOfText.noOfLinesOfCaption * (16 + 0.2) + 8}
                lineHeight={1.2}
                text={imageFragmentData?.caption}
                fontFamily={
                  branding?.font?.body?.family ||
                  objectRenderConfig.bodyFont ||
                  'GilroyRegular'
                }
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
            fontFamily={
              branding?.font?.body?.family ||
              objectRenderConfig.titleFont ||
              'Gilroy'
            }
            align="center"
            verticalAlign="middle"
            lineHeight={1.3}
            textTransform="capitalize"
          />
        )}
      </Group>
    </Group>,
  ]

  return (
    <Concourse
      layerChildren={layerChildren}
      viewConfig={viewConfig}
      stageRef={stageRef}
      isShorts={shortsMode}
      blockType={dataConfig.type}
    />
  )
}

export default ImageFragment
