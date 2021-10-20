import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { IconType } from 'react-icons'
import { AiOutlinePlus } from 'react-icons/ai'
import { IoAlbumsOutline } from 'react-icons/io5'
import { useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import {
  Button,
  Navbar,
  ScreenState,
  Tab,
  TabBar,
  Text,
} from '../../components'
import { Icons } from '../../constants'
import { FlickFragment, useGetDashboardQuery } from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'
import { CreateSeriesModal } from '../DashboardSeries/components'
import DashboardSeriesFlicks from '../DashboardSeries/DashboardSeriesFlicks'
import { Drafts, NewFlickBanner, Published } from './components/index'

const ViewBarButton = ({
  icon: I,
  active,
  onClick,
}: {
  icon: IconType
  active?: boolean
  onClick: () => void
}) => {
  return (
    <div
      className={cx('p-1.5 rounded-md transition-colors cursor-pointer', {
        'bg-brand text-white': active,
        'text-brand': !active,
      })}
      onClick={onClick}
      onKeyDown={onClick}
      role="button"
      tabIndex={0}
    >
      <I />
    </div>
  )
}

const Dashboard = () => {
  const { sub } = (useRecoilValue(userState) as User) || {}
  const { data, loading } = useGetDashboardQuery({
    variables: {
      sub: sub as string,
      limit: 60,
    },
  })

  const [flicks, setFlicks] = useState<FlickFragment[]>([])

  const history = useHistory()

  const tabs: Tab[] = [
    {
      name: 'Drafts',
      value: 'Drafts',
    },
    {
      name: 'Published',
      value: 'Published',
    },
  ]

  useEffect(() => {
    if (!data) return
    setFlicks([...data.Flick])
  }, [data])

  const [currentTab, setCurrentTab] = useState<Tab>(tabs[0])
  const [isOpenNewSeriesCreateModal, setIsOpenNewSeriesCreateModal] =
    useState(false)

  const updateFlicks = (id: string) => {
    setFlicks(flicks.filter((flick) => flick.id !== id))
  }

  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (data && data?.Series.length < 1 && data?.Flick.length < 1)
    return (
      <div>
        <Navbar />
        <div className="flex flex-col justify-center items-center ml-19">
          <img src={Icons.EmptyState} alt="I" className="mt-20 w-60 h-60" />
          <Text className="text-black mt-5 font-semibold text-2xl pt-0">
            Start by creating a flick or series.
          </Text>
          <Text className="text-black font-light text-sm pt-0 mt-2">
            Choose flick if you want to just hop on to the studio
          </Text>
          <Text className="text-black font-light text-sm pt-0">
            and create one flick. Choose series if you want to
          </Text>
          <Text className="text-black font-light text-sm pt-0">
            create a series of flicks
          </Text>
        </div>
        <div className="flex flex-row gap-3 justify-center">
          <NewFlickBanner />
          <div>
            <Button
              type="button"
              appearance="primary"
              size="extraSmall"
              className="my-5 py-2 p-2 mx-2 flex justify-end text-white rounded-md"
              icon={IoAlbumsOutline}
              onClick={() => setIsOpenNewSeriesCreateModal(true)}
            >
              Create series
            </Button>
          </div>
        </div>
        <CreateSeriesModal
          open={isOpenNewSeriesCreateModal}
          handleClose={() => {
            setIsOpenNewSeriesCreateModal(false)
          }}
        />
      </div>
    )

  return (
    <div>
      <Navbar />
      <Text className="text-black mx-28 mt-5 font-bold text-2xl pt-0">
        {" Let's create a flick"}
      </Text>
      <Text className="text-black mx-28 font-light text-sm pt-0 mt-2">
        {' Choose flick if you want to just hop on to the studio '}
      </Text>
      <Text className="text-black mx-28 font-light text-sm pt-0">
        {' and create one flick. Choose series if you want to '}
      </Text>
      <Text className="text-black mx-28 font-light text-sm pt-0">
        {' create a series of flicks '}
      </Text>
      <div className="flex flex-row gap-3 mt-4 mx-28">
        <Button
          type="button"
          size="small"
          appearance="primary"
          className="py-2"
          onClick={() => history.push(`/new-flick`)}
          icon={AiOutlinePlus}
        >
          Create flick
        </Button>
        <Button
          type="button"
          appearance="secondary"
          size="small"
          className="py-2"
          icon={IoAlbumsOutline}
          onClick={() => setIsOpenNewSeriesCreateModal(true)}
        >
          Create series
        </Button>
      </div>
      <DashboardSeriesFlicks data={data?.Series} />
      {flicks && flicks.length > 0 && (
        <div className="px-0">
          <div className="flex flex-row m-0 p-0 ml-28 items-center">
            <Text className="font-black text-xl">Your flicks</Text>
            <TabBar
              tabs={tabs}
              current={currentTab}
              onTabChange={setCurrentTab}
              className="text-black gap-2 w-auto ml-10"
            />
          </div>
          <div className="mt-10 mb-10">
            {currentTab.value === 'Drafts' && (
              <Drafts
                flicks={flicks}
                handleRefetch={(id, refresh) => {
                  if (refresh) updateFlicks(id)
                }}
              />
            )}
            {currentTab.value === 'Published' && (
              <Published
                flicks={flicks}
                handleRefetch={(id, refresh) => {
                  if (refresh) updateFlicks(id)
                }}
              />
            )}
          </div>
        </div>
      )}
      <CreateSeriesModal
        open={isOpenNewSeriesCreateModal}
        handleClose={() => {
          setIsOpenNewSeriesCreateModal(false)
        }}
      />
    </div>
  )
}

ViewBarButton.defaultProps = {
  active: undefined,
}

export default Dashboard
