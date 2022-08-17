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

import { useRef, useState } from 'react'

const useTimekeeper = (initialState = 0) => {
	const [timer, setTimer] = useState(initialState)
	const [isActive, setIsActive] = useState(false)
	const [isPaused, setIsPaused] = useState(false)
	const countRef = useRef<any>(null)

	// useEffect(() => {
	//   console.log(
	//     'current timer',
	//     timer,
	//     ' at ',
	//     new Date().toLocaleTimeString()
	//   )
	// }, [timer])

	// useEffect(() => {
	//   if (!countRef.current) return
	//   console.log(
	//     'current count ref',
	//     countRef.current,
	//     ' at ',
	//     new Date().toLocaleTimeString()
	//   )
	// }, [countRef])

	const handleStart = () => {
		setIsActive(true)
		setIsPaused(true)
		countRef.current = setInterval(() => {
			setTimer(currTimer => currTimer + 1)
		}, 1000)
	}

	const handlePause = () => {
		clearInterval(countRef.current)
		setIsPaused(false)
	}

	const handleResume = () => {
		setIsPaused(true)
		countRef.current = setInterval(() => {
			setTimer(currTimer => currTimer + 1)
		}, 1000)
	}

	const handleReset = () => {
		clearInterval(countRef.current)
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

export default useTimekeeper
