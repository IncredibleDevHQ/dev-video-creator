import React from 'react'
import { Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { studioStore } from '../stores'
import { BulletsConfig } from '../utils/PointsConfig'

const PointBullets = ({
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
    default:
      return <></>
  }
}

export default PointBullets
