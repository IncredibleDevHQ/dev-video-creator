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



import { cx } from '@emotion/css'
import { useState } from 'react'
import Check from 'svg/Check.svg'
import { IconButton } from 'ui/src'

const CookieBanner = () => {
	const [show, setShow] = useState(true)

	return (
		<div
			className={cx('container md:px-0 px-6', {
				hidden: !show,
			})}
		>
			<div className='z-50 flex flex-row items-center fixed left-0 right-0 bottom-10 mx-auto space-x-6 w-full md:max-w-[485px] max-w-[330px] rounded-lg px-6 py-4 backdrop-filter backdrop-blur-2xl bg-dark-300 bg-opacity-20'>
				<p className='text-size-sm font-normal text-dark-title-200'>
					By visiting our website, you agree to our 🍪 cookie policy
				</p>
				<IconButton
					colorScheme='dark'
					icon={<Check />}
					onClick={() => {
						setShow(false)
					}}
				/>
			</div>
		</div>
	)
}

export default CookieBanner
