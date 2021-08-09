import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { useGetMyFlicksQuery } from '../../../generated/graphql'
import {
  Flick,
  FlicksList,
  FlicksTypes,
  recoilFlicksArray,
} from '../../DataStructure'

const UserFlicks = () => {
  const [FlickList, setFlickList] =
    useRecoilState<FlicksList>(recoilFlicksArray)

  const { data } = useGetMyFlicksQuery()

  useEffect(() => {
    let list: FlicksTypes = []
    if (data && data?.Flick.length > 0) {
      data.Flick.forEach((flick) => {
        const flickItem: Flick = {
          id: flick.id,
          name: flick.name,
          discription: flick.description as string,
        }
        list = [...list, flickItem]
      })
    }
    setFlickList({ userFlicksList: list })
  }, [data])

  return (
    <div className="flex w-full flex-col p-2 ">
      <p className="mt-2 ml-4 align-middle text-2xl rounded-lg">My Flicks</p>
      <div className="flex justify-end flex-row gap-3">
        <button
          className="flex justify-end align-middle p-2 text-base text-white cursor-pointer bg-blue-400 bg-opacity-50 rounded-lg"
          type="button"
        >
          Add Flicks
        </button>

        {FlickList.userFlicksList.length > 0 ? (
          <Link to="/profile/flicks">
            <p className="object-none m-2 object-right text-blue-400 underline">
              see all
            </p>
          </Link>
        ) : (
          <></>
        )}
      </div>
      <div className=" max-w-full flex flex-row">
        {FlickList.userFlicksList.length > 0 ? (
          FlickList.userFlicksList.slice(0, 5).map((flick) => (
            <div
              key={flick.id}
              className="flex flex-col h-80 md:max-h-80 rounded-lg ml-7 w-60 md:w-80 lg:w-80 m-2 border-blue-400 border-2 bg-white shadow-md"
            >
              <div className="max-h-48 ">
                <img
                  src="https://cdn.educba.com/academy/wp-content/uploads/2019/05/What-is-Coding.jpg"
                  className="max-h-48 w-80 rounded-md"
                  alt="https://www.google.com/url?sa=i&url=http%3A%2F%2Fwww.manuscriptorium.com%2Fapps%2Fgbank%2Fgbank_table.php&psig=AOvVaw0VwFCv74ldPzmrxJXJEJaV&ust=1628622050638000&source=images&cd=vfe&ved=0CAsQjRxqFwoTCMjLn4jQpPICFQAAAAAdAAAAABAI"
                />
                <p className=" text-gray-600 flex justify-end  text-sm p-1">
                  ▪️12:38
                </p>
              </div>
              <h2 className="text-md md:capitalize text-gray-600 pl-4 font-bold ">
                {flick.name}
              </h2>
              <h2 className="text-md md:capitalize text-gray-600 pt-2 p-4 font-light ">
                {flick.discription}
              </h2>
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
