import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { atom, RecoilState } from 'recoil'
import { useGetUserSeriesQuery, UserFragment } from '../../../generated/graphql'
import { User } from '../../../stores/user.store'
import { AddNewSeriesModal, AddFlicksToSeriesModal } from './index'

interface Props {
  userdata: Partial<User> & Partial<UserFragment>
}
interface AddFlick {
  open: boolean
}

export const recoilState: RecoilState<string> = atom({
  key: 'mutatedSeriesId',
  default: '',
})

const UserSeries = ({ userdata }: Props) => {
  const [newSeriesModal, setNewSeriesModal] = useState<boolean>(false)
  const [addFlickSeriesModal, setAddFlickSeriesModal] = useState<AddFlick>({
    open: false,
  })

  const { data } = useGetUserSeriesQuery({
    variables: {
      userId: userdata.sub as string,
      limit: 5,
    },
  })

  return (
    <div className="flex w-full flex-col ">
      <p className="mt-4 ml-2 align-middle text-xl rounded-lg">My Series</p>
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
          handleClose={() => {
            setAddFlickSeriesModal({
              open: false,
            })
          }}
        />
        <button
          className="flex justify-end align-middle p-2 text-base cursor-pointer bg-pink-400 bg-opacity-50 rounded-lg"
          type="button"
          onClick={() => setNewSeriesModal(true)}
        >
          Add Series
        </button>

        {data && data.Series.length > 0 ? (
          <Link to="/profile/series">
            <button type="button" className="object-none object-right">
              see all
            </button>
          </Link>
        ) : (
          <></>
        )}
      </div>
      <div className=" max-w-full flex flex-row">
        {data && data.Series.length > 0 ? (
          data?.Series.map((series) => (
            <div
              key={series.id}
              className="p-8 w-3/5 m-2 bg-gradient-to-r from-pink-400 via-orange-500 to-red-500 rounded shadow-md"
            >
              <h2 className="text-base text-gray-700  ">{series.name}</h2>
            </div>
          ))
        ) : (
          <p className="max-w-full mt-4 text-lg flex justify-center align-middle">
            You dont have any series yet!
          </p>
        )}
      </div>
    </div>
  )
}

export default UserSeries
