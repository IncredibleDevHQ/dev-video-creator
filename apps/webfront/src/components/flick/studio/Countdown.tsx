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
