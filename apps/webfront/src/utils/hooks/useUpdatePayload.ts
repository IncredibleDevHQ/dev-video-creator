/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from 'react'
import { useSetRecoilState } from 'recoil'
import { payloadFamily } from 'src/stores/studio.store'
import { FragmentPayload } from '../configs'
import { useMap, useRoom } from '../liveblocks.config'

const useUpdatePayload = ({
	blockId,
	shouldUpdateLiveblocks,
}: {
	blockId: string
	shouldUpdateLiveblocks: boolean
}) => {
	const fragmentPayload = useMap('payload')?.get(blockId)
	const setFragmentPayload = useSetRecoilState(payloadFamily(blockId))
	const room = useRoom()

	useEffect(() => {
		let unsubscribe: any
		if (
			fragmentPayload &&
			setFragmentPayload &&
			shouldUpdateLiveblocks &&
			!unsubscribe
		) {
			unsubscribe = room.subscribe(
				fragmentPayload,
				() => {
					setFragmentPayload(fragmentPayload.toObject())
				},
				{ isDeep: true }
			)
		}
		return () => {
			unsubscribe?.()
		}
	}, [fragmentPayload, shouldUpdateLiveblocks])

	const updatePayload = (payload: FragmentPayload) => {
		if (shouldUpdateLiveblocks) {
			fragmentPayload?.update(payload)
		} else {
			setFragmentPayload(prev => ({ ...prev, ...payload }))
		}
	}

	const reset = (payload: FragmentPayload) => {
		if (shouldUpdateLiveblocks) fragmentPayload?.update(payload)
		setFragmentPayload(payload)
	}

	return { updatePayload, reset }
}

export default useUpdatePayload
