import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { Group, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { NextTokenIcon } from '../../../components'
import { Concourse } from '../components'
import { CONFIG } from '../components/Concourse'
import { ControlButton } from '../components/MissionControl'
import { StudioProviderProps, studioStore } from '../stores'
import { titleSplash } from './effects'

const Trivia = () => {
  const [isSplash, setisSplash] = useState<boolean>(true)

  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0)
  const [questions, setQuestions] = useState<string[]>([])
  const { fragment, isHost, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    setQuestions(
      fragment.configuration.properties.find(
        (property: any) => property.type === 'text[]'
      )?.value
    )
  }, [fragment?.configuration.properties])

  const controls =
    isHost && state === 'recording'
      ? [
          <ControlButton
            key="nextQuestion"
            icon={NextTokenIcon}
            className={cx('my-2 ', {
              hidden: activeQuestionIndex === questions.length - 1,
            })}
            appearance="primary"
            onClick={() => setActiveQuestionIndex(activeQuestionIndex + 1)}
          />,
        ]
      : [<></>]

  let layerChildren = [<></>]
  if (state === 'recording' && isSplash) {
    layerChildren = [
      <Group
        x={0}
        y={0}
        width={CONFIG.width}
        height={(CONFIG.width * 9) / 16}
        ref={(ref) =>
          ref?.to({
            duration: 3,
            onFinish: () => {
              setisSplash(false)
            },
          })
        }
      >
        {titleSplash(fragment?.name as string)}
      </Group>,
    ]
  } else if (state === 'recording') {
    layerChildren = [
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
  }

  return (
    <Concourse
      controls={controls}
      layerChildren={layerChildren}
      disableUserMedia={isSplash}
    />
  )
}

export default Trivia
