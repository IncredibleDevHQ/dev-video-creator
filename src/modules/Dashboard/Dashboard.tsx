import React, { useState } from 'react'
import { cx } from '@emotion/css'
import { IconType } from 'react-icons'
import { IoAlbumsOutline } from 'react-icons/io5'
import { Button, Navbar, Tab, TabBar, Text } from '../../components'
import { Drafts, NewFlickBanner, Published } from './components/index'
import CreateSeriesModal from '../DashboardSeries/CreateSeriesModal'
import DashboardSeriesFlicks from '../DashboardSeries/DashboardSeriesFlicks'

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

  const [currentTab, setCurrentTab] = useState<Tab>(tabs[0])
  const [isOpenNewSeriesCreateModal, setIsOpenNewSeriesCreateModal] =
    useState(false)

  return (
    <div>
      <Navbar />
      <Text className="text-black ml-28 mt-5 font-semibold text-2xl pt-0">
        {" Let's create a flick"}
      </Text>
      <Text className="text-black ml-28 font-light text-sm pt-0 mt-2">
        {' Choose quick start if you want to just hop on to the '}
      </Text>
      <Text className="text-black ml-28 font-light text-sm pt-0">
        {' studio with a blank fragment, or lets get started with '}
      </Text>
      <Text className="text-black ml-28 font-light text-sm pt-0">
        {' some curated templates. '}
      </Text>

      <div className="flex flex-row gap-3 ml-28">
        <NewFlickBanner />
        <div>
          <Button
            type="button"
            appearance="primary"
            size="extraSmall"
            className="my-5 p-2 mx-2 flex justify-end text-white rounded-md"
            icon={IoAlbumsOutline}
            onClick={() => setIsOpenNewSeriesCreateModal(true)}
          >
            Create series
          </Button>
        </div>
      </div>

      <div className="flex flex-col m-0 p-0 ml-28">
        <Text className="font-black text-xl mt-14">Your series</Text>
        <DashboardSeriesFlicks />
      </div>

      <div className="px-0">
        <div className="flex flex-row m-0 p-0 ml-28">
          <Text className="font-black text-xl mb-4 mt-14">Your flicks</Text>
          <TabBar
            tabs={tabs}
            current={currentTab}
            onTabChange={setCurrentTab}
            className="text-black gap-2 mt-14 w-auto ml-10"
          />
        </div>
        {currentTab.value === 'Drafts' && <Drafts />}
        {currentTab.value === 'Published' && <Published />}
      </div>
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
