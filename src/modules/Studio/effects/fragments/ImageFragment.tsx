/* eslint-disable no-nested-ternary */
import Konva from 'konva'
import { nanoid } from 'nanoid'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Image, Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import {
  BlockProperties,
  CaptionTitleView,
  ImageBlockView,
  ImageBlockViewProps,
  Layout,
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
  isPreview,
}: {
  viewConfig: BlockProperties
  dataConfig: ImageBlockProps
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  shortsMode: boolean
  isPreview: boolean
}) => {
  const { fragment, payload, branding, theme, preloadedBlobUrls, users } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [imageFragmentData, setImageFragmentData] =
    useState<{ title: string; image?: string; caption: string }>()

  const { getImageDimensions } = useEdit()
  const { getTextWidth } = useEdit()

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

  const [layout, setLayout] = useState<Layout | undefined>()

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
    setObjectConfig(
      FragmentLayoutConfig({
        theme,
        layout: !isPreview
          ? layout || viewConfig?.layout || 'classic'
          : viewConfig?.layout || 'classic',
        isShorts: shortsMode || false,
      })
    )
  }, [shortsMode, viewConfig, theme, layout, isPreview])

  useEffect(() => {
    setObjectRenderConfig(
      ThemeLayoutConfig({ theme, layoutConfig: objectConfig })
    )
  }, [objectConfig, theme])

  useEffect(() => {
    let noOfLinesOfTitle = getNoOfLinesOfText({
      text: imageFragmentData?.title || '',
      availableWidth: objectRenderConfig.availableWidth - 20,
      fontSize: objectRenderConfig?.blockTitleFontSize || 24,
      fontFamily:
        branding?.font?.heading?.family ||
        objectRenderConfig.titleFont ||
        'Gilroy',
      fontStyle: 'bold',
    })
    noOfLinesOfTitle =
      theme?.name === 'Whitep4nth3r' ? noOfLinesOfTitle + 0.8 : noOfLinesOfTitle
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
              // this 48 constitutes of, the starting y coordinate of the text ie 16, padding between the title and the image ie 16, and the bottom padding
              48 -
              noOfLinesOfTitle *
                ((objectRenderConfig?.blockTitleFontSize || 24) + 0.2),
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight -
              // this 48 constitutes of, the starting y coordinate of the text ie 16, padding between the title and the image ie 16, and the bottom padding
              48 -
              noOfLinesOfTitle *
                ((objectRenderConfig?.blockTitleFontSize || 24) + 0.2),
            20,
            // adding 16 bcoz its the starting y coordinate of the text
            16 +
              noOfLinesOfTitle *
                ((objectRenderConfig?.blockTitleFontSize || 24) + 0.2) +
              // this addition of 16 is for the pading between the title and the image
              16
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
              // top padding
              16 -
              noOfLinesOfCaption * (16 + 0.2) -
              // 32 is the padding between the image and the caption and the bottom padding
              32,
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight -
              // top padding
              16 -
              noOfLinesOfCaption * (16 + 0.2) -
              // 32 is the padding between the image and the caption and the bottom padding
              32,
            20,
            // 16 is for the top padding
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
              // adding 16 bcoz its the starting y coordinate of the text
              16 -
              noOfLinesOfTitle *
                ((objectRenderConfig?.blockTitleFontSize || 24) + 0.2) -
              // this addition of 16 is for the pading between the title and the image
              16 -
              // padding between the image and the caption
              16 -
              noOfLinesOfCaption * (16 + 0.2) -
              // bottom padding
              16,
            objectRenderConfig.availableWidth - 40,
            objectRenderConfig.availableHeight -
              // adding 16 bcoz its the starting y coordinate of the text
              16 -
              noOfLinesOfTitle *
                ((objectRenderConfig?.blockTitleFontSize || 24) + 0.2) -
              // this addition of 16 is for the pading between the title and the image
              16 -
              // padding between the image and the caption
              16 -
              noOfLinesOfCaption * (16 + 0.2) -
              // bottom padding
              16,
            20,
            // adding 16 bcoz its the starting y coordinate of the text
            16 +
              noOfLinesOfTitle *
                ((objectRenderConfig?.blockTitleFontSize || 24) + 0.2) +
              // this addition of 16 is for the pading between the title and the image
              16
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
      if (!shortsMode)
        setTimeout(() => {
          setLayout(viewConfig?.layout || 'classic')
          setFragmentState(payload?.fragmentState)
          customLayoutRef?.current?.to({
            opacity: 1,
            duration: 0.1,
          })
        }, 400)
      else {
        setLayout(viewConfig?.layout || 'classic')
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 1,
          duration: 0.1,
        })
      }
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (payload?.fragmentState === 'onlyUserMedia') {
      if (!shortsMode)
        setTimeout(() => {
          setFragmentState(payload?.fragmentState)
          customLayoutRef?.current?.to({
            opacity: 0,
            duration: 0.1,
          })
        }, 400)
      else {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 0,
          duration: 0.1,
        })
      }
    }
    if (payload?.fragmentState === 'onlyFragment') {
      if (!shortsMode)
        setTimeout(() => {
          setLayout('classic')
          setFragmentState(payload?.fragmentState)
          customLayoutRef?.current?.to({
            opacity: 1,
            duration: 0.1,
          })
        }, 400)
      else {
        setLayout('classic')
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 1,
          duration: 0.1,
        })
      }
    }
  }, [payload?.fragmentState, payload?.status])

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
                // shadowOpacity={0.3}
                // shadowOffset={{ x: 0, y: 1 }}
                // shadowBlur={2}
              />
            )}
            {(renderMode === 'titleOnly' ||
              renderMode === 'titleAndCaption') && (
              <Group>
                {theme.name === 'Whitep4nth3r' &&
                  imageFragmentData?.title !== '' && (
                    <Rect
                      x={
                        (objectRenderConfig.availableWidth - 20) / 2 -
                        (noOfLinesOfText.noOfLinesOfTitle - 0.8 === 1
                          ? getTextWidth(
                              imageFragmentData?.title || '',
                              branding?.font?.heading?.family ||
                                objectRenderConfig.titleFont ||
                                'Gilroy',
                              objectRenderConfig?.blockTitleFontSize || 24,
                              'bold'
                            ) + 30
                          : objectRenderConfig.availableWidth - 80) /
                          2 +
                        10
                      }
                      y={
                        16 +
                        (noOfLinesOfText.noOfLinesOfTitle - 0.25) *
                          (objectRenderConfig?.blockTitleFontSize || 24)
                      }
                      width={
                        // checking if the no of lines of title is equal to 1, and based on that calculate the width of the title
                        noOfLinesOfText.noOfLinesOfTitle - 0.8 === 1
                          ? getTextWidth(
                              imageFragmentData?.title || '',
                              branding?.font?.heading?.family ||
                                objectRenderConfig.titleFont ||
                                'Gilroy',
                              objectRenderConfig?.blockTitleFontSize || 24,
                              'bold'
                            ) + 30
                          : objectRenderConfig.availableWidth - 80
                      }
                      height={5}
                      fillLinearGradientColorStops={[
                        0,
                        '#F11012',
                        1,
                        '#FFB626',
                      ]}
                      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                      fillLinearGradientEndPoint={{
                        x:
                          noOfLinesOfText.noOfLinesOfTitle - 0.8 === 1
                            ? getTextWidth(
                                imageFragmentData?.title || '',
                                branding?.font?.heading?.family ||
                                  objectRenderConfig.titleFont ||
                                  'Gilroy',
                                objectRenderConfig?.blockTitleFontSize || 24,
                                'bold'
                              ) + 30
                            : objectRenderConfig.availableWidth - 80,
                        y: 0,
                      }}
                    />
                  )}
                <Text
                  x={10}
                  y={16}
                  align="center"
                  fontSize={objectRenderConfig?.blockTitleFontSize || 24}
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
              </Group>
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

  const studioUserConfig = !shortsMode
    ? StudioUserConfiguration({
        layout: !isPreview
          ? layout || 'classic'
          : viewConfig?.layout || 'classic',
        noOfParticipants: users
          ? users?.length + 1
          : fragment?.configuration?.speakers?.length,
        fragmentState,
        theme,
      })
    : ShortsStudioUserConfiguration({
        layout: !isPreview
          ? layout || 'classic'
          : viewConfig?.layout || 'classic',
        noOfParticipants: users
          ? users?.length + 1
          : fragment?.configuration?.speakers?.length,
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
      fragmentState={fragmentState}
    />
  )
}

export default ImageFragment
