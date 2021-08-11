import React from 'react'
import { EmptyState, Heading, Text } from '../../components'
import { useGetMyFlicksQuery } from '../../generated/graphql'

const AllUserFlicks = () => {
  const { data } = useGetMyFlicksQuery()

  return (
    <div className="  flex flex-col w-full">
      <div className="m-1 p-1 rounded-lg border-blue-400 border-2 w-auto">
        <Text className="m-1 p-1  text-3xl text-black rounded-lg w-auto">
          Flicks
        </Text>
      </div>
      <div className=" w-full grid grid-flow-row grid-cols-4">
        {!data && (
          <EmptyState
            text="You don't have any flicks in this series"
            width={400}
          />
        )}

        {data &&
          data.Flick.length > 0 &&
          data.Flick.map((flick) => (
            <div
              key={flick.id}
              className="flex flex-col h-80 md:max-h-80 rounded-lg ml-7 w-60 md:w-80 lg:w-80 m-2 border-blue-400 border-2 bg-white shadow-md"
            >
              <div className="max-h-48 ">
                <img
                  src="https://cdn.educba.com/academy/wp-content/uploads/2019/05/What-is-Coding.jpg"
                  className="max-h-48 w-80 rounded-md"
                  alt="picture"
                />
                <Text className=" text-gray-600 flex justify-end  text-sm p-1">
                  ▪️12:38
                </Text>
              </div>
              <Heading className="text-md md:capitalize text-gray-600 pl-4 font-bold ">
                {flick.name}
              </Heading>
              <Heading className="text-md md:capitalize text-gray-600 pt-2 p-4 font-light ">
                {flick.description}
              </Heading>
            </div>
          ))}
      </div>
    </div>
  )
}

export default AllUserFlicks
