import { cx } from '@emotion/css'
import React, { useEffect, useRef } from 'react'
import { IoCloudDone, IoPersonAddSharp, IoRocketSharp } from 'react-icons/io5'
import { MdAssignmentTurnedIn, MdDone } from 'react-icons/md'
import { useParams } from 'react-router-dom'
import { Loading, Text } from '../../../components'
import { useFlickActivityQuery } from '../../../generated/graphql'

const FlickActivity = ({
  menu,
  setMenu,
}: {
  menu: boolean
  setMenu: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const { id }: { id: string } = useParams()

  const { data, loading } = useFlickActivityQuery({
    variables: {
      flickId: id,
    },
  })

  const ActivityIcon = {
    FlickCreated: <IoRocketSharp fontSize="40" opacity="0.4" />,
    ParticipantAdded: <IoPersonAddSharp fontSize="40" opacity="0.4" />,
    FragmentAssignment: <MdAssignmentTurnedIn fontSize="40" opacity="0.4" />,
    FragmentCompleted: <MdDone fontSize="40" opacity="0.4" />,
    FlickPublished: <IoCloudDone fontSize="40" opacity="0.4" />,
  }

  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(e: { target: any }) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownRef])

  return (
    <div
      className={cx(
        'absolute right-0 max-h-96 overflow-x-hidden mt-9 w-96 rounded-md shadow-lg bg-white ring-1 z-50 ring-black ring-opacity-5 focus:outline-none',
        {
          'block ': menu === true,
          'hidden ': menu === false,
        }
      )}
      ref={dropdownRef}
    >
      {/* eslint-disable-next-line no-nested-ternary */}
      {loading ? (
        <Loading className="p-3" />
      ) : data?.FlickActivity.length === 0 ? (
        <Text className="p-3">No New Activity...</Text>
      ) : (
        data?.FlickActivity.map((notif) => {
          return (
            <div
              key={notif.id}
              className="flex items-center border-b-2 hover:bg-gray-100 cursor-pointer text-gray-700 px-4 py-3 text-sm"
            >
              <span className="w-1/6">
                {/* @ts-ignore */}
                {ActivityIcon[notif.type]}
              </span>
              <div className="flex flex-col w-5/6">
                <span className="font-bold">{notif.title}</span>
                <span>{notif.description}</span>
                <span className="text-gray-300">
                  {new Date(notif.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

export default FlickActivity
