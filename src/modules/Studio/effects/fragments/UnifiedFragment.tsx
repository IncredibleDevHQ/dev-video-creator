import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { User, userState } from '../../../../stores/user.store'
import {
  CodejamConfig,
  ConfigType,
  PointsConfig,
  TriviaConfig,
  VideojamConfig,
  ViewConfig,
} from '../../../../utils/configTypes'
import { StudioProviderProps, studioStore } from '../../stores'
import CodeFragment from './CodeFragment'
import { TitleSplashProps } from '../../components/Concourse'
import LowerThirds from '../../components/LowerThirds'
import PointsFragment from './PointsFragment'
import { FragmentState } from '../../components/RenderTokens'
import TriviaFragment from './TriviaFragment'
import VideoFragment from './VideoFragment'

const UnifiedFragment = ({
  stageRef,
  layerRef,
}: {
  stageRef: React.RefObject<Konva.Stage>
  layerRef: React.RefObject<Konva.Layer>
}) => {
  const { fragment, payload, updatePayload, state, participants, users } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSplashData, settitleSplashData] = useState<TitleSplashProps>({
    enable: false,
  })

  // data config holds all the info abt the object
  const [dataConfig, setDataConfig] =
    useState<(CodejamConfig | VideojamConfig | TriviaConfig | PointsConfig)[]>()
  // view config holds all the info abt the view of the canvas
  const [viewConfig, setViewConfig] = useState<ViewConfig>()
  // holds the index of the present object
  const [activeObjectIndex, setActiveObjectIndex] = useState(-1)

  // state of the fragment
  const [fragmentState, setFragmentState] =
    useState<FragmentState>('onlyUserMedia')

  // state which stores the layer children which have to be placed over the studio user
  const [topLayerChildren, setTopLayerChildren] = useState<JSX.Element[]>([])

  // holds the user's display name
  const { displayName } = (useRecoilValue(userState) as User) || {}

  // useEffect(() => {
  //   console.log('layerref', layerRef.current)
  // }, [layerRef])

  useEffect(() => {
    if (!fragment) return
    // setDataConfig(fragment?.configuration.dataConfig)
    // setViewConfig(fragment?.configuration.viewConfig)
    setDataConfig([
      {
        id: 'ijRZdrawIO_9_yqpYS76g',
        type: ConfigType.CODEJAM,
        title: '',
        value: {
          code: 'print("Hellow")',
          gistURL: '',
          isAutomated: false,
          language: 'python',
          explanations: [],
          colorCodes: [
            {
              color: '#D4D4D4',
              lineNumber: 0,
              content: 'W = tf.Variable(tf.ones([num_features, num_classes]), ',
            },
            { color: '#9CDCFE', lineNumber: 1, content: 'name' },
            { color: '#D4D4D4', lineNumber: 1, content: '=' },
            { color: '#CE9178', lineNumber: 1, content: '"weight"' },
            { color: '#D4D4D4', lineNumber: 1, content: ')' },
            { color: '#DCDCAA', lineNumber: 2, content: 'print' },
            { color: '#D4D4D4', lineNumber: 2, content: '(W)' },
            {
              color: '#D4D4D4',
              lineNumber: 3,
              content: 'W = tf.Variable(tf.ones([num_features, num_classes]), ',
            },
            { color: '#9CDCFE', lineNumber: 3, content: 'name' },
            { color: '#D4D4D4', lineNumber: 3, content: '=' },
            { color: '#CE9178', lineNumber: 3, content: '"weight"' },
            { color: '#D4D4D4', lineNumber: 3, content: ')' },
            { color: '#DCDCAA', lineNumber: 4, content: 'print' },
            { color: '#D4D4D4', lineNumber: 4, content: '(W)' },
            {
              color: '#D4D4D4',
              lineNumber: 5,
              content: 'b = tf.Variable(tf.zeros([num_classes]), ',
            },
            { color: '#9CDCFE', lineNumber: 5, content: 'name' },
            { color: '#D4D4D4', lineNumber: 5, content: '=' },
            { color: '#CE9178', lineNumber: 5, content: '"bias"' },
            { color: '#D4D4D4', lineNumber: 5, content: ')' },
            {
              color: '#D4D4D4',
              lineNumber: 6,
              content: 'b = tf.Variable(tf.zeros([num_classes]), ',
            },
            { color: '#9CDCFE', lineNumber: 6, content: 'name' },
            { color: '#D4D4D4', lineNumber: 6, content: '=' },
            { color: '#CE9178', lineNumber: 6, content: '"bias"' },
            { color: '#D4D4D4', lineNumber: 6, content: ')' },
          ],
        },
        notes: ['Notes for above code block'],
      },
      {
        id: 'aZHtrekf5WAF3FXMpHYWi',
        type: ConfigType.TRIVIA,
        title: 'Trivia/Slides Heading',
        value: {
          text: 'Question1',
        },
        notes: ['Notes for question1'],
      },
      {
        id: '8Wi1JpgnD86jMJI1mIvoO',
        type: ConfigType.TRIVIA,
        title: 'Trivia/Slides Heading',
        value: {
          text: 'Question2-Image',
          image: 'https://cdn.incredible.dev/idev-logo.svg',
        },
        notes: ['Notes for question2-image'],
      },
      {
        id: 'ebwwlXN-IPcl6xyPJVSVy',
        type: ConfigType.POINTS,
        title: 'Points',
        value: [
          {
            level: 0,
            text: 'Point1',
          },
          {
            level: 0,
            text: 'Point2',
          },
          {
            level: 0,
            text: 'Point3',
          },
        ],
        notes: ['Notes about points'],
      },
      {
        id: 'g45uLwBxRkGP3w8Zm9V4b',
        type: ConfigType.VIDEOJAM,
        title: 'VideoJam',
        value: {
          videoURL:
            'https://incredible-uploads-staging.s3.amazonaws.com/gmrY12qQHtlYH3JrqaEqp.webm',
        },
      },
    ])
    setViewConfig({
      hasTitleSplash: true,
      configs: [
        {
          id: '12345',
          type: ConfigType.VIDEOJAM,
          layoutNumber: 1,
          background: {
            type: 'color',
            gradient: {
              cssString:
                'linear-gradient(90deg, #D397FA 0%, #D397FA 0.01%, #8364E8 100%)',
              values: [0, '#D397FA', 0.0001, '#D397FA', 1, '#8364E8'],
              startIndex: {
                x: 0,
                y: 269.99999999999994,
              },
              endIndex: {
                x: 960,
                y: 270.00000000000006,
              },
            },
            image: '',
          },
        },
        {
          id: '123456',
          type: ConfigType.CODEJAM,
          layoutNumber: 1,
          background: {
            type: 'color',
            gradient: {
              cssString:
                'linear-gradient(90deg, #D397FA 0%, #D397FA 0.01%, #8364E8 100%)',
              values: [0, '#D397FA', 0.0001, '#D397FA', 1, '#8364E8'],
              startIndex: {
                x: 0,
                y: 269.99999999999994,
              },
              endIndex: {
                x: 960,
                y: 270.00000000000006,
              },
            },
            image: '',
          },
        },
        {
          id: '123456',
          type: ConfigType.CODEJAM,
          layoutNumber: 1,
          background: {
            type: 'color',
            gradient: {
              cssString:
                'linear-gradient(90deg, #D397FA 0%, #D397FA 0.01%, #8364E8 100%)',
              values: [0, '#D397FA', 0.0001, '#D397FA', 1, '#8364E8'],
              startIndex: {
                x: 0,
                y: 269.99999999999994,
              },
              endIndex: {
                x: 960,
                y: 270.00000000000006,
              },
            },
            image: '',
          },
        },
        {
          id: '123456',
          type: ConfigType.CODEJAM,
          layoutNumber: 1,
          background: {
            type: 'color',
            gradient: {
              cssString:
                'linear-gradient(90deg, #D397FA 0%, #D397FA 0.01%, #8364E8 100%)',
              values: [0, '#D397FA', 0.0001, '#D397FA', 1, '#8364E8'],
              startIndex: {
                x: 0,
                y: 269.99999999999994,
              },
              endIndex: {
                x: 960,
                y: 270.00000000000006,
              },
            },
            image: '',
          },
        },
        {
          id: '123456',
          type: ConfigType.CODEJAM,
          layoutNumber: 1,
          background: {
            type: 'color',
            gradient: {
              cssString:
                'linear-gradient(90deg, #D397FA 0%, #D397FA 0.01%, #8364E8 100%)',
              values: [0, '#D397FA', 0.0001, '#D397FA', 1, '#8364E8'],
              startIndex: {
                x: 0,
                y: 269.99999999999994,
              },
              endIndex: {
                x: 960,
                y: 270.00000000000006,
              },
            },
            image: '',
          },
        },
      ],
    })
    settitleSplashData({
      enable: true,
      title: fragment.name as string,
    })
    // enable: fragment?.configuration.viewConfig.hasTitleSplash,
    // bgRectColor: ['#140D1F', '#6E1DDB'],
    //   stripRectColor: ['#FF5D01', '#B94301'],
    //   textColor: ['#E6E6E6', '#FFFFFF'],
    updatePayload?.({
      activeObjectIndex: 0,
    })
  }, [fragment])

  useEffect(() => {
    setActiveObjectIndex(payload?.activeObjectIndex)
  }, [payload])

  useEffect(() => {
    if (state === 'ready') {
      updatePayload?.({
        fragmentState: 'onlyUserMedia',
      })
    }
    if (state === 'recording') {
      updatePayload?.({
        activeObjectIndex: 0,
        fragmentState: 'onlyUserMedia',
      })
      setTopLayerChildren([])
      setTimeout(() => {
        if (!displayName) return
        if (!fragment) return
        setTopLayerChildren([
          <LowerThirds
            x={lowerThirdCoordinates[0] || 0}
            y={450}
            userName={displayName}
            rectOneColors={['#651CC8', '#9561DA']}
            rectTwoColors={['#FF5D01', '#B94301']}
            rectThreeColors={['#1F2937', '#778496']}
          />,
          ...users.map((user, index) => (
            <LowerThirds
              x={lowerThirdCoordinates[index + 1] || 0}
              y={450}
              userName={participants?.[user.uid]?.displayName || ''}
              rectOneColors={['#651CC8', '#9561DA']}
              rectTwoColors={['#FF5D01', '#B94301']}
              rectThreeColors={['#1F2937', '#778496']}
            />
          )),
        ])
      }, 5000)
    }
  }, [state])

  const lowerThirdCoordinates = (() => {
    switch (fragment?.participants.length) {
      case 2:
        return [70, 530]
      case 3:
        return [45, 355, 665]
      default:
        return [70]
    }
  })()

  useEffect(() => {
    if (activeObjectIndex !== 0) settitleSplashData({ enable: false })
    else settitleSplashData({ enable: true, title: fragment?.name as string })
  }, [activeObjectIndex])

  if (!dataConfig || !viewConfig || dataConfig.length === 0) return <></>
  return (
    <>
      {(() => {
        switch (dataConfig[activeObjectIndex]?.type) {
          case ConfigType.CODEJAM: {
            return (
              <CodeFragment
                dataConfig={dataConfig[activeObjectIndex] as CodejamConfig}
                viewConfig={viewConfig.configs[activeObjectIndex]}
                dataConfigLength={dataConfig.length}
                topLayerChildren={topLayerChildren}
                setTopLayerChildren={setTopLayerChildren}
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                layerRef={layerRef}
              />
            )
          }
          case ConfigType.VIDEOJAM: {
            return (
              <VideoFragment
                dataConfig={dataConfig[activeObjectIndex] as VideojamConfig}
                viewConfig={viewConfig.configs[activeObjectIndex]}
                dataConfigLength={dataConfig.length}
                topLayerChildren={topLayerChildren}
                setTopLayerChildren={setTopLayerChildren}
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                layerRef={layerRef}
              />
            )
          }
          case ConfigType.TRIVIA: {
            return (
              <TriviaFragment
                dataConfig={dataConfig[activeObjectIndex] as TriviaConfig}
                viewConfig={viewConfig.configs[activeObjectIndex]}
                dataConfigLength={dataConfig.length}
                topLayerChildren={topLayerChildren}
                setTopLayerChildren={setTopLayerChildren}
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                layerRef={layerRef}
              />
            )
          }
          case ConfigType.POINTS: {
            return (
              <PointsFragment
                dataConfig={dataConfig[activeObjectIndex] as PointsConfig}
                viewConfig={viewConfig.configs[activeObjectIndex]}
                dataConfigLength={dataConfig.length}
                topLayerChildren={topLayerChildren}
                setTopLayerChildren={setTopLayerChildren}
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                layerRef={layerRef}
              />
            )
          }
          default:
            return <></>
        }
      })()}
    </>
  )
}

export default UnifiedFragment
