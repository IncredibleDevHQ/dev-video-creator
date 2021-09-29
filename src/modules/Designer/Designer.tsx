import React, { HTMLProps } from 'react'
import AspectRatio from 'react-aspect-ratio'
import { FiPlus, FiPlusCircle, FiMessageCircle } from 'react-icons/fi'
import { cx, css } from '@emotion/css'
import { Avatar, Navbar, Toolbar } from './components'
import 'react-aspect-ratio/aspect-ratio.css'
import { Button } from '../../components'

interface ThumbnailProps extends HTMLProps<HTMLDivElement> {
  active?: boolean
}

const style = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

const Thumbnail = ({ className, active, ...rest }: ThumbnailProps) => {
  return (
    <div
      className={cx(
        'py-4 border-l-4 pl-4 pr-4',
        { 'border-green-600 bg-green-50': active },
        className
      )}
      {...rest}
    >
      <AspectRatio
        ratio="16/9"
        className={cx('h-28 rounded-md p-1', {
          'border-green-600 border-2': active,
        })}
      >
        <img
          className="object-fill p-0.5 rounded-md"
          src="https://placekitten.com/500/500"
          alt="asdas"
        />
      </AspectRatio>
      <div className="flex text-sm justify-between mt-0.5 items-center">
        <p className="font-semibold">CodeJam</p>
        <time>02:00</time>
      </div>
    </div>
  )
}

const Thumbnails = () => {
  return (
    <div className={cx('w-56 shadow-md overflow-scroll relative', style)}>
      <ul className="">
        <li>
          <Thumbnail />
        </li>
        <li>
          <Thumbnail active />
        </li>
        <li>
          <Thumbnail />
        </li>
        <li>
          <Thumbnail />
        </li>
      </ul>
      <div className="bg-gray-100 py-2 sticky bottom-0 flex items-center justify-between left-0 w-full">
        <Button type="button" appearance="link" size="small" icon={FiPlus}>
          New Fragment
        </Button>
      </div>
    </div>
  )
}

const Workspace = () => {
  return (
    <div className="flex-grow relative flex items-center justify-center overflow-scroll">
      <div className="flex">
        <AspectRatio
          ratio="16/9"
          className="flex"
          style={{ width: 900, maxHeight: 600 }}
        >
          <div className="flex-1">
            <img src="https://placekitten.com/1920/1080" alt="workspace" />

            <div className="mt-6 text-xs flex items-center">
              <span>00:00</span>
              <div className="h-0.5 flex-grow bg-green-600 mx-2" />
              <span>00:00</span>
            </div>
          </div>
        </AspectRatio>
        <div className="flex flex-col ml-2">
          <ul className="px-1 py-2 grid gap-y-3 justify-center items-center grid-flow-row rounded-md bg-gray-100">
            <Avatar color="purple" />
            <Avatar color="blue" />
            <Avatar color="red" />
            <li className="flex items-center justify-center text-gray-500">
              <FiPlusCircle size={24} />
            </li>
          </ul>
          <ul className="px-1 py-2 my-4 grid gap-y-3 text-2xl justify-center grid-flow-row rounded-md bg-gray-100">
            <li>❣️</li>
            <li>🎉</li>
            <li>🤩</li>
            <li className="flex items-center justify-center text-gray-500">
              <FiPlusCircle size={24} />
            </li>
          </ul>

          <ul className="px-1 py-2 grid gap-y-3 justify-center items-center grid-flow-row rounded-md bg-gray-100">
            <li className="text-gray-500">
              <FiMessageCircle size={24} />
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

const Designer = () => {
  return (
    <div className="flex flex-col self-stretch items-stretch h-screen overflow-hidde">
      <Navbar />
      <Toolbar />

      <div className="flex flex-1 flex-col items-stretch overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <Thumbnails />
          <Workspace />
        </div>
      </div>
    </div>
  )
}

/**
 * 
 * 
 <div
          className={cx(
            'w-56 flex-1 overflow-scroll flex flex-col shadow-md',
            style
          )}
        >
          <div className="flex-1 relative pb-14">
            <Thumbnail />
            <Thumbnail active />
            <Thumbnail />
            <Thumbnail />
            <Thumbnail />
          </div>

          
        </div>
 */

export default Designer
