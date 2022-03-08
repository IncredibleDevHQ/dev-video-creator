import React from 'react'
import { useRecoilValue } from 'recoil'
import { ThemeFragment } from '../../../generated/graphql'
import { TopLayerChildren } from '../../../utils/configTypes'
import {
  CassidooTransition,
  PastelLinesTransition,
  TrianglePathTransition,
} from '../effects/FragmentTransitions'
import { studioStore } from '../stores'

const TransitionProvider = ({
  theme,
  isShorts,
  direction,
  setTopLayerChildren,
  performFinishAction,
}: {
  theme: ThemeFragment
  isShorts: boolean
  direction: string
  setTopLayerChildren?: React.Dispatch<
    React.SetStateAction<{ id: string; state: TopLayerChildren }>
  >
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
          setTopLayerChildren={setTopLayerChildren}
        />
      )
    case 'Cassidoo':
      return (
        <CassidooTransition
          direction={direction}
          isShorts={isShorts}
          color={branding?.colors?.transition}
          setTopLayerChildren={setTopLayerChildren}
        />
      )
    default:
      return <></>
  }
}

export default TransitionProvider
