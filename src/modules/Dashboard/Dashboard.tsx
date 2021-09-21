/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */
import React, { HTMLProps, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { cx } from '@emotion/css'
import { IconType } from 'react-icons'
import { BiVideo } from 'react-icons/bi'
import { FiPlay } from 'react-icons/fi'
import { Button, Heading, Navbar, ScreenState } from '../../components'
import {
  BaseFlickFragment,
  Flick_Status_Enum_Enum,
  useGetUserFlicksQuery,
} from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'
import { formatDate } from '../../utils/FormatDate'
import { NewFlickBanner, TableView } from './components'
import config from '../../config'
import DashboardModal from './components/DashboardModal'

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

const ViewBar = ({
  className,
  barItems,
  value,
  handleClick,
  ...rest
}: HTMLProps<HTMLDivElement> & {
  barItems: { icon: IconType; value: string }[]
  value: string
  handleClick: (value: string) => void
}) => {
  return (
    <div
      className={cx(
        'bg-gray-100 px-3 py-1.5 rounded-md grid grid-flow-col gap-x-1',
        className
      )}
      {...rest}
    >
      {barItems.map(({ icon, value: v }) => (
        <ViewBarButton
          key={v}
          icon={icon}
          active={v === value}
          onClick={() => handleClick(v)}
        />
      ))}
    </div>
  )
}

const VideoTile = ({ flick }: { flick: BaseFlickFragment }) => {
  const [dashboardModal, setDashboardModal] = useState<boolean>(false)

  return (
    <div className="bg-background shadow-md transition-all hover:shadow-xl pb-2 rounded-md cursor-pointer">
      <div
        className="bg-gray-100 justify-center items-center flex text-gray-300 rounded-t-md h-40"
        onClick={() => {
          setDashboardModal(true)
        }}
      >
        <FiPlay size={40} />
      </div>
      <DashboardModal
        flick={flick}
        open={dashboardModal}
        handleClose={() => {
          // eslint-disable-next-line no-restricted-globals
          setDashboardModal(false)
        }}
      />
      <InfoTile key={flick.id} flick={flick} />
    </div>
  )
}

const InfoTile = ({ flick }: { flick: BaseFlickFragment }) => {
  return (
    <Link to={`/flick/${flick.id}`}>
      <div className="mx-4 mt-2">
        <div className="flex items-center justify-between">
          <Heading fontSize="medium">{flick.name}</Heading>
        </div>
        <Heading
          fontSize="small"
          className="h-8 my-1 overflow-hidden overflow-ellipsis"
        >
          {flick.description}
        </Heading>

        <div className="flex items-center justify-between">
          <Heading fontSize="extra-small" className="uppercase">
            {formatDate(new Date(flick.startAt))}
          </Heading>
          <Heading
            fontSize="extra-small"
            className="bg-brand-10 py-1 px-2 rounded-md font-semibold uppercase text-brand "
          >
            {flick.status}
          </Heading>
        </div>
      </div>
    </Link>
  )
}

const FlickTile = ({ flick }: { flick: BaseFlickFragment }) => {
  return (
    <Link to={`/flick/${flick.id}`}>
      <div className="bg-background shadow-md transition-all hover:shadow-xl pb-2 rounded-md cursor-pointer">
        {flick.status === Flick_Status_Enum_Enum.Processing ? (
          <img
            className="w-full object-cover rounded-t-md h-40"
            src="https://i.giphy.com/media/l0uJcwRwF5tO7LgB5t/giphy-downsized.gif"
            alt={flick.name}
          />
        ) : (
          <div className="bg-gray-100 justify-center items-center flex text-gray-300 rounded-t-md h-40">
            <BiVideo size={40} />
          </div>
        )}
        <InfoTile key={flick.id} flick={flick} />
      </div>
    </Link>
  )
}

const Dashboard = () => {
  const { sub } = (useRecoilValue(userState) as User) || {}
  const { data, loading } = useGetUserFlicksQuery({
    variables: { sub: sub as string },
  })
  const [view, setView] = useState<'grid' | 'list'>('grid')

  if (loading) return <ScreenState title="Just a moment..." loading />

  return (
    <div className="relative h-screen">
      <Navbar />
      <div className="py-2 px-4 pb-24">
        <h2 className="font-black text-3xl mb-4">Your Flicks</h2>

        {view === 'list' && <TableView />}

        {view === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data?.Flick.map((flick) =>
              flick.producedLink ? (
                <VideoTile key={flick.id} flick={flick} />
              ) : (
                <FlickTile key={flick.id} flick={flick} />
              )
            )}
          </div>
        )}
      </div>
      <NewFlickBanner className="fixed bottom-0" />
    </div>
  )
}

ViewBarButton.defaultProps = {
  active: undefined,
}

export default Dashboard
