import React from 'react'
import { useRecoilValue } from 'recoil'
import { ThemeFragment } from '../../../generated/graphql'
import {
  PastelLinesTransition,
  TrianglePathTransition,
} from '../effects/FragmentTransitions'
import { studioStore } from '../stores'

const TransitionProvider = ({
  theme,
  isShorts,
  direction,
  performFinishAction,
}: {
  theme: ThemeFragment
  isShorts: boolean
  direction: string
  performFinishAction?: () => void
}) => {
  const { branding } = useRecoilValue(studioStore)
  switch (theme.name) {
    case 'DarkGradient':
      return (
        <TrianglePathTransition
          direction={direction}
          isShorts={isShorts}
          color={branding?.colors?.transition}
          performFinishAction={performFinishAction}
        />
      )
    case 'PastelLines':
      return (
        <PastelLinesTransition
          direction={direction}
          isShorts={isShorts}
          color={branding?.colors?.transition}
        />
      )
    default:
      return <></>
  }
}

export default TransitionProvider
