// Copyright 2022 Pixelbyte Studio Pvt Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.



import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { studioStateAtom } from 'src/stores/studio.store'
import { Text } from 'ui/src'
import useInterval from 'use-interval'

const formatTime = (timer: number) => {
	const getSeconds = `0${timer % 60}`.slice(-2)
	const minutes = `${Math.floor(timer / 60)}`
	const getMinutes = `0${+minutes % 60}`.slice(-2)

	return `${getMinutes}:${getSeconds}`
}

// type TimerState = 'noTarget' | 'onTime' | 'overtime' | 'closeShave'

const Timer = () => {
	const state = useRecoilValue(studioStateAtom)
	const [timer, setTimer] = useState(0)
	const [isActive, setIsActive] = useState(false)

	useInterval(
		() => {
			setTimer(t => t + 1)
		},
		isActive ? 1000 : null,
		true
	)

	useEffect(() => {
		if (state === 'recording') {
			setTimer(0)
			setIsActive(true)
		}
		if (state === 'stopRecording') {
			setTimer(0)
			setIsActive(false)
		}
	}, [state])

	return (
		<div>
			<Text className='text-sm text-zinc-800'>{formatTime(timer)}</Text>
		</div>
	)
}

export default Timer
