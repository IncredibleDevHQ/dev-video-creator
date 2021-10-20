import Konva from 'konva'
import React from 'react'
import { Circle, Group, Image, Rect } from 'react-konva'
import useImage from 'use-image'
import config from '../../../../config'
import {
  Fragment_Status_Enum_Enum,
  StudioFragmentFragment,
} from '../../../../generated/graphql'
import { CONFIG } from '../../components/Concourse'
import RenderTokens, {
  getRenderedTokens,
  Position,
  RenderFocus,
} from '../../components/RenderTokens'
import { Video, VideoConfig } from '../../components/Video'
import { ComputedToken } from '../../hooks/use-code'

// returns all the information to render the studio user based on the fragment state and the number of fragment participants
export const studioCoordinates = (
  fragment: StudioFragmentFragment | undefined,
  fragmentState: string
) => {
  switch (fragment?.participants.length) {
    case 2:
      if (fragmentState === 'both')
        return [
          {
            x: 735,
            y: 60,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 40,
              y: 0,
              width: 160,
              height: 180,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 50,
            backgroundRectColor: '#C084FC',
          },
          {
            x: 735,
            y: 265,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 40,
              y: 0,
              width: 160,
              height: 180,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 255,
            backgroundRectColor: '#4FD1C5',
          },
        ]
      if (fragmentState === 'onlyUserMedia')
        return [
          {
            x: -40,
            y: 25,
            width: 600,
            height: 450,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 100,
              y: 5,
              width: 400,
              height: 440,
              radius: 8,
            },
            backgroundRectX: 50,
            backgroundRectY: 20,
            backgroundRectColor: '#C084FC',
          },
          {
            x: 420,
            y: 25,
            width: 600,
            height: 450,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 100,
              y: 5,
              width: 400,
              height: 440,
              radius: 8,
            },
            backgroundRectX: 510,
            backgroundRectY: 20,
            backgroundRectColor: '#4FD1C5',
          },
        ]
      return [
        {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          clipTheme: 'rect',
          borderWidth: 0,
          studioUserClipConfig: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            radius: 0,
          },
          backgroundRectX: 0,
          backgroundRectY: 0,
        },
        {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          clipTheme: 'rect',
          borderWidth: 0,
          studioUserClipConfig: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            radius: 0,
          },
          backgroundRectX: 0,
          backgroundRectY: 0,
        },
      ]
    case 3:
      if (fragmentState === 'both')
        return [
          {
            x: 775,
            y: 58.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 48.5,
            backgroundRectColor: '#C084FC',
          },
          {
            x: 775,
            y: 198.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 188.5,
            backgroundRectColor: '#4FD1C5',
          },
          {
            x: 775,
            y: 338.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 328.5,
            backgroundRectColor: '#FCA5A5',
          },
        ]
      if (fragmentState === 'onlyUserMedia')
        return [
          {
            x: -125,
            y: 25,
            width: 600,
            height: 450,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 160,
              y: 5,
              width: 280,
              height: 440,
              radius: 8,
            },
            backgroundRectX: 25,
            backgroundRectY: 20,
            backgroundRectColor: '#C084FC',
          },
          {
            x: 185,
            y: 25,
            width: 600,
            height: 450,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 160,
              y: 5,
              width: 280,
              height: 440,
              radius: 8,
            },
            backgroundRectX: 335,
            backgroundRectY: 20,
            backgroundRectColor: '#4FD1C5',
          },
          {
            x: 495,
            y: 25,
            width: 600,
            height: 450,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 160,
              y: 5,
              width: 280,
              height: 440,
              radius: 8,
            },
            backgroundRectX: 645,
            backgroundRectY: 20,
            backgroundRectColor: '#FCA5A5',
          },
        ]
      return [
        {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          clipTheme: 'rect',
          borderWidth: 0,
          studioUserClipConfig: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            radius: 0,
          },
          backgroundRectX: 0,
          backgroundRectY: 0,
        },
        {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          clipTheme: 'rect',
          borderWidth: 0,
          studioUserClipConfig: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            radius: 0,
          },
          backgroundRectX: 0,
          backgroundRectY: 0,
        },
        {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          clipTheme: 'rect',
          borderWidth: 0,
          studioUserClipConfig: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            radius: 0,
          },
          backgroundRectX: 0,
          backgroundRectY: 0,
        },
      ]
    default:
      if (fragmentState === 'both')
        return [
          {
            x: 695,
            y: 120.5,
            width: 320,
            height: 240,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 80,
              y: 0,
              width: 160,
              height: 240,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 110.5,
            backgroundRectColor: '#C084FC',
          },
        ]
      if (fragmentState === 'onlyUserMedia') {
        return [
          {
            x: 85,
            y: -50,
            width: 800,
            height: 600,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 0,
              y: 80,
              width: 800,
              height: 440,
              radius: 8,
            },
            backgroundRectX: 75,
            backgroundRectY: 20,
            backgroundRectColor: '#C084FC',
          },
        ]
      }
      return [
        {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          clipTheme: 'rect',
          borderWidth: 0,
          studioUserClipConfig: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            radius: 0,
          },
          backgroundRectX: 0,
          backgroundRectY: 0,
        },
      ]
  }
}

export const graphqlCodeJamLayerChildren = (
  bothGroupRef: React.RefObject<Konva.Group>,
  onlyFragmentGroupRef: React.RefObject<Konva.Group>,
  computedTokens: ComputedToken[],
  position: Position,
  focusCode: boolean,
  payload: any
) => {
  const [incredibleLogo] = useImage(
    `${config.storage.baseUrl}x-incredible.svg`,
    'anonymous'
  )
  const [circleGroup] = useImage(
    `${config.storage.baseUrl}black-circles.svg`,
    'anonymous'
  )
  const [graphqlLogo] = useImage(
    `${config.storage.baseUrl}graphql3.svg`,
    'anonymous'
  )
  return [
    <Group x={0} y={0}>
      <Rect
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fill="#1F2937"
      />
      <Image image={circleGroup} x={400} y={450} />
      <Image image={incredibleLogo} x={30} y={CONFIG.height - 50} />
      <Image image={graphqlLogo} x={840} y={CONFIG.height - 48} />
    </Group>,
    <Group x={0} y={0} opacity={0} ref={bothGroupRef}>
      <Rect
        x={27}
        y={48}
        width={704}
        height={396}
        fill="#60A5FA"
        cornerRadius={8}
      />
      <Rect
        x={37}
        y={58}
        width={704}
        height={396}
        fill="#202026"
        cornerRadius={8}
      />
      <Group x={52} y={73} key="circleGroup">
        <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
        <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
        <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
      </Group>
      {payload?.status === Fragment_Status_Enum_Enum.Live && (
        <Group x={57} y={88} key="group">
          {getRenderedTokens(computedTokens, position)}
          {computedTokens.length > 0 && (
            <RenderTokens
              key={position.prevIndex}
              tokens={computedTokens}
              startIndex={position.prevIndex}
              endIndex={position.currentIndex}
            />
          )}
        </Group>
      )}
      {focusCode && (
        <RenderFocus
          tokens={computedTokens}
          lineNumber={computedTokens[position.prevIndex]?.lineNumber}
          currentIndex={position.currentIndex}
          groupCoordinates={{ x: 47, y: 88 }}
          bgRectInfo={{
            x: 37,
            y: 58,
            width: 704,
            height: 396,
            radius: 8,
          }}
        />
      )}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={onlyFragmentGroupRef}>
      <Rect
        x={70}
        y={20}
        width={800}
        height={440}
        fill="#60A5FA"
        cornerRadius={8}
      />
      <Rect
        x={80}
        y={30}
        width={800}
        height={440}
        fill="#202026"
        cornerRadius={8}
      />
      <Group x={100} y={45} key="circleGroup">
        <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
        <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
        <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
      </Group>
      {payload?.status === Fragment_Status_Enum_Enum.Live && (
        <Group x={105} y={60} key="group">
          {getRenderedTokens(computedTokens, position)}
          {computedTokens.length > 0 && (
            <RenderTokens
              key={position.prevIndex}
              tokens={computedTokens}
              startIndex={position.prevIndex}
              endIndex={position.currentIndex}
            />
          )}
        </Group>
      )}
      {focusCode && (
        <RenderFocus
          tokens={computedTokens}
          lineNumber={computedTokens[position.prevIndex]?.lineNumber}
          currentIndex={position.currentIndex}
          groupCoordinates={{ x: 90, y: 60 }}
          bgRectInfo={{
            x: 80,
            y: 30,
            width: 800,
            height: 440,
            radius: 8,
          }}
        />
      )}
    </Group>,
  ]
}

const onlyFragmentVideoConfig: VideoConfig = {
  x: 85,
  y: 30,
  width: 800,
  height: 450,
  videoFill: '#1F2937',
  cornerRadius: 8,
  performClip: true,
  backgroundRectX: 75,
  backgroundRectY: 20,
  backgroundRectColor: '#60A5FA',
}
const bothGroupVideoConfig: VideoConfig = {
  x: 37,
  y: 58,
  width: 704,
  height: 396,
  videoFill: '#1F2937',
  cornerRadius: 8,
  performClip: true,
  backgroundRectX: 27,
  backgroundRectY: 48,
  backgroundRectColor: '#60A5FA',
}

export const graphqlVideoJamLayerChildren = (
  bothGroupRef: React.RefObject<Konva.Group>,
  onlyFragmentGroupRef: React.RefObject<Konva.Group>,
  videoElement: HTMLVideoElement | undefined
) => {
  const [incredibleLogo] = useImage(
    `${config.storage.baseUrl}x-incredible.svg`,
    'anonymous'
  )
  const [circleGroup] = useImage(
    `${config.storage.baseUrl}black-circles.svg`,
    'anonymous'
  )
  const [graphqlLogo] = useImage(
    `${config.storage.baseUrl}graphql3.svg`,
    'anonymous'
  )
  return [
    <Group x={0} y={0}>
      <Rect
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fill="#1F2937"
      />
      <Image image={circleGroup} x={400} y={450} />
      <Image image={incredibleLogo} x={30} y={CONFIG.height - 50} />
      <Image image={graphqlLogo} x={840} y={CONFIG.height - 48} />
    </Group>,
    <Group x={0} y={0} opacity={0} ref={onlyFragmentGroupRef}>
      {videoElement && (
        <Video
          videoElement={videoElement}
          videoConfig={onlyFragmentVideoConfig}
        />
      )}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={bothGroupRef}>
      {videoElement && (
        <Video videoElement={videoElement} videoConfig={bothGroupVideoConfig} />
      )}
    </Group>,
  ]
}
