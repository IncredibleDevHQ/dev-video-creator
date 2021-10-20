import React from 'react'
import { Link } from 'react-router-dom'
import { Heading, Text } from '../../components'
import { Icons } from '../../constants'
import { GetUserSeriesQuery } from '../../generated/graphql'

const DashboardSeriesFlicks = ({
  data,
}: {
  data: GetUserSeriesQuery | undefined
}) => {
  if (data && data.Series.length < 1) return <></>

  return (
    <div className="flex flex-col m-0 p-0 mx-28 mt-12">
      <Text className="font-black text-xl">Your series</Text>
      <div className="gap-y-2 gap-x-6 p-0 grid grid-cols-4 justify-center mt-10 mb-20 rounded-md">
        {data &&
          data.Series.map((series) => (
            <Link to={`/series/${series.id}`} key={series.id}>
              <div
                key={series.id}
                className="bg-gray-50 hover:border-green-500 cursor-pointer rounded-md border-gray-300 border-2 flex justify-end items-end h-44"
              >
                <img
                  src={Icons.seriesFolder}
                  alt="I"
                  className="w-full h-full p-14"
                />
                <div className="bg-gray-300 h-5 p-1 rounded-sm text-xs flex items-center absolute m-2">
                  {!series.flickCount
                    ? `0 Flicks`
                    : `${series.flickCount?.count} Flicks`}
                </div>
              </div>
              <div className="w-full">
                <Heading className="text-sm md:capitalize p-2 mt-0 font-semibold text-gray-800 w-40 truncate overflow-ellipsis">
                  {series.name}
                </Heading>
              </div>
            </Link>
          ))}
      </div>
    </div>
  )
}

export default DashboardSeriesFlicks
