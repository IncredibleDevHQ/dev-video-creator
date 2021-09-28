/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { useEffect, useState } from 'react'
import Gravatar from 'react-gravatar'
import { useParams } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { Flick } from '..'
import {
  Button,
  EmptyState,
  Heading,
  Navbar,
  ScreenState,
  Text,
  TextField,
} from '../../components'
import {
  useGetSingleSeriesLazyQuery,
  useSeriesFlicksQuery,
} from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'
import SubscribeModal from './components/SubscribeModal'

const PublicView = () => {
  const [open, setOpen] = useState(false)
  const [flicksAdded, setFlicksAdded] = useState<boolean>(false)
  const params: { seriesSlug?: string } = useParams()

  const [GetSingleSeries, { data, loading, error, refetch }] =
    useGetSingleSeriesLazyQuery()

  const seriesId = params.seriesSlug?.split('_').splice(-1).join()
  const { data: flickData } = useSeriesFlicksQuery({
    variables: {
      id: seriesId,
    },
  })

  useEffect(() => {
    GetSingleSeries({
      variables: {
        id: seriesId,
      },
    })
  }, [flicksAdded])

  const Collaborators = () => {
    const userData = (useRecoilValue(userState) as User) || {}

    return (
      <div className="flex flex-row">
        <div className="" onClick={() => setOpen(true)}>
          {userData.picture ? (
            <img
              src={userData.picture}
              alt={userData.displayName || 'user'}
              className="w-12 h-12 mx-3 my-2 rounded-full border-blue-200 border-4"
            />
          ) : (
            <Gravatar
              className="w-12 h-12 mx-3 my-2 rounded-full"
              email={userData.email as string}
            />
          )}
        </div>
        <div className="mx-3 my-2">
          <Text>{userData.displayName}</Text>
          <Text>{userData.username}</Text>
        </div>
        <SubscribeModal
          open={open}
          handleClose={() => {
            setOpen(false)
          }}
        />
      </div>
    )
  }

  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return (
    <>
      <Navbar />
      <div className="relative flex flex-col gap-2 ml-28 mr-28 mt-10">
        <div className="flex flex-row">
          <Heading className="text-xl mb-10 font-bold">
            {data?.Series_by_pk?.name}
          </Heading>

          <div className="flex flex-col ml-auto px-2 gap-x-3 justify-center space-y-5">
            <EmailSubscriber />
            <div className="flex flex-col">
              <Heading className="text-lg md:capitalize  pl-1 mt-5">
                Collaborators
              </Heading>
              <Collaborators />
            </div>
          </div>
        </div>

        <div className=" w-full gap-4">
          {!flickData && (
            <EmptyState text="You don't have any series" width={400} />
          )}
          {flickData?.Flick_Series.map((flick) => (
            <div
              key={flick.flick?.id}
              className="flex flex-col h-40 w-2/5 mb-7 bg-white"
            >
              <div className="flex flex-row">
                <img
                  src="https://cdn.educba.com/academy/wp-content/uploads/2019/05/What-is-Coding.jpg"
                  alt="I"
                  className="w-64 h-36"
                />

                <div className="flex flex-col">
                  {/* {flick.flick?.producedLink && (
                    
                  )} */}

                  <Heading className="text-lg md:capitalize font-bold pl-4 mt-5">
                    {flick.flick?.name}
                  </Heading>
                </div>
              </div>
              <div className="bg-gray-200 h-0.5 w-full mt-3" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export const EmailSubscriber = () => {
  return (
    <div className="flex flex-row space-x-5 ">
      <TextField className="text-xl" placeholder="Email Address" label="" />
      <Button type="button" appearance="primary" size="small" className="p-5">
        Subscribe
      </Button>
    </div>
  )
}

export default PublicView
