/* eslint-disable no-nested-ternary */
import React, { HTMLProps, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { cx } from '@emotion/css'
import { IconType } from 'react-icons'
import { BiVideo } from 'react-icons/bi'
import { Heading, Navbar, ScreenState } from '../../components'
import {
  BaseFlickFragment,
  Flick_Status_Enum_Enum,
  useGetUserFlicksQuery,
} from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'
import { formatDate } from '../../utils/FormatDate'
import { NewFlickBanner, TableView } from './components'
import config from '../../config'
import { VideoJSPlayer } from '../VideoJSPlayer/VideoJSPlayer'

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
  const { baseUrl } = config.storage

  return (
    <Link to={`/flick/${flick.id}`}>
      <div className="bg-background shadow-md transition-all hover:shadow-xl pb-2 rounded-md cursor-pointer">
        {flick.producedLink ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <VideoJSPlayer
            className="rounded-t-md w-full"
            src={baseUrl + flick.producedLink}
            type="video/mp4"
          />
        ) : flick.status === Flick_Status_Enum_Enum.Processing ? (
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
