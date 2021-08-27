import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Text, Image, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { Logo, NextTokenIcon } from '../../../components'
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
  const { fragment, state, stream, picture, constraints } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const userData = (useRecoilValue(userState) as User) || {}

  const imageConfig = { width: 702, height: 540 }
  const imageRef = useRef<Konva.Image | null>(null)
  const [image] = useImage(picture as string, 'anonymous')
  const [qnaImage] = useImage(
    questions[activeQuestionIndex]?.image as string,
    'anonymous'
  )
  const pic =
    'https://user-images.githubusercontent.com/4124733/53160617-55d4aa80-35ee-11e9-8486-7ccde6a235f0.png'
  const [logoImage] = useImage(pic as string, 'anonymous')

  // const [image] = useImage(picture as string)

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
        (property: any) => property.type === 'text[]'
      )?.value
    )
  }, [fragment?.configuration.properties])

  useEffect(() => {
    console.log('questions', questions)
  }, [questions])

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

  const controls =
    state === 'recording'
      ? [
          <ControlButton
            key="nextQuestion"
            icon={NextTokenIcon}
            className="my-2"
            appearance="primary"
            disabled={activeQuestionIndex === questions.length - 1}
            onClick={() => setActiveQuestionIndex(activeQuestionIndex + 1)}
          />,
        ]
      : [<></>]

  const layerChildren = [
    <Group x={0} y={0} draggable>
      {constraints?.video ? (
        <Image
          x={CONFIG.width / 3}
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
      {/* image */}
      <Rect y={12} x={857} fill="#C4C4C4" width={91} height={25} />

      <Rect x={0} y={0} width={600} height={CONFIG.height} fill="#ffffff" />
    </Group>,
    <Group x={64} y={64} key="group1">
      <Image
        image={logoImage}
        x={0}
        y={0}
        width={64}
        height={64}
        cornerRadius={4}
        fill="#F5F5F5"
      />
      {questions.length > 0 ? (
        <Text
          x={88}
          verticalAlign="middle"
          fontSize={24}
          fill="#424242"
          width={394}
          height={64}
          text={questions[activeQuestionIndex].text}
          fontStyle="bold"
          fontFamily="Gilroy"
          textTransform="capitalize"
        />
      ) : null}

      <Rect y={94} fill="#F5F5F5" width={472} height={318} />

      <Image
        image={qnaImage}
        y={110}
        x={16}
        fill="#F5F5F5"
        width={438}
        height={284}
      />
    </Group>,
    <Group x={664} y={412} width={234} height={64} key="group2">
      <Rect width={234} cornerRadius={4} height={64} fill="#F3F4F6" />
      <Text
        fontSize={18}
        fill="#1F2937"
        y={14}
        x={16}
        fontFamily="Inter"
        align="center"
        fontStyle="bold"
        text={userData.displayName as string}
        textTransform="capitalize"
      />
      <Text
        fontSize={9}
        fill="#1F2937"
        fontFamily="Inter"
        text={userData.email as string}
        textTransform="capitalize"
        y={36}
        x={16}
      />
    </Group>,
  ]

  return (
    <Concourse
      controls={controls}
      layerChildren={layerChildren}
      disableUserMedia={isDisableCamera}
    />
  )
}

export default Trivia
