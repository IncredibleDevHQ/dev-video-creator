/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { cx } from '@emotion/css'
import { sentenceCase } from 'change-case'
import { differenceInMonths, format, formatDistance } from 'date-fns'
import React, { useEffect, useState } from 'react'
import { FiCopy, FiMoreHorizontal } from 'react-icons/fi'
import { IoDocumentTextOutline, IoTrashOutline } from 'react-icons/io5'
import { useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import {
  emitToast,
  Heading,
  Text,
  ThumbnailPreview,
  Tooltip,
} from '../../../components'
import { ASSETS } from '../../../constants'
import {
  Content_Type_Enum_Enum,
  DashboardFlicksFragment,
  OrientationEnum,
  useDeleteFlickMutation,
  useDuplicateUserFlickMutation,
} from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'

const FlickTile = ({
  id,
  name,
  status,
  contents,
  thumbnail,
  theme,
  updatedAt,
  owner,
  handleDelete,
  handleCopy,
}: DashboardFlicksFragment & {
  handleDelete: (id: string) => void
  handleCopy: (id: string, newId: string) => void
}) => {
  const history = useHistory()

  const { sub } = (useRecoilValue(userState) as User) || {}

  const [deleteFlick, { data, error }] = useDeleteFlickMutation()

  const deleteFlickFunction = async () => {
    await deleteFlick({
      variables: {
        flickId: id,
      },
    })
  }
  const [
    duplicateFlick,
    { data: duplicateFlickData, error: duplicateFlickError },
  ] = useDuplicateUserFlickMutation()

  useEffect(() => {
    if (!duplicateFlickError) return
    emitToast({
      title: 'Error making copy',
      type: 'error',
    })
  }, [duplicateFlickError])

  useEffect(() => {
    if (!error) return
    emitToast({ title: 'Error deleting flick', type: 'error' })
  }, [error])

  useEffect(() => {
    if (!data) return
    emitToast({ title: 'Successfully deleted the flick', type: 'success' })
    handleDelete(id)
  }, [data])

  useEffect(() => {
    if (!duplicateFlickData) return
    emitToast({ title: 'Successfully duplicated the flick', type: 'success' })
    handleCopy(id, duplicateFlickData.DuplicateFlick?.id)
  }, [duplicateFlickData])

  const [overflowButtonVisible, setOverflowButtonVisible] = useState(false)
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)

  useEffect(() => {
    if (!overflowMenuVisible) {
      setShowDeleteConfirmation(false)
      setOverflowButtonVisible(false)
    }
  }, [overflowMenuVisible])

  useEffect(() => {
    if (showDeleteConfirmation) {
      setTimeout(() => {
        setShowDeleteConfirmation(false)
      }, 2000)
    }
  }, [showDeleteConfirmation])

  return (
    <div
      className="relative border border-dark-300 rounded-md cursor-pointer hover:border-brand"
      onClick={() => history.push(`/flick/${id}`)}
      onMouseEnter={() => setOverflowButtonVisible(true)}
      onMouseLeave={() => {
        if (!overflowMenuVisible) {
          setOverflowButtonVisible(false)
          setOverflowMenuVisible(false)
        }
      }}
    >
      <div className="aspect-w-16 aspect-h-9">
        <div className="flex items-center justify-center bg-dark-300 w-full h-full rounded-md">
          {(() => {
            if (contents.length > 0) {
              if (contents[0]?.thumbnail && contents[0]?.preview) {
                return (
                  <ThumbnailPreview
                    backgroundImageSource={contents[0]?.preview || ''}
                    posterImageSource={
                      contents[0]?.thumbnail || ASSETS.ICONS.FLICKBG
                    }
                    className="rounded-t-md w-full h-full"
                    orientation={
                      contents[0]?.type === Content_Type_Enum_Enum.Video
                        ? OrientationEnum.Landscape
                        : OrientationEnum.Portrait
                    }
                    totalImages={50}
                    useInternalScaling
                  />
                )
              }
              if (contents[1]?.thumbnail && contents[1]?.preview) {
                return (
                  <ThumbnailPreview
                    backgroundImageSource={contents[1]?.preview || ''}
                    posterImageSource={
                      contents[1]?.thumbnail || ASSETS.ICONS.FLICKBG
                    }
                    className="rounded-t-md w-full h-full"
                    orientation={
                      contents[1]?.type === Content_Type_Enum_Enum.Video
                        ? OrientationEnum.Landscape
                        : OrientationEnum.Portrait
                    }
                    totalImages={50}
                    useInternalScaling
                  />
                )
              }
              return (
                <IoDocumentTextOutline size={36} className="text-dark-700" />
              )
            }
            return <IoDocumentTextOutline size={36} className="text-dark-700" />
          })()}
        </div>
      </div>
      <div className="flex flex-col p-4 gap-y-2">
        <Heading>{sentenceCase(name)}</Heading>
        <Text fontSize="small" className="text-dark-title my-1 font-body">
          {`Edited ${
            differenceInMonths(new Date(), new Date(updatedAt)) < 1
              ? formatDistance(new Date(updatedAt), new Date(), {
                  addSuffix: true,
                })
              : format(new Date(updatedAt), 'do MMM yyyy')
          }`}
        </Text>
      </div>
      {overflowButtonVisible && (
        <div
          role="button"
          tabIndex={0}
          onKeyUp={() => {}}
          className="absolute top-0 right-0 m-2 bg-dark-100 w-min p-1.5 shadow-md rounded-md cursor-pointer"
          onClick={(e) => {
            setOverflowMenuVisible(!overflowMenuVisible)
            e.stopPropagation()
          }}
        >
          <FiMoreHorizontal className="text-gray-100" />
          {overflowMenuVisible && (
            <Tooltip
              isOpen={overflowMenuVisible}
              setIsOpen={setOverflowMenuVisible}
              content={
                <div className="flex flex-col mt-3 bg-dark-400 rounded-md cursor-pointer -mr-5 shadow-md">
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyUp={() => {}}
                    className={cx(
                      'flex items-center hover:bg-dark-100 px-3 py-2 rounded-t-md',
                      {
                        'cursor-not-allowed ': owner?.userSub !== sub,
                      }
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (owner?.userSub !== sub) return
                      duplicateFlick({
                        variables: {
                          flickId: id,
                        },
                      })
                    }}
                  >
                    <FiCopy size={16} className="text-gray-100 mr-4" />
                    <span className="font-medium text-gray-100 text-sm font-main">
                      Make a copy
                    </span>
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyUp={() => {}}
                    className={cx(
                      'flex items-center rounded-b-md hover:bg-dark-100 px-3 py-2',
                      {
                        'cursor-not-allowed ': owner?.userSub !== sub,
                      }
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (owner?.userSub !== sub) return
                      if (showDeleteConfirmation) {
                        deleteFlickFunction()
                      } else {
                        setShowDeleteConfirmation(true)
                      }
                    }}
                  >
                    <IoTrashOutline
                      size={16}
                      className={cx('text-gray-100 mr-4', {
                        'text-red-400': showDeleteConfirmation,
                      })}
                    />
                    <span
                      className={cx('font-medium text-gray-100 text-sm', {
                        'text-red-400': showDeleteConfirmation,
                      })}
                    >
                      {showDeleteConfirmation ? 'Yes, delete it' : 'Delete'}
                    </span>
                  </div>
                </div>
              }
              placement="bottom-end"
              hideOnOutsideClick
            />
          )}
        </div>
      )}
    </div>
  )
}

export default FlickTile
