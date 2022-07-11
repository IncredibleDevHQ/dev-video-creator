import { useEffect } from 'react'
import { useSetRecoilState } from 'recoil'
import { payloadFamily } from 'src/stores/studio.store'
import { FragmentPayload } from '../configs'
import { useMap } from '../liveblocks.config'

const useUpdatePayload = ({
	blockId,
	shouldUpdateLiveblocks,
}: {
	blockId: string
	shouldUpdateLiveblocks: boolean
}) => {
	const fragmentPayload = useMap('payload')?.get(blockId)
	const setFragmentPayload = useSetRecoilState(payloadFamily(blockId))

	useEffect(() => {
		if (fragmentPayload && setFragmentPayload && shouldUpdateLiveblocks) {
			setFragmentPayload(fragmentPayload.toObject())
		}
	}, [fragmentPayload, setFragmentPayload, shouldUpdateLiveblocks])

	const updatePayload = ( payload: FragmentPayload ) => {
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
