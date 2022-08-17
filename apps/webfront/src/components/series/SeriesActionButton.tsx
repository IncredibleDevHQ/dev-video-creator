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
