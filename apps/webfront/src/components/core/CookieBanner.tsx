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
