import React from 'react'
import { Link } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { EmptyState, Heading, ScreenState } from '../../components'
import { Icons } from '../../constants'
import { useGetUserSeriesQuery, User } from '../../generated/graphql'
import { userState } from '../../stores/user.store'

const DashboardSeriesFlicks = () => {
  const userdata = (useRecoilValue(userState) as User) || {}

  const { data, loading, error } = useGetUserSeriesQuery({
    variables: {
      userId: userdata.sub as string,
      limit: 60,
    },
  })

  if (loading) return <ScreenState title="Just a jiffy" loading />

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
          data.Series.length > 0 &&
          data.Series.map((series) => (
            <Link to={`/series/${series.id}`}>
              <div
                key={series.id}
                className="bg-gray-50 hover:border-green-500 pb-2 cursor-pointer w-60 h-36 rounded-md border-gray-300 border-4"
              >
                <img
                  src={Icons.FoldersIcon}
                  className="w-10 h-10 m-10 ml-24 mt-12"
                  alt="I"
                />
              </div>
              <div className="w-full">
                <Heading className="text-sm md:capitalize p-2 mt-0">
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
