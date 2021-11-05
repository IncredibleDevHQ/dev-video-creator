/* eslint-disable react/no-unknown-property */
import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'
import {
  IoCodeSlashOutline,
  IoImageOutline,
  IoListOutline,
  IoPlayOutline,
} from 'react-icons/io5'
import { ConfigType } from '../../../utils/configTypes'

const FragmentTypeIcon = ({ type }: { type: ConfigType }) => {
  return (
    <>
      {(() => {
        switch (type) {
          case ConfigType.TRIVIA:
            return <IoImageOutline className="text-gray-400 h-full w-full" />
          case ConfigType.VIDEOJAM:
            return <IoPlayOutline className="text-gray-400 h-full w-full" />
          case ConfigType.POINTS:
            return <IoListOutline className="text-gray-400 h-full w-full" />
          case ConfigType.CODEJAM:
            return (
              <IoCodeSlashOutline className="text-gray-400 h-full w-full" />
            )
          default:
            return <></>
        }
      })()}
    </>
  )
}

const LayoutGeneric = ({
  type,
  layoutId,
  isSelected,
  ...rest
}: {
  type?: ConfigType
  isSelected?: boolean
  layoutId: number
} & HTMLAttributes<HTMLDivElement>) => {
  return (
    <>
      {(() => {
        switch (layoutId) {
          case 1:
            return (
              <div
                className={cx(
                  'w-24 p-2 border border-gray-200 h-14 rounded-md cursor-pointer',
                  {
                    'border-brand': isSelected,
                  }
                )}
                {...rest}
              >
                <div className="h-full w-full bg-gray-200 rounded-sm p-2">
                  {type && <FragmentTypeIcon type={type} />}
                </div>
              </div>
            )
          default:
            return <></>
        }
      })()}
    </>
  )
}

export default LayoutGeneric
