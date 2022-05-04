import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import Concourse from '../../components/Concourse'
import FragmentBackground from '../../components/FragmentBackground'
import { FragmentState } from '../../components/RenderTokens'
import { presentationStore } from '../../stores'
import { PresentationProviderProps } from '../../stores/presentation.store'
import { BlockProperties } from '../../utils/configTypes'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { ObjectRenderConfig, ThemeLayoutConfig } from '../../utils/ThemeConfig'
import { HeadingBlockProps } from '../../utils/utils'

const HeadingFragment = ({
  dataConfig,
  viewConfig,
  setFragmentState,
  stageRef,
  shortsMode,
}: {
  dataConfig: HeadingBlockProps
  viewConfig: BlockProperties
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  shortsMode: boolean
}) => {
  const { payload, branding, theme } =
    (useRecoilValue(presentationStore) as PresentationProviderProps) || {}

  const [title, setTitle] = useState('')

  // ref to the object grp
  const customLayoutRef = useRef<Konva.Group>(null)

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

  useEffect(() => {
    if (!dataConfig) return
    setObjectConfig(
      FragmentLayoutConfig({
        theme,
        layout: 'classic',
        isShorts: shortsMode || false,
      })
    )
    if (dataConfig?.headingBlock?.title)
      setTitle(dataConfig?.headingBlock?.title || '')
  }, [dataConfig, shortsMode, viewConfig, theme])

  useEffect(() => {
    setObjectRenderConfig(
      ThemeLayoutConfig({ theme, layoutConfig: objectConfig })
    )
  }, [objectConfig, theme])

  useEffect(() => {
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (payload?.fragmentState === 'customLayout') {
      if (!shortsMode)
        setTimeout(() => {
          setFragmentState(payload?.fragmentState)
          customLayoutRef?.current?.to({
            opacity: 1,
            duration: 0.1,
          })
        }, 400)
      else {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 1,
          duration: 0.1,
        })
      }
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (payload?.fragmentState === 'onlyUserMedia') {
      if (!shortsMode)
        setTimeout(() => {
          setFragmentState(payload?.fragmentState)
          customLayoutRef?.current?.to({
            opacity: 0,
            duration: 0.1,
          })
        }, 400)
      else {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 0,
          duration: 0.1,
        })
      }
    }
  }, [payload?.fragmentState])

  const layerChildren: any[] = [
    <Group x={0} y={0} opacity={1} ref={customLayoutRef} key={0}>
      <FragmentBackground
        theme={theme}
        objectConfig={objectConfig}
        backgroundRectColor={
          branding?.colors?.primary
            ? branding?.colors?.primary
            : objectRenderConfig.surfaceColor
        }
      />
      <Group
        x={objectRenderConfig.startX}
        y={objectRenderConfig.startY}
        key="group1"
      >
        <Text
          x={10}
          fontSize={32}
          fill={
            branding?.colors?.text
              ? branding?.colors?.text
              : objectRenderConfig.textColor
          }
          width={objectRenderConfig.availableWidth - 20}
          height={objectRenderConfig.availableHeight}
          text={title}
          fontStyle="bold"
          fontFamily={
            branding?.font?.body?.family ||
            objectRenderConfig.titleFont ||
            'Gilroy'
          }
          align="center"
          verticalAlign="middle"
          lineHeight={1.3}
          textTransform="capitalize"
        />
      </Group>
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

export default HeadingFragment
