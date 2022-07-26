import React, { useEffect } from 'react'

const useOutsideClick = (ref: React.RefObject<any>, handler: () => void) => {
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (ref.current && !ref.current.contains(event.target)) {
				handler()
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [ref])
}

export default useOutsideClick
