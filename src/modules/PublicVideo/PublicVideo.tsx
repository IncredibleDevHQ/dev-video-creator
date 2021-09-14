/* eslint-disable jsx-a11y/media-has-caption */
import React, { useEffect } from 'react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { EmptyState, Heading, Navbar, ScreenState } from '../../components'
import config from '../../config'
import {
  BaseFlickFragment,
  Flick,
  useGetFlickByJoinLinkQuery,
} from '../../generated/graphql'

const PublicVideo = () => {
  const { baseUrl } = config.storage
  const { joinLink } = useParams<{ joinLink: string }>()

  const [flick, setFlick] = useState<BaseFlickFragment>()

  const { data, loading } = useGetFlickByJoinLinkQuery({
    variables: { joinLink },
  })

  useEffect(() => {
    console.log('data', data)
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
    <div>
      <Navbar />
      <div className="flex items-center flex-col justify-center">
        <Heading className=" flex font-black text-4xl capitalize justify-center mb-4">
          {flick.name}
        </Heading>
        <video
          className=" max-w-7xl bg-gray-800 m-1 rounded-md p-1"
          src={baseUrl + data?.Flick[0].producedLink}
          typeof="mp4"
          preload="auto"
          controls
        />
      </div>
    </div>
  )
}

export default PublicVideo
