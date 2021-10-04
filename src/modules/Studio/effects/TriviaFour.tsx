import React, { useEffect, useState } from 'react'
import { Group, Text, Image, Rect } from 'react-konva'
import FontFaceObserver from 'fontfaceobserver'
import { useRecoilValue } from 'recoil'
import { useImage } from 'react-konva-utils'
import { NextTokenIcon } from '../../../components'
import { User, userState } from '../../../stores/user.store'
import { Concourse } from '../components'
import { CONFIG, StudioUserConfig } from '../components/Concourse'
import { ControlButton } from '../components/MissionControl'
import { StudioProviderProps, studioStore } from '../stores'
import config from '../../../config'
import useEdit from '../hooks/use-edit'
import Gif from '../components/Gif'

const TriviaFour = () => {
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

  const [astroPlanet] = useImage(
    `${config.storage.baseUrl}planet.svg`,
    'anonymous'
  )
  const [astroLogo] = useImage(
    `${config.storage.baseUrl}astro-logo.svg`,
    'anonymous'
  )
  const [windowOps] = useImage(
    `${config.storage.baseUrl}window-ops.svg`,
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
        37,
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
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 10,
              y: 0,
              width: 220,
              height: 180,
              radius: 8,
            },
            backgroundRectX: 705,
            backgroundRectY: 70,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 705,
            y: 265,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 10,
              y: 0,
              width: 220,
              height: 180,
              radius: 8,
            },
            backgroundRectX: 705,
            backgroundRectY: 295,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
        ]
      default:
        return [
          {
            x: 565,
            y: 68,
            width: 520,
            height: 390,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 150,
              y: 0,
              width: 220,
              height: 390,
              radius: 8,
            },
            backgroundRectX: 705,
            backgroundRectY: 58,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
        ]
    }
  })()

  const windowOpsImages = <Image image={windowOps} x={860} y={25} />

  const layerChildren = [
    <Rect
      x={0}
      y={0}
      width={CONFIG.width}
      height={CONFIG.height}
      fillLinearGradientColorStops={[
        0,
        '#140D1F',
        0.41,
        '#361367',
        1,
        '#6E1DDB',
      ]}
      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
      fillLinearGradientEndPoint={{
        x: CONFIG.width,
        y: CONFIG.height,
      }}
    />,
    <Image image={astroPlanet} x={-10} y={0} />,
    <Rect
      x={27}
      y={58}
      width={704}
      height={396}
      fill="#FF5D01"
      cornerRadius={8}
      stroke="#1F2937"
      strokeWidth={3}
    />,
    <Rect
      x={37}
      y={68}
      width={704}
      height={396}
      fill="#ffffff"
      cornerRadius={8}
      stroke="#1F2937"
      strokeWidth={3}
    />,
    <Group x={37} y={58} key="group1">
      {questions?.length > 0 && questions[activeQuestionIndex]?.image ? (
        <Text
          x={10}
          y={20}
          align="center"
          fontSize={32}
          fill="#1F2937"
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
          fill="#1F2937"
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
              maxWidth={610}
              maxHeight={250}
              availableWidth={640}
              availableHeight={280}
              x={37}
              y={90}
            />
          )}
        </>
      )}
    </Group>,
    { ...windowOpsImages },
    <Image image={astroLogo} x={30} y={CONFIG.height - 60} />,
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

export default TriviaFour
