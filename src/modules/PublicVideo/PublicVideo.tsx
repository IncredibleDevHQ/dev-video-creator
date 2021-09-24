/* eslint-disable jsx-a11y/media-has-caption */
import React, { useEffect, useState } from 'react'
import Gravatar from 'react-gravatar'
import { useParams } from 'react-router-dom'
import { EmptyState, Heading, ScreenState } from '../../components'
import Video from '../../components/Video'
import config from '../../config'
import {
  BaseFlickFragment,
  Flick,
  useGetFlickByJoinLinkQuery,
} from '../../generated/graphql'
import { formatDate } from '../../utils/FormatDate'
import { Header } from './components'

const PublicVideo = () => {
  const { baseUrl } = config.storage
  const { joinLink } = useParams<{ joinLink: string }>()

  const [flick, setFlick] = useState<BaseFlickFragment>()

  const { data, loading } = useGetFlickByJoinLinkQuery({
    variables: { joinLink },
  })

  useEffect(() => {
    if (!data?.Flick || data.Flick.length < 1) return
    setFlick(data.Flick[0] as Flick)
  }, [data])

  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (!flick) return <EmptyState width={400} text="Cannot Find any flick" />

  if (!flick.producedLink)
    return (
      <EmptyState
        width={400}
        text="This flick doesn't have the final video yet. Please check back again after sometime."
      />
    )

  return (
    <>
      <Header
        owernId={data?.Flick?.[0].ownerId}
        link={`https://twitter.com/intent/tweet?text=Check this IncredibleDev Flick !%0A${
          data?.Flick?.[0].name
        }%0A${data?.Flick?.[0].description}%0A${
          baseUrl + data?.Flick?.[0].producedLink
        }`}
      />
      <div className="flex flex-col  mt-12 m-60">
        <Video
          className="flex-1 flex-grow-1  w-full   bg-gray-800  rounded-md p-1"
          src={baseUrl + data?.Flick?.[0].producedLink}
        />

        <Heading className=" flex font-black   text-3xl capitalize  mt-10">
          {flick.name}
        </Heading>
        <Heading className=" flex font-normal text-gray-500   text-xs capitalize  ">
          {formatDate(new Date(data?.Flick?.[0].updatedAt))}
        </Heading>
        <div className="grid grid-cols-3 gap-4 pb-3 pl-4 pt-3 w-4/12  mt-6 rounded-lg min-w-min bg-gray-100 ">
          {data?.Flick?.[0].participants &&
            data.Flick[0].participants.length > 0 &&
            data.Flick[0].participants.map((user) => (
              <div className="flex h-auto mr-4 flex-row">
                <div className=" flex w-10 h-10 bg-green-500 place-items-center place-content-center rounded-full">
                  {user.user.picture ? (
                    <img
                      src={user.user.picture}
                      alt="user"
                      className="w-8 h-8 rounded-full bg-gray-100"
                    />
                  ) : (
                    <Gravatar
                      className="w-8 h-8 rounded-full bg-gray-100"
                      email={user.user.email as string}
                    />
                  )}
                </div>
                <Heading className=" flex ml-2 w-auto h-auto mt-2 justify-center font-semibold text-sm capitalize ">
                  {user.user.displayName}
                </Heading>
              </div>

              // <p className=" flex font-black text-4xl capitalize justify-center mb-4">
              //   {flick as string}
              // </p>
            ))}
        </div>
        <Heading className=" flex  w-auto h-auto mt-3  mb-5 font-normal text-base capitalize ">
          {data?.Flick?.[0].description}
        </Heading>
      </div>
    </>
  )
}

export default PublicVideo
