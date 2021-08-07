import React from 'react'
import { useRecoilValue } from 'recoil'
import { useGetUserSeriesQuery } from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'

const Series = () => {
  const userdata = (useRecoilValue(userState) as User) || {}

  const { data } = useGetUserSeriesQuery({
    variables: {
      userId: userdata.sub as string,
      limit: 60,
    },
  })

  return (
    <div className="  flex flex-col max-w-full">
      <text className="m-2 p-3 bg-pink-400 bg-opacity-25 text-3xl rounded-lg w-auto">
        Series
      </text>
      <div className=" max-w-full grid grid-flow-row grid-cols-3 grid-rows-3 gap-4">
        {data && data.Series.length > 0 ? (
          data?.Series.map((series) => (
            <div
              key={series.id}
              className="p-8 m-2 bg-gradient-to-r from-pink-400 via-orange-500 to-red-500 rounded shadow-md"
            >
              <h2 className="text-base text-gray-700  ">{series.name}</h2>
              <p className="text-gray-600">{series.description}</p>
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

export default Series
