import React from 'react'
import { useRecoilValue } from 'recoil'
import { FlicksList, recoilFlicksArray } from '../DataStructure'

const Flicks = () => {
  const FlickList = useRecoilValue<FlicksList>(recoilFlicksArray)

  return (
    <div className="  flex flex-col max-w-full">
      <p className="m-2 p-3 bg-pink-400 bg-opacity-25 text-3xl rounded-lg w-auto">
        Flicks
      </p>
      <div className=" max-w-full grid grid-flow-row grid-cols-3 grid-rows-3 gap-4">
        {FlickList.userFlicksList.length > 0 ? (
          FlickList.userFlicksList.map((flick) => (
            <div
              key={flick.id}
              className="p-8 m-2 bg-gradient-to-r from-pink-400 via-orange-500 to-red-500 rounded shadow-md"
            >
              <h2 className="text-base text-gray-700  ">{flick.name}</h2>
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

export default Flicks
