import React from 'react'
import { useRecoilValue } from 'recoil'
import { ThemeFragment } from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'
import {
  IntroBlockView,
  TopLayerChildren,
  ViewConfig,
} from '../../../utils/configTypes'
import { BrandingJSON } from '../../Branding/BrandingPage'
import { IntroBlockProps } from '../../Flick/editor/utils/utils'
import { studioStore } from '../stores'
import { CONFIG, SHORTS_CONFIG } from './Concourse'
import {
  CassidooLowerThirds,
  DevsForUkraineLowerThirds,
  GlassyLowerThirds,
  LambdaTestLowerThirds,
  LeeRobLowerThirds,
  PastelLinesLowerThirds,
  VetsWhoCodeLowerThirds,
  Web3AuthLowerThirds,
  Whitep4nth3rLowerThirds,
} from './LowerThirds'

const LowerThridProvider = ({
  theme,
  isShorts,
  setTopLayerChildren,
  brandingJSON,
}: {
  theme: ThemeFragment
  isShorts: boolean
  setTopLayerChildren?: React.Dispatch<
    React.SetStateAction<{ id: string; state: TopLayerChildren }>
  >
  brandingJSON?: BrandingJSON | null
}) => {
  const branding = useRecoilValue(studioStore).branding || brandingJSON
  const { fragment, users, participants } = useRecoilValue(studioStore)
  const introBlockViewProps = (
    (fragment?.configuration as ViewConfig)?.blocks[
      (fragment?.editorState?.blocks[0] as IntroBlockProps).id
    ]?.view as IntroBlockView
  )?.intro
  // holds the user's display name
  const { displayName, designation, organization } =
    (useRecoilValue(userState) as User) || {}
  const lowerThirdUserName = introBlockViewProps?.name || displayName
  const lowerThirdUserDesignation =
    introBlockViewProps?.designation || designation
  const lowerThirdUserOrganization =
    introBlockViewProps?.organization || organization

  const lowerThirdCoordinates = ({ position }: { position: string }) => {
    if (position === 'right')
      switch (fragment?.participants.length) {
        case 2:
          return [CONFIG.width - 140, CONFIG.width / 2 - 130]
        case 3:
          // TODO: calculate the coordinates for 3 people
          return [665, 355, 45]
        default:
          return [CONFIG.width - 170]
      }
    if (position === 'left')
      switch (fragment?.participants.length) {
        case 2:
          return [140, CONFIG.width / 2 - 130]
        case 3:
          // TODO: calculate the coordinates for 3 people
          return [665, 355, 45]
        default:
          return [90]
      }
    else return []
  }
  switch (theme.name) {
    case 'DarkGradient':
      return (
        <>
          <GlassyLowerThirds
            x={
              !isShorts
                ? lowerThirdCoordinates({ position: 'right' })[0]
                : SHORTS_CONFIG.width - 80
            }
            y={!isShorts ? 450 : 620}
            userName={lowerThirdUserName || ''}
            designation={lowerThirdUserDesignation || ''}
            organization={lowerThirdUserOrganization || ''}
            logo={branding?.logo || ''}
            color={branding?.background?.color?.primary || ''}
            textColor={branding?.colors?.text || ''}
            branding={branding}
            setTopLayerChildren={setTopLayerChildren}
            isShorts={isShorts}
          />
          {users &&
            users?.map((user, index) => (
              <GlassyLowerThirds
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                x={lowerThirdCoordinates({ position: 'right' })[index + 1]}
                y={!isShorts ? 450 : 620}
                userName={participants?.[user.uid]?.displayName || ''}
                designation={participants?.[user.uid]?.designation || ''}
                organization={participants?.[user.uid]?.organization || ''}
                logo={branding?.logo || ''}
                color={branding?.background?.color?.primary || ''}
                textColor={branding?.colors?.text || ''}
                branding={branding}
                isShorts={isShorts}
                setTopLayerChildren={setTopLayerChildren}
              />
            ))}
        </>
      )
    case 'PastelLines':
      return (
        <>
          <PastelLinesLowerThirds
            x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
            y={!isShorts ? 400 : 560}
            userName={lowerThirdUserName || ''}
            designation={lowerThirdUserDesignation || ''}
            organization={lowerThirdUserOrganization || ''}
            logo={branding?.logo || ''}
            color={branding?.background?.color?.primary || ''}
            textColor={branding?.colors?.text || ''}
            setTopLayerChildren={setTopLayerChildren}
          />
          {users &&
            users?.map((user, index) => (
              <PastelLinesLowerThirds
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
                y={!isShorts ? 400 : 560}
                userName={participants?.[user.uid]?.displayName || ''}
                designation={lowerThirdUserDesignation || ''}
                organization={lowerThirdUserOrganization || ''}
                logo={branding?.logo || ''}
                color={branding?.background?.color?.primary || ''}
                textColor={branding?.colors?.text || ''}
                setTopLayerChildren={setTopLayerChildren}
              />
            ))}
        </>
      )
    case 'Cassidoo': {
      return (
        <>
          <CassidooLowerThirds
            x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
            y={!isShorts ? 400 : 560}
            userName={lowerThirdUserName || ''}
            designation={lowerThirdUserDesignation || ''}
            organization={lowerThirdUserOrganization || ''}
            logo={branding?.logo || ''}
            color={branding?.background?.color?.primary || ''}
            textColor={branding?.colors?.text || ''}
            setTopLayerChildren={setTopLayerChildren}
          />
          {/* {users.map((user, index) => (
            <CassidooLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
        </>
      )
    }
    case 'LambdaTest': {
      return (
        <>
          <LambdaTestLowerThirds
            x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
            y={!isShorts ? 400 : 560}
            userName={lowerThirdUserName || ''}
            designation={lowerThirdUserDesignation || ''}
            organization={lowerThirdUserOrganization || ''}
            logo={branding?.logo || ''}
            color={branding?.background?.color?.primary || ''}
            textColor={branding?.colors?.text || ''}
            setTopLayerChildren={setTopLayerChildren}
          />
          {/* {users.map((user, index) => (
            <LambdaTestLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
        </>
      )
    }
    case 'LeeRob': {
      return (
        <>
          <LeeRobLowerThirds
            x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
            y={!isShorts ? 400 : 560}
            userName={lowerThirdUserName || ''}
            designation={lowerThirdUserDesignation || ''}
            organization={lowerThirdUserOrganization || ''}
            logo={branding?.logo || ''}
            color={branding?.background?.color?.primary || ''}
            textColor={branding?.colors?.text || ''}
            setTopLayerChildren={setTopLayerChildren}
          />
          {/* {users.map((user, index) => (
            <LeeRobLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
        </>
      )
    }
    case 'Web3Auth': {
      return (
        <>
          <Web3AuthLowerThirds
            x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
            y={!isShorts ? 400 : 560}
            userName={lowerThirdUserName || ''}
            designation={lowerThirdUserDesignation || ''}
            organization={lowerThirdUserOrganization || ''}
            logo={branding?.logo || ''}
            color={branding?.background?.color?.primary || ''}
            textColor={branding?.colors?.text || ''}
            setTopLayerChildren={setTopLayerChildren}
          />
          {/* {users.map((user, index) => (
            <LeeRobLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
        </>
      )
    }
    case 'DevsForUkraine': {
      return (
        <>
          <DevsForUkraineLowerThirds
            x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
            y={!isShorts ? 400 : 560}
            userName={lowerThirdUserName || ''}
            designation={lowerThirdUserDesignation || ''}
            organization={lowerThirdUserOrganization || ''}
            logo={branding?.logo || ''}
            color={branding?.background?.color?.primary || ''}
            textColor={branding?.colors?.text || ''}
            setTopLayerChildren={setTopLayerChildren}
          />
          {/* {users.map((user, index) => (
            <LeeRobLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
        </>
      )
    }
    case 'Whitep4nth3r': {
      return (
        <>
          <Whitep4nth3rLowerThirds
            x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
            y={!isShorts ? 430 : 600}
            userName={lowerThirdUserName || ''}
            designation={lowerThirdUserDesignation || ''}
            organization={lowerThirdUserOrganization || ''}
            logo={branding?.logo || ''}
            color={branding?.background?.color?.primary || ''}
            textColor={branding?.colors?.text || ''}
            setTopLayerChildren={setTopLayerChildren}
          />
          {/* {users.map((user, index) => (
            <LeeRobLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
        </>
      )
    }
    case 'VetsWhoCode': {
      return (
        <>
          <VetsWhoCodeLowerThirds
            x={!isShorts ? lowerThirdCoordinates({ position: 'left' })[0] : 45}
            y={!isShorts ? 390 : 600}
            userName={lowerThirdUserName || ''}
            designation={lowerThirdUserDesignation || ''}
            organization={lowerThirdUserOrganization || ''}
            logo={branding?.logo || ''}
            color={branding?.background?.color?.primary || ''}
            textColor={branding?.colors?.text || ''}
            setTopLayerChildren={setTopLayerChildren}
          />
          {/* {users.map((user, index) => (
            <LeeRobLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={lowerThirdUserDesignation || ''}
              organization={lowerThirdUserOrganization || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))} */}
        </>
      )
    }
    default:
      return <></>
  }
}

export default LowerThridProvider
