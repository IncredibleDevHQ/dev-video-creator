import React from 'react'
import { Link } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { EmptyState, Heading, ScreenState, Text } from '../../components'
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
      <div className="gap-y-5 p-0 grid grid-cols-4 mr-20 justify-center mt-7 mb-20">
        {data &&
          data.Series.length > 0 &&
          data.Series.map((series) => (
            <div
              key={series.id}
              className="bg-background shadow-md transition-all hover:shadow-xl pb-2 cursor-pointer w-80 h-40 mt-10"
            >
              <img
                src={
                  series.picture
                    ? series.picture
                    : 'https://png.pngitem.com/pimgs/s/31-316453_firebase-logo-png-transparent-firebase-logo-png-png.png '
                }
                className="w-10 md:w-10 lg:w-10 h-10 md:h-10 lg:h-10 border-blue-300 border-2 rounded-lg"
                alt="https://png.pngitem.com/pimgs/s/31-316453_firebase-logo-png-transparent-firebase-logo-png-png.png"
              />
              <div className="w-full">
                <Link to={`/series/${series.id}`}>
                  <Heading className="text-gray-600 text-md md:capitalize font-bold p-2">
                    {series.name}
                  </Heading>
                </Link>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export default DashboardSeriesFlicks
