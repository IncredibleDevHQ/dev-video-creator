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
