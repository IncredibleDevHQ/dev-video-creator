import axios from 'axios'
import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { Group, Rect } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import * as gConfig from '../../../../config'
import firebaseState from '../../../../stores/firebase.store'
import { BlockProperties } from '../../../../utils/configTypes'
import {
  CodeBlockProps,
  CommentExplanations,
} from '../../../Flick/editor/utils/utils'
import Concourse from '../../components/Concourse'
import FragmentBackground from '../../components/FragmentBackground'
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
import {
  ShortsStudioUserConfiguration,
  StudioUserConfiguration,
} from '../../utils/StudioUserConfig'
import { ObjectRenderConfig, ThemeLayoutConfig } from '../../utils/ThemeConfig'

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
        code,
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

  const { auth } = useRecoilValue(firebaseState)
  const [user] = useAuthState(auth)

  useEffect(() => {
    if (!dataConfig) return
    setColorCodes([])
    setComputedTokens([])
    updatePayload?.({
      currentIndex: 1,
      prevIndex: 0,
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
    setIsCodexFormat(dataConfig.codeBlock.isAutomated || false)
    const blocks = Object.assign([], dataConfig.codeBlock.explanations || [])
    blocks.unshift({ from: 0, to: 0, explanation: '' })
    setBlockConfig(blocks)
    ;(async () => {
      try {
        if (dataConfig.codeBlock.code) {
          const token = await user?.getIdToken()
          const { data } = await getColorCodes(
            dataConfig.codeBlock.code,
            dataConfig.codeBlock.language || '',
            token || ''
          )
          if (!data?.errors) setColorCodes(data.data.TokenisedCode.data)
        }
      } catch (e) {
        console.error(e)
        throw e
      }
    })()
  }, [dataConfig, shortsMode, viewConfig])

  useEffect(() => {
    setObjectRenderConfig(
      ThemeLayoutConfig({ theme, layoutConfig: objectConfig })
    )
  }, [objectConfig])

  useEffect(() => {
    if (colorCodes.length === 0) return
    setComputedTokens(
      initUseCode({
        tokens: colorCodes,
        canvasWidth: objectConfig.width - 120,
        canvasHeight: objectRenderConfig.availableHeight,
        gutter: 5,
        fontSize: codeConfig.fontSize,
      })
    )
  }, [colorCodes, objectRenderConfig])

  useEffect(() => {
    setStudio({
      ...studio,
      controlsConfig: {
        position,
        computedTokens,
      },
    })
  }, [state, position, computedTokens])

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
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
      <FragmentBackground
        theme={theme}
        objectConfig={objectConfig}
        backgroundRectColor="#202026"
      />
      {!isPreview ? (
        <Group
          x={objectRenderConfig.startX + 25}
          y={objectRenderConfig.startY + 10}
          key="group"
        >
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
                objectRenderConfig.availableHeight - 10
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
      ) : (
        <Group
          x={objectRenderConfig.startX + 25}
          y={objectRenderConfig.startY + 10}
          key="previewGroup"
        >
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
            objectRenderConfig.availableHeight - 10
          )}
        </Group>
      )}

      {focusCode && (
        <RenderFocus
          tokens={computedTokens}
          lineNumber={computedTokens[position.prevIndex]?.lineNumber}
          currentIndex={position.currentIndex}
          groupCoordinates={{
            x: objectRenderConfig.startX + 10,
            y: objectRenderConfig.startY + 10,
          }}
          bgRectInfo={{
            x: objectRenderConfig.startX,
            y: objectRenderConfig.startY,
            width: objectConfig.width,
            height: objectRenderConfig.availableHeight,
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
          groupCoordinates={{
            x: objectConfig.x + 10,
            y: objectRenderConfig.startY,
          }}
          bgRectInfo={{
            x: objectRenderConfig.startX,
            y: objectRenderConfig.startY,
            width: objectConfig.width,
            height: objectRenderConfig.availableHeight,
            radius: objectConfig.borderRadius,
          }}
          opacity={1}
        />
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
