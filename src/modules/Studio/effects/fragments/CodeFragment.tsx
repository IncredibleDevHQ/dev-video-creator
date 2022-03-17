import axios from 'axios'
import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { Group } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import * as gConfig from '../../../../config'
import firebaseState from '../../../../stores/firebase.store'
import {
  BlockProperties,
  CodeAnimation,
  CodeBlockView,
  CodeBlockViewProps,
  CodeHighlightConfig,
  CodeTheme,
} from '../../../../utils/configTypes'
import { CodeBlockProps } from '../../../Flick/editor/utils/utils'
import Concourse from '../../components/Concourse'
import FragmentBackground from '../../components/FragmentBackground'
import RenderTokens, {
  FragmentState,
  getAllLineNumbers,
  getRenderedTokens,
  getTokens,
  Position,
  RenderHighlight,
} from '../../components/RenderTokens'
import useCode, { ComputedToken } from '../../hooks/use-code'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import {
  ShortsStudioUserConfiguration,
  StudioUserConfiguration,
} from '../../utils/StudioUserConfig'
import { ObjectRenderConfig, ThemeLayoutConfig } from '../../utils/ThemeConfig'

export const getColorCodes = async (
  code: string,
  language: string,
  userToken: string,
  codeTheme: CodeTheme
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
        code,
        language: language || 'javascript',
        theme: codeTheme,
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

export const getSurfaceColor = ({ codeTheme }: { codeTheme: CodeTheme }) => {
  switch (codeTheme) {
    case 'light_vs':
      return '#ffffff'
    case 'light_plus':
      return '#ffffff'
    case 'quietlight':
      return '#f5f5f5'
    case 'solarized_light':
      return '#FDF6E3'
    case 'abyss':
      return '#000C18'
    case 'dark_vs':
      return '#1E1E1E'
    case 'dark_plus':
      return '#1E1E1E'
    case 'kimbie_dark':
      return '#221A0F'
    case 'monokai':
      return '#272822'
    case 'monokai_dimmed':
      return '#1E1E1E'
    case 'red':
      return '#390000'
    case 'solarized_dark':
      return '#002B36'
    case 'tomorrow_night_blue':
      return '#002451'
    case 'hc_black':
      return '#000000'
    default:
      return '#1E1E1E'
  }
}

const CodeFragment = ({
  viewConfig,
  dataConfig,
  fragmentState,
  setFragmentState,
  stageRef,
  shortsMode,
  isPreview,
}: {
  viewConfig: BlockProperties
  dataConfig: CodeBlockProps
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  shortsMode: boolean
  isPreview: boolean
}) => {
  const { fragment, payload, updatePayload, state, theme } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const { initUseCode } = useCode()
  const [computedTokens, setComputedTokens] = useState<ComputedToken[][]>([[]])
  const [position, setPosition] = useState<Position>({
    prevIndex: -1,
    currentIndex: 0,
  })
  // const [focusCode, setFocusCode] = useState<boolean>(false)

  const [studio, setStudio] = useRecoilState(studioStore)

  // ref to the object grp
  const customLayoutRef = useRef<Konva.Group>(null)

  const codeGroupRef = useRef<Konva.Group>(null)

  // states used for codex format
  // a bool state which tells if its a codex format or not
  const [codeAnimation, setCodeAnimation] = useState<CodeAnimation>()
  // a state which stores the active block info like index
  const [activeBlockIndex, setActiveBlockIndex] = useState<number>(0)
  // a state to tell if the block of code is focused or not
  // const [focusBlockCode, setFocusBlockCode] = useState<boolean>(false)
  const [highlightBlockCode, setHiglightBlockCode] = useState<boolean>(false)

  // config for focusing the lines of code in codex format
  const [blockConfig, setBlockConfig] = useState<CodeHighlightConfig[]>([])

  const [objectConfig, setObjectConfig] = useState<ObjectConfig>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    borderRadius: 0,
  })

  const [objectRenderConfig, setObjectRenderConfig] =
    useState<ObjectRenderConfig>({
      startX: 0,
      startY: 0,
      availableWidth: 0,
      availableHeight: 0,
      textColor: '',
      surfaceColor: '',
    })

  const [colorCodes, setColorCodes] = useState<any>([])
  const [codeTheme, setCodeTheme] = useState<CodeTheme>(CodeTheme.DarkPlus)
  const [fontSize, setFontSize] = useState<number>(16)

  // const [lineNumbers, setLineNumbers] = useState<number[]>([])

  const { auth } = useRecoilValue(firebaseState)
  const [user] = useAuthState(auth)

  useEffect(() => {
    if (!dataConfig) return
    setColorCodes([])
    setComputedTokens([[]])
    updatePayload?.({
      currentIndex: 0,
      prevIndex: -1,
      isFocus: false,
      focusBlockCode: false,
      activeBlockIndex: 0,
    })
    setObjectConfig(
      FragmentLayoutConfig({
        theme,
        layout: viewConfig?.layout || 'classic',
        isShorts: shortsMode || false,
      })
    )
    const codeBlockViewProps: CodeBlockViewProps = (
      viewConfig?.view as CodeBlockView
    )?.code
    ;(async () => {
      if (dataConfig.codeBlock.colorCodes) {
        setColorCodes(dataConfig.codeBlock.colorCodes)
      } else {
        try {
          if (dataConfig.codeBlock.code) {
            const token = await user?.getIdToken()
            const { data } = await getColorCodes(
              dataConfig.codeBlock.code,
              dataConfig.codeBlock.language || '',
              token || '',
              codeBlockViewProps?.theme
            )
            if (!data?.errors) setColorCodes(data.data.TokenisedCode.data)
          }
        } catch (e) {
          console.error(e)
          throw e
        }
      }
    })()
    setCodeAnimation(codeBlockViewProps?.animation)
    setCodeTheme(codeBlockViewProps?.theme)
    if (codeBlockViewProps?.fontSize) setFontSize(codeBlockViewProps.fontSize)
    const blocks = Object.assign([], codeBlockViewProps?.highlightSteps || [])
    blocks.unshift({ from: 0, to: 0, fileIndex: 0, lineNumbers: [] })
    // const blocks = [
    //   { lineNumbers: [] },
    //   { lineNumbers: [0] },
    //   { lineNumbers: [2, 5] },
    //   { lineNumbers: [3, 4] },
    //   // { lineNumbers: [3] },
    // ]
    setBlockConfig(blocks)
  }, [dataConfig, shortsMode, viewConfig, theme])

  useEffect(() => {
    setObjectRenderConfig(
      ThemeLayoutConfig({ theme, layoutConfig: objectConfig })
    )
  }, [objectConfig, theme])

  useEffect(() => {
    if (colorCodes.length === 0) return
    setComputedTokens(
      initUseCode({
        tokens: [colorCodes],
        canvasWidth: objectConfig.width - 140,
        canvasHeight: objectRenderConfig.availableHeight - 35,
        gutter: 8,
        fontSize,
        codeAnimation: codeAnimation || CodeAnimation.TypeLines,
        // fontFamily: branding?.font?.heading?.family,
      })
    )
  }, [colorCodes, objectRenderConfig, fontSize])

  useEffect(() => {
    setStudio({
      ...studio,
      controlsConfig: {
        position,
        computedTokens: computedTokens[0],
      },
    })
  }, [state, position, computedTokens])

  useEffect(() => {
    setPosition({
      prevIndex: payload?.prevIndex,
      currentIndex: payload?.currentIndex,
    })
    // setFocusCode(payload?.isFocus)
    // if (codeAnimation === 'Insert in between') {
    //   setActiveBlockIndex(payload?.activeBlockIndex)
    //   setLineNumbers((oldLineNumbers) => [
    //     ...oldLineNumbers,
    //     ...(blockConfig?.[payload?.activeBlockIndex]?.lineNumbers || []),
    //   ])
    // }
    if (codeAnimation === 'Highlight lines') {
      setActiveBlockIndex(payload?.activeBlockIndex)
      if (payload?.focusBlockCode) {
        if (
          (computedTokens[
            blockConfig?.[payload?.activeBlockIndex]?.fileIndex || 0
          ].find(
            (token) =>
              token.lineNumber ===
                (blockConfig &&
                  blockConfig[payload?.activeBlockIndex] &&
                  blockConfig[payload?.activeBlockIndex].from) || 0
          )?.y || 0) >
          objectRenderConfig.availableHeight / 2
        ) {
          codeGroupRef.current?.to({
            y:
              -(
                computedTokens[
                  blockConfig?.[payload?.activeBlockIndex]?.fileIndex || 0
                ].find(
                  (token) =>
                    token.lineNumber ===
                      (blockConfig &&
                        blockConfig[payload?.activeBlockIndex] &&
                        blockConfig[payload?.activeBlockIndex].from) || 0
                )?.y || 0
              ) +
              objectRenderConfig.availableHeight / 2 +
              objectRenderConfig.startY -
              15,
            duration: 0.5,
            easing: Konva.Easings.EaseInOut,
          })
        } else {
          codeGroupRef.current?.to({
            y: objectRenderConfig.startY + 24,
            duration: 0.5,
            easing: Konva.Easings.EaseInOut,
          })
        }
        setHiglightBlockCode(payload?.focusBlockCode)
      } else {
        setHiglightBlockCode(payload?.focusBlockCode)
      }
    }
  }, [payload])

  useEffect(() => {
    if (state === 'ready') {
      setPosition({
        prevIndex: -1,
        currentIndex: 0,
      })
      if (codeAnimation === 'Type lines')
        updatePayload?.({
          prevIndex: -1,
          currentIndex: 0,
          isFocus: false,
        })
      else
        updatePayload?.({
          focusBlockCode: false,
          activeBlockIndex: 0,
        })
    }
    if (state === 'recording') {
      setPosition({
        prevIndex: -1,
        currentIndex: 0,
      })
      if (codeAnimation === 'Type lines')
        updatePayload?.({
          prevIndex: -1,
          currentIndex: 0,
          isFocus: false,
        })
      else
        updatePayload?.({
          focusBlockCode: false,
          activeBlockIndex: 0,
        })
    }
  }, [state, codeAnimation])

  useEffect(() => {
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (payload?.fragmentState === 'customLayout') {
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 1,
          duration: 0.1,
        })
      }, 800)
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (payload?.fragmentState === 'onlyUserMedia') {
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 0,
          duration: 0.1,
        })
      }, 400)
    }
  }, [payload?.fragmentState])

  const layerChildren: any[] = [
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
      <FragmentBackground
        theme={theme}
        objectConfig={objectConfig}
        backgroundRectColor={getSurfaceColor({ codeTheme })}
      />
      {!isPreview ? (
        <Group
          x={objectRenderConfig.startX + 25}
          y={objectRenderConfig.startY + 24}
          key="group"
          ref={codeGroupRef}
        >
          {
            {
              'Type lines': (
                <>
                  {getRenderedTokens(computedTokens[0], position, fontSize)}
                  {computedTokens.length > 0 &&
                    computedTokens[0].length > 0 && (
                      <RenderTokens
                        key={position.prevIndex}
                        tokens={computedTokens[0]}
                        startIndex={position.prevIndex}
                        endIndex={position.currentIndex}
                        fontSize={fontSize}
                      />
                    )}
                </>
              ),
              'Highlight lines': (
                <>
                  {computedTokens.length > 0 && computedTokens[0].length > 0 && (
                    <>
                      <Group x={-15}>
                        {getAllLineNumbers(computedTokens[0], fontSize)}
                      </Group>
                      <Group x={40}>
                        {getTokens({
                          tokens: computedTokens[0],
                          opacity: highlightBlockCode ? 0.2 : 1,
                          fontSize,
                        })}
                      </Group>
                    </>
                  )}
                  {highlightBlockCode && (
                    <>
                      {/* <Rect
                    x={-5}
                    y={
                      (computedTokens[
                        blockConfig?.[payload?.activeBlockIndex]?.fileIndex || 0
                      ].find(
                        (token) =>
                          token.lineNumber ===
                          (blockConfig &&
                            blockConfig[activeBlockIndex] &&
                            blockConfig[activeBlockIndex].from)
                      )?.y || 0) - 5
                    }
                    width={objectConfig.width - 40}
                    height={
                      (computedTokens[
                        blockConfig?.[payload?.activeBlockIndex]?.fileIndex || 0
                      ].find(
                        (token) =>
                          token.lineNumber ===
                          (blockConfig &&
                            blockConfig[activeBlockIndex] &&
                            blockConfig[activeBlockIndex].to)
                      )?.y || 0) -
                        (computedTokens[
                          blockConfig?.[payload?.activeBlockIndex]?.fileIndex ||
                            0
                        ].find(
                          (token) =>
                            token.lineNumber ===
                            (blockConfig &&
                              blockConfig[activeBlockIndex] &&
                              blockConfig[activeBlockIndex].from)
                        )?.y || 0) +
                        codeConfig.fontSize +
                        5 >
                      0
                        ? (computedTokens[
                            blockConfig?.[payload?.activeBlockIndex]
                              ?.fileIndex || 0
                          ].find(
                            (token) =>
                              token.lineNumber ===
                              (blockConfig &&
                                blockConfig[activeBlockIndex] &&
                                blockConfig[activeBlockIndex].to)
                          )?.y || 0) -
                          (computedTokens[
                            blockConfig?.[payload?.activeBlockIndex]
                              ?.fileIndex || 0
                          ].find(
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
                    cornerRadius={4}
                  /> */}
                      <Group x={40}>
                        <RenderHighlight
                          tokens={computedTokens[0]}
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
                          fontSize={fontSize}
                        />
                      </Group>
                    </>
                  )}
                </>
              ),
              // 'Insert in between': (
              //   <>
              //     <Group x={-15}>
              //       {getSomeLineNumbers({
              //         tokens: computedTokens[0],
              //         lineNumbers,
              //         fontSize,
              //       })}
              //     </Group>
              //     <Group x={40}>
              //       <RenderLines
              //         tokens={computedTokens[0]}
              //         lineNumbers={lineNumbers}
              //         fontSize={fontSize}
              //       />
              //     </Group>
              //   </>
              // ),
            }[codeAnimation || 'Type lines']
          }
        </Group>
      ) : (
        <Group
          x={objectRenderConfig.startX + 25}
          y={objectRenderConfig.startY + 24}
          key="previewGroup"
        >
          <Group x={-15}>
            {getAllLineNumbers(computedTokens[0], fontSize)}
          </Group>
          <Group x={40}>
            {getTokens({
              tokens: computedTokens[0],
              opacity: 1,
              fontSize,
            })}
          </Group>
        </Group>
      )}
    </Group>,
  ]

  const studioUserConfig = !shortsMode
    ? StudioUserConfiguration({
        layout: viewConfig?.layout || 'classic',
        fragment,
        fragmentState,
        theme,
      })
    : ShortsStudioUserConfiguration({
        layout: viewConfig?.layout || 'classic',
        fragment,
        fragmentState,
        theme,
      })

  return (
    <Concourse
      layerChildren={layerChildren}
      viewConfig={viewConfig}
      stageRef={stageRef}
      studioUserConfig={studioUserConfig}
      isShorts={shortsMode}
      blockType={dataConfig.type}
    />
  )
}

export default CodeFragment
