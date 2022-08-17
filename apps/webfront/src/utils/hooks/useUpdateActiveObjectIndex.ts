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
