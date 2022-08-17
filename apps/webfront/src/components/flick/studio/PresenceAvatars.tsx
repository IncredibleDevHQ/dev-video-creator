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
