/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { cx } from '@emotion/css'
import { formatDistance } from 'date-fns'
import React, { useEffect, useState } from 'react'
import { GoPrimitiveDot } from 'react-icons/go'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import { useHistory } from 'react-router-dom'
import dpFallback from '../../assets/dp_fallback.png'
import { Button, Heading, Image, Text } from '../../components'
import config from '../../config'
import {
  MyNotificationFragment,
  Notification_Meta_Type_Enum_Enum,
  Notification_Type_Enum_Enum,
  useGetAllMyNotificationsQuery,
  useMarkNotificationAsReadMutation,
} from '../../generated/graphql'
import { logPage } from '../../utils/analytics'
import { PageCategory, PageTitle } from '../../utils/analytics-types'
import { Navbar } from '../Dashboard/components'
import CollaborationRespondModal from '../Dashboard/components/CollaborationResponseModal'
import { NotificationMessage } from '../Dashboard/components/NotificationModal'
import { customScroll } from '../Dashboard/Dashboard'

const Notifications = () => {
  useEffect(() => {
    logPage(PageCategory.Main, PageTitle.Notifications)
  }, [])

  const history = useHistory()

  const [offset, setOffset] = useState(0)

  const [allData, setAllData] = useState<MyNotificationFragment[]>()
  const { data, loading, error, fetchMore, refetch } =
    useGetAllMyNotificationsQuery()

  const [markAsRead] = useMarkNotificationAsReadMutation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [notification, setNotification] = useState<MyNotificationFragment>()

  useEffect(() => {
    if (!data) return
    setAllData(data.Notifications)
  }, [data])

  return (
    <div className="flex flex-col items-center w-screen h-screen bg-dark-500 overflow-hidden">
      <Navbar className="fixed bg-dark-500" />
      <div
        className={cx(
          'w-full flex justify-center flex-1 overflow-y-scroll',
          customScroll
        )}
        onScroll={(e) => {
          if (
            e.currentTarget.scrollHeight - e.currentTarget.scrollTop ===
            e.currentTarget.clientHeight
          ) {
            fetchMore({
              variables: {
                offset: offset + 25,
              },
              updateQuery: (prev, { fetchMoreResult }) => {
                if (!fetchMoreResult) return prev
                return {
                  ...prev,
                  Notifications: [
                    ...prev.Notifications,
                    ...fetchMoreResult.Notifications,
                  ],
                }
              },
            })
            setOffset(offset + 25)
          }
        }}
      >
        <div
          className="flex flex-col flex-1 pt-16"
          style={{
            maxWidth: '520px',
          }}
        >
          <Heading className="p-4 mb-14 font-main text-gray-100 text-4xl">
            Notifications
          </Heading>
          {isModalOpen && notification && (
            <CollaborationRespondModal
              open={isModalOpen}
              notification={notification}
              handleClose={() => {
                setIsModalOpen(false)
              }}
            />
          )}
          {loading && !data && (
            <SkeletonTheme color="#202020" highlightColor="#444">
              <div className="flex-1 flex flex-col gap-8">
                {[...Array(10).keys()].map(() => (
                  <Skeleton height={60} />
                ))}
              </div>
            </SkeletonTheme>
          )}
          {error && (
            <div className="flex flex-col flex-1 justify-center items-center gap-y-3 -mt-28">
              <Text className="text-base text-gray-300">
                Something went wrong. Please try again.
              </Text>
              <Button
                appearance="danger"
                type="button"
                size="small"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </div>
          )}
          {allData &&
            allData.map((notification) => {
              return (
                <div
                  className="flex items-center rounded-md hover:bg-dark-400"
                  key={notification.id}
                >
                  <div
                    className="flex justify-start w-full p-4 cursor-pointer gap-x-4"
                    onClick={() => {
                      markAsRead({
                        variables: {
                          id: notification.id,
                        },
                      })
                      setNotification(notification)

                      if (
                        notification.type === Notification_Type_Enum_Enum.Event
                      ) {
                        switch (notification.metaType) {
                          case Notification_Meta_Type_Enum_Enum.Follow:
                            window.open(
                              `${config.auth.endpoint}/${notification.sender.username}`
                            )
                            break
                          case Notification_Meta_Type_Enum_Enum.User:
                            window.open(
                              `${config.auth.endpoint}/${notification.sender.username}`
                            )
                            break
                          case Notification_Meta_Type_Enum_Enum.Flick:
                            history.push(`/story/${notification.meta?.flickId}`)
                            break
                          case Notification_Meta_Type_Enum_Enum.Series:
                            window.open(
                              `${config.auth.endpoint}/series/series--${notification.meta?.seriesId}`
                            )
                            break
                          default:
                            break
                        }
                      }
                      if (
                        notification.type ===
                          Notification_Type_Enum_Enum.Invitation ||
                        notification.type ===
                          Notification_Type_Enum_Enum.Request
                      ) {
                        setIsModalOpen(true)
                      }
                    }}
                  >
                    <Image
                      mainSrc={notification.sender.picture as string}
                      fallbackSrc={dpFallback}
                      alt=""
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
                    className={cx('text-transparent mr-3', {
                      'text-incredible-green-600': !notification.isRead,
                    })}
                  />
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}

export default Notifications
