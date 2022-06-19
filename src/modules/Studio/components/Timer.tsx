import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { Text } from '../../../components'

const formatTime = (timer: number) => {
  const getSeconds = `0${timer % 60}`.slice(-2)
  const minutes = `${Math.floor(timer / 60)}`
  const getMinutes = `0${+minutes % 60}`.slice(-2)

  return `${getMinutes}:${getSeconds}`
}

type TimerState = 'noTarget' | 'onTime' | 'overtime' | 'closeShave'

const Timer = ({ target, timer }: { target?: number; timer: number }) => {
  const [timerState, setTimerState] = useState<TimerState>()

  useEffect(() => {
    if (!target) {
      setTimerState('noTarget')
      return
    }
    switch (true) {
      case typeof target === 'undefined':
        setTimerState('noTarget')
        break
      case target - timer > 30:
        setTimerState('onTime')
        break
      case target - timer < 0:
        setTimerState('overtime')
        break
      case target - timer <= 30:
        setTimerState('closeShave')
        break
      default:
        throw Error('Invalid TimerState.')
    }
  }, [timer])

  return (
    <div
      className={cx(
        'flex rounded-sm justify-center w-full'
        // {
        //   'bg-brand-10': timerState === 'onTime' || timerState === 'noTarget',
        //   'bg-error-10': timerState === 'closeShave' || timerState === 'overtime',
        // }
      )}
    >
      <Text className="text-sm text-gray-300">{formatTime(timer)}</Text>
      {/* {(() => {
        switch (timerState) {
          case 'noTarget':
            return (
              <Text className="text-sm text-brand font-semibold">
                {formatTime(timer)}
              </Text>
            )
          case 'onTime':
            return (
              <Text className="text-sm text-brand font-semibold">
                <span>{formatTime(timer)}</span>
              </Text>
            )
          case 'closeShave':
            return (
              <Text className="text-sm text-error font-semibold animate-pulse">
                <span>{formatTime(timer)}</span>
              </Text>
            )
          case 'overtime':
            return (
              <Text className="text-sm text-error font-semibold animate-pulse">
                +{formatTime(timer - target)}
              </Text>
            )
          default:
            return null
        }
      })()} */}
    </div>
  )
}

export default Timer
