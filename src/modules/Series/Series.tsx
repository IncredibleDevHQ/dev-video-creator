import React from 'react'
import { useRecoilValue } from 'recoil'
import { Link } from 'react-router-dom'
import { useGetUserSeriesQuery } from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'
import { Text, Heading, EmptyState, ScreenState } from '../../components'

const Series = () => {
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
    <div className="  flex p-2 flex-col bg-blue-100 w-full">
      <div className="m-1 p-1 rounded-lg border-blue-400 border-2 bg-white w-auto">
        <Text className="m-1 p-1  text-3xl text-black rounded-lg w-auto">
          Series
        </Text>
      </div>
      {!data && (
        <EmptyState text=" You dont have any series yet!" width={400} />
      )}
      <div className="w-full grid grid-flow-row grid-cols-5 gap-4">
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
                className="w-10 md:w-10 lg:w-10 h-10 md:h-10 lg:h-10 border-blue-300 border-2 rounded-lg"
                alt="https://png.pngitem.com/pimgs/s/31-316453_firebase-logo-png-transparent-firebase-logo-png-png.png"
              />
              <div className="w-full">
                <Link to={`/profile/series/${series.id}`}>
                  <Heading className="text-gray-600 text-md md:capitalize font-bold p-2">
                    {series.name}
                  </Heading>
                </Link>
                <Heading className="text-gray-600 md:font-light md:capitalize text-md p-2">
                  {series.description}
                </Heading>

                <Text className="  text-sm flex justify-end align-bottom object-bottom">
                  2 Flicks
                </Text>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export default Series
