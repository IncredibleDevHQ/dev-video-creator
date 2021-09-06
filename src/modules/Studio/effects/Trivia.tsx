import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Text, Image, Rect } from 'react-konva'
import FontFaceObserver from 'fontfaceobserver'
import { useRecoilValue } from 'recoil'
import { useImage } from 'react-konva-utils'
import { NextTokenIcon } from '../../../components'
import { User, userState } from '../../../stores/user.store'
import { Concourse } from '../components'
import { CONFIG } from '../components/Concourse'
import { ControlButton } from '../components/MissionControl'
import { StudioProviderProps, studioStore } from '../stores'

const Trivia = () => {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0)
  const [questions, setQuestions] = useState<{ text: string; image: string }[]>(
    []
  )
  const [useTitleSpalsh, setUseTitleSpalsh] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })
  const { fragment, state, stream, picture, payload, constraints } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const userData = (useRecoilValue(userState) as User) || {}
  const imageConfig = { width: 702, height: 540 }
  const imageRef = useRef<Konva.Image | null>(null)
  const [image] = useImage(picture as string, 'anonymous')
  const [qnaImage] = useImage(
    questions && questions[activeQuestionIndex]
      ? questions[activeQuestionIndex].image
      : '',
    'anonymous'
  )

  useEffect(() => {
    const font = new FontFaceObserver('Poppins')
    font.load()
  }, [])

  const videoElement = React.useMemo(() => {
    if (!stream) return undefined
    const element = document.createElement('video')
    element.srcObject = stream
    element.muted = true

    return element
  }, [stream])

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    setQuestions(
      fragment.configuration.properties.find(
        (property: any) => property.type === 'json'
      )?.value
    )
    //setConfig of titleSpalsh
    setUseTitleSpalsh({
      enable: fragment.configuration.properties.find(
        (property: any) => property.key === 'showTitleSplash'
      )?.value,
      title: fragment.name as string,
    })
  }, [fragment?.configuration.properties])

  useEffect(() => {
    if (!videoElement || !imageRef.current) return undefined
    videoElement.play()

    const layer = imageRef.current.getLayer()

    const anim = new Konva.Animation(() => {}, layer)
    anim.start()

    return () => {
      anim.stop()
    }
  }, [videoElement, imageRef.current])

  const ref = useRef<HTMLVideoElement | null>(null)
  const isDisableCamera = true

  useEffect(() => {
    if (!ref.current) return

    ref.current.srcObject = stream
  }, [ref.current])

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

  const layerChildren = [
    <Group x={600} y={0} key="group0">
      {constraints?.video ? (
        <Image
          x={-imageConfig.width / 3}
          ref={imageRef}
          image={videoElement}
          width={imageConfig.width}
          height={imageConfig.height}
        />
      ) : (
        <Image
          image={image}
          width={imageConfig.width}
          height={imageConfig.height}
        />
      )}

      <Rect x={-600} y={0} width={600} height={CONFIG.height} fill="#ffffff" />
    </Group>,
    <Group x={64} y={64} key="group1">
      {questions.length > 0 && questions[activeQuestionIndex].image ? (
        <Text
          x={-64}
          align="left"
          fontSize={24}
          fill="#424242"
          width={472}
          height={64}
          text={questions[activeQuestionIndex]?.text}
          fontStyle="bold"
          fontFamily="Poppins"
          textTransform="capitalize"
          ref={(ref) => ref?.to({ x: 0, duration: 0.3 })}
        />
      ) : (
        <></>
      )}
      {questions.length > 0 && !questions[activeQuestionIndex].image ? (
        <Text
          x={-64}
          y={-64}
          verticalAlign="middle"
          fontSize={24}
          fill="#424242"
          width={472}
          height={CONFIG.height}
          text={questions[activeQuestionIndex]?.text}
          fontStyle="bold"
          fontFamily="Poppins"
          align="center"
          textTransform="capitalize"
          ref={(ref) => ref?.to({ x: 0, duration: 0.3 })}
        />
      ) : (
        <>
          <Rect y={94} fill="#F5F5F5" width={472} height={318} />
          <Image
            image={qnaImage}
            y={110}
            x={16}
            fill="#F5F5F5"
            width={438}
            height={284}
          />
        </>
      )}
    </Group>,
    <Group x={664} y={412} width={234} height={64} key="group2">
      <Rect width={234} cornerRadius={4} height={64} fill="#F3F4F6" />

      <Text
        fontSize={18}
        fill="#1F2937"
        y={14}
        fontFamily="Poppins"
        width={234}
        height={64}
        align="center"
        fontStyle="bold"
        text={userData.displayName as string}
        textTransform="capitalize"
      />
      <Text
        fontSize={9}
        fill="#1F2937"
        fontFamily="Poppins"
        align="center"
        width={234}
        height={64}
        text={userData.email as string}
        textTransform="capitalize"
        y={36}
      />
    </Group>,
  ]

  return (
    <Concourse
      controls={controls}
      layerChildren={layerChildren}
      disableUserMedia={isDisableCamera}
      useTitleSpalsh={useTitleSpalsh}
    />
  )
}

export default Trivia
