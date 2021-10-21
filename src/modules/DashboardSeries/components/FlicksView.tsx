/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */
import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import Gravatar from 'react-gravatar'
import { FiEdit, FiMoreHorizontal } from 'react-icons/fi'
import { IoCheckmarkDone, IoTrashOutline } from 'react-icons/io5'
import { useHistory, useParams } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import {
  emitToast,
  Heading,
  ScreenState,
  Text,
  Tooltip,
} from '../../../components'
import { Icons } from '../../../constants'
import {
  BaseFlickFragment,
  useDeleteFlickMutation,
  useGetSingleSeriesQuery,
  User,
  useSeriesFlicksQuery,
  useUpdateFlickMutation,
} from '../../../generated/graphql'
import { Auth, authState } from '../../../stores/auth.store'
import { userState } from '../../../stores/user.store'

const Participants = ({ flick }: { flick: BaseFlickFragment }) => {
  return (
    <div className="w-8 h-8 flex flex-row">
      {flick?.participants
        .slice(0, 5)
        .map((participant) =>
          participant.user.picture ? (
            <img
              src={participant.user.picture as string}
              alt="I"
              className="w-8 h-8 rounded-full bg-gray-100"
            />
          ) : (
            <Gravatar className="w-8 h-8 rounded-full bg-gray-100" />
          )
        )}
    </div>
  )
}

const FlickTile = ({
  flick,
  handleRefetch,
}: {
  flick: BaseFlickFragment
  handleRefetch: (refresh?: boolean) => void
}) => {
  const [deleteFlick, { data }] = useDeleteFlickMutation()
  const history = useHistory()
  const userdata = (useRecoilValue(userState) as User) || {}

  const [overflowButtonVisible, setOverflowButtonVisible] = useState(false)
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false)

  const deleteFlickFunction = async () => {
    await deleteFlick({
      variables: {
        flickId: flick.id,
      },
    })
  }

  useEffect(() => {
    if (!data) return
    emitToast({
      title: 'Success',
      description: 'Successfully deleted the flick',
      type: 'success',
    })
    handleRefetch(true)
  }, [data])

  return (
    <div className="flex">
      <div
        className="bg-gray-50 rounded-md h-44 w-5/12 border-2 border-gray-300 cursor-pointer relative"
        onClick={() => {
          history.push(`/flick/${flick.id}`)
        }}
        onMouseEnter={() => setOverflowButtonVisible(true)}
        onMouseLeave={() => {
          setOverflowButtonVisible(false)
          setOverflowMenuVisible(false)
        }}
      >
        <img src={Icons.flickIcon} alt="I" className="w-full h-full p-16" />

        {overflowButtonVisible && (
          <div
            className="absolute top-0 right-0 m-2 bg-gray-50 w-min p-1 shadow-md rounded-md cursor-pointer"
            onClick={(e) => {
              setOverflowMenuVisible(!overflowMenuVisible)
              e.stopPropagation()
            }}
          >
            <FiMoreHorizontal />
            {overflowMenuVisible && (
              <Tooltip
                isOpen={overflowMenuVisible}
                setIsOpen={setOverflowMenuVisible}
                content={
                  <div className="flex flex-col px-6 py-2 mt-2 bg-gray-50 rounded-md border border-gray-300 cursor-pointer">
                    <div
                      className={cx('flex', {
                        'cursor-not-allowed text-gray-400':
                          flick.owner?.userSub !== userdata.sub,
                      })}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (flick.owner?.userSub !== userdata.sub) return
                        deleteFlickFunction()
                      }}
                    >
                      <IoTrashOutline
                        size={21}
                        className="text-gray-600 mr-4"
                      />
                      <Text className="font-medium">Delete</Text>
                    </div>
                    <div
                      className="flex mt-4"
                      onClick={(e) => {
                        e.stopPropagation()
                        history.push(`/flick/${flick.id}`)
                      }}
                    >
                      <FiEdit size={21} className="text-gray-600 mr-4" />
                      <Text className="font-medium">Edit in studio</Text>
                    </div>
                  </div>
                }
                placement="bottom-start"
                hideOnOutsideClick
              />
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col ml-4 ">
        {flick.producedLink ? (
          <div className="bg-green-100 w-full flex flex-row items-center justify-center py-1 px-2 rounded-sm">
            <IoCheckmarkDone size={15} />
            <Text className="text-green-700 text-sm pl-1">Published</Text>
          </div>
        ) : (
          <div className="bg-orange flex flex-row max-w-min rounded-sm items-center py-1 px-2 justify-center">
            <FiEdit size={12} className="text-orange-darker" />
            <Text className="text-orange-darker text-sm pl-1">Draft</Text>
          </div>
        )}
        <Heading className="text-lg md:capitalize pt-2 mb-4 mt-2 font-semibold text-gray-800 truncate overflow-ellipsis">
          {flick.name}
        </Heading>
        <Participants flick={flick} />
      </div>
    </div>
  )
}

const FlicksView = () => {
  const params: { id?: string } = useParams()
  const { data: seriesData } = useSeriesFlicksQuery({
    variables: {
      id: params.id,
    },
  })
  const { data, error, refetch } = useGetSingleSeriesQuery({
    variables: {
      id: params.id,
    },
  })

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return (
    <div>
      <div className="w-full gap-4">
        {seriesData?.Flick_Series.length === 0 && (
          <div className="flex flex-col justify-center items-center">
            <img src={Icons.EmptyState} alt="I" />
            <Text className="text-base mt-5">
              Uh-oh, you don&apos;t have any flicks yet.
            </Text>
          </div>
        )}
      </div>
      {seriesData?.Flick_Series.map((flick) => (
        <div key={flick.flick?.id} className="flex flex-col w-4/5 bg-white">
          {flick.flick && (
            <FlickTile
              key={flick.flick.id}
              flick={flick.flick}
              handleRefetch={(refresh) => {
                if (refresh) refetch()
              }}
            />
          )}
          <div className="bg-gray-200 h-0.5 w-full my-6" />
        </div>
      ))}
    </div>
  )
}
export default FlicksView
