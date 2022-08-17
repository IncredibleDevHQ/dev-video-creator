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
