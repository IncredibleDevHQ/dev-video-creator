/* eslint-disable jsx-a11y/media-has-caption */
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { EmptyState, Heading, Navbar, ScreenState } from '../../components'
import Video from '../../components/Video'
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
      <Navbar />
      <div className="flex flex-col items-center">
        <Heading className=" flex font-black text-4xl capitalize justify-center mb-4">
          {flick.name}
        </Heading>
        <Video
          className="flex-1 flex-grow-1 w-3/5 bg-gray-800 m-1 rounded-md p-1"
          src={baseUrl + data?.Flick?.[0].producedLink}
        />
      </div>
    </>
  )
}

export default PublicVideo
