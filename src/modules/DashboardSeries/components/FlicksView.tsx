/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */
import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import Gravatar from 'react-gravatar'
import { FiEdit, FiMoreHorizontal } from 'react-icons/fi'
import { IoCheckmarkDone } from 'react-icons/io5'
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

const FlickTileDrafts = ({
  flick,
  handleRefetch,
}: {
  flick: BaseFlickFragment
  handleRefetch: (refresh?: boolean) => void
}) => {
  const history = useHistory()

  return (
    <>
      <div className="flex flex-row w-full h-48">
        <FlickTooltip
          key={flick?.id}
          flick={flick}
          handleRefetch={handleRefetch}
        />
        <div
          className="w-64 flex items-center justify-center border-2"
          onClick={() => {
            history.push(`/flick/${flick.id}`)
          }}
        >
          <img src={Icons.flickIcon} alt="I" className="border-2" />
        </div>

        <div className="flex flex-col">
          <div
            style={{
              background: '#FFEDD5',
            }}
            className="ml-4 flex flex-row max-w-min px-2 py-1 rounded-sm items-center justify-center"
          >
            <FiEdit size={12} style={{ color: '#C2410C' }} />
            <Text className="text-red-700 text-xs pl-2">Draft</Text>
          </div>

          <Heading className="text-lg md:capitalize font-bold pl-4 mt-5 w-40 truncate overflow-ellipsis">
            {flick.name}
          </Heading>
          <Participants flick={flick} />
        </div>
      </div>
    </>
  )
}

const FlickTilePublished = ({
  flick,
  handleRefetch,
}: {
  flick: BaseFlickFragment
  handleRefetch: (refresh?: boolean) => void
}) => {
  const history = useHistory()
  const userdata = (useRecoilValue(userState) as User) || {}
  const [editFlickName, setEditFlickName] = useState(false)
  const [updateFlickMutation, { data: updateNameData }] =
    useUpdateFlickMutation()
  const updateFlickMutationFunction = async (newName: string) => {
    if (editFlickName) {
      await updateFlickMutation({
        variables: {
          name: newName,
          flickId: flick?.id,
        },
      })
    }
  }

  useEffect(() => {
    if (!updateNameData) return
    setEditFlickName(false)
  }, [updateNameData])

  return (
    <>
      <div className="flex flex-row w-full h-32 m-1">
        <FlickTooltip
          key={flick?.id}
          flick={flick}
          handleRefetch={handleRefetch}
        />
        <div
          className="w-64 flex items-center justify-center border-2"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return
            history.push(`/view/${flick.joinLink}`)
          }}
        >
          <img src={Icons.flickIcon} alt="I" className="border-2" />
        </div>

        <div className="flex flex-col">
          {flick.owner?.userSub === userdata.sub ? (
            <Heading
              className="text-lg md:capitalize font-bold pl-4 mt-5 w-40 truncate overflow-ellipsis cursor-auto p-1 rounded-lg hover:bg-gray-300"
              contentEditable={editFlickName}
              onClick={() => {
                setEditFlickName(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  updateFlickMutationFunction(e.currentTarget.innerText)
                }
              }}
            >
              {flick?.name}
            </Heading>
          ) : (
            <Heading className="text-lg md:capitalize font-bold pl-4 mt-5 w-40 truncate overflow-ellipsis">
              {flick?.name}
            </Heading>
          )}
          <Participants flick={flick} />
        </div>
      </div>
    </>
  )
}

const Participants = ({ flick }: { flick: BaseFlickFragment }) => {
  return (
    <div className="h-8 relative w-40">
      <span
        style={{ zIndex: 0 }}
        className="top-0 left-0 w-8 h-8 rounded-full absolute animate-spin-slow "
      />
      <div className="z-10 mt-5 w-8 h-8 flex flex-row absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 left-6">
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
    </div>
  )
}

const FlickTooltip = ({
  flick,
  handleRefetch,
}: {
  flick: BaseFlickFragment
  handleRefetch: (refresh?: boolean) => void
}) => {
  const userdata = (useRecoilValue(userState) as User) || {}
  const [options, setOptions] = useState(false)
  const [deleteFlick, { data: deleteData, loading }] = useDeleteFlickMutation()
  const extraOptions = ['Delete Flick', 'Edit in studio']
  const history = useHistory()

  const deleteFlickFunction = async (flickId: string) => {
    await deleteFlick({
      variables: {
        flickId,
      },
    })
  }

  useEffect(() => {
    if (!deleteData) return
    emitToast({
      title: 'Success',
      description: 'Successfully deleted the flick',
      type: 'success',
    })
    handleRefetch(true)
  }, [deleteData])

  if (loading) return <ScreenState title="Just a jiffy" loading />

  return (
    <Tooltip
      isOpen={options}
      setIsOpen={setOptions}
      content={
        <div
          className={cx(
            'bg-gray-100 w-40 border-gray-200 rounded-sm p-1',
            flick.owner?.userSub !== userdata.sub
              ? 'cursor-not-allowed'
              : 'cursor-pointer'
          )}
        >
          {extraOptions.map((option) => (
            <>
              {flick.producedLink && option && option === 'Edit in studio' && (
                <>
                  <div className="bg-gray-200 h-0.5 w-full" />
                  <div
                    className=""
                    onClick={(e) => {
                      e.stopPropagation()
                      history.push(`/flick/${flick.id}`)
                    }}
                  >
                    {option}
                  </div>
                </>
              )}
              {option && option === 'Delete Flick' && (
                <div
                  onClick={() => {
                    if (flick.owner?.userSub !== userdata.sub) return
                    deleteFlickFunction(flick.id)
                  }}
                >
                  {option}
                </div>
              )}
            </>
          ))}
        </div>
      }
      placement="top-end"
      hideOnOutsideClick
    >
      <FiMoreHorizontal
        className="absolute w-6 h-6 text-gray-400 cursor-pointer"
        size={30}
        onClick={() => setOptions(!options)}
      />
    </Tooltip>
  )
}

const FlicksView = () => {
  const params: { id?: string } = useParams()
  const { data: seriesData } = useSeriesFlicksQuery({
    variables: {
      id: params.id,
    },
  })
  const { isAuthenticated } = (useRecoilValue(authState) as Auth) || {}
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
    <>
      {isAuthenticated ? (
        <div>
          <div className=" w-full gap-4">
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
            <div
              key={flick.flick?.id}
              className="flex flex-col h-40 w-2/5 mb-7 bg-white"
            >
              {flick.flick?.producedLink ? (
                <FlickTilePublished
                  key={flick.flick?.id}
                  flick={flick.flick}
                  handleRefetch={(refresh) => {
                    if (refresh) refetch()
                  }}
                />
              ) : flick.flick && !flick.flick?.producedLink ? (
                <FlickTileDrafts
                  key={flick.flick?.id}
                  flick={flick.flick}
                  handleRefetch={(refresh) => {
                    if (refresh) refetch()
                  }}
                />
              ) : (
                'Add flicks to videos !! '
              )}

              <div className="bg-gray-200 h-0.5 w-full mt-3" />
            </div>
          ))}
        </div>
      ) : (
        seriesData?.Flick_Series.map(
          (flick) =>
            flick.flick?.producedLink && (
              <div className="hover:border-green-500 cursor-pointer">
                <div
                  key={flick.flick?.id}
                  className="flex flex-col h-40 w-2/5 mb-7 bg-white"
                >
                  {flick.flick && flick.flick?.producedLink ? (
                    <FlickTilePublished
                      key={flick.flick?.id}
                      flick={flick.flick}
                      handleRefetch={(refresh) => {
                        if (refresh) refetch()
                      }}
                    />
                  ) : (
                    'Yo!! Well this series yet to Publish their Flicks'
                  )}
                  <div className="bg-gray-200 h-0.5 w-full mt-3" />
                </div>
              </div>
            )
        )
      )}
    </>
  )
}
export default FlicksView
