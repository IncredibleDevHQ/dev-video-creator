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
      <h2 className="font-black text-3xl">Nothing selected. 🙈</h2>
      <Lottie
        width={width}
        options={defaultOptions}
        isPaused={false}
        isStopped={false}
      />
      <Text fontSize="small">{text}</Text>
    </div>
  )
}

export default EmptyState
