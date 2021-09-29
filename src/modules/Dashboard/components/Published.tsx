/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */
import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { FiMoreHorizontal } from 'react-icons/fi'
import { useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { emitToast, ScreenState, Text, Tooltip } from '../../../components'
import { Icons } from '../../../constants'
import {
  BaseFlickFragment,
  useDeleteFlickMutation,
  useGetUserFlicksQuery,
  User,
} from '../../../generated/graphql'
import { userState } from '../../../stores/user.store'

const InfoTilePublished = ({ flick }: { flick: BaseFlickFragment }) => {
  return (
    <div>
      <Text className="text-sm text-gray-900 mt-3 w-40 truncate overflow-ellipsis">
        {flick.name}
      </Text>
    </div>
  )
}

const VideoTile = ({
  flick,
  handleRefetch,
}: {
  flick: BaseFlickFragment
  handleRefetch: (refresh?: boolean) => void
}) => {
  const history = useHistory()
  const userdata = (useRecoilValue(userState) as User) || {}
  const [options, setOptions] = useState(false)
  const [deleteFlick, { data, loading }] = useDeleteFlickMutation()

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

  if (loading) return <ScreenState title="Just a jiffy" loading />

  return (
    <div className="bg-gray-50 hover:border-green-500 cursor-pointer w-60 h-36 rounded-md items-center justify-center mt-9">
      <div
        className="text-gray-300 hover:border-green-500 cursor-pointer w-60 h-36 border-2"
        onClick={(e) => {
          e.stopPropagation()
          history.push(`/view/${flick.joinLink}`)
        }}
      >
        <Tooltip
          isOpen={options}
          setIsOpen={setOptions}
          content={
            <div
              className={cx(
                'bg-gray-100 w-28 h-10 p-2 rounded-sm',
                flick.owner?.userSub !== userdata.sub
                  ? 'cursor-not-allowed'
                  : 'cursor-pointer'
              )}
              onClick={() => {
                if (flick.owner?.userSub !== userdata.sub) return
                deleteFlickFunction()
              }}
            >
              Delete Flick
            </div>
          }
          placement="bottom-start"
          hideOnOutsideClick
        >
          <FiMoreHorizontal
            className="w-6 h-6 text-gray-400 cursor-pointer"
            size={30}
            onClick={() => setOptions(!options)}
          />
        </Tooltip>
        <img
          src={Icons.flickIcon}
          alt="I"
          className="ml-24 mt-14 border-gray-500 border-2 rounded-md"
        />
      </div>

      <InfoTilePublished key={flick.id} flick={flick} />
    </div>
  )
}

const Published = () => {
  const { sub } = (useRecoilValue(userState) as User) || {}
  const { data, loading, refetch } = useGetUserFlicksQuery({
    variables: { sub: sub as string },
  })
  const [view] = useState<'grid' | 'list'>('grid')
  if (loading) return <ScreenState title="Just a moment..." loading />
  return (
    <div>
      {view === 'grid' && (
        <div className="gap-y-5 p-0 grid grid-cols-4 ml-28 mr-20 justify-center mb-20">
          {data?.Flick.map(
            (flick) =>
              flick.producedLink && (
                <VideoTile
                  key={flick.id}
                  flick={flick}
                  handleRefetch={(refresh) => {
                    if (refresh) refetch()
                  }}
                />
              )
          )}
        </div>
      )}
    </div>
  )
}

export default Published
