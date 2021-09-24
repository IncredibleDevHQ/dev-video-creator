/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */
import React, { useState } from 'react'
import { useRecoilValue } from 'recoil'
import { ScreenState, Text } from '../../../components'
import { Icons } from '../../../constants'
import {
  BaseFlickFragment,
  useGetUserFlicksQuery,
  User,
} from '../../../generated/graphql'
import { userState } from '../../../stores/user.store'
import DashboardModal from './DashboardModal'

const InfoTilePublished = ({ flick }: { flick: BaseFlickFragment }) => {
  return (
    <div>
      <Text className="text-sm text-gray-900 mt-3 w-40 truncate overflow-ellipsis">
        {flick.name}
      </Text>
    </div>
  )
}

const VideoTile = ({ flick }: { flick: BaseFlickFragment }) => {
  const [dashboardModal, setDashboardModal] = useState<boolean>(false)

  return (
    <div className="bg-gray-50 hover:border-green-500 cursor-pointer w-60 h-36 rounded-md items-center justify-center mt-9">
      <div
        className="text-gray-300 hover:border-green-500 cursor-pointer w-60 h-36 border-2"
        onClick={() => {
          setDashboardModal(true)
        }}
      >
        <img
          src={Icons.flickIcon}
          alt="I"
          className="ml-24 mt-14 border-gray-500 border-2 rounded-md"
        />
      </div>
      <DashboardModal
        flick={flick}
        open={dashboardModal}
        handleClose={() => {
          setDashboardModal(false)
        }}
      />
      <InfoTilePublished key={flick.id} flick={flick} />
    </div>
  )
}

const Published = () => {
  const { sub } = (useRecoilValue(userState) as User) || {}
  const { data, loading } = useGetUserFlicksQuery({
    variables: { sub: sub as string },
  })
  const [view] = useState<'grid' | 'list'>('grid')
  if (loading) return <ScreenState title="Just a moment..." loading />
  return (
    <div>
      {view === 'grid' && (
        <div className="gap-y-5 p-0 grid grid-cols-4 ml-28 mr-20 justify-center mb-20">
          {data?.Flick.map(
            (flick) =>
              flick.producedLink && <VideoTile key={flick.id} flick={flick} />
          )}
        </div>
      )}
    </div>
  )
}

export default Published
