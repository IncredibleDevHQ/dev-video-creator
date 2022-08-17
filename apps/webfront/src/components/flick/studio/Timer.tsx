// Copyright (c) 2022 Pixelbyte Studio Pvt Ltd
//
// This file is part of Incredible, Pixelbyte Studio Pvt Ltd
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program\.  If not, see <http://www\.gnu\.org/licenses/>\.

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
