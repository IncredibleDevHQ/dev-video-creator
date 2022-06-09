import React from 'react'
import { Group, Rect, Star, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { studioStore } from '../stores'
import { BulletsConfig } from '../utils/PointsConfig'
import { ObjectRenderConfig } from '../utils/ThemeConfig'

const HorizontalPointBullets = ({
  theme,
  bulletsConfig,
  pointNumber,
}: {
  theme: string
  bulletsConfig: BulletsConfig
  pointNumber: number
}) => {
  const { branding } = useRecoilValue(studioStore)
  switch (theme) {
    case 'DarkGradient':
    case 'PastelLines':
    case 'Cassidoo':
    case 'LambdaTest':
    case 'LeeRob':
    case 'DevsForUkraine':
    case 'Whitep4nth3r':
      return (
        <>
          <Rect
            x={bulletsConfig.bulletXOffset}
            y={bulletsConfig.bulletYOffset}
            width={bulletsConfig.bulletWidth}
            height={bulletsConfig.bulletHeight}
            fill={(bulletsConfig.bulletColor as string) || 'white'}
            cornerRadius={bulletsConfig.bulletCornerRadius}
            offsetX={bulletsConfig.bulletXOffset}
            offsetY={bulletsConfig.bulletYOffset}
            rotation={bulletsConfig.bulletRotation}
          />
          <Text
            text={pointNumber.toString()}
            fontSize={bulletsConfig.bulletFontSize}
            fill={bulletsConfig.bulletTextColor || 'black'}
            fontFamily={branding?.font?.body?.family || 'Inter'}
            fontStyle={bulletsConfig.bulletFontStyle}
            width={bulletsConfig.bulletWidth}
            height={bulletsConfig.bulletHeight}
            align="center"
            verticalAlign="middle"
          />
        </>
      )
    case 'Web3Auth':
      return (
        <>
          <Rect
            x={bulletsConfig.bulletBgRectXOffset}
            y={bulletsConfig.bulletBgRectYOffset}
            width={bulletsConfig.bulletBgRectWidth}
            height={bulletsConfig.bulletBgRectHeight}
            fill={
              (bulletsConfig.bulletBgRectColor as string[])?.[
                (pointNumber - 1) % 4
              ] || 'white'
            }
            opacity={0.1}
            cornerRadius={bulletsConfig.bulletBgRectCornerRadius}
          />
          <Rect
            x={bulletsConfig.bulletBgRectXOffset}
            y={bulletsConfig.bulletBgRectYOffset}
            width={bulletsConfig.bulletBgRectWidth}
            height={bulletsConfig.bulletBgRectHeight}
            stroke={
              (bulletsConfig.bulletBgRectColor as string[])?.[
                (pointNumber - 1) % 4
              ] || 'white'
            }
            cornerRadius={bulletsConfig.bulletBgRectCornerRadius}
          />
          <Rect
            x={bulletsConfig.bulletXOffset}
            y={bulletsConfig.bulletYOffset}
            width={bulletsConfig.bulletWidth}
            height={bulletsConfig.bulletHeight}
            fill={
              (bulletsConfig.bulletColor as string[])?.[
                (pointNumber - 1) % 4
              ] || 'white'
            }
            cornerRadius={bulletsConfig.bulletCornerRadius}
            offsetX={bulletsConfig.bulletXOffset}
            offsetY={bulletsConfig.bulletYOffset}
            rotation={bulletsConfig.bulletRotation}
          />
          <Text
            text={pointNumber.toString()}
            fontSize={bulletsConfig.bulletFontSize}
            fill={bulletsConfig.bulletTextColor || 'black'}
            fontFamily={branding?.font?.body?.family || 'Inter'}
            width={bulletsConfig.bulletWidth}
            height={bulletsConfig.bulletHeight}
            align="center"
            verticalAlign="middle"
          />
        </>
      )
    case 'VetsWhoCode':
      return (
        <Star
          x={bulletsConfig.bulletXOffset}
          y={bulletsConfig.bulletYOffset}
          numPoints={5}
          innerRadius={7}
          outerRadius={17}
          fill={bulletsConfig.bulletColor as string}
        />
      )
    case 'ShrutiKapoor':
      return (
        <>
          <Rect
            x={bulletsConfig.bulletXOffset}
            y={bulletsConfig.bulletYOffset}
            width={bulletsConfig.bulletWidth}
            height={bulletsConfig.bulletHeight}
            stroke={(bulletsConfig.bulletColor as string) || 'white'}
            cornerRadius={bulletsConfig.bulletCornerRadius}
            offsetX={bulletsConfig.bulletXOffset}
            offsetY={bulletsConfig.bulletYOffset}
            rotation={bulletsConfig.bulletRotation}
          />
          <Text
            text={pointNumber.toString()}
            fontSize={bulletsConfig.bulletFontSize}
            fill={bulletsConfig.bulletTextColor || 'black'}
            fontFamily={branding?.font?.body?.family || 'Space Mono'}
            fontStyle={bulletsConfig.bulletFontStyle}
            width={bulletsConfig.bulletWidth}
            height={bulletsConfig.bulletHeight}
            align="center"
            verticalAlign="middle"
          />
        </>
      )
    default:
      return <></>
  }
}

export const PointBullets = ({
  theme,
  objectRenderConfig,
  pointY,
  pointLevel,
  pointRenderMode,
}: {
  theme: string
  objectRenderConfig: ObjectRenderConfig
  pointY: number
  pointLevel: number
  pointRenderMode: string
}) => {
  const { branding } = useRecoilValue(studioStore)
  switch (theme) {
    case 'DarkGradient':
    case 'PastelLines':
    case 'Cassidoo':
    case 'LambdaTest':
    case 'LeeRob':
    case 'DevsForUkraine':
    case 'Web3Auth':
      return (
        <Rect
          key="points"
          x={
            pointRenderMode === 'stack'
              ? -2 + (41 * (pointLevel - 1) || 0)
              : 0 + (41 * (pointLevel - 1) || 0)
          }
          y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
          width={12}
          height={12}
          cornerRadius={objectRenderConfig.pointsBulletCornerRadius}
          fill={
            branding?.colors?.text
              ? branding?.colors?.text
              : (objectRenderConfig.pointsBulletColor as string)
          }
          ref={(ref) => {
            if (pointRenderMode !== 'stack') return
            ref?.to({
              x: 0 + (41 * (pointLevel - 1) || 0),
              duration: 0.3,
            })
          }}
          rotation={objectRenderConfig.pointsBulletRotation}
        />
      )
    case 'Whitep4nth3r':
      return (
        <Group
          x={
            pointRenderMode === 'stack'
              ? -2 + (41 * (pointLevel - 1) || 0)
              : 0 + (41 * (pointLevel - 1) || 0)
          }
          ref={(ref) => {
            if (pointRenderMode !== 'stack') return
            ref?.to({
              x: 0 + (41 * (pointLevel - 1) || 0),
              duration: 0.3,
            })
          }}
        >
          <Rect
            y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
            width={12}
            height={2}
            fill={
              branding?.colors?.text
                ? branding?.colors?.text
                : (objectRenderConfig.pointsBulletColor as string)
            }
          />
          <Rect
            x={12}
            y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
            width={8}
            height={2}
            fill={
              branding?.colors?.text
                ? branding?.colors?.text
                : (objectRenderConfig.pointsBulletColor as string)
            }
            offsetX={8}
            rotation={45}
          />
          <Rect
            x={12}
            y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
            width={10}
            height={2}
            fill={
              branding?.colors?.text
                ? branding?.colors?.text
                : (objectRenderConfig.pointsBulletColor as string)
            }
            offsetX={10}
            rotation={-45}
          />
        </Group>
      )
    case 'VetsWhoCode':
      return (
        <Star
          x={
            pointRenderMode === 'stack'
              ? -2 + (41 * (pointLevel - 1) || 0)
              : 0 + (41 * (pointLevel - 1) || 0)
          }
          y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
          numPoints={5}
          innerRadius={3.5}
          outerRadius={8.5}
          fill={objectRenderConfig.pointsBulletColor as string}
          ref={(ref) => {
            if (pointRenderMode !== 'stack') return
            ref?.to({
              x: 0 + (41 * (pointLevel - 1) || 0),
              duration: 0.3,
            })
          }}
        />
      )
    case 'ShrutiKapoor':
      return (
        <Group
          x={
            pointRenderMode === 'stack'
              ? -2 + (41 * (pointLevel - 1) || 0)
              : 0 + (41 * (pointLevel - 1) || 0)
          }
          ref={(ref) => {
            if (pointRenderMode !== 'stack') return
            ref?.to({
              x: 0 + (41 * (pointLevel - 1) || 0),
              duration: 0.3,
            })
          }}
        >
          <Rect
            x={12}
            y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
            width={8.4}
            height={2}
            fill={
              branding?.colors?.text
                ? branding?.colors?.text
                : (objectRenderConfig.pointsBulletColor as string)
            }
            offsetX={8}
            rotation={30}
          />
          <Rect
            x={12.5}
            y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
            width={9.7}
            height={2}
            fill={
              branding?.colors?.text
                ? branding?.colors?.text
                : (objectRenderConfig.pointsBulletColor as string)
            }
            offsetX={10}
            rotation={-30}
          />
        </Group>
      )
    default:
      return <></>
  }
}

export default HorizontalPointBullets
