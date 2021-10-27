import { cx } from '@emotion/css'
import React from 'react'
import { ASSETS } from '../../constants'
import { Text } from '../../components'

const InWaitlist = () => {
  return (
    <div className="w-screen min-h-screen grid grid-cols-12">
      <img
        src={ASSETS.ICONS.IncredibleLogo}
        alt="Incredible"
        className="absolute left-0 top-0 m-4"
      />
      <div
        className={cx(
          'w-full col-start-5 col-end-9 flex flex-col items-center -mt-12 justify-center'
        )}
      >
        <div className="flex">
          <div className="h-32 w-32 bg-gray-200 rounded-full z-0" />
          <div className="h-32 w-32 rounded-full backdrop-filter backdrop-blur-xl -ml-32 z-20" />
          <div className="h-24 w-24 bg-brand rounded-full -ml-10 z-10" />
        </div>
        <div className="px-14">
          <Text className="mt-8 font-black text-3xl flex flex-col mb-4">
            <span> You are in queue to join </span>
            <span> Incredible 🎉 </span>
          </Text>
          <Text>
            We’re working hard to make Incredible available to everyone. We’ll
            get back to you as soon as possible.{' '}
          </Text>
        </div>
      </div>
    </div>
  )
}

export default InWaitlist
