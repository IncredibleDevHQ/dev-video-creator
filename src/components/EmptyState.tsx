import React from 'react'
import { ASSETS } from '../constants'

const defaultOptions = {
  loop: true,
  autoplay: true,
  animationData: ASSETS.ANIMATION.EMPTY_ACTIVITY,
  rendererSettings: {
    preserveAspectRatio: 'xMidYMid slice',
  },
}
const EmptyState = ({ width, text }: { width: number; text: string }) => {
  return (
    <div className="flex h-full justify-center flex-col">
      <h2 className="font-black text-base">
        Select a Fragment to see it here.
      </h2>
    </div>
  )
}

export default EmptyState
