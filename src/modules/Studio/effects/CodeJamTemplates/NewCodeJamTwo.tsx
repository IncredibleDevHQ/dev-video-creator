import axios from 'axios'
import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Circle, Group, Image, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../../config'
import { API } from '../../../../constants'
import {
  Fragment_Status_Enum_Enum,
  useGetTokenisedCodeLazyQuery,
} from '../../../../generated/graphql'
import { Concourse } from '../../components'
import {
  CONFIG,
  StudioUserConfig,
  TitleSplashProps,
} from '../../components/Concourse'
import RenderTokens, {
  controls,
  FragmentState,
  getRenderedTokens,
  RenderFocus,
} from '../../components/RenderTokens'
import useCode from '../../hooks/use-code'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  MutipleRectMoveLeft,
  MutipleRectMoveRight,
} from '../FragmentTransitions'

export const codeConfig = {
  fontSize: 14,
  width: 960,
  height: 540,
}

interface Position {
  prevIndex: number
  currentIndex: number
}

const NewCodeJamTwo = () => {
  const { fragment, payload, updatePayload, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSpalshData, settitleSpalshData] = useState<TitleSplashProps>({
    enable: false,
  })

  const { initUseCode, computedTokens } = useCode()
  const [getTokenisedCode, { data }] = useGetTokenisedCodeLazyQuery()
  const [position, setPosition] = useState<Position>({
    prevIndex: -1,
    currentIndex: 0,
  })
  const [focusCode, setFocusCode] = useState<boolean>(false)

  const [incredibleLogo] = useImage(
    `${config.storage.baseUrl}x-incredible.svg`,
    'anonymous'
  )
  const [circleGroup] = useImage(
    `${config.storage.baseUrl}black-circles.svg`,
    'anonymous'
  )
  const [graphqlLogo] = useImage(
    `${config.storage.baseUrl}graphql3.svg`,
    'anonymous'
  )

  // state of the fragment
  const [fragmentState, setFragmentState] =
    useState<FragmentState>('onlyUserMedia')

  // state which stores the layer children which have to be placed over the studio user
  const [topLayerChildren, setTopLayerChildren] = useState<JSX.Element[]>([])

  const bothGroupRef = useRef<Konva.Group>(null)
  // const onlyUserMediaGroupRef = useRef<Konva.Group>(null)
  const onlyFragmentGroupRef = useRef<Konva.Group>(null)

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    const gistURL = fragment.configuration.properties.find(
      (property: any) => property.key === 'gistUrl'
    )?.value

    // setConfig of titleSpalsh
    settitleSpalshData({
      enable: fragment.configuration.properties.find(
        (property: any) => property.key === 'showTitleSplash'
      )?.value,
      title: fragment.name as string,
      bgRectColor: ['#1F2937', '#1F2937'],
      stripRectColor: ['#e535ab', '#e535ab'],
      textColor: ['#ffffff', '#ffffff'],
    })

    if (!gistURL) throw new Error('Missing gist URL')
    ;(async () => {
      try {
        const { data } = await axios.get(
          `${API.GITHUB.BASE_URL}gists/${(gistURL as string).split('/').pop()}`
        )
        const file = data.files[Object.keys(data.files)[0]]
        getTokenisedCode({
          variables: {
            code: file.content,
            language: (file.language as string).toLowerCase(),
          },
        })
      } catch (e) {
        console.error(e)
        throw e
      }
    })()
  }, [fragment?.configuration.properties])

  useEffect(() => {
    if (!data?.TokenisedCode) return
    initUseCode({
      tokens: data.TokenisedCode.data,
      canvasWidth: 585,
      canvasHeight: 360,
      gutter: 5,
      fontSize: codeConfig.fontSize,
    })
  }, [data])

  useEffect(() => {
    setPosition({
      prevIndex: payload?.prevIndex || 0,
      currentIndex: payload?.currentIndex || 1,
    })
    setFocusCode(payload?.isFocus)
    setFragmentState(payload?.fragmentState)
  }, [payload])

  useEffect(() => {
    if (state === 'ready') {
      setPosition({
        prevIndex: -1,
        currentIndex: 0,
      })
      updatePayload?.({
        currentIndex: 1,
        prevIndex: 0,
        isFocus: false,
        fragmentState: 'onlyUserMedia',
      })
      setFragmentState('onlyUserMedia')
    }
    if (state === 'recording') {
      setFragmentState('onlyUserMedia')
      updatePayload?.({
        currentIndex: 1,
        prevIndex: 0,
        isFocus: false,
        fragmentState: 'onlyUserMedia',
      })
    }
  }, [state])

  useEffect(() => {
    if (!onlyFragmentGroupRef.current || !bothGroupRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (fragmentState === 'onlyFragment') {
      setTopLayerChildren([
        <MutipleRectMoveRight
          rectOneColors={['#60A5FA', '#60A5FA']}
          rectTwoColors={['#C084FC', '#C084FC']}
          rectThreeColors={['#4FD1C5', '#4FD1C5']}
        />,
      ])
      onlyFragmentGroupRef.current.to({
        opacity: 1,
        duration: 0.2,
      })
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (fragmentState === 'onlyUserMedia') {
      setTopLayerChildren([
        <MutipleRectMoveLeft
          rectOneColors={['#60A5FA', '#60A5FA']}
          rectTwoColors={['#C084FC', '#C084FC']}
          rectThreeColors={['#4FD1C5', '#4FD1C5']}
        />,
      ])
      onlyFragmentGroupRef.current.to({
        opacity: 0,
        duration: 0.2,
      })
      bothGroupRef.current.to({
        opacity: 0,
        duration: 0.2,
      })
    }
    // Checking if the current state is both and making the opacity of the only both group 1
    if (fragmentState === 'both') {
      bothGroupRef.current.to({
        opacity: 1,
        duration: 0.2,
      })
    }
  }, [fragmentState])

  // returns all the information to render the studio user based on the fragment state and the number of fragment participants
  const studioCoordinates: StudioUserConfig[] = (() => {
    switch (fragment?.participants.length) {
      case 2:
        if (fragmentState === 'both')
          return [
            {
              x: 735,
              y: 60,
              width: 240,
              height: 180,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 40,
                y: 0,
                width: 160,
                height: 180,
                radius: 8,
              },
              backgroundRectX: 765,
              backgroundRectY: 50,
              backgroundRectColor: '#C084FC',
            },
            {
              x: 735,
              y: 265,
              width: 240,
              height: 180,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 40,
                y: 0,
                width: 160,
                height: 180,
                radius: 8,
              },
              backgroundRectX: 765,
              backgroundRectY: 255,
              backgroundRectColor: '#4FD1C5',
            },
          ]
        if (fragmentState === 'onlyUserMedia')
          return [
            {
              x: -40,
              y: 25,
              width: 600,
              height: 450,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 100,
                y: 5,
                width: 400,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 50,
              backgroundRectY: 20,
              backgroundRectColor: '#C084FC',
            },
            {
              x: 420,
              y: 25,
              width: 600,
              height: 450,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 100,
                y: 5,
                width: 400,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 510,
              backgroundRectY: 20,
              backgroundRectColor: '#4FD1C5',
            },
          ]
        return [
          {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              radius: 0,
            },
            backgroundRectX: 0,
            backgroundRectY: 0,
          },
          {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              radius: 0,
            },
            backgroundRectX: 0,
            backgroundRectY: 0,
          },
        ]
      case 3:
        if (fragmentState === 'both')
          return [
            {
              x: 775,
              y: 58.5,
              width: 160,
              height: 120,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 160,
                height: 120,
                radius: 8,
              },
              backgroundRectX: 765,
              backgroundRectY: 48.5,
              backgroundRectColor: '#C084FC',
            },
            {
              x: 775,
              y: 198.5,
              width: 160,
              height: 120,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 160,
                height: 120,
                radius: 8,
              },
              backgroundRectX: 765,
              backgroundRectY: 188.5,
              backgroundRectColor: '#4FD1C5',
            },
            {
              x: 775,
              y: 338.5,
              width: 160,
              height: 120,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 160,
                height: 120,
                radius: 8,
              },
              backgroundRectX: 765,
              backgroundRectY: 328.5,
              backgroundRectColor: '#FCA5A5',
            },
          ]
        if (fragmentState === 'onlyUserMedia')
          return [
            {
              x: -125,
              y: 25,
              width: 600,
              height: 450,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 160,
                y: 5,
                width: 280,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 25,
              backgroundRectY: 20,
              backgroundRectColor: '#C084FC',
            },
            {
              x: 185,
              y: 25,
              width: 600,
              height: 450,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 160,
                y: 5,
                width: 280,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 335,
              backgroundRectY: 20,
              backgroundRectColor: '#4FD1C5',
            },
            {
              x: 495,
              y: 25,
              width: 600,
              height: 450,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 160,
                y: 5,
                width: 280,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 645,
              backgroundRectY: 20,
              backgroundRectColor: '#FCA5A5',
            },
          ]
        return [
          {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              radius: 0,
            },
            backgroundRectX: 0,
            backgroundRectY: 0,
          },
          {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              radius: 0,
            },
            backgroundRectX: 0,
            backgroundRectY: 0,
          },
          {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              radius: 0,
            },
            backgroundRectX: 0,
            backgroundRectY: 0,
          },
        ]
      default:
        if (fragmentState === 'both')
          return [
            {
              x: 695,
              y: 120.5,
              width: 320,
              height: 240,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 80,
                y: 0,
                width: 160,
                height: 240,
                radius: 8,
              },
              backgroundRectX: 765,
              backgroundRectY: 110.5,
              backgroundRectColor: '#C084FC',
            },
          ]
        if (fragmentState === 'onlyUserMedia') {
          return [
            {
              x: 85,
              y: -50,
              width: 800,
              height: 600,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 0,
                y: 80,
                width: 800,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 75,
              backgroundRectY: 20,
              backgroundRectColor: '#C084FC',
            },
          ]
        }
        return [
          {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              radius: 0,
            },
            backgroundRectX: 0,
            backgroundRectY: 0,
          },
        ]
    }
  })()

  const layerChildren = [
    <Group x={0} y={0}>
      <Rect
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fill="#1F2937"
      />
      <Image image={circleGroup} x={400} y={450} />
      <Image image={incredibleLogo} x={30} y={CONFIG.height - 50} />
      <Image image={graphqlLogo} x={840} y={CONFIG.height - 48} />
    </Group>,
    <Group x={0} y={0} opacity={0} ref={bothGroupRef}>
      <Rect
        x={27}
        y={48}
        width={704}
        height={396}
        fill="#60A5FA"
        cornerRadius={8}
      />
      <Rect
        x={37}
        y={58}
        width={704}
        height={396}
        fill="#202026"
        cornerRadius={8}
      />
      <Group x={52} y={73} key="circleGroup">
        <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
        <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
        <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
      </Group>
      {payload?.status === Fragment_Status_Enum_Enum.Live && (
        <Group x={57} y={88} key="group">
          {getRenderedTokens(computedTokens.current, position)}
          {computedTokens.current.length > 0 && (
            <RenderTokens
              key={position.prevIndex}
              tokens={computedTokens.current}
              startIndex={position.prevIndex}
              endIndex={position.currentIndex}
            />
          )}
        </Group>
      )}
      {focusCode && (
        <RenderFocus
          tokens={computedTokens.current}
          lineNumber={computedTokens.current[position.prevIndex]?.lineNumber}
          currentIndex={position.currentIndex}
          groupCoordinates={{ x: 47, y: 88 }}
          bgRectInfo={{
            x: 37,
            y: 58,
            width: 704,
            height: 396,
            radius: 8,
          }}
        />
      )}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={onlyFragmentGroupRef}>
      <Rect
        x={70}
        y={20}
        width={800}
        height={440}
        fill="#60A5FA"
        cornerRadius={8}
      />
      <Rect
        x={80}
        y={30}
        width={800}
        height={440}
        fill="#202026"
        cornerRadius={8}
      />
      <Group x={100} y={45} key="circleGroup">
        <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
        <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
        <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
      </Group>
      {payload?.status === Fragment_Status_Enum_Enum.Live && (
        <Group x={105} y={60} key="group">
          {getRenderedTokens(computedTokens.current, position)}
          {computedTokens.current.length > 0 && (
            <RenderTokens
              key={position.prevIndex}
              tokens={computedTokens.current}
              startIndex={position.prevIndex}
              endIndex={position.currentIndex}
            />
          )}
        </Group>
      )}
      {focusCode && (
        <RenderFocus
          tokens={computedTokens.current}
          lineNumber={computedTokens.current[position.prevIndex]?.lineNumber}
          currentIndex={position.currentIndex}
          groupCoordinates={{ x: 90, y: 60 }}
          bgRectInfo={{
            x: 80,
            y: 30,
            width: 800,
            height: 440,
            radius: 8,
          }}
        />
      )}
    </Group>,
  ]

  return (
    <Concourse
      layerChildren={layerChildren}
      controls={controls(
        setFocusCode,
        position,
        computedTokens.current,
        fragmentState,
        setFragmentState
      )}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioCoordinates}
      topLayerChildren={topLayerChildren}
    />
  )
}

export default NewCodeJamTwo
