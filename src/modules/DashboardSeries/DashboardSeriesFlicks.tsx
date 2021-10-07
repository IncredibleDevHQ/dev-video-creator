import React from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, Heading, ScreenState } from '../../components'
import { Icons } from '../../constants'
import {
  GetUserSeriesQuery,
  useGetUserSeriesQuery,
} from '../../generated/graphql'

const DashboardSeriesFlicks = ({
  data,
}: {
  data: GetUserSeriesQuery | undefined
}) => {
  // const { data, error } = useGetUserSeriesQuery({
  //   variables: {
  //     limit: 60,
  //   },
  // })

  // if (error)
  //   return (
  //     <ScreenState title="Something went wrong!!" subtitle={error.message} />
  //   )
  if (!data) return <></>

  return (
    <div className="gap-y-5 p-0 grid grid-cols-4 mr-20 justify-center mt-7 mb-20 rounded-md ml-28">
      {data &&
        data.Series.map((series) => (
          <Link to={`/series/${series.id}`} key={series.id}>
            <div
              key={series.id}
              className="bg-gray-50 hover:border-green-500 cursor-pointer w-60 h-36 rounded-md border-gray-300 border-2 items-center justify-center"
            >
              <img src={Icons.seriesFolder} alt="I" className="ml-20 mt-10" />
              <div className="bg-gray-300 h-5 w-14 p-1 justify-end ml-44 mb-20 mt-2 rounded-sm text-xs items-center">
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
  )
}

export default DashboardSeriesFlicks
