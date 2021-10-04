import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Text, Image, Rect, Circle } from 'react-konva'
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

const TriviaEight = () => {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0)
  const [questions, setQuestions] = useState<{ text: string; image: string }[]>(
    []
  )
  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const { fragment, state, stream, picture, constraints } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const userData = (useRecoilValue(userState) as User) || {}

  const { getImageDimensions } = useEdit()

  const [qnaImage] = useImage(
    questions && questions[activeQuestionIndex]
      ? questions[activeQuestionIndex].image
      : '',
    'anonymous'
  )

  const [elasticLogo] = useImage(
    `${config.storage.baseUrl}elastic-logo.png`,
    'anonymous'
  )
  const [whiteCircle] = useImage(
    `${config.storage.baseUrl}circle.png`,
    'anonymous'
  )
  const [pinkCircle] = useImage(
    `${config.storage.baseUrl}pink2.png`,
    'anonymous'
  )

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
    setImgDim(
      getImageDimensions(
        {
          w: (qnaImage && qnaImage.width) || 0,
          h: (qnaImage && qnaImage.height) || 0,
        },
        640,
        280,
        610,
        250,
        7,
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
    if (state === 'recording') {
      setActiveQuestionIndex(0)
    }
  }, [state])

  const controls = [
    <ControlButton
      key="nextQuestion"
      icon={NextTokenIcon}
      className="my-2"
      appearance="primary"
      disabled={activeQuestionIndex === questions.length - 1}
      onClick={() => setActiveQuestionIndex(activeQuestionIndex + 1)}
    />,
  ]

  const studioUserConfig: StudioUserConfig[] = [
    {
      x: 565,
      y: 58,
      width: 520,
      height: 390,
      clipTheme: 'rect',
      borderWidth: 8,
      borderColor: '#D1D5DB',
      studioUserClipConfig: {
        x: 150,
        y: 0,
        width: 220,
        height: 390,
        radius: 8,
      },
    },
  ]

  const layerChildren = [
    <Rect
      x={0}
      y={0}
      width={CONFIG.width}
      height={CONFIG.height}
      fill="#ffffff"
      // fillLinearGradientColorStops={[0, '#60D0ED', 1, '#536FA8']}
      // fillLinearGradientStartPoint={{ x: 0, y: 0 }}
      // fillLinearGradientEndPoint={{ x: CONFIG.width, y: CONFIG.height }}
    />,
    <Circle x={82} y={10} radius={55} fill="#7DE2D1" />,
    <Circle x={70} y={CONFIG.height - 70} radius={100} fill="#7DE2D1" />,
    <Circle x={640} y={20} radius={10} fill="#0077CC" />,
    <Circle x={270} y={CONFIG.height - 70} radius={10} fill="#0077CC" />,
    <Image image={pinkCircle} x={790} y={400} />,
    <Image image={whiteCircle} x={615} y={245} />,

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
      {questions.length > 0 && !questions[activeQuestionIndex].image ? (
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
      )}
    </Group>,
    <Image image={elasticLogo} x={30} y={CONFIG.height - 60} />,
  ]

  return (
    <Concourse
      controls={controls}
      layerChildren={layerChildren}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioUserConfig}
    />
  )
}

export default TriviaEight
