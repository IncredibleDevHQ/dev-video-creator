import React, { useEffect, useState } from 'react'
import { Group, Text, Image, Rect } from 'react-konva'
import FontFaceObserver from 'fontfaceobserver'
import { useRecoilValue } from 'recoil'
import { useImage } from 'react-konva-utils'
import { NextTokenIcon } from '../../../components'
import { Concourse } from '../components'
import { CONFIG, StudioUserConfig } from '../components/Concourse'
import { ControlButton } from '../components/MissionControl'
import { StudioProviderProps, studioStore } from '../stores'
import config from '../../../config'
import useEdit from '../hooks/use-edit'
import Gif from '../components/Gif'

const TriviaSeven = () => {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0)
  const [questions, setQuestions] = useState<{ text: string; image: string }[]>(
    []
  )
  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const { fragment, state, updatePayload, payload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const { getImageDimensions } = useEdit()

  const [qnaImage] = useImage(
    questions && questions[activeQuestionIndex]
      ? questions[activeQuestionIndex].image
      : '',
    'anonymous'
  )

  const [incredibleLogo] = useImage(
    `${config.storage.baseUrl}x-incredible-black.svg`,
    'anonymous'
  )
  const [nextJSLogo] = useImage(
    `${config.storage.baseUrl}nextJSLogo.svg`,
    'anonymous'
  )
  const [nextJSBg] = useImage(
    `${config.storage.baseUrl}nextJS_bg.svg`,
    'anonymous'
  )
  const [isGif, setIsGif] = useState(false)
  const [gifUrl, setGifUrl] = useState('')

  const [imgDim, setImgDim] = useState<{
    width: number
    height: number
    x: number
    y: number
  }>({ width: 0, height: 0, x: 0, y: 0 })
  useEffect(() => {
    const font = new FontFaceObserver('Poppins')
    font.load()
  }, [])

  useEffect(() => {
    if (qnaImage?.src.split('.').pop() === 'gif') {
      setIsGif(true)
      setGifUrl(qnaImage.src)
    } else {
      setIsGif(false)
    }
    setImgDim(
      getImageDimensions(
        {
          w: (qnaImage && qnaImage.width) || 0,
          h: (qnaImage && qnaImage.height) || 0,
        },
        610,
        250,
        640,
        280,
        0,
        90
      )
    )
  }, [qnaImage])

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    setQuestions(
      fragment.configuration.properties.find(
        (property: any) => property.type === 'json'
      )?.value
    )
    // setConfig of titleSpalsh
    settitleSpalshData({
      enable: fragment.configuration.properties.find(
        (property: any) => property.key === 'showTitleSplash'
      )?.value,
      title: fragment.name as string,
    })
  }, [fragment?.configuration.properties])

  useEffect(() => {
    if (state === 'ready') {
      updatePayload?.({ activeQuestion: 0 })
    }
    if (state === 'recording') {
      setActiveQuestionIndex(0)
    }
  }, [state])

  useEffect(() => {
    setActiveQuestionIndex(payload?.activeQuestion)
  }, [payload])

  const controls = [
    <ControlButton
      key="nextQuestion"
      icon={NextTokenIcon}
      className="my-2"
      appearance="primary"
      disabled={activeQuestionIndex === questions.length - 1}
      onClick={() => {
        setActiveQuestionIndex(activeQuestionIndex + 1)
        updatePayload?.({ activeQuestion: activeQuestionIndex + 1 })
      }}
    />,
  ]

  const studioCoordinates: StudioUserConfig[] = (() => {
    switch (fragment?.participants.length) {
      case 2:
        return [
          {
            x: 705,
            y: 60,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 4,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 10,
              y: 0,
              width: 220,
              height: 180,
              radius: 0,
            },
          },
          {
            x: 705,
            y: 265,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 4,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 10,
              y: 0,
              width: 220,
              height: 180,
              radius: 0,
            },
          },
        ]

      default:
        return [
          {
            x: 565,
            y: 58,
            width: 520,
            height: 390,
            clipTheme: 'rect',
            borderWidth: 4,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 150,
              y: 0,
              width: 220,
              height: 390,
              radius: 0,
            },
          },
        ]
    }
  })()

  const layerChildren = [
    <Rect
      strokeWidth={1}
      x={0}
      y={0}
      fill="#F5F6F7"
      width={CONFIG.width}
      height={CONFIG.height}
      stroke="#111111"
    />,
    <Image
      image={nextJSBg}
      x={1}
      y={1}
      fill="#F5F6F7"
      width={CONFIG.width - 2}
      height={CONFIG.height - 2}
    />,

    <Rect
      x={37}
      y={58}
      width={640}
      height={390}
      fill="white"
      stroke="#111111"
      strokeWidth={2}
    />,
    <Group x={37} y={58} key="group1">
      {questions?.length > 0 && questions[activeQuestionIndex]?.image ? (
        <Text
          x={10}
          y={20}
          align="center"
          fontSize={32}
          fill="#111111"
          width={620}
          lineHeight={1.2}
          text={questions[activeQuestionIndex]?.text}
          fontStyle="bold"
          fontFamily="Poppins"
          textTransform="capitalize"
        />
      ) : (
        <></>
      )}
      {questions.length > 0 && !questions[activeQuestionIndex]?.image ? (
        <Text
          x={10}
          verticalAlign="middle"
          fontSize={32}
          fill="#111111"
          width={620}
          height={390}
          text={questions[activeQuestionIndex]?.text}
          fontStyle="bold"
          fontFamily="Poppins"
          align="center"
          lineHeight={1.3}
          textTransform="capitalize"
        />
      ) : (
        <>
          {!isGif && (
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
          )}
          {isGif && (
            <Gif
              src={gifUrl}
              x={imgDim.x}
              y={imgDim.y}
              width={imgDim.width}
              height={imgDim.height}
            />
          )}
        </>
      )}
    </Group>,
    <Image image={incredibleLogo} x={30} y={CONFIG.height - 75} />,
    <Image image={nextJSLogo} x={840} y={CONFIG.height - 68} />,
  ]

  return (
    <Concourse
      controls={controls}
      layerChildren={layerChildren}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioCoordinates}
    />
  )
}

export default TriviaSeven
