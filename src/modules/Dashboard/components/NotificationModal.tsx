/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { useEffect, useState } from 'react'
import { css, cx } from '@emotion/css'
import { formatDistance } from 'date-fns'
import { useHistory } from 'react-router-dom'
import { GoPrimitiveDot } from 'react-icons/go'
import {
  IoNotifications,
  IoNotificationsOutline,
  IoSyncOutline,
} from 'react-icons/io5'
import {
  MyNotificationFragment,
  Notification_Meta_Type_Enum_Enum,
  Notification_Type_Enum_Enum,
  useGetMyNotificationsLazyQuery,
  useMarkNotificationAsReadMutation,
  useMyUnreadNotificationsCountSubscription,
} from '../../../generated/graphql'
import { Button, emitToast, Text, Tooltip } from '../../../components'
import CollaborationRespondModal from './CollaborationResponseModal'

export const NotificationMessage = ({
  notification,
}: {
  notification: MyNotificationFragment
}) => {
  const highlightStartIndex = notification.message.indexOf('%')
  const highlightEndIndex = notification.message.indexOf(
    '%',
    highlightStartIndex + 1
  )
  const start = notification.message.substring(0, highlightStartIndex)
  const middle = notification.message.substring(
    highlightStartIndex + 1,
    highlightEndIndex
  )
  const end = notification.message.substring(highlightEndIndex + 1)

  return (
    <Text className="text-sm text-gray-400 font-body">
      {start}
      <span className="text-gray-100 font-main">{middle}</span>
      {end}
    </Text>
  )
}

const NotificationsList = ({
  isNotificationsOpen,
  setIsNotificationsOpen,
  setIsCollaborateRespondModalOpen,
  setNotification,
}: {
  isNotificationsOpen: boolean
  setIsNotificationsOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsCollaborateRespondModalOpen: React.Dispatch<
    React.SetStateAction<boolean>
  >
  setNotification: (notification: MyNotificationFragment) => void
}) => {
  const [getNotifications, { data, error, loading }] =
    useGetMyNotificationsLazyQuery({
      fetchPolicy: 'cache-and-network',
    })

  const [markAsRead] = useMarkNotificationAsReadMutation()
  const history = useHistory()

  useEffect(() => {
    if (isNotificationsOpen) {
      getNotifications()
    }
  }, [isNotificationsOpen])

  return (
    <div
      className={cx(
        'flex flex-col bg-dark-200 rounded-md mt-6',
        css`
          min-width: 350px;
          max-width: 350px;
          max-height: 50vh;
        `
      )}
    >
      {error && (
        <div
          className={cx('flex flex-col items-center justify-center mt-2', {
            'mb-2': !data,
          })}
        >
          <Text className="text-dark-body-200">
            Could not fetch notifications
          </Text>
          <Text className="underline text-dark-title">Retry</Text>
        </div>
      )}
      {loading && (
        <div
          className={cx('flex justify-center mt-2', {
            'mb-2': !data,
          })}
        >
          <IoSyncOutline className="text-dark-title animate-spin" />
        </div>
      )}
      {data && data.Notifications.length === 0 && (
        <div className="flex items-center justify-center flex-1 my-12">
          <Text className="italic text-gray-200">
            You do not have any notifications
          </Text>
        </div>
      )}
      <div
        className={cx(
          'flex-1 overflow-scroll',
          css`
            -ms-overflow-style: none;
            scrollbar-width: none;
            ::-webkit-scrollbar {
              display: none;
            }
          `
        )}
      >
        {data &&
          data.Notifications.map((notification, index) => {
            return (
              <div
                className={cx('flex items-center hover:bg-dark-100', {
                  'rounded-t-md': index === 0,
                })}
                key={notification.id}
              >
                <div
                  className="flex justify-start w-full p-3 cursor-pointer gap-x-4"
                  onClick={() => {
                    markAsRead({
                      variables: {
                        id: notification.id,
                      },
                    })
                    setNotification(notification)
                    setIsNotificationsOpen(false)
                    if (
                      notification.type === Notification_Type_Enum_Enum.Event
                    ) {
                      switch (notification.meta.type) {
                        case Notification_Meta_Type_Enum_Enum.Follow:
                          history.push(
                            `/profile/${notification.sender.username}`
                          )
                          break
                        case Notification_Meta_Type_Enum_Enum.Flick:
                          history.push(`/flick/${notification.meta.flickId}`)
                          break
                        case Notification_Meta_Type_Enum_Enum.Series:
                          history.push(`/series/${notification.meta.seriesId}`)
                          break
                        default:
                      }
                    }
                    if (
                      notification.type ===
                        Notification_Type_Enum_Enum.Invitation ||
                      notification.type === Notification_Type_Enum_Enum.Request
                    ) {
                      setIsCollaborateRespondModalOpen(true)
                    }
                  }}
                >
                  <img
                    src={notification.sender.picture || ''}
                    alt={notification.sender.displayName || ''}
                    className="h-8 rounded-full"
                  />
                  <div className="flex flex-col w-full">
                    <NotificationMessage notification={notification} />
                    <Text className="mt-1 text-xs text-gray-400">
                      {formatDistance(
                        new Date(notification.createdAt),
                        new Date(),
                        {
                          addSuffix: true,
                        }
                      )}
                    </Text>
                  </div>
                </div>
                <GoPrimitiveDot
                  className={cx('text-incredible-green-600 mr-3', {
                    'text-transparent': notification.isRead,
                  })}
                />
              </div>
            )
          })}
      </div>
      {/* {data && data.Notifications.length >= 15 && (
        <div className="flex items-center justify-center w-full py-2 border-t border-dark-100">
          <Button
            type="button"
            appearance="gray"
            onClick={() => history.push('/notifications')}
          >
            <Text className="text-sm">See all</Text>
          </Button>
        </div>
      )} */}
    </div>
  )
}

const Notifications = () => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const [isCollaborateRespondModalOpen, setIsCollaborateRespondModalOpen] =
    useState(false)
  const [notification, setNotification] = useState<MyNotificationFragment>()

  const { data } = useMyUnreadNotificationsCountSubscription()

  return (
    <Tooltip
      className="font-body"
      content={
        <NotificationsList
          isNotificationsOpen={isNotificationsOpen}
          setIsNotificationsOpen={setIsNotificationsOpen}
          setIsCollaborateRespondModalOpen={setIsCollaborateRespondModalOpen}
          setNotification={setNotification}
        />
      }
      isOpen={isNotificationsOpen}
      setIsOpen={setIsNotificationsOpen}
      placement="bottom-end"
    >
      <div
        className="relative cursor-pointer"
        onClick={() => {
          setIsNotificationsOpen(!isNotificationsOpen)
        }}
      >
        {data && data.Notifications_aggregate.aggregate?.count !== 0 && (
          <GoPrimitiveDot
            className={cx(
              'text-red-500 absolute top-0 right-0 -mt-2 -mr-1.5 block'
            )}
            size={21}
          />
        )}
        {isNotificationsOpen ? (
          <IoNotifications className="rounded-full text-gray-200" size={24} />
        ) : (
          <IoNotificationsOutline
            className="rounded-full text-gray-200"
            size={24}
          />
        )}
        {isCollaborateRespondModalOpen && notification && (
          <CollaborationRespondModal
            open={isCollaborateRespondModalOpen}
            notification={notification}
            handleClose={() => {
              setIsCollaborateRespondModalOpen(false)
            }}
          />
        )}
      </div>
    </Tooltip>
  )
}

export default Notifications
