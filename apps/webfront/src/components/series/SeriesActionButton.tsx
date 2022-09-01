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

/* eslint-disable react/jsx-props-no-spreading */
import { HTMLAttributes } from 'react'

import { cx } from '@emotion/css'

const SeriesActionButton = ({
	icon,
	number,
	className,
	children,
	disabled,
	...rest
}: {
	icon?: JSX.Element
	number?: number
	disabled?: boolean
} & HTMLAttributes<HTMLButtonElement>) => (
	<button
		type='button'
		className={cx(
			'flex items-center justify-start overflow-hidden text-dark-title font-main font-semibold group rounded-sm active:scale-95 transition-all',
			className
		)}
		{...rest}
	>
		<div className='flex items-center justify-center gap-x-2 bg-dark-100 text-size-xs md:text-size-sm px-3 md:px-4 min-h-[32px] md:min-h-[40px]'>
			{icon}
			{children}
		</div>

		{number !== undefined && (
			<>
				<div className='w-px h-full' />
				<div className='bg-dark-100 flex items-center justify-center text-size-xs md:text-size-sm px-3 md:px-4 min-h-[32px] md:min-h-[40px]'>
					{number}
				</div>
			</>
		)}
	</button>
)

export default SeriesActionButton
