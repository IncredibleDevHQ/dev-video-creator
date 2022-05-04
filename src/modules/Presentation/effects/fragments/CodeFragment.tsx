import axios from 'axios'
import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { Group } from 'react-konva'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
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
import useEdit from '../../hooks/use-edit'
import { presentationStore } from '../../stores'
import {
  BlockProperties,
  CodeAnimation,
  CodeBlockView,
  CodeBlockViewProps,
  CodeHighlightConfig,
  CodeTheme,
} from '../../utils/configTypes'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { ObjectRenderConfig, ThemeLayoutConfig } from '../../utils/ThemeConfig'
import { CodeBlockProps } from '../../utils/utils'
import * as config from '../../../../config'
import firebaseState from '../../../../stores/firebase.store'
import {
  controlsConfigStore,
  PresentationProviderProps,
} from '../../stores/presentation.store'

export const getColorCodes = async (
  code: string,
  language: string,
  userToken: string,
  codeTheme: CodeTheme
) => {
  return axios.post(
    config.default.hasura.server,
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
  const { codePayload, setCodePayload, theme } =
    (useRecoilValue(presentationStore) as PresentationProviderProps) || {}

  const { initUseCode } = useCode()
  const [computedTokens, setComputedTokens] = useState<ComputedToken[][]>([[]])
  const [position, setPosition] = useState<Position>({
    prevIndex: -1,
    currentIndex: 0,
  })
  // const [focusCode, setFocusCode] = useState<boolean>(false)

  const [studio, setStudio] = useRecoilState(presentationStore)
  const setControlsConfig = useSetRecoilState(controlsConfigStore)

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

  const { clipRect } = useEdit()

  useEffect(() => {
    if (!dataConfig) return
    setColorCodes([])
    setComputedTokens([[]])
    setCodePayload?.({
      ...codePayload,
      currentIndex: 0,
      prevIndex: -1,
      isFocus: false,
      focusBlockCode: false,
      activeBlockIndex: 0,
    })
    setObjectConfig(
      FragmentLayoutConfig({
        theme,
        layout: 'classic',
        isShorts: shortsMode || false,
      })
    )
    const codeBlockViewProps: CodeBlockViewProps = (
      viewConfig?.view as CodeBlockView
    )?.code
    ;(async () => {
      const code = studio.codes?.[dataConfig.id]
      const decodedCode = dataConfig.codeBlock.code
        ? Buffer.from(dataConfig.codeBlock.code, 'base64').toString('utf8')
        : undefined

      if (
        dataConfig.codeBlock.colorCodes &&
        codeBlockViewProps.theme === code?.theme
      ) {
        setColorCodes(dataConfig.codeBlock.colorCodes)
      } else {
        try {
          if (
            decodedCode &&
            (code?.code !== decodedCode ||
              codeBlockViewProps.theme !== code?.theme)
          ) {
            const token = await user?.getIdToken()
            const { data } = await getColorCodes(
              decodedCode,
              dataConfig.codeBlock.language || '',
              token || '',
              codeBlockViewProps?.theme
            )
            if (!data?.errors) {
              setColorCodes(data.data.TokenisedCode.data)
              setStudio({
                ...studio,
                codes: {
                  ...studio.codes,
                  [dataConfig.id]: {
                    code: decodedCode,
                    colorCode: data.data.TokenisedCode.data,
                    theme: codeBlockViewProps?.theme,
                  },
                },
              })
            }
          } else {
            setColorCodes(code?.colorCode)
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
    setBlockConfig(blocks)
  }, [dataConfig, shortsMode, viewConfig, theme, studio.codes?.[dataConfig.id]])

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
    setControlsConfig({
      position,
      computedTokens: computedTokens[0],
    })
  }, [position, computedTokens])

  useEffect(() => {
    setPosition({
      prevIndex: codePayload?.prevIndex,
      currentIndex: codePayload?.currentIndex,
    })
    // setFocusCode(codePayload?.isFocus)
    // if (codeAnimation === 'Insert in between') {
    //   setActiveBlockIndex(codePayload?.activeBlockIndex)
    //   setLineNumbers((oldLineNumbers) => [
    //     ...oldLineNumbers,
    //     ...(blockConfig?.[codePayload?.activeBlockIndex]?.lineNumbers || []),
    //   ])
    // }
    if (codeAnimation === 'Highlight lines') {
      setActiveBlockIndex(codePayload?.activeBlockIndex)
      if (codePayload?.focusBlockCode) {
        if (
          (computedTokens[
            blockConfig?.[codePayload?.activeBlockIndex]?.fileIndex || 0
          ].find(
            (token) =>
              token.lineNumber ===
                (blockConfig &&
                  blockConfig[codePayload?.activeBlockIndex] &&
                  blockConfig[codePayload?.activeBlockIndex].from) || 0
          )?.y || 0) >
          objectRenderConfig.availableHeight / 2
        ) {
          let valueToCenterTheHighlight = 20
          if (
            objectRenderConfig.availableHeight -
              ((blockConfig?.[codePayload?.activeBlockIndex]?.to || 0) -
                (blockConfig?.[codePayload?.activeBlockIndex]?.from || 0) +
                // adding 1 bcoz subracting the to and from will give one line less
                1) *
                (fontSize + 8) >
            0
          ) {
            // calculating the height of the highlighted part and subtracting it with the total available height and dividing it by 2 to place it in the center
            valueToCenterTheHighlight =
              objectRenderConfig.availableHeight -
              ((blockConfig?.[codePayload?.activeBlockIndex]?.to || 0) -
                (blockConfig?.[codePayload?.activeBlockIndex]?.from || 0) +
                // adding 1 bcoz subracting the to and from will give one line less
                1) *
                (fontSize + 8)
          }
          codeGroupRef.current?.to({
            y:
              -(
                computedTokens[
                  blockConfig?.[codePayload?.activeBlockIndex]?.fileIndex || 0
                ].find(
                  (token) =>
                    token.lineNumber ===
                      blockConfig?.[codePayload?.activeBlockIndex]?.from || 0
                )?.y || 0
              ) +
              valueToCenterTheHighlight / 2 +
              // this is the starting y of the code block
              objectRenderConfig.startY +
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
        setHiglightBlockCode(codePayload?.focusBlockCode)
      } else {
        setHiglightBlockCode(codePayload?.focusBlockCode)
      }
    }
  }, [codePayload])

  useEffect(() => {
    setPosition({
      prevIndex: -1,
      currentIndex: 0,
    })
    if (codeAnimation === 'Type lines')
      setCodePayload?.({
        ...codePayload,
        prevIndex: -1,
        currentIndex: 0,
        isFocus: false,
      })
    else
      setCodePayload?.({
        ...codePayload,
        focusBlockCode: false,
        activeBlockIndex: 0,
      })
  }, [codeAnimation])

  const layerChildren: any[] = [
    <Group x={0} y={0} opacity={1} ref={customLayoutRef} key={0}>
      <FragmentBackground
        theme={theme}
        objectConfig={objectConfig}
        backgroundRectColor={getSurfaceColor({ codeTheme })}
      />
      {!isPreview ? (
        <Group
          clipFunc={(ctx: any) => {
            clipRect(ctx, {
              x: objectRenderConfig.startX,
              y: objectRenderConfig.startY + 24,
              width: objectRenderConfig.availableWidth,
              height: objectRenderConfig.availableHeight,
              borderRadius: 0,
            })
          }}
        >
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
                    )}
                  </>
                ),
              }[codeAnimation || 'Type lines']
            }
          </Group>
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

  return (
    <Concourse
      layerChildren={layerChildren}
      viewConfig={viewConfig}
      stageRef={stageRef}
      isShorts={shortsMode}
      blockType={dataConfig.type}
    />
  )
}

export default CodeFragment
