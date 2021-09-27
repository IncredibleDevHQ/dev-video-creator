import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
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

const TriviaThree = () => {
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

  const [openSaucedLogo] = useImage(
    `${config.storage.baseUrl}open-sauce-logo.svg`,
    'anonymous'
  )

  const [openSaucedBg] = useImage(
    `${config.storage.baseUrl}opensauce-bg.svg`,
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
        610,
        260,
        640,
        280,
        37,
        85
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
      studioUserClipConfig: {
        x: 150,
        y: 0,
        width: 220,
        height: 390,
        radius: 8,
      },
      backgroundRectX: 705,
      backgroundRectY: 48,
      backgroundRectColor: '#E0A764',
    },
  ]

  const layerChildren = [
    <Rect
      x={0}
      y={0}
      width={CONFIG.width}
      height={CONFIG.height}
      fill="#ffffff"
    />,
    <Image
      image={openSaucedBg}
      x={0}
      y={0}
      width={CONFIG.width}
      height={CONFIG.height}
    />,
    <Rect
      x={27}
      y={48}
      width={640}
      height={390}
      fill="#E0A764"
      cornerRadius={8}
    />,
    <Rect
      x={37}
      y={58}
      width={640}
      height={390}
      fill="#FAEACE"
      cornerRadius={8}
    />,
    <Group x={37} y={58} key="group1">
      {questions?.length > 0 && questions[activeQuestionIndex]?.image ? (
        <Text
          y={20}
          align="center"
          fontSize={32}
          fill="#D95C41"
          width={630}
          height={64}
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
          verticalAlign="middle"
          fontSize={32}
          fill="#D95C41"
          width={630}
          height={390}
          text={questions[activeQuestionIndex]?.text}
          fontStyle="bold"
          fontFamily="Poppins"
          align="center"
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
    <Image image={openSaucedLogo} x={30} y={CONFIG.height - 60} />,
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

export default TriviaThree
