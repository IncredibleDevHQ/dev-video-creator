import axios from 'axios'
import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Circle, Group, Rect } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import { CodeBlockProps } from '../../../../components/TextEditor/utils'
import * as gConfig from '../../../../config'
import { Fragment_Status_Enum_Enum } from '../../../../generated/graphql'
import firebaseState from '../../../../stores/firebase.store'
import { CommentExplanations, ConfigType } from '../../../../utils/configTypes'
import { BlockProperties } from '../../../../utils/configTypes2'
import Concourse, {
  CONFIG,
  SHORTS_CONFIG,
  TitleSplashProps,
} from '../../components/Concourse'
import RenderTokens, {
  codeConfig,
  FragmentState,
  getRenderedTokens,
  getTokens,
  Position,
  RenderFocus,
  RenderMultipleLineFocus,
} from '../../components/RenderTokens'
import useCode, { ComputedToken } from '../../hooks/use-code'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import { TrianglePathTransition } from '../FragmentTransitions'

const getColorCodes = async (
  code: string,
  language: string,
  userToken: string
) => {
  return axios.post(
    gConfig.default.hasura.server,
    {
      query: `
          query GetTokenisedCode(
            $code: String!
            $language: String!
            $theme: String
          ) {
            TokenisedCode(code: $code, language: $language, theme: $theme) {
              success
              data
            }
          }
        `,
      variables: {
        code: code || '',
        language: language || 'javascript',
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${userToken}`,
      },
    }
  )
}

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
  shortsMode,
}: {
  viewConfig: BlockProperties
  dataConfig: CodeBlockProps
  dataConfigLength: number
  topLayerChildren: JSX.Element[]
  setTopLayerChildren: React.Dispatch<React.SetStateAction<JSX.Element[]>>
  titleSplashData?: TitleSplashProps | undefined
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  layerRef: React.RefObject<Konva.Layer>
  shortsMode: boolean
}) => {
  const { fragment, payload, updatePayload, state, addMusic } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const { initUseCode } = useCode()
  const [computedTokens, setComputedTokens] = useState<ComputedToken[]>([])
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
  const [blockConfig, setBlockConfig] = useState<CommentExplanations[]>([])

  // // state which stores if its a short or not
  // const [isShorts, setIsShorts] = useState<boolean>(false)

  // const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')

  const [objectConfig, setObjectConfig] = useState<ObjectConfig>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    borderRadius: 0,
  })

  const [colorCodes, setColorCodes] = useState<any>([])

  const user = useRecoilValue(firebaseState)

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  useEffect(() => {
    if (!shortsMode) setStageConfig(CONFIG)
    else setStageConfig(SHORTS_CONFIG)
  }, [shortsMode])

  useEffect(() => {
    if (!dataConfig) return
    setObjectConfig(
      FragmentLayoutConfig({
        layout: viewConfig.layout || 'classic',
        isShorts: shortsMode || false,
      })
    )
    setIsCodexFormat(dataConfig.codeBlock.isAutomated || false)
    const blocks = Object.assign([], dataConfig.codeBlock.explanations || [])
    blocks.unshift({ from: 0, to: 0, explanation: '' })
    setBlockConfig(blocks)
    setTopLayerChildren([])
    ;(async () => {
      try {
        const { data } = await getColorCodes(
          dataConfig.codeBlock.code || '',
          dataConfig.codeBlock.language || '',
          user.token ||
            'eyJhbGciOiJSUzI1NiIsImtpZCI6IjgwNTg1Zjk5MjExMmZmODgxMTEzOTlhMzY5NzU2MTc1YWExYjRjZjkiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiU3V2aWogU3VyeWEiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EtL0FPaDE0R2o1ZV9YTEFMTzlrVnVpblpLdGJnZTFoZDZhWmM4blBpUVpORUJTeFE9czk2LWMiLCJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWRlZmF1bHQtcm9sZSI6InVzZXIiLCJ4LWhhc3VyYS1hbGxvd2VkLXJvbGVzIjpbInVzZXIiXSwieC1oYXN1cmEtdXNlci1pZCI6IkVYSHZjZHVCcW9WZzYwdzl5b3UzdmlEellWTDIifSwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL2luY3JlZGlibGVkZXYtbmV4dC1zdGFnaW5nIiwiYXVkIjoiaW5jcmVkaWJsZWRldi1uZXh0LXN0YWdpbmciLCJhdXRoX3RpbWUiOjE2Mzg3MDU3MDEsInVzZXJfaWQiOiJFWEh2Y2R1QnFvVmc2MHc5eW91M3ZpRHpZVkwyIiwic3ViIjoiRVhIdmNkdUJxb1ZnNjB3OXlvdTN2aUR6WVZMMiIsImlhdCI6MTYzODcxMDI0NSwiZXhwIjoxNjM4NzEzODQ1LCJlbWFpbCI6InN1dmlqc3VyeWE3NkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjEwMjcxMzc0NDQ5MTY0MjM2NjA1NSJdLCJlbWFpbCI6WyJzdXZpanN1cnlhNzZAZ21haWwuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoiY3VzdG9tIn19.fh9IgxWdgiK7W1L5wQau5Rfqh2DDWyi5uAilxQe0pxfNoMR7I2RrOhWYdvKFcRcrDJRXbdLhvq7XjMZY4Utj1qT_DwYDh34BCr9bnQWoThCnaCEprLVXZL1V-IW1DiVnFZ5RNyhZk7-8nCe2HkvfWwnOXxSkdnboSTY16Vfv-a-V1P5b-2Q8ohX8Im6ScezTsymkLMTLRAh_bGRCW-9xVAV1UrKOySU9vSIfHecIqCT_WRHOCQaaNWWAoR0Ka17WjptLTdnrCq_FaMKxyS7gH6nEy_QxvHW-vIdVUNUOmVpbDrM7JsRdpXoomZFwnhzCEyIYKfXkJ00kItrFU8FQbQ'
        )
        if (!data?.errors) setColorCodes(data.data.TokenisedCode.data)
      } catch (e) {
        console.error(e)
        throw e
      }
    })()
  }, [dataConfig, shortsMode, viewConfig])

  useEffect(() => {
    if (!colorCodes) return
    setComputedTokens(
      initUseCode({
        tokens: colorCodes,
        canvasWidth: objectConfig.width - 120,
        canvasHeight: objectConfig.height - 36,
        gutter: 5,
        fontSize: codeConfig.fontSize,
      })
    )
  }, [colorCodes, objectConfig])

  useEffect(() => {
    setStudio({
      ...studio,
      controlsConfig: {
        position,
        computedTokens,
        fragmentState,
        isCodexFormat,
        noOfBlocks: blockConfig.length,
        type: ConfigType.CODEJAM,
        dataConfigLength,
      },
    })
  }, [
    state,
    position,
    computedTokens,
    fragmentState,
    isCodexFormat,
    blockConfig,
  ])

  useEffect(() => {
    setPosition({
      prevIndex: payload?.prevIndex || 0,
      currentIndex: payload?.currentIndex || 1,
    })
    setFocusCode(payload?.isFocus)
    if (isCodexFormat) {
      setActiveBlockIndex(payload?.activeBlockIndex)
      if (payload?.focusBlockCode) {
        setHiglightBlockCode(payload?.focusBlockCode)
        setTimeout(() => {
          setFocusBlockCode(payload?.focusBlockCode)
        }, 1000)
      } else {
        setFocusBlockCode(payload?.focusBlockCode)
        setTimeout(() => {
          setHiglightBlockCode(payload?.focusBlockCode)
        }, 1000)
      }
    }
  }, [payload])

  useEffect(() => {
    if (state === 'ready') {
      setPosition({
        prevIndex: -1,
        currentIndex: 0,
      })
      if (!isCodexFormat)
        updatePayload?.({
          currentIndex: 1,
          prevIndex: 0,
          isFocus: false,
        })
      else
        updatePayload?.({
          currentIndex: 1,
          prevIndex: 0,
          isFocus: false,
          focusBlockCode: false,
          activeBlockIndex: 0,
        })
    }
    if (state === 'recording') {
      if (!isCodexFormat)
        updatePayload?.({
          currentIndex: 1,
          prevIndex: 0,
          isFocus: false,
        })
      else
        updatePayload?.({
          currentIndex: 1,
          prevIndex: 0,
          isFocus: false,
          focusBlockCode: false,
          activeBlockIndex: 0,
        })
    }
  }, [state, isCodexFormat])

  useEffect(() => {
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (payload?.fragmentState === 'customLayout') {
      setTopLayerChildren([
        <TrianglePathTransition isShorts={shortsMode} direction="right" />,
      ])
      addMusic()
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 1,
          duration: 0.2,
        })
      }, 800)
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (payload?.fragmentState === 'onlyUserMedia') {
      setTopLayerChildren([
        <TrianglePathTransition isShorts={shortsMode} direction="left" />,
      ])
      addMusic()
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 0,
          duration: 0.2,
        })
      }, 800)
    }
  }, [payload?.fragmentState])

  const layerChildren: any[] = [
    <Group x={0} y={0}>
      {/* {viewConfig.background.type === 'color' ? ( */}
      <Rect
        x={0}
        y={0}
        width={stageConfig.width}
        height={stageConfig.height}
        fillLinearGradientColorStops={viewConfig.gradient?.values}
        fillLinearGradientStartPoint={viewConfig.gradient?.startIndex}
        fillLinearGradientEndPoint={viewConfig.gradient?.endIndex}
      />
      {/* ) : (
        <Image
          x={0}
          y={0}
          width={stageConfig.width}
          height={stageConfig.height}
          image={bgImage}
        />
      )} */}
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
        <Group x={objectConfig.x + 25} y={objectConfig.y + 35} key="group">
          {!isCodexFormat ? (
            <>
              {getRenderedTokens(computedTokens, position)}
              {computedTokens.length > 0 && (
                <RenderTokens
                  key={position.prevIndex}
                  tokens={computedTokens}
                  startIndex={position.prevIndex}
                  endIndex={position.currentIndex}
                />
              )}
            </>
          ) : (
            <>
              {getTokens(
                computedTokens,
                computedTokens[
                  computedTokens.find(
                    (token) =>
                      token.lineNumber ===
                        (blockConfig &&
                          blockConfig[activeBlockIndex] &&
                          blockConfig[activeBlockIndex].from) || 0
                  )?.startFromIndex || 0
                ]?.lineNumber,
                objectConfig.height - 40
              )}
              {highlightBlockCode && (
                <Rect
                  x={-5}
                  y={
                    (computedTokens.find(
                      (token) =>
                        token.lineNumber ===
                        (blockConfig &&
                          blockConfig[activeBlockIndex] &&
                          blockConfig[activeBlockIndex].from)
                    )?.y || 0) - 5
                  }
                  width={objectConfig.width - 40}
                  height={
                    (computedTokens.find(
                      (token) =>
                        token.lineNumber ===
                        (blockConfig &&
                          blockConfig[activeBlockIndex] &&
                          blockConfig[activeBlockIndex].to)
                    )?.y || 0) -
                      (computedTokens.find(
                        (token) =>
                          token.lineNumber ===
                          (blockConfig &&
                            blockConfig[activeBlockIndex] &&
                            blockConfig[activeBlockIndex].from)
                      )?.y || 0) +
                      codeConfig.fontSize +
                      5 >
                    0
                      ? (computedTokens.find(
                          (token) =>
                            token.lineNumber ===
                            (blockConfig &&
                              blockConfig[activeBlockIndex] &&
                              blockConfig[activeBlockIndex].to)
                        )?.y || 0) -
                        (computedTokens.find(
                          (token) =>
                            token.lineNumber ===
                            (blockConfig &&
                              blockConfig[activeBlockIndex] &&
                              blockConfig[activeBlockIndex].from)
                        )?.y || 0) +
                        codeConfig.fontSize +
                        10
                      : 0
                  }
                  fill="#0066B8"
                  opacity={0.3}
                  cornerRadius={8}
                />
              )}
            </>
          )}
        </Group>
      )}
      {focusCode && (
        <RenderFocus
          tokens={computedTokens}
          lineNumber={computedTokens[position.prevIndex]?.lineNumber}
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
      {focusBlockCode && (
        <RenderMultipleLineFocus
          tokens={computedTokens}
          startLineNumber={
            (blockConfig &&
              blockConfig[activeBlockIndex] &&
              blockConfig[activeBlockIndex].from) ||
            0
          }
          endLineNumber={
            (blockConfig &&
              blockConfig[activeBlockIndex] &&
              blockConfig[activeBlockIndex].to) ||
            0
          }
          explanation={
            (blockConfig &&
              blockConfig[activeBlockIndex] &&
              blockConfig[activeBlockIndex].explanation) ||
            ''
          }
          groupCoordinates={{ x: objectConfig.x + 10, y: objectConfig.y + 10 }}
          bgRectInfo={{
            x: objectConfig.x,
            y: objectConfig.y,
            width: objectConfig.width,
            height: objectConfig.height,
            radius: objectConfig.borderRadius,
          }}
          opacity={1}
        />
      )}
    </Group>,
  ]

  const studioUserConfig = StudioUserConfiguration({
    layout: viewConfig.layout || 'classic',
    fragment,
    fragmentState,
    isShorts: shortsMode || false,
  })

  return (
    <Concourse
      layerChildren={layerChildren}
      stageRef={stageRef}
      layerRef={layerRef}
      titleSplashData={titleSplashData}
      studioUserConfig={studioUserConfig}
      topLayerChildren={topLayerChildren}
      isShorts={shortsMode}
    />
  )
}

export default CodeFragment
