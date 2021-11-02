import React, { useEffect, useRef, useState } from 'react'
import { Rect, Image, Group } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import Konva from 'konva'
import Concourse, { CONFIG, StudioUserConfig } from '../components/Concourse'
import useEdit, { ClipConfig } from '../hooks/use-edit'
import { StudioProviderProps, studioStore } from '../stores'
import Gif from '../components/Gif'
import { ControlButton } from '../components/MissionControl'
import { NextTokenIcon } from '../../../components'
import config from '../../../config'
import { FragmentState } from '../components/RenderTokens'
import {
  MutipleRectMoveLeft,
  MutipleRectMoveRight,
} from './FragmentTransitions'
import SwapIcon from '../../../components/SwapIcon'

const Solo = () => {
  const { fragment, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [titleSpalshData, setTitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const [media, setMedia] = useState<string[]>([])
  const [activeMediaIndex, setActiveMediaIndex] = useState<number>(-1)
  const [activeMedia] = useImage(media[activeMediaIndex] || '', 'anonymous')

  const { getImageDimensions } = useEdit()

  const [activeMediaDimension, setActiveMediaDimension] = useState<{
    width: number
    height: number
    x: number
    y: number
  }>({ width: 0, height: 0, x: 0, y: 0 })

  // state of the fragment
  const [fragmentState, setFragmentState] =
    useState<FragmentState>('onlyUserMedia')

  // const bothGroupRef = useRef<Konva.Group>(null)
  const onlyFragmentGroupRef = useRef<Konva.Group>(null)

  // state which stores the layer children which have to be placed over the studio user
  const [topLayerChildren, setTopLayerChildren] = useState<JSX.Element[]>([])

  const [svelteLogo] = useImage(
    `${config.storage.baseUrl}Svelte.svg`,
    'anonymous'
  )
  const [incredibleLogo] = useImage(
    `${config.storage.baseUrl}x-incredible-black.svg`,
    'anonymous'
  )
  const [svelteBg] = useImage(
    `${config.storage.baseUrl}svelte_bg.svg`,
    'anonymous'
  )

  useEffect(() => {
    if (!fragment) return
    // setConfig of titleSpalsh
    setTitleSpalshData({
      enable: fragment?.configuration.properties.find(
        (property: any) => property.key === 'showTitleSplash'
      )?.value,
      title: fragment?.name as string,
    })
    setMedia(
      fragment?.configuration.properties.find(
        (property: any) => property.type === 'file[]'
      )?.value
    )
  }, [fragment?.configuration.properties])

  useEffect(() => {
    // calculating the width and height of the gif or image when it is placed on the user media
    const mediaDimensions = getImageDimensions(
      {
        w: (activeMedia && activeMedia.width) || 0,
        h: (activeMedia && activeMedia.height) || 0,
      },
      480,
      480,
      480,
      480,
      0,
      0
    )
    // calculating the width and height of the gif or image when it is placed on the empty screen
    setActiveMediaDimension(
      getImageDimensions(
        {
          w: (activeMedia && activeMedia.width) || 0,
          h: (activeMedia && activeMedia.height) || 0,
        },
        800,
        480,
        800,
        480,
        0,
        0
      )
    )
    if (fragmentState === 'onlyUserMedia')
      if (activeMedia?.src.split('.').pop() === 'gif')
        setTopLayerChildren([
          <Gif
            src={activeMedia?.src}
            x={mediaDimensions.x}
            y={mediaDimensions.y}
            width={mediaDimensions.width}
            height={mediaDimensions.height}
          />,
        ])
      else
        setTopLayerChildren([
          <Image
            image={activeMedia}
            x={mediaDimensions.x}
            y={mediaDimensions.y}
            width={mediaDimensions.width}
            height={mediaDimensions.height}
            shadowOpacity={0.3}
            shadowOffset={{ x: 0, y: 1 }}
            shadowBlur={2}
          />,
        ])
  }, [activeMedia])

  useEffect(() => {
    if (!onlyFragmentGroupRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (fragmentState === 'customLayout') {
      setTopLayerChildren([
        <MutipleRectMoveRight
          rectOneColors={['#FF6F00', '#FFA100']}
          rectTwoColors={['#425066', '#425066']}
          rectThreeColors={['#E6E6E6', '#FFFFFF']}
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
          rectOneColors={['#FF6F00', '#FFA100']}
          rectTwoColors={['#425066', '#425066']}
          rectThreeColors={['#E6E6E6', '#FFFFFF']}
        />,
      ])
      onlyFragmentGroupRef.current.to({
        opacity: 0,
        duration: 0.2,
      })
    }
  }, [fragmentState])

  useEffect(() => {
    if (state === 'recording') {
      setActiveMediaIndex(-1)
    }
  }, [state])

  const controls = [
    <ControlButton
      key="swap"
      icon={SwapIcon}
      className="my-2"
      appearance="primary"
      onClick={() => {
        if (fragmentState === 'onlyUserMedia') {
          setFragmentState('onlyFragment')
        } else {
          setFragmentState('onlyUserMedia')
        }
      }}
    />,
    <ControlButton
      key="nextMedia"
      icon={NextTokenIcon}
      className="my-2"
      appearance="primary"
      disabled={activeMediaIndex === media.length - 1}
      onClick={() => setActiveMediaIndex(activeMediaIndex + 1)}
    />,
  ]

  const clipConfig: ClipConfig = {
    x: 20,
    y: 20,
    width: 920,
    height: 500,
    radius: 8,
  }

  const studioCoordinates = () => {
    if (fragmentState === 'onlyUserMedia')
      return [
        {
          x: 0,
          y: 0,
          width: 960,
          height: 720,
          studioUserClipConfig: clipConfig,
        },
      ]
    return [
      {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        studioUserClipConfig: {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          radius: 0,
        },
      },
    ]
  }

  const layerChildren = [
    <Group x={0} y={0}>
      <Rect
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fill="#ffffff"
        stroke="#000000"
        strokeWidth={1}
      />
      <Image
        x={1}
        y={1}
        image={svelteBg}
        width={CONFIG.width - 2}
        height={CONFIG.height - 2}
      />
    </Group>,
    <Group x={0} y={0} opacity={0} ref={onlyFragmentGroupRef}>
      <Rect
        x={70}
        y={20}
        width={800}
        height={480}
        stroke="#FF3E00"
        strokeWidth={1}
      />
      <Rect
        x={80}
        y={30}
        width={800}
        height={480}
        fill="#FFFFFF"
        strokeWidth={1}
        stroke="#FF3E00"
      />
      <Group x={80} y={30}>
        {media.length > 0 && activeMedia?.src.split('.').pop() === 'gif' ? (
          <Gif
            src={activeMedia?.src}
            x={activeMediaDimension.x}
            y={activeMediaDimension.y}
            width={activeMediaDimension.width}
            height={activeMediaDimension.height}
          />
        ) : (
          <Image
            image={activeMedia}
            x={activeMediaDimension.x}
            y={activeMediaDimension.y}
            width={activeMediaDimension.width}
            height={activeMediaDimension.height}
            shadowOpacity={0.3}
            shadowOffset={{ x: 0, y: 1 }}
            shadowBlur={2}
          />
        )}
      </Group>
      {/* <Image image={incredibleLogo} x={20} y={CONFIG.height - 50} />
      <Image image={svelteLogo} x={830} y={CONFIG.height - 40} /> */}
    </Group>,
  ]

  return (
    <Concourse
      layerChildren={layerChildren}
      controls={controls}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioCoordinates()}
      topLayerChildren={topLayerChildren}
    />
  )
}

export default Solo
