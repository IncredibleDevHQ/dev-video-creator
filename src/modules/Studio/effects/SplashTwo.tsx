import React, { useContext, useEffect, useState } from 'react'
import { Circle, Group, Image, Rect, Text } from 'react-konva'
import { useImage } from 'react-konva-utils'
import { useRecoilValue } from 'recoil'
import { useParams } from 'react-router-dom'
import Konva from 'konva'
import { Concourse } from '../components'
import { User, userState } from '../../../stores/user.store'
import { CONFIG } from '../components/Concourse'
import { useGetFragmentByIdQuery } from '../../../generated/graphql'
import { ScreenState } from '../../../components'
import { StudioProviderProps, studioStore } from '../stores'

interface CircleItems {
  x: number
  y: number
  id: string
  r: number
  color: string
}

const SplashTwo = () => {
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [items, setItems] = useState<CircleItems[]>([])
  const params: { fragmentId: string } = useParams()

  const { data, error } = useGetFragmentByIdQuery({
    variables: { id: params.fragmentId, sub: sub as string },
  })

  const { displayName, username, picture } = JSON.parse(
    data?.Fragment[0].configuration
  )

  const [image] = useImage(picture as string, 'anonymous')

  const { fragment, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const controls: any = []

  useEffect(() => {
    // FIXME: This is a temporarily commented code to toggleAudio. Do uncomment when audio handlers are passed in by the store.
    // toggleAudio(false)
    generateItems()
  }, [])

  useEffect(() => {
    if (state === 'recording') {
      handleRecord()
    }
  }, [state])

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  const [layerChildren, setLayerChildren] = useState([
    <Rect
      x={0}
      y={0}
      fillLinearGradientColorStops={[0, '#ffffff', 1, '#ffffff']}
      fillLinearGradientStartPoint={{ x: 0, y: CONFIG.height / 2 }}
      fillLinearGradientEndPoint={{ x: CONFIG.width, y: CONFIG.height / 2 }}
      width={CONFIG.width}
      height={CONFIG.height}
      cornerRadius={8}
    />,
  ])

  function generateItems() {
    const items = []
    for (let i = 0; i < 15; i += 1) {
      items.push({
        x: Math.random() * 912,
        y: (Math.random() * 513) / 2,
        r: Math.random() * 70,
        id: 'node-',
        color: Konva.Util.getRandomColor(),
      })
    }
    setItems(items)
    // return items
  }

  const handleRecord = () => {
    setLayerChildren((layerChildren) => [
      ...layerChildren,

      <Group x={10} y={-10} ref={(ref) => ref?.to({ x: -10, duration: 1 })}>
        {items.map((item) => (
          <Circle
            key={item.id}
            name={item.id}
            draggable
            x={item.x}
            y={item.y}
            opacity={0.4}
            fill={item.color}
            radius={item.r}
          />
        ))}
      </Group>,
      <Group x={50} y={-200} ref={(ref) => ref?.to({ y: 80, duration: 1 })}>
        <Rect
          x={20}
          y={15}
          fill="#000"
          opacity={0.1}
          width={500}
          height={80}
          cornerRadius={5}
        />

        <Text
          x={40}
          y={20}
          text={fragment?.flick.name}
          fontStyle="bold"
          fill="black"
          fontSize={80}
          //   fontVariant="small-caps"
          fontFamily="Arial"
          textTransform="capitalize"
          align="center"
        />
      </Group>,
      <Group x={20} y={300}>
        <Group
          x={-100}
          y={-10}
          clipFunc={(ctx: any) => {
            ctx.arc(80, 80, 80, 0, Math.PI * 2, true)
          }}
          scaleX={1}
          scaleY={1}
          draggable
          ref={(ref) => ref?.to({ x: 30, duration: 1 })}
        >
          <Image image={image} width={160} height={160} />
        </Group>
        <Text
          x={-50}
          y={45}
          fill="black"
          fontSize={24}
          fontStyle="700"
          text={displayName as string}
          scaleX={1}
          ref={(ref) => ref?.to({ x: 200, duration: 1 })}
        />
        <Text
          x={-50}
          y={70}
          fill="black"
          fontSize={16}
          letterSpacing={1}
          text={`@${username}`}
          scaleX={1}
          ref={(ref) => ref?.to({ x: 200, duration: 1 })}
        />
      </Group>,
    ])
  }

  return (
    <Concourse
      disableUserMedia
      layerChildren={layerChildren}
      controls={controls}
      // json={BasicTemplate}
    />
  )
}

export default SplashTwo
