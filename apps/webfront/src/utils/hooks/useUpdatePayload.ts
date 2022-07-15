import { useSetRecoilState } from 'recoil'
import { payloadFamily } from 'src/stores/studio.store'
import { FragmentPayload } from '../configs'
import {
	RoomEventTypes,
	useBroadcastEvent,
	useEventListener,
} from '../liveblocks.config'

const useUpdatePayload = ({
	blockId,
	shouldUpdateLiveblocks,
}: {
	blockId: string
	shouldUpdateLiveblocks: boolean
}) => {
	const setFragmentPayload = useSetRecoilState(payloadFamily(blockId))
	const broadcast = useBroadcastEvent()

	// useEffect(() => {
	// 	let unsubscribe: any
	//   console.log('fragment',fragmentPayload)
	// 	if (fragmentPayload && shouldUpdateLiveblocks && !unsubscribe) {
	// 		unsubscribe = room.subscribe(
	// 			fragmentPayload,
	// 			() => {
	// 				setFragmentPayload(fragmentPayload.toObject())
	// 			},
	// 			{ isDeep: true }
	// 		)
	// 	}
	// 	return () => {
	// 		unsubscribe?.()
	// 	}
	// }, [fragmentPayload, shouldUpdateLiveblocks])

	useEventListener(({ event }) => {
		if (event.type === RoomEventTypes.PayloadChanged) {
			if (event.payload.blockId === blockId && shouldUpdateLiveblocks) {
				setFragmentPayload(prev => ({ ...prev, ...event.payload.payload }))
			}
		}
	})

	const updatePayload = (payload: FragmentPayload) => {
		if (shouldUpdateLiveblocks) {
			broadcast({
				type: RoomEventTypes.PayloadChanged,
				payload: {
					blockId,
					payload,
				},
			})
			setFragmentPayload(prev => ({ ...prev, ...payload }))
		} else {
			setFragmentPayload(prev => ({ ...prev, ...payload }))
		}
	}

	const reset = (payload: FragmentPayload) => {
		if (shouldUpdateLiveblocks)
			broadcast({
				type: RoomEventTypes.PayloadChanged,
				payload: {
					blockId,
					payload,
				},
			})
		setFragmentPayload(payload)
	}

	return { updatePayload, reset }
}

export default useUpdatePayload
