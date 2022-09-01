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

import { useEffect } from 'react'
import { useRecoilValue } from 'recoil'
import { studioStateAtom } from 'src/stores/studio.store'
import {
	PresencePage,
	useMyPresence,
	useOthers,
	Presence,
	useUpdateMyPresence,
} from 'src/utils/liveblocks.config'
import { Avatar } from 'ui/src'

const PresenceAvatars = () => {
	// getting the presence of others from live blocks
	const [myPresence] = useMyPresence()
	const others = useOthers()
	const updateMyPresence = useUpdateMyPresence()
	const state = useRecoilValue(studioStateAtom)

	useEffect(() => {
		if (state === 'ready' || state === 'resumed')
			updateMyPresence({
				page: PresencePage.Backstage,
			})
		if (state === 'recording')
			updateMyPresence({
				page: PresencePage.Recording,
			})
	}, [state])

	return (
		<>
			<Avatar
				src={myPresence.user.picture}
				name={myPresence.user.name}
				alt={myPresence.user.name}
				className='h-7 w-7 rounded-full'
			/>
			{others?.map(({ presence }) => {
				if (presence) {
					const otherPresence = presence as Presence
					return otherPresence.page === PresencePage.Recording ||
						otherPresence.page === PresencePage.Backstage ? (
						<Avatar
							src={otherPresence.user.picture}
							name={otherPresence.user.name}
							className='h-7 w-7 rounded-full'
							alt={otherPresence.user.name}
						/>
					) : null
				}
				return null
			})}
		</>
	)
}
export default PresenceAvatars
