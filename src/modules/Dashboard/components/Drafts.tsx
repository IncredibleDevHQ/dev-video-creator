/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */
import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { useHistory } from 'react-router-dom'
import { FiMoreHorizontal } from 'react-icons/fi'
import { cx } from '@emotion/css'
import { emitToast, ScreenState, Text, Tooltip } from '../../../components'
import {
  BaseFlickFragment,
  useDeleteFlickMutation,
  useGetUserFlicksQuery,
  User,
} from '../../../generated/graphql'
import { userState } from '../../../stores/user.store'
import { Icons } from '../../../constants'

const InfoTile = ({ flick }: { flick: BaseFlickFragment }) => {
  return (
    <div>
      <Text className="text-sm text-gray-900 mt-3 w-44 truncate overflow-ellipsis capitalize">
        {flick.name}
      </Text>
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
  const [options, setOptions] = useState(false)
  const [deleteFlick, { data, loading }] = useDeleteFlickMutation()
  const history = useHistory()
  const userdata = (useRecoilValue(userState) as User) || {}

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
    <div className="relative bg-background transition-all pb-2 cursor-pointer w-0 h-36 mt-8">
      <div
        className="transition-all border-2 mt-10 bg-gray-50 hover:border-green-500 cursor-pointer w-60 h-36 rounded-md border-gray-300 items-center justify-center"
        onClick={(e) => {
          if (e.target !== e.currentTarget) return
          history.push(`/flick/${flick.id}`)
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
            className="absolute w-6 h-6 text-gray-400 cursor-pointer"
            size={30}
            onClick={() => setOptions(!options)}
          />
        </Tooltip>
        <div
          onClick={() => {
            history.push(`/flick/${flick.id}`)
          }}
        >
          <img src={Icons.flickIcon} alt="I" className="ml-24 mt-12" />
        </div>
      </div>

      <InfoTile key={flick.id} flick={flick} />
    </div>
  )
}

const Drafts = () => {
  const { sub } = (useRecoilValue(userState) as User) || {}
  const { data, loading, refetch } = useGetUserFlicksQuery({
    variables: { sub: sub as string },
  })
  const [view] = useState<'grid' | 'list'>('grid')

  if (loading) return <ScreenState title="Just a moment..." loading />
  return (
    <div>
      {view === 'grid' && (
        <div className="grid grid-cols-4 gap-y-5 gap-x-3 p-0 ml-28 mr-20 justify-center mb-20">
          {data?.Flick.map(
            (flick) =>
              !flick.producedLink && (
                <FlickTile
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

export default Drafts
