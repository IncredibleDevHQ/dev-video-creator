import React, { useEffect, useState } from 'react'
import { Group, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { NextTokenIcon } from '../../../components'
import { Concourse } from '../components'
import { CONFIG } from '../components/Concourse'
import { ControlButton } from '../components/MissionControl'
import { StudioProviderProps, studioStore } from '../stores'

const Trivia = () => {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0)
  const [questions, setQuestions] = useState<string[]>([])
  const { fragment } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    setQuestions(
      fragment.configuration.properties.find(
        (property: any) => property.type === 'text[]'
      ).value
    )
  }, [fragment?.configuration.properties])

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
    <Group key="group">
      {questions.length > 0 ? (
        <Text
          fontSize={24}
          fill="#ffffff"
          width={CONFIG.width}
          height={CONFIG.height}
          text={questions[activeQuestionIndex]}
          align="center"
          verticalAlign="middle"
        />
      ) : null}
    </Group>,
  ]

  return <Concourse controls={controls} layerChildren={layerChildren} />
}

export default Trivia
