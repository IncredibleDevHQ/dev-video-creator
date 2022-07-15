import { useSetRecoilState } from 'recoil'
import { StudioState, studioStateAtom } from 'src/stores/studio.store'
import {
	RoomEventTypes,
	useBroadcastEvent,
	useEventListener,
} from '../liveblocks.config'

const useUpdateState = (shouldUpdateLiveblocks: boolean) => {
	const setState = useSetRecoilState(studioStateAtom)
	const broadcast = useBroadcastEvent()

	// useEffect(() => {
	// 	let unsubscribe: any
	// 	if (state && setState && shouldUpdateLiveblocks && !unsubscribe) {
	// 		unsubscribe = room.subscribe(
	// 			state,
	// 			() => {
	// 				setState(state.get('state'))
	// 			},
	// 			{ isDeep: true }
	// 		)
	// 	}
	// 	return () => {
	// 		unsubscribe?.()
	// 	}
	// }, [state, shouldUpdateLiveblocks])

	useEventListener(({ event }) => {
		if (event.type === RoomEventTypes.StateChanged) {
			if (shouldUpdateLiveblocks) {
				setState(event.payload)
			}
		}
	})

	const updateState = (studioState: StudioState) => {
		if (shouldUpdateLiveblocks) {
			broadcast({
				type: RoomEventTypes.StateChanged,
				payload: studioState,
			})
			setState(studioState)
		} else {
			setState(studioState)
		}
	}

	const reset = (studioState: StudioState) => {
		if (shouldUpdateLiveblocks)
			broadcast({
				type: RoomEventTypes.StateChanged,
				payload: studioState,
			})
		setState(studioState)
	}

	return { updateState, reset }
}

export default useUpdateState
