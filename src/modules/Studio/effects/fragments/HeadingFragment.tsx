import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { BlockProperties, Layout } from '../../../../utils/configTypes'
import { HeadingBlockProps } from '../../../Flick/editor/utils/utils'
import { Concourse } from '../../components'
import FragmentBackground from '../../components/FragmentBackground'
import { FragmentState } from '../../components/RenderTokens'
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

const HeadingFragment = ({
  dataConfig,
  viewConfig,
  fragmentState,
  setFragmentState,
  stageRef,
  shortsMode,
}: {
  dataConfig: HeadingBlockProps
  viewConfig: BlockProperties
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  shortsMode: boolean
}) => {
  const { fragment, payload, branding, theme, users } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [title, setTitle] = useState('')

  // ref to the object grp
  const customLayoutRef = useRef<Konva.Group>(null)

  const [layout, setLayout] = useState<Layout | undefined>()

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
        layout: layout || viewConfig?.layout || 'classic',
        isShorts: shortsMode || false,
      })
    )
    if (dataConfig?.headingBlock?.title)
      setTitle(dataConfig?.headingBlock?.title || '')
  }, [dataConfig, shortsMode, viewConfig, theme, layout])

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
          setLayout(viewConfig?.layout || 'classic')
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
    if (payload?.fragmentState === 'onlyFragment') {
      if (!shortsMode)
        setTimeout(() => {
          setLayout('classic')
          setFragmentState(payload?.fragmentState)
          customLayoutRef?.current?.to({
            opacity: 1,
            duration: 0.1,
          })
        }, 400)
      else {
        setLayout('classic')
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 1,
          duration: 0.1,
        })
      }
    }
  }, [payload?.fragmentState, payload?.status])

  const layerChildren: any[] = [
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
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

  const studioUserConfig = !shortsMode
    ? StudioUserConfiguration({
        layout: layout || 'classic',
        noOfParticipants: users
          ? users?.length + 1
          : fragment?.configuration?.speakers?.length,
        fragmentState,
        theme,
      })
    : ShortsStudioUserConfiguration({
        layout: layout || 'classic',
        noOfParticipants: users
          ? users?.length + 1
          : fragment?.configuration?.speakers?.length,
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
      fragmentState={fragmentState}
    />
  )
}

export default HeadingFragment
