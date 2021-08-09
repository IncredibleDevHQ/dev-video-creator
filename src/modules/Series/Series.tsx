import React from 'react'
import { useRecoilValue } from 'recoil'
import { Link } from 'react-router-dom'
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
    <div className="  flex p-2 flex-col bg-blue-100 max-w-full">
      <div className="m-1 p-1 rounded-lg border-blue-400 border-2 bg-white w-auto">
        <p className="m-1 p-1  text-3xl text-black rounded-lg w-auto">Series</p>
      </div>
      <div className=" max-w-full grid grid-flow-row grid-cols-5 gap-4">
        {data && data.Series.length > 0 ? (
          data.Series.map((series) => (
            <div
              key={series.id}
              className="flex flex-row h-20 md:h-32 rounded-lg p-4 ml-7 w-60 md:w-80 lg:w-80 m-2 border-blue-400 border-2 bg-white shadow-md"
            >
              {/* <p>{series.picture as string}</p> */}
              <img
                src={
                  series.picture
                    ? series.picture
                    : 'https://png.pngitem.com/pimgs/s/31-316453_firebase-logo-png-transparent-firebase-logo-png-png.png '
                }
                alt="https://www.google.com/url?sa=i&url=http%3A%2F%2Fwww.manuscriptorium.com%2Fapps%2Fgbank%2Fgbank_table.php&psig=AOvVaw0VwFCv74ldPzmrxJXJEJaV&ust=1628622050638000&source=images&cd=vfe&ved=0CAsQjRxqFwoTCMjLn4jQpPICFQAAAAAdAAAAABAI"
                className="w-10 md:w-10 lg:w-10 h-10 md:h-10 lg:h-10 border-blue-300 border-2 rounded-lg"
              />
              <div className="w-full">
                <Link to={`/profile/series/${series.id}`}>
                  <h2 className="text-gray-600 text-md md:capitalize font-bold p-2">
                    {series.name ? series.name : '  '}
                  </h2>
                </Link>
                <h2 className="text-gray-600 md:font-light md:capitalize text-md p-2">
                  {series.description}
                </h2>

                <p className="  text-sm flex justify-end align-bottom object-bottom">
                  2 Flicks
                </p>
              </div>
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
