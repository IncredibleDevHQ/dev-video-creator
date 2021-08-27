import React, { HTMLProps } from 'react'
import { cx } from '@emotion/css'
import {
  FiShuffle,
  FiLink2,
  FiPlay,
  FiUpload,
  FiZap,
  FiBell,
} from 'react-icons/fi'
import logo from '../../../assets/new_logo.svg'
import { Button } from '../../../components'
import { Avatar, Separator } from '.'

const Navbar = ({ className, ...rest }: HTMLProps<HTMLDivElement>) => {
  return (
    <nav
      className={cx(
        'px-6 py-2 shadow-sm flex items-stretch justify-between',
        className
      )}
      {...rest}
    >
      <div className="flex items-center">
        <div className="flex items-center">
          <img src={logo} alt="" className="w-10 h-10" />
          <div className="flex flex-col ml-2">
            <span className="font-semibold text-xl">Incredible</span>
            <span className="-mt-1">studio</span>
          </div>
        </div>
        <Separator className="mx-6" />
        <div className="flex flex-col">
          <span className="font-semibold">
            Why you&apos;ll need Symbl for your app
          </span>
          <span>Intermediate • ConferenceX AI • Symbl</span>
        </div>
        <Separator className="mx-6" />

        <ul className="grid grid-flow-col gap-x-2 items-center">
          <Avatar color="blue" />
          <Avatar color="red" />
          <Avatar color="purple" />

          <Button
            icon={FiShuffle}
            className="ml-2"
            type="button"
            appearance="secondary"
          >
            Huddle
          </Button>
        </ul>
      </div>

      <div className="flex items-center">
        <ul className="grid grid-flow-col gap-x-2 items-center">
          <FiBell className="text-gray-600" size={24} />
          <FiZap className="text-gray-600" size={24} />
          <Button appearance="link" icon={FiLink2} type="button">
            Share
          </Button>
          <Button appearance="primary" icon={FiUpload} type="button">
            Publish
          </Button>
        </ul>

        <Separator className="mx-6" />
        <FiPlay size={24} />
      </div>
    </nav>
  )
}

export default Navbar
