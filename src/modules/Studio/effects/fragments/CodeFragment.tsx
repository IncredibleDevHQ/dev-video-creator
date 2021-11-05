import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Circle, Group, Image, Rect } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { Fragment_Status_Enum_Enum } from '../../../../generated/graphql'
import {
  CodejamConfig,
  ConfigType,
  LayoutConfig,
} from '../../../../utils/configTypes'
import {
  MutipleRectMoveLeft,
  MutipleRectMoveRight,
} from '../FragmentTransitions'
import useCode from '../../hooks/use-code'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import Concourse, { CONFIG, TitleSplashProps } from '../../components/Concourse'
import RenderTokens, {
  CodeBlockConfig,
  codeConfig,
  FragmentState,
  getRenderedTokens,
  Position,
  RenderFocus,
} from '../../components/RenderTokens'

const CodeFragment = ({
  viewConfig,
  dataConfig,
  dataConfigLength,
  topLayerChildren,
  setTopLayerChildren,
  titleSplashData,
  fragmentState,
  setFragmentState,
  stageRef,
  layerRef,
}: {
  viewConfig: LayoutConfig
  dataConfig: CodejamConfig
  dataConfigLength: number
  topLayerChildren: JSX.Element[]
  setTopLayerChildren: React.Dispatch<React.SetStateAction<JSX.Element[]>>
  titleSplashData?: TitleSplashProps | undefined
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  layerRef: React.RefObject<Konva.Layer>
}) => {
  const { fragment, payload, updatePayload, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const { initUseCode, computedTokens } = useCode()
  // const [getTokenisedCode, { data }] = useGetTokenisedCodeLazyQuery()
  const [position, setPosition] = useState<Position>({
    prevIndex: -1,
    currentIndex: 0,
  })
  const [focusCode, setFocusCode] = useState<boolean>(false)

  const [studio, setStudio] = useRecoilState(studioStore)

  // ref to the object grp
  const customLayoutRef = useRef<Konva.Group>(null)

  // states used for codex format
  // a bool state which tells if its a codex format or not
  const [isCodexFormat, setIsCodexFormat] = useState<boolean>()
  // a state which stores the active block info like index
  const [activeBlockIndex, setActiveBlockIndex] = useState<number>(0)
  // a state to tell if the block of code is focused or not
  const [focusBlockCode, setFocusBlockCode] = useState<boolean>(false)
  const [highlightBlockCode, setHiglightBlockCode] = useState<boolean>(false)

  // config for focusing the lines of code in codex format
  const [blockConfig, setBlockConfig] = useState<CodeBlockConfig[]>([])

  // state which stores if its a short or not
  const [isShorts, setIsShorts] = useState<boolean>(false)

  const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')

  const [objectConfig, setObjectConfig] = useState<ObjectConfig>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    borderRadius: 0,
  })

  useEffect(() => {
    if (!dataConfig) return
    setObjectConfig(
      FragmentLayoutConfig({ layoutNumber: viewConfig.layoutNumber })
    )
  }, [dataConfig])

  useEffect(() => {
    initUseCode({
      tokens: dataConfig.value.colorCodes,
      canvasWidth: objectConfig.width - 120,
      canvasHeight: objectConfig.height - 36,
      gutter: 5,
      fontSize: codeConfig.fontSize,
    })
  }, [objectConfig])

  useEffect(() => {
    setStudio({
      ...studio,
      controlsConfig: {
        position,
        computedTokens: computedTokens.current,
        fragmentState,
        type: ConfigType.CODEJAM,
        dataConfigLength,
      },
    })
  }, [state, position, computedTokens, fragmentState])

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
      })
    }
    if (state === 'recording') {
      updatePayload?.({
        currentIndex: 1,
        prevIndex: 0,
        isFocus: false,
      })
    }
  }, [state])

  useEffect(() => {
    if (!customLayoutRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (fragmentState === 'customLayout') {
      setTopLayerChildren([
        <MutipleRectMoveRight
          rectOneColors={['#651CC8', '#9561DA']}
          rectTwoColors={['#FF5D01', '#B94301']}
          rectThreeColors={['#1F2937', '#778496']}
        />,
      ])
      customLayoutRef.current.to({
        opacity: 1,
        duration: 0.2,
      })
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (fragmentState === 'onlyUserMedia') {
      setTopLayerChildren([
        <MutipleRectMoveLeft
          rectOneColors={['#651CC8', '#9561DA']}
          rectTwoColors={['#FF5D01', '#B94301']}
          rectThreeColors={['#1F2937', '#778496']}
        />,
      ])
      customLayoutRef.current.to({
        opacity: 0,
        duration: 0.2,
      })
    }
  }, [fragmentState])

  const layerChildren: any[] = [
    <Group x={0} y={0}>
      {viewConfig.background.type === 'color' ? (
        <Rect
          x={0}
          y={0}
          width={CONFIG.width}
          height={CONFIG.height}
          fillLinearGradientColorStops={viewConfig.background.gradient?.values}
          fillLinearGradientStartPoint={
            viewConfig.background.gradient?.startIndex
          }
          fillLinearGradientEndPoint={viewConfig.background.gradient?.endIndex}
        />
      ) : (
        <Image
          x={0}
          y={0}
          width={CONFIG.width}
          height={CONFIG.height}
          image={bgImage}
        />
      )}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
      <Rect
        x={objectConfig.x}
        y={objectConfig.y}
        width={objectConfig.width}
        height={objectConfig.height}
        fill="#202026"
        cornerRadius={objectConfig.borderRadius}
      />
      <Group x={objectConfig.x + 20} y={objectConfig.y + 20} key="circleGroup">
        <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
        <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
        <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
      </Group>
      {payload?.status === Fragment_Status_Enum_Enum.Live && (
        <Group x={objectConfig.x + 25} y={objectConfig.y + 40} key="group">
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
          groupCoordinates={{ x: objectConfig.x + 10, y: objectConfig.y + 30 }}
          bgRectInfo={{
            x: objectConfig.x,
            y: objectConfig.y,
            width: objectConfig.width,
            height: objectConfig.height,
            radius: objectConfig.borderRadius,
          }}
        />
      )}
    </Group>,
  ]

  const studioUserConfig = StudioUserConfiguration({
    layoutNumber: viewConfig.layoutNumber,
    fragment,
    fragmentState,
  })

  return (
    <Concourse
      layerChildren={layerChildren}
      stageRef={stageRef}
      layerRef={layerRef}
      titleSplashData={titleSplashData}
      studioUserConfig={studioUserConfig}
      topLayerChildren={topLayerChildren}
    />
  )
}

export default CodeFragment
