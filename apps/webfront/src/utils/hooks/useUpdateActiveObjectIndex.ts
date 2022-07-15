/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from 'react'
import { useSetRecoilState } from 'recoil'
import { activeObjectIndexAtom } from 'src/stores/studio.store'
import { useObject, useRoom } from '../liveblocks.config'

const useUpdateActiveObjectIndex = (shouldUpdateLiveblocks: boolean) => {
	const activeObjectIndex = useObject('activeObjectIndex')
	const setActiveObjectIndex = useSetRecoilState(activeObjectIndexAtom)
	const room = useRoom()

	useEffect(() => {
		let unsubscribe: any
		if (activeObjectIndex && shouldUpdateLiveblocks && !unsubscribe) {
			unsubscribe = room.subscribe(
				activeObjectIndex,
				() => {
					setActiveObjectIndex(activeObjectIndex.get('activeObjectIndex'))
				},
				{ isDeep: true }
			)
		}
		return () => {
			unsubscribe?.()
		}
	}, [activeObjectIndex, shouldUpdateLiveblocks])

	const updateActiveObjectIndex = (index: number) => {
		if (shouldUpdateLiveblocks) {
			activeObjectIndex?.update({ activeObjectIndex: index })
		} else {
			setActiveObjectIndex(index)
		}
	}

	const reset = (index: number) => {
		if (shouldUpdateLiveblocks)
			activeObjectIndex?.update({ activeObjectIndex: index })
		setActiveObjectIndex(index)
	}

	return { updateActiveObjectIndex, reset }
}

export default useUpdateActiveObjectIndex
