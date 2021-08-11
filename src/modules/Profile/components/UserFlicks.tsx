import React from 'react'
import { Link } from 'react-router-dom'
import { useGetMyFlicksQuery } from '../../../generated/graphql'
import { Text, Heading, EmptyState, ScreenState } from '../../../components'

const UserFlicks = () => {
  const { data, loading, error } = useGetMyFlicksQuery({
    variables: {
      limit: 5,
    },
  })
  if (loading) return <ScreenState title="Loading..." loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return (
    <div className="flex w-full flex-col p-2 ">
      <Text className="mt-2 ml-4 align-middle text-2xl rounded-lg">
        My Flicks
      </Text>
      <div className="flex justify-end flex-row gap-3">
        <button
          className="flex justify-end align-middle p-2 text-base text-white cursor-pointer bg-blue-400 bg-opacity-50 rounded-lg"
          type="button"
        >
          Add Flicks
        </button>
        {data && data?.Flick.length > 0 && (
          <Link to="/profile/flicks">
            <Text className="object-none m-2 object-right text-blue-400 underline">
              see all
            </Text>
          </Link>
        )}
      </div>
      {!data && <EmptyState text="You don't have any series" width={400} />}
      <div className=" w-full flex flex-row">
        {data &&
          data?.Flick.length > 0 &&
          data?.Flick.map((flick) => (
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

export default UserFlicks
