import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, Heading, ScreenState, Text } from '../../components'
import { Icons } from '../../constants'
import {
  Flick_Status_Enum_Enum,
  useGetUserSeriesQuery,
} from '../../generated/graphql'
import seriesModal from '../Series/OrganisationSeries/CreateSeriesModal'

const DashboardSeriesFlicks = () => {
  const { data, error } = useGetUserSeriesQuery({
    variables: {
      limit: 60,
    },
  })

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return (
    <div className="">
      {!data && (
        <EmptyState text=" You dont have any series yet!" width={400} />
      )}
      <div className="gap-y-5 p-0 grid grid-cols-4 mr-20 justify-center mt-7 mb-20 rounded-md">
        {data &&
          data.Series.map((serie) => (
            <Link to={`/series/${serie.id}`} key={serie.id}>
              <div
                key={serie.id}
                className="bg-gray-50 hover:border-green-500 cursor-pointer w-60 h-36 rounded-md border-gray-300 border-2 items-center justify-center"
              >
                <img src={Icons.seriesFolder} alt="I" className="ml-20 mt-10" />
                <div className="bg-gray-300 h-5 w-14 p-1 justify-end ml-44 mb-20 mt-2 rounded-sm text-xs items-center">
                  {!serie.flickCount
                    ? `0 flicks`
                    : `${serie.flickCount?.count} Flicks`}
                </div>
              </div>
              <div className="w-full">
                <Heading className="text-sm md:capitalize p-2 mt-0 font-semibold text-gray-800 w-40 truncate overflow-ellipsis">
                  {serie.name}
                </Heading>
              </div>
            </Link>
          ))}
      </div>
    </div>
  )
}

export default DashboardSeriesFlicks
