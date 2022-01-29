import React from 'react'
import { useRecoilValue } from 'recoil'
import { VideoTheme } from '../../../utils/configTypes'
import { TrianglePathTransition } from '../effects/FragmentTransitions'
import { studioStore } from '../stores'

const TransitionProvider = ({
  theme,
  isShorts,
  direction,
  performFinishAction,
}: {
  theme: VideoTheme
  isShorts: boolean
  direction: string
  performFinishAction?: () => void
}) => {
  const { branding } = useRecoilValue(studioStore)
  switch (theme) {
    case 'glassy':
      return (
        <TrianglePathTransition
          direction={direction}
          isShorts={isShorts}
          color={branding?.colors?.transition}
          performFinishAction={performFinishAction}
        />
      )
    default:
      return <></>
  }
}

export default TransitionProvider
