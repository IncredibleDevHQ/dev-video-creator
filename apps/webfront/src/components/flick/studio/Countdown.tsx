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

import { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { StudioState, studioStateAtom } from 'src/stores/studio.store'
import { Heading } from 'ui/src'

const Countdown = ({
	updateState,
}: {
	updateState: (value: StudioState) => void
}) => {
	const state = useRecoilValue(studioStateAtom)
	const [timer, setTimer] = useState<number>(3)

	useEffect(() => {
		if (state === 'countDown') {
			if (timer === 0) {
				updateState('recording')
			} else {
				setTimeout(() => {
					setTimer(timer - 1)
				}, 1000)
			}
		}
		if (state === 'ready' || state === 'resumed') setTimer(3)
	}, [state, timer])

	return timer > 0 && state === 'countDown' ? (
		<div className='z-10 p-4 flex flex-col items-center justify-center fixed w-screen left-0 top-0 min-h-screen bg-black bg-opacity-80'>
			<Heading className='text-white !text-[120px]'>{timer}</Heading>
		</div>
	) : null
}

export default Countdown
