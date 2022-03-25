import React from 'react'
import { Circle, Group, Line, Rect } from 'react-konva'
import { ThemeFragment } from '../../../generated/graphql'
import { ObjectConfig } from '../utils/FragmentLayoutConfig'

const FragmentBackground = ({
  theme,
  objectConfig,
  backgroundRectColor,
}: {
  theme: ThemeFragment
  objectConfig: ObjectConfig
  backgroundRectColor: string
}) => {
  switch (theme.name) {
    case 'DarkGradient':
      return (
        <Group>
          <Rect
            x={objectConfig.x}
            y={objectConfig.y}
            width={objectConfig.width}
            height={40}
            fill="#ffffff"
            opacity={0.2}
          />
          <Group
            x={objectConfig.x + 20}
            y={objectConfig.y + 20}
            key="circleGroup"
          >
            <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={6} />
            <Circle key="yellowCircle" x={20} y={0} fill="#FFBD44" radius={6} />
            <Circle key="greenCircle" x={40} y={0} fill="#00CA4E" radius={6} />
          </Group>
          <Rect
            x={objectConfig.x}
            y={objectConfig.y + 40}
            width={objectConfig.width}
            height={objectConfig.height - 40}
            fill={backgroundRectColor}
          />
        </Group>
      )
    case 'PastelLines':
      return (
        <Rect
          x={objectConfig.x}
          y={objectConfig.y}
          width={objectConfig.width}
          height={objectConfig.height}
          fill={backgroundRectColor}
        />
      )
    case 'Cassidoo':
      return (
        <Group>
          <Rect
            x={objectConfig.x}
            y={objectConfig.y}
            width={objectConfig.width}
            height={56}
            fill="#fafafa"
            opacity={0.8}
          />
          <Group
            x={objectConfig.x + 28}
            y={objectConfig.y + 28}
            key="circleGroup"
          >
            <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={6} />
            <Circle key="yellowCircle" x={20} y={0} fill="#FFBD44" radius={6} />
            <Circle key="greenCircle" x={40} y={0} fill="#00CA4E" radius={6} />
          </Group>
          <Line
            points={[
              objectConfig.x,
              objectConfig.y + 56,
              objectConfig.x + objectConfig.width,
              objectConfig.y + 56,
            ]}
            stroke="#27272A"
            strokeWidth={1}
          />
          <Rect
            x={objectConfig.x}
            y={objectConfig.y + 56}
            width={objectConfig.width}
            height={objectConfig.height - 56}
            fill={backgroundRectColor}
            opacity={0.8}
          />
        </Group>
      )
    default:
      return <></>
  }
}

export default FragmentBackground
