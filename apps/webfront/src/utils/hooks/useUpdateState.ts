/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from 'react'
import { useSetRecoilState } from 'recoil'
import { StudioState, studioStateAtom } from 'src/stores/studio.store'
import { useObject, useRoom } from '../liveblocks.config'

const useUpdateState = (shouldUpdateLiveblocks: boolean) => {
	const state = useObject('state')
	const setState = useSetRecoilState(studioStateAtom)
	const room = useRoom()

	useEffect(() => {
		let unsubscribe: any
		if (state && setState && shouldUpdateLiveblocks && !unsubscribe) {
			unsubscribe = room.subscribe(
				state,
				() => {
					setState(state.get('state'))
				},
				{ isDeep: true }
			)
		}
		return () => {
			unsubscribe?.()
		}
	}, [state, shouldUpdateLiveblocks])

	const updateState = (studioState: StudioState) => {
		if (shouldUpdateLiveblocks) {
			state?.update({ state: studioState })
		} else {
			setState(studioState)
		}
	}

	const reset = (studioState: StudioState) => {
		if (shouldUpdateLiveblocks) state?.update({ state: studioState })
		setState(studioState)
	}

	return { updateState, reset }
}

export default useUpdateState
