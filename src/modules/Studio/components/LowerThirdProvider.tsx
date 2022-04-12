import React from 'react'
import { useRecoilValue } from 'recoil'
import { ThemeFragment } from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'
import { TopLayerChildren } from '../../../utils/configTypes'
import { studioStore } from '../stores'
import { CONFIG, SHORTS_CONFIG } from './Concourse'
import {
  CassidooLowerThirds,
  GlassyLowerThirds,
  LambdaTestLowerThirds,
  PastelLinesLowerThirds,
} from './LowerThirds'

const LowerThridProvider = ({
  theme,
  isShorts,
  setTopLayerChildren,
}: {
  theme: ThemeFragment
  isShorts: boolean
  setTopLayerChildren?: React.Dispatch<
    React.SetStateAction<{ id: string; state: TopLayerChildren }>
  >
}) => {
  const { branding, fragment, users, participants } =
    useRecoilValue(studioStore)
  // holds the user's display name
  const { displayName, designation, organization } =
    (useRecoilValue(userState) as User) || {}
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
                : SHORTS_CONFIG.width - 100
            }
            y={!isShorts ? 450 : 620}
            userName={displayName || ''}
            designation={designation || ''}
            organization={organization || ''}
            logo={branding?.logo || ''}
            color={branding?.background?.color?.primary || ''}
            textColor={branding?.colors?.text || ''}
            branding={branding}
            setTopLayerChildren={setTopLayerChildren}
          />
          {users.map((user, index) => (
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
            userName={displayName || ''}
            designation={designation || ''}
            organization={organization || ''}
            logo={branding?.logo || ''}
            color={branding?.background?.color?.primary || ''}
            textColor={branding?.colors?.text || ''}
            setTopLayerChildren={setTopLayerChildren}
          />
          {users.map((user, index) => (
            <PastelLinesLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates({ position: 'left' })[index + 1]}
              y={!isShorts ? 400 : 560}
              userName={participants?.[user.uid]?.displayName || ''}
              designation={designation || ''}
              organization={organization || ''}
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
            userName={displayName || ''}
            designation={designation || ''}
            organization={organization || ''}
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
              designation={designation || ''}
              organization={organization || ''}
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
            userName={displayName || ''}
            designation={designation || ''}
            organization={organization || ''}
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
              designation={designation || ''}
              organization={organization || ''}
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
