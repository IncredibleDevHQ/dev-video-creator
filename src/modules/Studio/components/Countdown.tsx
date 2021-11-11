import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { Text } from '../../../components'
import { Fragment_Status_Enum_Enum } from '../../../generated/graphql'
import { StudioProviderProps, studioStore } from '../stores'

const Countdown = () => {
  const { state, payload, updatePayload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [timer, setTimer] = useState<number>(3)

  useEffect(() => {
    if (payload?.status === Fragment_Status_Enum_Enum.CountDown) {
      if (timer === 0) {
        updatePayload?.({
          status: Fragment_Status_Enum_Enum.Live,
        })
      } else {
        setTimeout(() => {
          setTimer(timer - 1)
        }, 1000)
      }
    }
    if (payload?.status === Fragment_Status_Enum_Enum.NotStarted) setTimer(3)
  }, [payload?.status, timer])

  return timer > 0 &&
    (state === 'countDown' ||
      payload?.status === Fragment_Status_Enum_Enum.CountDown) ? (
    <div className="z-10 p-4 flex flex-col items-center justify-center fixed w-screen left-0 top-0 min-h-screen bg-black bg-opacity-80">
      <Text className="text-white text-9xl">{timer}</Text>
    </div>
  ) : null
}

export default Countdown
