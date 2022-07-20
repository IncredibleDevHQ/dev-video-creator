/* eslint-disable react-hooks/exhaustive-deps */
import { useRef, useEffect } from 'react'

function useDidUpdateEffect(fn: any, inputs: any) {
	const didMountRef = useRef(false)

	// eslint-disable-next-line consistent-return
	useEffect(() => {
		if (didMountRef.current) return fn()
		didMountRef.current = true
	}, inputs)
}

export default useDidUpdateEffect
