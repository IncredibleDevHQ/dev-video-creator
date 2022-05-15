import { css, cx } from '@emotion/css'
import React, { useEffect, useRef, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { IoAlbumsOutline, IoDocumentTextOutline } from 'react-icons/io5'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import { useRecoilValue } from 'recoil'
import { Button, Heading, Text } from '../../components'
import {
  DashboardFlicksFragment,
  DashboardSeriesFragment,
  useGetDashboardUserFlicksLazyQuery,
  useGetDashboardUserSeriesLazyQuery,
} from '../../generated/graphql'
import firebaseState from '../../stores/firebase.store'
import { User, userState } from '../../stores/user.store'
import { logPage } from '../../utils/analytics'
import { PageCategory, PageTitle } from '../../utils/analytics-types'
import { Filter, FlickTile, Header, Navbar } from './components'
import { CollectionFilter } from './components/Filter'
import SeriesHeader from './components/SeriesHeader'
import SeriesTile from './components/SeriesTile'

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

  const [activeTab, setActiveTab] = useState<'stories' | 'series'>('stories')

  return (
    <div className="flex flex-col bg-dark-500 h-screen w-screen items-center overflow-hidden">
      <Navbar />
      <div className="flex items-start flex-1 w-full h-full overflow-hidden">
        <div className="flex flex-col w-44 py-8 h-full pl-8 gap-y-2">
          <button
            type="button"
            onClick={() => setActiveTab('stories')}
            className={cx(
              'flex items-center gap-x-2 w-full py-1.5 text-left px-4 border-l-2 hover:text-gray-100',
              {
                'border-incredible-green-600 text-gray-100':
                  activeTab === 'stories',
                'border-transparent text-gray-400': activeTab !== 'stories',
              }
            )}
          >
            <IoDocumentTextOutline />
            <span className="text-sm">Stories</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('series')}
            className={cx(
              'flex items-center gap-x-2 w-full py-1.5 text-left px-4 border-l-2 hover:text-gray-100',
              {
                'border-incredible-green-600 text-gray-100':
                  activeTab === 'series',
                'border-transparent text-gray-400': activeTab !== 'series',
              }
            )}
          >
            <IoAlbumsOutline />
            <span className="text-sm">Series</span>
          </button>
        </div>
        {activeTab === 'stories' && <FlickTab />}
        {activeTab === 'series' && <SeriesTab />}
      </div>
    </div>
  )
}

const FlickTab = () => {
  const { sub } = (useRecoilValue(userState) as User) || {}

  const { auth } = useRecoilValue(firebaseState)
  const [user] = useAuthState(auth)

  const verticalHeaderRef = useRef<HTMLDivElement>(null)

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
    <div
      className={cx(
        'flex flex-col items-center overflow-y-scroll flex-1 px-4 h-full text-white ',
        customScroll
      )}
      onScroll={(e) => {
        if (
          e.currentTarget.scrollHeight - e.currentTarget.scrollTop >
            e.currentTarget.clientHeight - 2 &&
          e.currentTarget.scrollHeight - e.currentTarget.scrollTop <
            e.currentTarget.clientHeight + 2
        ) {
          if (loading) return
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
      {allData && allData.length === 0 && (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-y-12"
          ref={verticalHeaderRef}
        >
          <Heading fontSize="large">Start by creating a story</Heading>
          <Header vertical />
        </div>
      )}

      {((loading && user) ||
        error ||
        (data && allData && allData.length > 0)) && (
        <div className="flex flex-col flex-1 py-8 container">
          {!verticalHeaderRef.current && (
            <>
              <Header />
              <div className="my-8">
                <Filter
                  collectionFilter={collectionFilter}
                  setCollectionFilter={setCollectionFilter}
                />
              </div>
            </>
          )}

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
  )
}

const SeriesTab = () => {
  const { sub } = (useRecoilValue(userState) as User) || {}

  const { auth } = useRecoilValue(firebaseState)
  const [user] = useAuthState(auth)

  const [fetchSeriesData, { data, error, loading, fetchMore, refetch }] =
    useGetDashboardUserSeriesLazyQuery()

  const [offset, setOffset] = useState(0)
  const [allData, setAllData] = useState<DashboardSeriesFragment[]>()

  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>(
    CollectionFilter.all
  )

  useEffect(() => {
    fetchSeriesData()
  }, [])

  useEffect(() => {
    if (data?.Series) {
      setAllData(data.Series)
    }
  }, [data])

  return (
    <div
      className={cx(
        'flex flex-col items-center overflow-y-scroll flex-1 px-4 h-full text-white',
        customScroll
      )}
      onScroll={(e) => {
        if (
          e.currentTarget.scrollHeight - e.currentTarget.scrollTop >
            e.currentTarget.clientHeight - 2 &&
          e.currentTarget.scrollHeight - e.currentTarget.scrollTop <
            e.currentTarget.clientHeight + 2
        ) {
          if (loading) return
          fetchMore({
            variables: {
              offset: offset + 25,
            },
            updateQuery: (prev, { fetchMoreResult }) => {
              if (!fetchMoreResult) return prev
              return {
                ...prev,
                Series: [...prev.Series, ...fetchMoreResult.Series],
              }
            },
          })
          setOffset(offset + 25)
        }
      }}
    >
      {allData && allData.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-y-8">
          <Heading fontSize="medium">
            A series is a collection of your stories. Click below to create your
            own
          </Heading>
          <SeriesHeader
            refresh={() => {
              refetch()
            }}
          />
        </div>
      )}

      {((loading && user) ||
        error ||
        (data && allData && allData.length > 0)) && (
        <div className="flex flex-col flex-1 py-8 container">
          <div className="flex items-center mb-8 justify-between">
            <Filter
              collectionFilter={collectionFilter}
              setCollectionFilter={setCollectionFilter}
            />
            <SeriesHeader
              refresh={() => {
                refetch({
                  limit: offset === 0 ? 25 : offset,
                })
              }}
            />
          </div>
          {loading && !data && (
            <SkeletonTheme color="#202020" highlightColor="#444">
              <div className="flex-1 grid grid-cols-4 gap-10">
                {[...Array(10).keys()].map(() => (
                  <Skeleton height={160} />
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
              ?.filter((series) => {
                if (collectionFilter === CollectionFilter.all) return true
                if (collectionFilter === CollectionFilter.owner)
                  return series.ownerSub === sub
                if (collectionFilter === CollectionFilter.collaborator)
                  return series.ownerSub !== sub
                return true
              })
              .map((series) => (
                <SeriesTile series={series} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
