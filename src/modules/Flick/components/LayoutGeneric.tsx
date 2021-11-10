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
                  'w-full p-2 border border-gray-200 h-full rounded-md cursor-pointer bg-white',
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
          case 2:
            return (
              <div
                className={cx(
                  'w-full p-2 border border-gray-200 h-full rounded-md cursor-pointer flex gap-x-2',
                  {
                    'border-brand': isSelected,
                  }
                )}
                {...rest}
              >
                <div className="h-full w-5/6 bg-gray-200 rounded-sm p-2.5">
                  {type && <FragmentTypeIcon type={type} />}
                </div>
                <div className="h-full w-1/6 bg-gray-500 rounded-sm p-2" />
              </div>
            )
          case 3:
            return (
              <div
                className={cx(
                  'w-full p-2 border border-gray-200 h-full rounded-md cursor-pointer flex gap-x-2',
                  {
                    'border-brand': isSelected,
                  }
                )}
                {...rest}
              >
                <div className="h-full w-1/6 bg-gray-500 rounded-sm p-2" />
                <div className="h-full w-5/6 bg-gray-200 rounded-sm p-2.5">
                  {type && <FragmentTypeIcon type={type} />}
                </div>
              </div>
            )
          case 4:
            return (
              <div
                className={cx(
                  'w-full p-2 border border-gray-200 h-full rounded-md cursor-pointer flex justify-end items-center relative',
                  {
                    'border-brand': isSelected,
                  }
                )}
                {...rest}
              >
                <div className="h-full w-full bg-gray-200 rounded-sm p-2 mr-2">
                  {type && <FragmentTypeIcon type={type} />}
                </div>
                <div className="h-7 w-1/6 bg-gray-500 rounded-sm p-2 absolute" />
              </div>
            )
          case 5:
            return (
              <div
                className={cx(
                  'w-full p-2 border border-gray-200 h-full rounded-md cursor-pointer flex justify-end items-end relative',
                  {
                    'border-brand': isSelected,
                  }
                )}
                {...rest}
              >
                <div className="h-full w-full bg-gray-200 rounded-sm p-2">
                  {type && <FragmentTypeIcon type={type} />}
                </div>
                <div className="w-4 h-4 -m-1 bg-gray-500 rounded-sm p-2 absolute" />
              </div>
            )
          case 6:
            return (
              <div
                className={cx(
                  'w-full p-2 border border-gray-200 h-full rounded-md cursor-pointer flex justify-end items-end relative',
                  {
                    'border-brand': isSelected,
                  }
                )}
                {...rest}
              >
                <div className="h-full w-full bg-gray-200 rounded-sm p-2">
                  {type && <FragmentTypeIcon type={type} />}
                </div>
                <div className="w-4 h-4 -m-1 bg-gray-500 rounded-full p-2 absolute" />
              </div>
            )
          case 7:
            return (
              <div
                className={cx(
                  'w-full border border-gray-200 h-full rounded-md cursor-pointer flex justify-end items-end relative',
                  {
                    'border-brand': isSelected,
                  }
                )}
                {...rest}
              >
                <div className="h-full w-full bg-gray-200 rounded-md p-3.5">
                  {type && <FragmentTypeIcon type={type} />}
                </div>
                <div className="w-4 h-4 m-1 bg-gray-500 rounded-sm p-2 absolute" />
              </div>
            )
          case 8:
            return (
              <div
                className={cx(
                  'w-full border border-gray-200 h-full rounded-md cursor-pointer flex justify-end items-end relative',
                  {
                    'border-brand': isSelected,
                  }
                )}
                {...rest}
              >
                <div className="h-full w-full bg-gray-200 rounded-md p-3.5">
                  {type && <FragmentTypeIcon type={type} />}
                </div>
                <div className="w-4 h-4 m-1 bg-gray-500 rounded-full p-2 absolute" />
              </div>
            )
          case 9:
            return (
              <div
                className={cx(
                  'w-full border border-gray-200 h-full rounded-md cursor-pointer flex items-center gap-x-2',
                  {
                    'border-brand': isSelected,
                  }
                )}
                {...rest}
              >
                <div className="h-7 w-5/6 bg-gray-200 rounded-sm p-1.5 ml-2">
                  {type && <FragmentTypeIcon type={type} />}
                </div>
                <div className="h-full w-3/6 bg-gray-500 rounded-tr-sm rounded-br-sm p-2" />
              </div>
            )
          case 10:
            return (
              <div
                className={cx(
                  'w-full border border-gray-200 h-full rounded-md cursor-pointer flex items-center',
                  {
                    'border-brand': isSelected,
                  }
                )}
                {...rest}
              >
                <div className="h-8 w-3/6 bg-gray-200 p-1.5">
                  {type && <FragmentTypeIcon type={type} />}
                </div>
                <div className="h-full w-3/6 bg-gray-500 rounded-tr-sm rounded-br-sm items-self-end" />
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
