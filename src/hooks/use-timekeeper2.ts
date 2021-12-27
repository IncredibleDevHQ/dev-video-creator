import { useState } from 'react'
import useInterval from 'use-interval'

const useTimekeeper2 = (initialState = 0) => {
  const [timer, setTimer] = useState(initialState)
  const [isActive, setIsActive] = useState(false)
  const [isPaused, setIsPaused] = useState<false | number>(false)

  useInterval(
    () => {
      setTimer((timer) => timer + 1)
    },
    isActive ? isPaused : null,
    true
  )

  const handleStart = () => {
    setIsActive(true)
    setIsPaused(1000)
  }

  const handlePause = () => {
    setIsPaused(false)
  }

  const handleResume = () => {
    setIsPaused(1000)
  }

  const handleReset = () => {
    setIsActive(false)
    setIsPaused(false)
    setTimer(0)
  }

  return {
    timer,
    isActive,
    isPaused,
    handleStart,
    handlePause,
    handleResume,
    handleReset,
  }
}

export default useTimekeeper2
