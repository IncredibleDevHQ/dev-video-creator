/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */
import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { FiEdit, FiMoreHorizontal } from 'react-icons/fi'
import { IoTrashOutline } from 'react-icons/io5'
import { useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { emitToast, Heading, Text, Tooltip } from '../../../components'
import { Icons } from '../../../constants'
import {
  BaseFlickFragment,
  FlickFragment,
  useDeleteFlickMutation,
  User,
} from '../../../generated/graphql'
import { userState } from '../../../stores/user.store'

const FlickTile = ({
  flick,
  handleRefetch,
}: {
  flick: BaseFlickFragment
  handleRefetch: (id: string, refresh?: boolean) => void
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
    handleRefetch(flick.id, true)
  }, [data])

  return (
    <div
      className="bg-gray-50 rounded-md h-44 border-2 border-gray-300 cursor-pointer relative hover:border-green-500"
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
      <Heading className="text-sm md:capitalize pt-2 mt-0 font-semibold text-gray-800 truncate overflow-ellipsis">
        {flick.name}
      </Heading>
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
                    <IoTrashOutline size={21} className="text-gray-600 mr-4" />
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
  )
}

const Drafts = ({
  flicks,
  handleRefetch,
}: {
  flicks: FlickFragment[]
  handleRefetch: (id: string, refresh?: boolean) => void
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-y-12 gap-x-6 p-0 mx-28 justify-center mb-20">
      {flicks.map(
        (flick) =>
          !flick.producedLink && (
            <FlickTile
              key={flick.id}
              flick={flick}
              handleRefetch={(id, refresh) => {
                if (refresh) handleRefetch(id, refresh)
              }}
            />
          )
      )}
    </div>
  )
}

export default Drafts
