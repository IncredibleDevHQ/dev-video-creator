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
