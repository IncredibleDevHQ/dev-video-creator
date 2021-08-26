import React from 'react'
import Lottie from 'react-lottie'
import { ASSETS } from '../constants'
import Text from './Text'

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
    <div className="flex h-full justify-center items-center flex-col">
      <h2 className="font-black text-3xl">Select a Fragment to see it here.</h2>
    </div>
  )
}

export default EmptyState
