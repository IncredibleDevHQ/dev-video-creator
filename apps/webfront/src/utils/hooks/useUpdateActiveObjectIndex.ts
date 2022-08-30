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
