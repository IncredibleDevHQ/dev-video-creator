import React from 'react'
import { useRecoilValue } from 'recoil'
import { FlicksList, recoilFlicksArray } from '../DataStructure'

const UserFlicks = () => {
  const FlickList = useRecoilValue<FlicksList>(recoilFlicksArray)

  return (
    <div className="  flex flex-col max-w-full">
      <div className="m-1 p-1 rounded-lg border-blue-400 border-2 w-auto">
        <p className="m-1 p-1  text-3xl text-black rounded-lg w-auto">Flicks</p>
      </div>
      <div className=" max-w-full grid grid-flow-row grid-cols-4">
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
