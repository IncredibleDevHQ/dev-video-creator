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

import { Loader } from './Loader'

export const ScreenState = ({
	title,
	subtitle,
	button,
	onHandleClick,
	loading = true,
}: {
	title?: string
	subtitle?: string
	button?: string
	onHandleClick?: () => void
	loading?: boolean
}) => (
	<div className='fixed left-0 top-0 z-10 flex min-h-screen w-screen flex-col items-center justify-center bg-dark-500 p-4'>
		{loading && <Loader className='w-14 h-14' />}

		<div style={{ maxWidth: 256 }}>
			{title && (
				<h2 className='text-xl mt-8 mb-2 text-center font-bold text-gray-100'>
					{title}
				</h2>
			)}
			{subtitle && (
				<h4 className='text-sm text-center text-gray-200'>{subtitle}</h4>
			)}
		</div>
		{button && (
			<button type='button' className='mt-12' onClick={onHandleClick}>
				{button}
			</button>
		)}
	</div>
)

ScreenState.defaultProps = {
	title: undefined,
	subtitle: undefined,
	button: undefined,
	onHandleClick: undefined,
	loading: true,
}
