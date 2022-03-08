import React from 'react'
import { Group, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { userState } from '../../../../stores/user.store'
import FragmentBackground from '../../components/FragmentBackground'
import VideoBackground from '../../components/VideoBackground'
import useEdit from '../../hooks/use-edit'
import { studioStore } from '../../stores'
import { getThemeTextColor } from '../../utils/ThemeConfig'

const CassidooSplash = ({
  isShorts,
  stageConfig,
}: {
  isShorts: boolean
  stageConfig: {
    width: number
    height: number
  }
}) => {
  const { fragment, branding, theme } = useRecoilValue(studioStore)
  const { clipRect } = useEdit()
  const { displayName, designation, organization } =
    useRecoilValue(userState) || {}

  return (
    <Group>
      <VideoBackground
        theme={theme}
        stageConfig={stageConfig}
        isShorts={isShorts}
      />
      <Group
        clipFunc={(ctx: any) => {
          clipRect(
            ctx,
            !isShorts
              ? {
                  x: 56,
                  y: 32,
                  width: 848,
                  height: 477,
                  borderRadius: 16,
                }
              : {
                  x: 16,
                  y: 16,
                  width: 364,
                  height: 672,
                  borderRadius: 16,
                }
          )
        }}
      >
        <FragmentBackground
          theme={theme}
          objectConfig={
            !isShorts
              ? {
                  x: 56,
                  y: 32,
                  width: 848,
                  height: 477,
                  borderRadius: 16,
                }
              : {
                  x: 16,
                  y: 16,
                  width: 364,
                  height: 672,
                  borderRadius: 16,
                }
          }
          backgroundRectColor={
            branding?.colors?.primary ? branding?.colors?.primary : '#ffffff'
          }
        />
      </Group>

      <Text
        x={!isShorts ? 100 : 50}
        y={175}
        width={!isShorts ? 485 : 270}
        height={!isShorts ? 170 : 340}
        text={fragment?.flick.name || 'Hello Intro'}
        fill={branding?.colors?.text || getThemeTextColor(theme)}
        fontSize={64}
        fontFamily="Roboto Mono"
        fontStyle="bold"
        lineHeight={1.2}
      />
      <Text
        x={!isShorts ? 110 : 60}
        y={!isShorts ? 375 : 500}
        width={!isShorts ? 485 : 280}
        height={!isShorts ? 32 : 32}
        text={displayName || ''}
        fill={branding?.colors?.text || getThemeTextColor(theme)}
        fontSize={32}
        fontFamily="Roboto Mono"
        lineHeight={1.2}
      />
      {designation && organization && (
        <Text
          x={!isShorts ? 110 : 60}
          y={!isShorts ? 420 : 550}
          width={!isShorts ? 600 : 280}
          height={!isShorts ? 32 : 80}
          text={`${designation}, ${organization}` || ''}
          fill={branding?.colors?.text || getThemeTextColor(theme)}
          fontSize={24}
          fontFamily="Roboto Mono"
          lineHeight={1.2}
        />
      )}
    </Group>
  )
}

export default CassidooSplash
