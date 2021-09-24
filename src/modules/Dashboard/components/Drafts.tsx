import React, { useState } from 'react'
import { useRecoilValue } from 'recoil'
import { Link } from 'react-router-dom'
import { BiRectangle } from 'react-icons/bi'
import { ScreenState, Text } from '../../../components'
import {
  BaseFlickFragment,
  Flick_Status_Enum_Enum,
  useGetUserFlicksQuery,
  User,
} from '../../../generated/graphql'
import { userState } from '../../../stores/user.store'
import { flickFinalVideoImage, Icons } from '../../../constants'

const InfoTile = ({ flick }: { flick: BaseFlickFragment }) => {
  return (
    <div>
      <Text className="text-sm text-gray-900 mt-3 w-44 truncate overflow-ellipsis capitalize">
        {flick.name}
      </Text>
    </div>
  )
}

const FlickTile = ({ flick }: { flick: BaseFlickFragment }) => {
  return (
    <Link to={`/flick/${flick.id}`}>
      <div className="bg-background transition-all pb-2 cursor-pointer w-0 h-36">
        {flick.status === Flick_Status_Enum_Enum.Processing ? (
          <img
            className="object-cover w-0 h-36 hover:border-green-500 border-2"
            src={flickFinalVideoImage.thumbnailImage}
            alt={flick.name}
          />
        ) : (
          <div className="transition-all border-2 mt-10 bg-gray-50 hover:border-green-500 cursor-pointer w-60 h-36 rounded-md border-gray-300 items-center justify-center">
            <img src={Icons.flickIcon} alt="I" className="ml-24 mt-14" />
          </div>
        )}
        <InfoTile key={flick.id} flick={flick} />
      </div>
    </Link>
  )
}

const Drafts = () => {
  const { sub } = (useRecoilValue(userState) as User) || {}
  const { data, loading } = useGetUserFlicksQuery({
    variables: { sub: sub as string },
  })
  const [view] = useState<'grid' | 'list'>('grid')
  if (loading) return <ScreenState title="Just a moment..." loading />
  return (
    <div>
      {view === 'grid' && (
        <div className="grid grid-cols-4 gap-y-5 gap-x-3 p-0 ml-28 mr-20 justify-center mb-20">
          {data?.Flick.map(
            (flick) =>
              !flick.producedLink && <FlickTile key={flick.id} flick={flick} />
          )}
        </div>
      )}
    </div>
  )
}

export default Drafts
