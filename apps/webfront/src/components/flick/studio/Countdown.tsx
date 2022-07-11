import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { studioStateAtom } from 'src/stores/studio.store'
import { Text } from 'ui/src/Text'

const Countdown = () => {
	const state = useRecoilValue(studioStateAtom)
	const [timer, setTimer] = useState<number>(3)

	useEffect(() => {
		if (state === 'countDown') {
			if (timer === 0) {
				// TODO change state to recording
			} else {
				setTimeout(() => {
					setTimer(timer - 1)
				}, 1000)
			}
		}
		if (state === 'ready') setTimer(3)
	}, [state, timer])

	return timer > 0 && state === 'countDown' ? (
		<div className='z-10 p-4 flex flex-col items-center justify-center fixed w-screen left-0 top-0 min-h-screen bg-black bg-opacity-80'>
			<Text className='text-white text-9xl'>{timer}</Text>
		</div>
	) : null
}

export default Countdown
