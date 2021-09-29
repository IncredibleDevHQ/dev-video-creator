import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGetUserSeriesQuery, UserFragment } from '../../../generated/graphql'
import { User } from '../../../stores/user.store'
import {
  AddNewSeriesModal,
  AddFlicksToSeriesModal,
} from '../../Profile/components/index'
import { Text, Heading, EmptyState, ScreenState } from '../../../components'

export interface AddFlick {
  open: boolean
  seriesId: string
}

const UserSeries = ({
  userData,
}: {
  userData: Partial<User> & Partial<UserFragment>
}) => {
  const [newSeriesModal, setNewSeriesModal] = useState<boolean>(false)
  const [addFlickSeriesModal, setAddFlickSeriesModal] = useState<AddFlick>({
    open: false,
    seriesId: '',
  })

  const { data, loading, error } = useGetUserSeriesQuery({
    variables: {
      userId: userData.sub as string,
      limit: 5,
    },
  })

  if (loading) return <ScreenState title="Loading..." loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return (
    <div className="flex w-full flex-col bg-blue-100 p-2">
      <Text className="mt-2 ml-4 align-middle text-2xl rounded-lg">
        My Series
      </Text>
      <div className="flex justify-end flex-row gap-3">
        <AddNewSeriesModal
          open={newSeriesModal}
          handleClose={() => {
            setNewSeriesModal(false)
          }}
          setAddFlickSeriesModal={setAddFlickSeriesModal}
        />
        <AddFlicksToSeriesModal
          open={addFlickSeriesModal.open}
          seriesId={addFlickSeriesModal.seriesId}
          handleClose={() => {
            setAddFlickSeriesModal({
              open: false,
              seriesId: '',
            })
          }}
        />
        <button
          className="flex justify-end align-middle p-2 pb-2 text-base cursor-pointer bg-blue-400 bg-opacity-50 rounded-lg text-white"
          type="button"
          onClick={() => setNewSeriesModal(true)}
        >
          Add Series
        </button>

        {data && data.Series.length > 0 && (
          <Link to="/profile/series">
            <Text className="object-none object-right text-blue-400 underline m-2">
              see all
            </Text>
          </Link>
        )}
      </div>
      {!data && <EmptyState text="You don't have any series" width={400} />}
      <div className=" w-full flex flex-row">
        {data &&
          data.Series.length > 0 &&
          data.Series.map((series) => (
            <div
              key={series.id}
              className="flex flex-row h-20 md:h-32 rounded-lg p-4 ml-7 w-60 md:w-80 lg:w-80 m-2 border-blue-400 border-2 bg-white shadow-md"
            >
              <img
                src={
                  series.picture
                    ? series.picture
                    : 'https://png.pngitem.com/pimgs/s/31-316453_firebase-logo-png-transparent-firebase-logo-png-png.png '
                }
                alt="https://png.pngitem.com/pimgs/s/31-316453_firebase-logo-png-transparent-firebase-logo-png-png.png "
                className="w-10 md:w-10 lg:w-10 h-10 md:h-10 lg:h-10 border-blue-300 border-2 rounded-lg"
              />
              <div className="w-full">
                <Link to={`/profile/series/${series.id}`}>
                  <Heading className="text-gray-600 text-md md:capitalize font-bold p-2">
                    {series.name ? series.name : '  '}
                  </Heading>
                </Link>
                <Heading className="text-gray-600 md:font-light md:capitalize text-md p-2">
                  {series.description}
                </Heading>

                <Text className="  text-sm flex justify-end align-bottom object-bottom">
                  {series.Flick_Series_aggregate.aggregate?.count}
                  {series.Flick_Series_aggregate.aggregate?.count === 1
                    ? ' Flick'
                    : ' Flicks'}
                </Text>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export default UserSeries
