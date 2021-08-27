import React, { HTMLProps, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { cx } from '@emotion/css'
import { IconType } from 'react-icons'
import config from '../../config'
import { Navbar, ScreenState, Text } from '../../components'
import {
  BaseFlickFragment,
  useGetUserFlicksQuery,
} from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'
import { formatDate } from '../../utils/FormatDate'
import { NewFlickBanner, TableView } from './components'

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

const FlickTile = ({ flick }: { flick: BaseFlickFragment }) => {
  return (
    <Link to={`/flick/${flick.id}`}>
      <div className="bg-gray-100 px-4 py-2 rounded-md cursor-pointer">
        {flick.producedLink && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            className="w-full rounded-md p-2"
            controls
            preload="auto"
            src={config.storage.baseUrl + flick.producedLink}
          />
        )}
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold">{flick.name}</h3>
          <div>
            <span className="bg-brand p-1 rounded-md text-xs font-semibold uppercase text-background-alt ">
              {flick.status}
            </span>
          </div>
        </div>
        <Text className="h-16 my-1 overflow-hidden overflow-ellipsis">
          {flick.description}
        </Text>

        <p className="uppercase text-xs">
          {formatDate(new Date(flick.startAt))}
        </p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.Flick.map((flick) => (
              <FlickTile key={flick.id} flick={flick} />
            ))}
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
