import React from 'react'
import { Link } from 'react-router-dom'
import { useGetMyFlicksQuery } from '../../../generated/graphql'

const UserFlicks = () => {
  const { data } = useGetMyFlicksQuery({
    variables: {
      limit: 5,
    },
  })

  return (
    <div className="flex w-full flex-col ">
      <p className="mt-4 ml-2 align-middle text-xl rounded-lg">My Flicks</p>
      <div className="flex justify-end flex-row gap-3">
        <button
          className="flex justify-end align-middle p-2 text-base cursor-pointer bg-pink-400 bg-opacity-50 rounded-lg"
          type="button"
        >
          Add Flicks
        </button>

        {data && data.Flick.length > 0 ? (
          <Link to="/profile/flicks">
            <button type="button" className="object-none object-right">
              see all
            </button>
          </Link>
        ) : (
          <></>
        )}
      </div>
      <div className=" max-w-full flex flex-row">
        {data && data.Flick.length > 0 ? (
          data?.Flick.map((flick) => (
            <div
              key={flick.id}
              className="p-8 m-2 bg-gradient-to-r from-pink-400 via-orange-500 to-red-500 rounded shadow-md"
            >
              <h2 className="text-base text-gray-700  ">{flick.name}</h2>
              <p className="text-gray-600">{flick.description}</p>
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

export default UserFlicks
