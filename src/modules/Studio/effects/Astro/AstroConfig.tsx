import Konva from 'konva'
import React from 'react'
import { Circle, Group, Image, Rect } from 'react-konva'
import useImage from 'use-image'
import config from '../../../../config'
import {
  Fragment_Status_Enum_Enum,
  StudioFragmentFragment,
} from '../../../../generated/graphql'
import { CONFIG, SHORTS_CONFIG } from '../../components/Concourse'
import RenderTokens, {
  CodeBlockConfig,
  codeConfig,
  getRenderedTokens,
  getTokens,
  Position,
  RenderFocus,
  RenderMultipleLineFocus,
  shortsCodeConfig,
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
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 40,
              y: 0,
              width: 160,
              height: 180,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 50,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 735,
            y: 265,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 40,
              y: 0,
              width: 160,
              height: 180,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 255,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
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
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 100,
              y: 5,
              width: 400,
              height: 440,
              radius: 8,
            },
            backgroundRectX: 50,
            backgroundRectY: 20,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 420,
            y: 25,
            width: 600,
            height: 450,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 100,
              y: 5,
              width: 400,
              height: 440,
              radius: 8,
            },
            backgroundRectX: 510,
            backgroundRectY: 20,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
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
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 48.5,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 775,
            y: 198.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 188.5,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 775,
            y: 338.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 328.5,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
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
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 160,
              y: 5,
              width: 280,
              height: 440,
              radius: 8,
            },
            backgroundRectX: 25,
            backgroundRectY: 20,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 185,
            y: 25,
            width: 600,
            height: 450,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 160,
              y: 5,
              width: 280,
              height: 440,
              radius: 8,
            },
            backgroundRectX: 335,
            backgroundRectY: 20,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 495,
            y: 25,
            width: 600,
            height: 450,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 160,
              y: 5,
              width: 280,
              height: 440,
              radius: 8,
            },
            backgroundRectX: 645,
            backgroundRectY: 20,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
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
            y: 140.5,
            width: 320,
            height: 240,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 80,
              y: 0,
              width: 160,
              height: 240,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 130.5,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
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
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 0,
              y: 80,
              width: 800,
              height: 440,
              radius: 8,
            },
            backgroundRectX: 75,
            backgroundRectY: 20,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
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

export const shortsStudioCoordinates = (
  fragment: StudioFragmentFragment | undefined,
  fragmentState: string
) => {
  switch (fragment?.participants.length) {
    case 2:
      if (fragmentState === 'onlyUserMedia') {
        return [
          {
            x: -197,
            y: 28,
            width: 800,
            height: 600,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 220,
              y: 0,
              width: 360,
              height: 600,
              radius: 8,
            },
            backgroundRectX: 13,
            backgroundRectY: 18,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
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
      if (fragmentState === 'onlyUserMedia') {
        return [
          {
            x: -197,
            y: 28,
            width: 800,
            height: 600,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 220,
              y: 0,
              width: 360,
              height: 600,
              radius: 8,
            },
            backgroundRectX: 13,
            backgroundRectY: 18,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
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
      if (fragmentState === 'onlyUserMedia') {
        return [
          {
            x: -197,
            y: 28,
            width: 800,
            height: 600,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 220,
              y: 0,
              width: 360,
              height: 600,
              radius: 8,
            },
            backgroundRectX: 13,
            backgroundRectY: 18,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
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

const windowOpsImages = (fragment: StudioFragmentFragment | undefined) => {
  const [windowOps] = useImage(
    `${config.storage.baseUrl}window-ops.svg`,
    'anonymous'
  )
  switch (fragment?.participants.length) {
    case 2:
      return (
        <>
          <Image image={windowOps} x={860} y={35} />
          <Image image={windowOps} x={860} y={260} />
        </>
      )
    case 3:
      return <></>
    default:
      return <Image image={windowOps} x={860} y={95} />
  }
}

export const astroCodeJamLayerChildren = ({
  bothGroupRef,
  onlyFragmentGroupRef,
  computedTokens,
  position,
  focusCode,
  payload,
}: {
  bothGroupRef: React.RefObject<Konva.Group>
  onlyFragmentGroupRef: React.RefObject<Konva.Group>
  computedTokens: ComputedToken[]
  position: Position
  focusCode: boolean
  payload: any
}) => {
  const [astroPlanet] = useImage(
    `${config.storage.baseUrl}planet.svg`,
    'anonymous'
  )
  const [astroLogo] = useImage(
    `${config.storage.baseUrl}astro-logo.svg`,
    'anonymous'
  )
  return [
    <Group x={0} y={0}>
      <Rect
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fillLinearGradientColorStops={[
          0,
          '#140D1F',
          0.41,
          '#361367',
          1,
          '#6E1DDB',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: CONFIG.width,
          y: CONFIG.height,
        }}
      />
      <Image image={astroPlanet} x={-10} y={0} />
      <Image image={astroLogo} x={40} y={CONFIG.height - 55} />
    </Group>,
    <Group x={0} y={0} opacity={0} ref={bothGroupRef}>
      <Rect
        x={27}
        y={48}
        width={704}
        height={396}
        fill="#FF5D01"
        cornerRadius={8}
        stroke="#1F2937"
        strokeWidth={3}
      />
      <Rect
        x={37}
        y={58}
        width={704}
        height={396}
        fill="#202026"
        cornerRadius={8}
        stroke="#1F2937"
        strokeWidth={3}
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
      {windowOpsImages}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={onlyFragmentGroupRef}>
      <Rect
        x={70}
        y={20}
        width={800}
        height={440}
        fill="#FF5D01"
        cornerRadius={8}
        stroke="#1F2937"
        strokeWidth={3}
      />
      <Rect
        x={80}
        y={30}
        width={800}
        height={440}
        fill="#202026"
        cornerRadius={8}
        stroke="#1F2937"
        strokeWidth={3}
      />
      <Group x={100} y={45} key="circleGroup">
        <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
        <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
        <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
      </Group>
      {payload?.status === Fragment_Status_Enum_Enum.Live && (
        <Group x={105} y={60} key="codeGroup">
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

export const astroCodexLayerChildren = ({
  bothGroupRef,
  onlyFragmentGroupRef,
  computedTokens,
  position,
  focusBlockCode,
  highlightBlockCode,
  blockConfig,
  activeBlockIndex,
  payload,
}: {
  bothGroupRef: React.RefObject<Konva.Group>
  onlyFragmentGroupRef: React.RefObject<Konva.Group>
  computedTokens: ComputedToken[]
  position: Position
  focusBlockCode: boolean
  highlightBlockCode: boolean
  blockConfig: CodeBlockConfig[]
  activeBlockIndex: number
  payload: any
}) => {
  const [astroPlanet] = useImage(
    `${config.storage.baseUrl}planet.svg`,
    'anonymous'
  )
  const [astroLogo] = useImage(
    `${config.storage.baseUrl}astro-logo.svg`,
    'anonymous'
  )
  return [
    <Group x={0} y={0}>
      <Rect
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fillLinearGradientColorStops={[
          0,
          '#140D1F',
          0.41,
          '#361367',
          1,
          '#6E1DDB',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: CONFIG.width,
          y: CONFIG.height,
        }}
      />
      <Image image={astroPlanet} x={-10} y={0} />
      <Image image={astroLogo} x={40} y={CONFIG.height - 55} />
    </Group>,
    <Group x={0} y={0} opacity={0} ref={bothGroupRef}>
      <Rect
        x={27}
        y={48}
        width={704}
        height={396}
        fill="#FF5D01"
        cornerRadius={8}
        stroke="#1F2937"
        strokeWidth={3}
      />
      <Rect
        x={37}
        y={58}
        width={704}
        height={396}
        fill="#202026"
        cornerRadius={8}
        stroke="#1F2937"
        strokeWidth={3}
      />
      <Group x={52} y={73} key="circleGroup">
        <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
        <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
        <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
      </Group>
      {payload?.status === Fragment_Status_Enum_Enum.Live && (
        <Group x={57} y={88} key="group">
          {getRenderedTokens(computedTokens, position)}
        </Group>
      )}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={onlyFragmentGroupRef}>
      <Rect
        x={70}
        y={20}
        width={800}
        height={440}
        fill="#FF5D01"
        cornerRadius={8}
        stroke="#1F2937"
        strokeWidth={3}
      />
      <Rect
        x={80}
        y={30}
        width={800}
        height={440}
        fill="#202026"
        cornerRadius={8}
        stroke="#1F2937"
        strokeWidth={3}
      />
      <Group x={100} y={45} key="circleGroup">
        <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
        <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
        <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
      </Group>
      {payload?.status === Fragment_Status_Enum_Enum.Live && (
        <Group x={105} y={60} key="codeGroup">
          {getTokens(
            computedTokens,
            computedTokens[
              computedTokens.find(
                (token) =>
                  token.lineNumber ===
                    (blockConfig &&
                      blockConfig[activeBlockIndex] &&
                      blockConfig[activeBlockIndex].from - 1) || 0
              )?.startFromIndex || 0
            ]?.lineNumber
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
                      blockConfig[activeBlockIndex].from - 1)
                )?.y || 0) - 5
              }
              width={585}
              height={
                (computedTokens.find(
                  (token) =>
                    token.lineNumber ===
                    (blockConfig &&
                      blockConfig[activeBlockIndex] &&
                      blockConfig[activeBlockIndex].to - 1)
                )?.y || 0) -
                  (computedTokens.find(
                    (token) =>
                      token.lineNumber ===
                      (blockConfig &&
                        blockConfig[activeBlockIndex] &&
                        blockConfig[activeBlockIndex].from - 1)
                  )?.y || 0) +
                  codeConfig.fontSize +
                  5 >
                0
                  ? (computedTokens.find(
                      (token) =>
                        token.lineNumber ===
                        (blockConfig &&
                          blockConfig[activeBlockIndex] &&
                          blockConfig[activeBlockIndex].to - 1)
                    )?.y || 0) -
                    (computedTokens.find(
                      (token) =>
                        token.lineNumber ===
                        (blockConfig &&
                          blockConfig[activeBlockIndex] &&
                          blockConfig[activeBlockIndex].from - 1)
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
        </Group>
      )}
      {focusBlockCode && (
        <RenderMultipleLineFocus
          tokens={computedTokens}
          startLineNumber={
            blockConfig &&
            blockConfig[activeBlockIndex] &&
            blockConfig[activeBlockIndex].from - 1
          }
          endLineNumber={
            blockConfig &&
            blockConfig[activeBlockIndex] &&
            blockConfig[activeBlockIndex].to - 1
          }
          explanation={
            (blockConfig &&
              blockConfig[activeBlockIndex] &&
              blockConfig[activeBlockIndex].explanation) ||
            ''
          }
          groupCoordinates={{ x: 90, y: 60 }}
          bgRectInfo={{
            x: 80,
            y: 30,
            width: 800,
            height: 440,
            radius: 8,
          }}
          opacity={1}
        />
      )}
    </Group>,
  ]
}

export const astroShortsCodexLayerChildren = ({
  bothGroupRef,
  onlyFragmentGroupRef,
  computedTokens,
  position,
  focusBlockCode,
  highlightBlockCode,
  blockConfig,
  activeBlockIndex,
  payload,
}: {
  bothGroupRef: React.RefObject<Konva.Group>
  onlyFragmentGroupRef: React.RefObject<Konva.Group>
  computedTokens: ComputedToken[]
  position: Position
  focusBlockCode: boolean
  highlightBlockCode: boolean
  blockConfig: CodeBlockConfig[]
  activeBlockIndex: number
  payload: any
}) => {
  const [astroPlanet] = useImage(
    `${config.storage.baseUrl}planet.svg`,
    'anonymous'
  )
  const [astroLogo] = useImage(
    `${config.storage.baseUrl}astro-logo.svg`,
    'anonymous'
  )
  return [
    <Group x={0} y={0}>
      <Rect
        x={0}
        y={0}
        width={SHORTS_CONFIG.width}
        height={SHORTS_CONFIG.height}
        fillLinearGradientColorStops={[
          0,
          '#140D1F',
          0.41,
          '#361367',
          1,
          '#6E1DDB',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: SHORTS_CONFIG.width,
          y: SHORTS_CONFIG.height,
        }}
      />
      <Image image={astroPlanet} x={-10} y={0} />
      <Image image={astroLogo} x={30} y={SHORTS_CONFIG.height - 60} />
    </Group>,
    <Group x={0} y={0} opacity={0} ref={bothGroupRef}>
      <Rect
        x={13}
        y={18}
        width={360}
        height={600}
        fill="#FF5D01"
        cornerRadius={8}
        stroke="#1F2937"
        strokeWidth={3}
      />
      <Rect
        x={23}
        y={28}
        width={360}
        height={600}
        fill="#202026"
        cornerRadius={8}
        stroke="#1F2937"
        strokeWidth={3}
      />
      <Group x={38} y={43} key="circleGroup">
        <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
        <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
        <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
      </Group>
      {payload?.status === Fragment_Status_Enum_Enum.Live && (
        <Group x={43} y={58} key="group">
          {getRenderedTokens(computedTokens, position)}
        </Group>
      )}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={onlyFragmentGroupRef}>
      <Rect
        x={13}
        y={18}
        width={360}
        height={600}
        fill="#FF5D01"
        cornerRadius={8}
        stroke="#1F2937"
        strokeWidth={3}
      />
      <Rect
        x={23}
        y={28}
        width={360}
        height={600}
        fill="#202026"
        cornerRadius={8}
        stroke="#1F2937"
        strokeWidth={3}
      />
      <Group x={38} y={43} key="circleGroup">
        <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
        <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
        <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
      </Group>
      {payload?.status === Fragment_Status_Enum_Enum.Live && (
        <Group x={43} y={58} key="group">
          {getTokens(
            computedTokens,
            computedTokens[
              computedTokens.find(
                (token) =>
                  token.lineNumber ===
                    (blockConfig &&
                      blockConfig[activeBlockIndex] &&
                      blockConfig[activeBlockIndex].from - 1) || 0
              )?.startFromIndex || 0
            ]?.lineNumber,
            true
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
                      blockConfig[activeBlockIndex].from - 1)
                )?.y || 0) - 2
              }
              width={300}
              height={
                (computedTokens.find(
                  (token) =>
                    token.lineNumber ===
                    (blockConfig &&
                      blockConfig[activeBlockIndex] &&
                      blockConfig[activeBlockIndex].to - 1)
                )?.y || 0) -
                  (computedTokens.find(
                    (token) =>
                      token.lineNumber ===
                      (blockConfig &&
                        blockConfig[activeBlockIndex] &&
                        blockConfig[activeBlockIndex].from - 1)
                  )?.y || 0) +
                  shortsCodeConfig.fontSize +
                  4 >
                0
                  ? (computedTokens.find(
                      (token) =>
                        token.lineNumber ===
                        (blockConfig &&
                          blockConfig[activeBlockIndex] &&
                          blockConfig[activeBlockIndex].to - 1)
                    )?.y || 0) -
                    (computedTokens.find(
                      (token) =>
                        token.lineNumber ===
                        (blockConfig &&
                          blockConfig[activeBlockIndex] &&
                          blockConfig[activeBlockIndex].from - 1)
                    )?.y || 0) +
                    shortsCodeConfig.fontSize +
                    4
                  : 0
              }
              fill="#0066B8"
              opacity={0.3}
              cornerRadius={8}
            />
          )}
        </Group>
      )}
      {focusBlockCode && (
        <RenderMultipleLineFocus
          tokens={computedTokens}
          startLineNumber={
            blockConfig &&
            blockConfig[activeBlockIndex] &&
            blockConfig[activeBlockIndex].from - 1
          }
          endLineNumber={
            blockConfig &&
            blockConfig[activeBlockIndex] &&
            blockConfig[activeBlockIndex].to - 1
          }
          explanation={
            (blockConfig &&
              blockConfig[activeBlockIndex] &&
              blockConfig[activeBlockIndex].explanation) ||
            ''
          }
          groupCoordinates={{ x: 28, y: 58 }}
          bgRectInfo={{
            x: 23,
            y: 28,
            width: 360,
            height: 600,
            radius: 8,
          }}
          opacity={1}
          isShort
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
  backgroundRectColor: '#FF5D01',
  borderColor: '#1F2937',
  borderWidth: 6,
  backgroundRectBorderWidth: 3,
  backgroundRectBorderColor: '#1F2937',
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
  backgroundRectColor: '#FF5D01',
  borderColor: '#1F2937',
  borderWidth: 6,
  backgroundRectBorderWidth: 3,
  backgroundRectBorderColor: '#1F2937',
}

export const astroVideoJamLayerChildren = (
  bothGroupRef: React.RefObject<Konva.Group>,
  onlyFragmentGroupRef: React.RefObject<Konva.Group>,
  videoElement: HTMLVideoElement | undefined
) => {
  const [astroPlanet] = useImage(
    `${config.storage.baseUrl}planet.svg`,
    'anonymous'
  )
  const [astroLogo] = useImage(
    `${config.storage.baseUrl}astro-logo.svg`,
    'anonymous'
  )
  return [
    <Group x={0} y={0}>
      <Rect
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fillLinearGradientColorStops={[
          0,
          '#140D1F',
          0.41,
          '#361367',
          1,
          '#6E1DDB',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: CONFIG.width,
          y: CONFIG.height,
        }}
      />
      <Image image={astroPlanet} x={-10} y={0} />
      <Image image={astroLogo} x={40} y={CONFIG.height - 55} />
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
      {windowOpsImages}
      {videoElement && (
        <Video videoElement={videoElement} videoConfig={bothGroupVideoConfig} />
      )}
    </Group>,
  ]
}
