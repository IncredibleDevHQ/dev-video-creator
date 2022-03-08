import { css, cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import { useRecoilValue } from 'recoil'
import {
  DashboardFlicksFragment,
  useGetDashboardUserFlicksLazyQuery,
} from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'
import { Filter, FlickTile, Header, Navbar } from './components'
import { CollectionFilter } from './components/Filter'
import { Button, Heading, Text } from '../../components'
import { logPage } from '../../utils/analytics'
import { PageCategory, PageTitle } from '../../utils/analytics-types'

export const customScroll = css`
  ::-webkit-scrollbar {
    width: 18px;
  }
  ::-webkit-scrollbar-track {
    background-color: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background-color: #383b40;
    border-radius: 20px;
    border: 6px solid transparent;
    background-clip: content-box;
  }
  ::-webkit-scrollbar-thumb:hover {
    background-color: #a8bbbf;
  }
`

const Dashboard = () => {
  useEffect(() => {
    logPage(PageCategory.Main, PageTitle.Dashboard)
  }, [])

  const { sub } = (useRecoilValue(userState) as User) || {}
  const [fetchFlickData, { data, error, loading, fetchMore, refetch }] =
    useGetDashboardUserFlicksLazyQuery()

  const [offset, setOffset] = useState(0)
  const [allData, setAllData] = useState<DashboardFlicksFragment[]>()

  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>(
    CollectionFilter.all
  )

  useEffect(() => {
    if (!sub) return
    fetchFlickData({
      variables: {
        sub: sub || '',
      },
    })
  }, [sub])

  useEffect(() => {
    if (data?.Flick) {
      setAllData(data.Flick)
    }
  }, [data])

  const removeFlick = (id: string) => {
    setAllData(allData?.filter((flick) => flick.id !== id))
    refetch({
      limit: offset === 0 ? 25 : offset,
      sub: sub || '',
    })
  }

  const copyFlick = (id: string, newId: string) => {
    if (!allData) return
    const newFlick = allData.find((flick) => flick.id === id)
    if (!newFlick) return
    setAllData([
      { ...newFlick, id: newId, name: `${newFlick.name} (Copy)` },
      ...allData,
    ])
  }

  return (
    <div className="flex flex-col bg-dark-500 h-screen w-screen items-center text-white overflow-hidden">
      <Navbar />
      <div
        className={cx(
          'flex flex-col items-center overflow-y-scroll w-full flex-1',
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
                  Flick: [...prev.Flick, ...fetchMoreResult.Flick],
                }
              },
            })
            setOffset(offset + 25)
          }
        }}
      >
        {data && allData && allData.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-y-12">
            <Heading fontSize="large">Start by creating a story</Heading>
            <Header vertical />
          </div>
        )}

        {(loading || error || (data && allData && allData.length > 0)) && (
          <div className="flex flex-col flex-1 py-8 container">
            <Header />
            <Filter
              collectionFilter={collectionFilter}
              setCollectionFilter={setCollectionFilter}
            />
            {loading && !data && (
              <SkeletonTheme color="#202020" highlightColor="#444">
                <div className="flex-1 grid grid-cols-4 gap-10">
                  {[...Array(10).keys()].map(() => (
                    <Skeleton height={210} />
                  ))}
                </div>
              </SkeletonTheme>
            )}
            {error && (
              <div className="flex flex-col flex-1 justify-center items-center gap-y-3">
                <Text className="text-lg">
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

            <div className="grid grid-cols-4 gap-10">
              {allData
                ?.filter((flick) => {
                  if (collectionFilter === CollectionFilter.all) return true
                  if (collectionFilter === CollectionFilter.owner)
                    return flick.owner?.userSub === sub
                  if (collectionFilter === CollectionFilter.collaborator)
                    return flick.owner?.userSub !== sub
                  return true
                })
                .map((flick) => (
                  <FlickTile
                    key={flick.id}
                    {...flick}
                    handleDelete={(id) => {
                      removeFlick(id)
                    }}
                    handleCopy={(id, newId) => {
                      copyFlick(id, newId)
                    }}
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
