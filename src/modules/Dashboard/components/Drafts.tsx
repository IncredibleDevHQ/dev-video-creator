import React, { useState } from 'react'
import { useRecoilValue } from 'recoil'
import { Link } from 'react-router-dom'
import { BiVideo } from 'react-icons/bi'
import { ScreenState, Text } from '../../../components'
import {
  BaseFlickFragment,
  Flick_Status_Enum_Enum,
  useGetUserFlicksQuery,
  User,
} from '../../../generated/graphql'
import { userState } from '../../../stores/user.store'
import { flickFinalVideoImage } from '../../../constants'

const InfoTile = ({ flick }: { flick: BaseFlickFragment }) => {
  return (
    <div>
      <Text className="text-sm text-gray-900 mt-3">{flick.name}</Text>
    </div>
  )
}

const FlickTile = ({ flick }: { flick: BaseFlickFragment }) => {
  return (
    <Link to={`/flick/${flick.id}`}>
      <div className="bg-background shadow-md transition-all hover:shadow-xl pb-2 cursor-pointer w-80 h-40">
        {flick.status === Flick_Status_Enum_Enum.Processing ? (
          <img
            className="w-64 object-cover h-40"
            src={flickFinalVideoImage.thumbnailImage}
            alt={flick.name}
          />
        ) : (
          <div className="bg-background shadow-md transition-all hover:shadow-xl pb-2 cursor-pointer w-80 h-40 mt-10">
            <BiVideo />
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
        <div className="gap-y-5 p-0 grid grid-cols-4 ml-28 mr-20 justify-center mb-20 mt-0">
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
