import React from 'react'
import { useRecoilValue } from 'recoil'
import { ThemeFragment } from '../../../generated/graphql'
import { TopLayerChildren } from '../../../utils/configTypes'
import {
  CassidooTransition,
  DevsForUkraineTransition,
  DipTransition,
  LeeRobTransition,
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
      if (direction === 'moveIn' || direction === 'moveAway') {
        return (
          <DipTransition
            direction={direction}
            isShorts={isShorts}
            color="black"
            performFinishAction={performFinishAction}
            setTopLayerChildren={setTopLayerChildren}
          />
        )
      }
      return (
        <TrianglePathTransition
          direction={direction}
          isShorts={isShorts}
          color={branding?.colors?.transition}
          performFinishAction={performFinishAction}
        />
      )
    case 'PastelLines':
      if (direction === 'moveIn' || direction === 'moveAway') {
        return (
          <DipTransition
            direction={direction}
            isShorts={isShorts}
            color="black"
            performFinishAction={performFinishAction}
            setTopLayerChildren={setTopLayerChildren}
          />
        )
      }
      return (
        <PastelLinesTransition
          direction={direction}
          isShorts={isShorts}
          color={branding?.colors?.transition}
          setTopLayerChildren={setTopLayerChildren}
        />
      )
    case 'Cassidoo':
      if (direction === 'moveIn' || direction === 'moveAway') {
        return (
          <DipTransition
            direction={direction}
            isShorts={isShorts}
            color="white"
            performFinishAction={performFinishAction}
            setTopLayerChildren={setTopLayerChildren}
          />
        )
      }
      return (
        <CassidooTransition
          direction={direction}
          isShorts={isShorts}
          color={branding?.colors?.transition}
          setTopLayerChildren={setTopLayerChildren}
        />
      )
    case 'LambdaTest':
      if (direction === 'moveIn' || direction === 'moveAway') {
        return (
          <DipTransition
            direction={direction}
            isShorts={isShorts}
            color="white"
            performFinishAction={performFinishAction}
            setTopLayerChildren={setTopLayerChildren}
          />
        )
      }
      return (
        <DipTransition
          direction={direction}
          isShorts={isShorts}
          color="white"
          setTopLayerChildren={setTopLayerChildren}
        />
      )
    case 'LeeRob':
      if (direction === 'moveIn' || direction === 'moveAway') {
        return (
          <DipTransition
            direction={direction}
            isShorts={isShorts}
            color="black"
            performFinishAction={performFinishAction}
            setTopLayerChildren={setTopLayerChildren}
          />
        )
      }
      return (
        <LeeRobTransition
          direction={direction}
          isShorts={isShorts}
          // color={branding?.colors?.transition}
          setTopLayerChildren={setTopLayerChildren}
        />
      )
    case 'Web3Auth':
      if (direction === 'moveIn' || direction === 'moveAway') {
        return (
          <DipTransition
            direction={direction}
            isShorts={isShorts}
            color="black"
            performFinishAction={performFinishAction}
            setTopLayerChildren={setTopLayerChildren}
          />
        )
      }
      return (
        <TrianglePathTransition
          direction={direction}
          isShorts={isShorts}
          color={branding?.colors?.transition}
          performFinishAction={performFinishAction}
        />
        // <Web3AuthTransition
        //   direction={direction}
        //   // isShorts={isShorts}
        //   // color={branding?.colors?.transition}
        //   setTopLayerChildren={setTopLayerChildren}
        // />
      )
    case 'DevsForUkraine':
      if (direction === 'moveIn' || direction === 'moveAway') {
        return (
          <DipTransition
            direction={direction}
            isShorts={isShorts}
            color="black"
            performFinishAction={performFinishAction}
            setTopLayerChildren={setTopLayerChildren}
          />
        )
      }
      return (
        <DevsForUkraineTransition
          direction={direction}
          isShorts={isShorts}
          // color="white"
          setTopLayerChildren={setTopLayerChildren}
        />
      )
    default:
      return <></>
  }
}

export default TransitionProvider
