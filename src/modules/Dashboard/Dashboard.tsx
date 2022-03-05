import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { ScreenState } from '../../components'
import {
  DashboardFlicksFragment,
  useGetDashboardUserFlicksLazyQuery,
} from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'
import { Header, Navbar, Filter, FlickTile } from './components'

enum FilterType {
  All = 'all',
  Owner = 'owner',
  Collaborator = 'collaborator',
}

enum FlickType {
  Recorded = 'recorded',
  Draft = 'draft',
}

const Dashboard = () => {
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [fetchFlickData, { data, error, loading, fetchMore }] =
    useGetDashboardUserFlicksLazyQuery()

  const [allData, setAllData] = useState<DashboardFlicksFragment[]>([])
  const [viewData, setViewData] = useState<DashboardFlicksFragment[]>([])

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

  if (loading) return <ScreenState loading />

  return (
    <div className="bg-dark-500 min-h-screen text-white">
      <Navbar />
      <div className="py-8 px-32">
        <Header />
        <Filter />
        <div className="grid grid-cols-4 gap-3">
          {data?.Flick?.map((flick) => (
            <FlickTile key={flick.id} {...flick} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
