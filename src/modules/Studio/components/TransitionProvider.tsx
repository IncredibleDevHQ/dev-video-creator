import React from 'react'
import { useRecoilValue } from 'recoil'
import { ThemeFragment } from '../../../generated/graphql'
import { TopLayerChildren } from '../../../utils/configTypes'
import { BrandingJSON } from '../../Branding/BrandingPage'
import {
  CassidooTransition,
  DevsForUkraineTransition,
  DipTransition,
  LeeRobTransition,
  PastelLinesTransition,
  ShrutiKapoorTransition,
  TrianglePathTransition,
  VetsWhoCodeTransition,
  Whitep4nth3rTransition,
} from '../effects/FragmentTransitions'
import { studioStore } from '../stores'

const TransitionProvider = ({
  theme,
  isShorts,
  direction,
  setTopLayerChildren,
  performFinishAction,
  brandingJSON,
  transitionSettings,
}: {
  theme: ThemeFragment
  isShorts: boolean
  direction: string
  setTopLayerChildren?: React.Dispatch<
    React.SetStateAction<{ id: string; state: TopLayerChildren }>
  >
  performFinishAction?: () => void
  brandingJSON?: BrandingJSON | null
  transitionSettings?: string
}) => {
  const branding = useRecoilValue(studioStore).branding || brandingJSON
  if (transitionSettings && !isShorts) {
    switch (transitionSettings) {
      case 'Circles':
        return (
          <DevsForUkraineTransition
            direction={direction}
            isShorts={isShorts}
            // color="white"
            setTopLayerChildren={setTopLayerChildren}
            performFinishAction={performFinishAction}
          />
        )
      case 'DipToBlack':
        return (
          <DipTransition
            direction={direction}
            isShorts={isShorts}
            color="black"
            performFinishAction={performFinishAction}
            setTopLayerChildren={setTopLayerChildren}
          />
        )
      case 'DipToWhite':
        return (
          <DipTransition
            direction={direction}
            isShorts={isShorts}
            color="white"
            performFinishAction={performFinishAction}
            setTopLayerChildren={setTopLayerChildren}
          />
        )
      case 'Line':
        return (
          <PastelLinesTransition
            direction={direction}
            isShorts={isShorts}
            color={branding?.colors?.transition}
            setTopLayerChildren={setTopLayerChildren}
            performFinishAction={performFinishAction}
          />
        )
      case 'Rectangles':
        return (
          <Whitep4nth3rTransition
            direction={direction}
            isShorts={isShorts}
            // color="black"
            setTopLayerChildren={setTopLayerChildren}
            performFinishAction={performFinishAction}
          />
        )
      case 'Triangles':
        return (
          <TrianglePathTransition
            direction={direction}
            isShorts={isShorts}
            color={branding?.colors?.transition}
            performFinishAction={performFinishAction}
            setTopLayerChildren={setTopLayerChildren}
          />
        )
      case 'Wipe':
        return (
          <LeeRobTransition
            direction={direction}
            isShorts={isShorts}
            // color={branding?.colors?.transition}
            setTopLayerChildren={setTopLayerChildren}
            performFinishAction={performFinishAction}
          />
        )
      case 'CloseSides':
        return (
          <VetsWhoCodeTransition
            direction={direction}
            isShorts={isShorts}
            // color="black"
            setTopLayerChildren={setTopLayerChildren}
            performFinishAction={performFinishAction}
          />
        )
      default:
        return <></>
    }
  } else {
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
            setTopLayerChildren={setTopLayerChildren}
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
      case 'Whitep4nth3r':
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
          <Whitep4nth3rTransition
            direction={direction}
            isShorts={isShorts}
            // color="black"
            setTopLayerChildren={setTopLayerChildren}
          />
        )
      case 'VetsWhoCode':
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
          <VetsWhoCodeTransition
            direction={direction}
            isShorts={isShorts}
            // color="black"
            setTopLayerChildren={setTopLayerChildren}
          />
        )
      case 'ShrutiKapoor':
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
          <ShrutiKapoorTransition
            direction={direction}
            isShorts={isShorts}
            // color="black"
            setTopLayerChildren={setTopLayerChildren}
          />
        )
      case 'Mux':
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
      default:
        return <></>
    }
  }
}

export default TransitionProvider
