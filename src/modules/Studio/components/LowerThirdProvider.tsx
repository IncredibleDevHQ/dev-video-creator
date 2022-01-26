import React from 'react'
import { useRecoilValue } from 'recoil'
import { User, userState } from '../../../stores/user.store'
import { VideoTheme } from '../../../utils/configTypes'
import { studioStore } from '../stores'
import { CONFIG, SHORTS_CONFIG } from './Concourse'
import { GlassyLowerThirds } from './LowerThirds'

const LowerThridProvider = ({
  theme,
  isShorts,
}: {
  theme: VideoTheme
  isShorts: boolean
}) => {
  const { branding, fragment, users, participants } =
    useRecoilValue(studioStore)
  // holds the user's display name
  const { displayName } = (useRecoilValue(userState) as User) || {}
  const lowerThirdCoordinates = () => {
    switch (fragment?.participants.length) {
      case 2:
        return [CONFIG.width - 140, CONFIG.width / 2 - 130]
      case 3:
        // TODO: calculate the coordinates for 3 people
        return [665, 355, 45]
      default:
        return [CONFIG.width - 170]
    }
  }
  switch (theme) {
    case 'glassy':
      return (
        <>
          <GlassyLowerThirds
            x={
              !isShorts ? lowerThirdCoordinates()[0] : SHORTS_CONFIG.width - 90
            }
            y={!isShorts ? 450 : 630}
            userName={displayName || ''}
            logo={branding?.logo || ''}
            color={branding?.background?.color?.primary || ''}
            textColor={branding?.colors?.text || ''}
          />
          {users.map((user, index) => (
            <GlassyLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates()[index + 1]}
              y={!isShorts ? 450 : 630}
              userName={participants?.[user.uid]?.displayName || ''}
              logo={branding?.logo || ''}
              color={branding?.background?.color?.primary || ''}
              textColor={branding?.colors?.text || ''}
            />
          ))}
        </>
      )
    default:
      return <></>
  }
}

export default LowerThridProvider
