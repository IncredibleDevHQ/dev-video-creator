/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */
import React, { useEffect, useState } from 'react'
import Gravatar from 'react-gravatar'
import { FiEdit } from 'react-icons/fi'
import { IoCheckmarkDone } from 'react-icons/io5'
import { useRecoilValue } from 'recoil'
import { Link, useHistory, useParams } from 'react-router-dom'
import { Auth, authState } from '../../../stores/auth.store'
import { Button, Heading, ScreenState, Text } from '../../../components'
import { Icons } from '../../../constants'
import {
  useGetSingleSeriesLazyQuery,
  useSeriesFlicksQuery,
} from '../../../generated/graphql'
import { NewFlickBanner } from '../../Dashboard/components'
import AddFlicksToSeriesModal from './AddFlicksToSeriesModal'

const FV = ({
  flick,
  seriesParticipants,
  setSeriesParticipants,
  seriesId,
}: {
  flick: any
  seriesParticipants: {
    name: string
    photo: string
    email: string
  }[]
  setSeriesParticipants: React.Dispatch<
    React.SetStateAction<
      {
        name: string
        photo: string
        email: string
      }[]
    >
  >
  seriesId: string
}) => {
  const [open, setOpen] = useState(false)
  const { isAuthenticated } = (useRecoilValue(authState) as Auth) || {}
  const history = useHistory()
  const [flicksAdded, setFlicksAdded] = useState<boolean>(false)
  const [GetSingleSeries, { data, error }] = useGetSingleSeriesLazyQuery()

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  useEffect(() => {
    flick.participants.map((participant: any) => {
      setSeriesParticipants((prevUsers) => {
        if (
          prevUsers.find((element) => element.email === participant.user.email)
        )
          return [...prevUsers]
        return [
          ...prevUsers,
          {
            name: participant.user.displayName as string,
            email: participant.user.email as string,
            photo: participant.user.picture as string,
          },
        ]
      })
      return ''
    })
  }, [flick.participants])

  return isAuthenticated ? (
    <Link to={`/flick/${flick?.id}`}>
      <div className=" w-full gap-4">
        {flick.length === 0 && (
          <div className="flex flex-col justify-center items-center">
            <img src={Icons.EmptyState} alt="I" />
            <Text className="text-base mt-5">
              Uh-oh, you don&apos;t have any flicks yet.
            </Text>
            <div className="flex flex-row">
              <NewFlickBanner seriesId={seriesId} />
              <Button
                type="button"
                appearance="secondary"
                size="small"
                className="text-white mt-5 ml-5"
                onClick={() => setOpen(true)}
              >
                Add Flick
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-row h-40 w-2/5 mb-7 bg-white">
        <div className="w-64 flex items-center justify-center border-2">
          <img src={Icons.flickIcon} alt="I" className="border-2" />
        </div>
        <div className="flex flex-col">
          {flick?.producedLink ? (
            <div className="bg-green-300 h-5 w-24 ml-4 flex flex-row-1 items-center justify-center">
              <IoCheckmarkDone size={15} />
              <Text className="text-green-700 text-sm pl-2">Published</Text>
            </div>
          ) : (
            <div
              style={{
                background: '#FFEDD5',
              }}
              className="ml-4 flex flex-row max-w-min px-2 py-1 rounded-sm items-center justify-center"
            >
              <FiEdit size={12} style={{ color: '#C2410C' }} />
              <Text className="text-red-700 text-xs pl-2">Draft</Text>
            </div>
          )}
          <Heading className="flex flex-row text-lg md:capitalize font-bold pl-4 mt-5 w-40 truncate overflow-ellipsis">
            {flick?.name}
          </Heading>
          <div className="h-8 relative w-40">
            <span
              style={{ zIndex: 0 }}
              className="top-0 left-0 w-8 h-8 rounded-full absolute animate-spin-slow "
            />
            <div className="z-10 mt-5 w-8 h-8 pt-5 flex flex-row absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 left-6">
              {flick?.participants.map((participant: any) =>
                participant.user.picture ? (
                  <img
                    src={participant.user.picture as string}
                    alt="I"
                    className="w-8 h-8 rounded-full bg-gray-100"
                  />
                ) : (
                  <Gravatar
                    className="w-8 h-8 rounded-full bg-gray-100"
                    email={participant.user.email as string}
                  />
                )
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="bg-gray-200 h-0.5 w-2/3 mt-1 mb-3" />
      <AddFlicksToSeriesModal
        setFlicksAdded={setFlicksAdded}
        open={open}
        setOpen={setOpen}
        seriesId={data?.Series_by_pk?.id}
        seriesName={data?.Series_by_pk?.name}
        flicksAdded={flicksAdded}
        flicks={
          data?.Series_by_pk?.Flick_Series.map(
            (flick) => flick.flick?.id as string
          ) || []
        }
      />
    </Link>
  ) : (
    flick.producedLink && (
      <div
        className="hover:border-green-500 cursor-pointer"
        onClick={() => {
          history.push(`/view/${flick.joinLink}`)
        }}
      >
        <div className="flex flex-row h-40 w-2/5 mb-7 bg-white">
          <img
            src="https://cdn.educba.com/academy/wp-content/uploads/2019/05/What-is-Coding.jpg"
            alt="I"
            className="w-64 h-36"
          />
          <div className="flex flex-col">
            <Heading className="flex flex-row text-lg md:capitalize font-bold pl-4 mt-5 w-40 truncate overflow-ellipsis">
              {flick?.name}
            </Heading>
          </div>
        </div>
        <div className="bg-gray-200 h-0.5 w-2/3 mt-1 mb-3" />
      </div>
    )
  )
}

export default FV
