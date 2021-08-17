import React from 'react'
import {
  Group,
  Image,
  Layer,
  Rect,
  RegularPolygon,
  Stage,
  Text,
} from 'react-konva'
import { StudioFragmentFragment } from '../../../../generated/graphql'

const BasicTemplate = {
  attrs: { width: 578, height: 200 },
  className: Stage,
  children: [
    {
      attrs: {},
      className: Layer,
      children: [
        {
          attrs: {
            x: 100,
            y: 100,
            sides: 6,
            radius: 70,
            fill: 'red',
            stroke: 'black',
            strokeWidth: 4,
          },
          className: RegularPolygon,
        },
      ],
    },
  ],
}

// const BasicTemplate =
//   '{"attrs":{"width":578,"height":200},"className":"Stage","children":[{"attrs":{},"className":"Layer","children":[{"attrs":{"x":100,"y":100,"sides":6,"radius":70,"fill":"red","stroke":"black","strokeWidth":4},"className":"RegularPolygon"}]}]}'

const CWMTemplate = ({
  fragment,
  image,
  displayName,
  username,
}: {
  fragment: StudioFragmentFragment | undefined
  image: HTMLImageElement | undefined
  displayName: string | undefined | null
  username: string | undefined
}) => {
  return (
    <>
      <Group x={-100} y={200} ref={(ref) => ref?.to({ x: -10, duration: 1 })}>
        <Rect fill="#fff" width={400} height={60} cornerRadius={12} />
        <Text
          x={20}
          y={15}
          text={fragment?.flick.name}
          fill="#5156EA"
          fontSize={40}
          align="center"
        />
      </Group>
      ,
      <Group x={20} y={360}>
        <Group
          x={0}
          y={-10}
          clipFunc={(ctx: any) => {
            ctx.arc(40, 40, 40, 0, Math.PI * 2, true)
          }}
          scaleX={0}
          scaleY={0}
          ref={(ref) => ref?.to({ scaleY: 1, scaleX: 1, duration: 1 })}
        >
          <Image image={image} width={80} height={80} />
        </Group>
        <Text
          x={100}
          y={10}
          fill="white"
          fontSize={24}
          fontStyle="700"
          text={displayName as string}
          scaleX={0}
          ref={(ref) => ref?.to({ scaleX: 1, duration: 1 })}
        />
        <Text
          x={100}
          y={40}
          fill="white"
          fontSize={16}
          letterSpacing={1}
          text={`@${username}`}
          scaleY={0}
          ref={(ref) => ref?.to({ offsetY: -5, scaleY: 1, duration: 1 })}
        />
      </Group>
    </>
  )
}

export { BasicTemplate, CWMTemplate }
