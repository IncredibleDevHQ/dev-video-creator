import React, { useEffect, useState } from 'react'
import { Group, Image, Rect, Text } from 'react-konva'
import { useImage } from 'react-konva-utils'
import { useRecoilValue } from 'recoil'
import { useParams } from 'react-router-dom'
import { Concourse } from '../../components'
import { User, userState } from '../../../../stores/user.store'
import { CONFIG } from '../../components/Concourse'
import { StudioProviderProps, studioStore } from '../../stores'
import { useGetFragmentByIdQuery } from '../../../../generated/graphql'
import { ScreenState } from '../../../../components'

const Splash = () => {
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [aspectRatio, setAspectRatio] = useState(1)

  const params: { fragmentId: string } = useParams()

  const { data, error } = useGetFragmentByIdQuery({
    variables: { id: params.fragmentId, sub: sub as string },
  })

  const [displayName, username, picture] =
    data?.Fragment[0].configuration.properties // this is temporary for one template, since config doesnt have template section

  const [image] = useImage(picture.value as string, 'anonymous')

  const { fragment, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const controls: any = []

  useEffect(() => {
    if (!image) return
    setAspectRatio(image.width / image.height)
  }, [image])

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

  const handleRecord = () => {
    setLayerChildren((layerChildren) => [
      ...layerChildren,
      <Group x={-200} y={150} ref={(ref) => ref?.to({ x: -10, duration: 1 })}>
        <Rect fill="#FF1493" width={400} height={60} cornerRadius={12} />
        <Text
          x={30}
          y={15}
          text={fragment?.flick.name}
          fill="#000000"
          fontSize={40}
          align="center"
        />
      </Group>,
      <Group x={20} y={300}>
        <Group
          x={-200}
          y={-10}
          clipFunc={(ctx: any) => {
            ctx.arc(
              75,
              75 / aspectRatio,
              Math.min(75, 75 / aspectRatio),
              0,
              Math.PI * 2,
              true
            )
          }}
          scaleX={1}
          scaleY={1}
          draggable
          ref={(ref) => ref?.to({ x: 30, duration: 1 })}
        >
          <Image image={image} width={150} height={150 / aspectRatio} />
        </Group>
        <Text
          x={10}
          y={45}
          fill="#00008B"
          fontSize={24}
          fontStyle="700"
          text={displayName.value as string}
          scaleX={1}
          ref={(ref) => ref?.to({ x: 200, duration: 1 })}
        />
        <Text
          x={10}
          y={70}
          fill="#7B68EE"
          fontSize={16}
          letterSpacing={1}
          text={`@${username.value}`}
          scaleY={1}
          ref={(ref) => ref?.to({ x: 200, duration: 1 })}
        />
      </Group>,
    ])
  }

  return <Concourse disableUserMedia layerChildren={layerChildren} />
}

export default Splash