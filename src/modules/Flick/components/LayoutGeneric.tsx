/* eslint-disable react/no-unknown-property */
import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'
import {
  IoCodeSlashOutline,
  IoImageOutline,
  IoListOutline,
  IoPlayOutline,
} from 'react-icons/io5'
import { Block } from '../../../components/TextEditor/utils'
import { Layout } from '../../../utils/configTypes2'

export const FragmentTypeIcon = ({ type }: { type: Block['type'] }) => {
  return (
    <>
      {(() => {
        switch (type) {
          case 'imageBlock':
            return <IoImageOutline className="text-gray-400 h-full w-full" />
          case 'videoBlock':
            return <IoPlayOutline className="text-gray-400 h-full w-full" />
          case 'listBlock':
            return <IoListOutline className="text-gray-400 h-full w-full" />
          case 'codeBlock':
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
  layout,
  isSelected,
  ...rest
}: {
  isSelected?: boolean
  layout: Layout
  type: Block['type']
} & HTMLAttributes<HTMLDivElement>) => {
  return (
    <>
      {(() => {
        switch (layout) {
          case 'classic':
            return (
              <div
                className={cx(
                  'w-32 h-16 p-2 border border-gray-200 rounded-md cursor-pointer bg-white',
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
          case 'float-full-right':
            return (
              <div
                className={cx(
                  'w-32 h-16 p-2 border border-gray-200 rounded-md cursor-pointer flex gap-x-2',
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
          case 'float-full-left':
            return (
              <div
                className={cx(
                  'w-32 h-16 p-2 border border-gray-200 rounded-md cursor-pointer flex gap-x-2',
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
          case 'float-half-right':
            return (
              <div
                className={cx(
                  'w-32 h-16 p-2 border border-gray-200 rounded-md cursor-pointer flex justify-end items-center relative',
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
          case 'padded-bottom-right-tile':
            return (
              <div
                className={cx(
                  'w-32 h-16 p-2 border border-gray-200 rounded-md cursor-pointer flex justify-end items-end relative',
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
          case 'padded-bottom-right-circle':
            return (
              <div
                className={cx(
                  'w-32 h-16 p-2 border border-gray-200 rounded-md cursor-pointer flex justify-end items-end relative',
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
          case 'bottom-right-tile':
            return (
              <div
                className={cx(
                  'w-32 h-16 border border-gray-200 rounded-md cursor-pointer flex justify-end items-end relative',
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
          case 'bottom-right-circle':
            return (
              <div
                className={cx(
                  'w-32 h-16 border border-gray-200 rounded-md cursor-pointer flex justify-end items-end relative',
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
          case 'padded-split':
            return (
              <div
                className={cx(
                  'w-32 h-16 border border-gray-200 rounded-md cursor-pointer flex items-center gap-x-2',
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
          case 'split':
            return (
              <div
                className={cx(
                  'w-32 h-16 border border-gray-200 rounded-md cursor-pointer flex items-center',
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
