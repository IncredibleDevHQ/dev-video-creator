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

/* eslint-disable react/require-default-props */
import { cx } from '@emotion/css'
import { Switch as HeadlessSwitch } from '@headlessui/react'

export const Switch = ({
	label,
	checked,
	disabled,
	labelClassName,
	onChange,
}: {
	label?: string
	checked: boolean
	disabled?: boolean
	labelClassName?: string
	onChange: (checked: boolean) => void
}) => (
	<HeadlessSwitch.Group>
		<div className='flex items-center'>
			<HeadlessSwitch.Label className={cx('mr-4', labelClassName)}>
				{label}
			</HeadlessSwitch.Label>
			<HeadlessSwitch
				checked={checked}
				onChange={onChange}
				disabled={disabled}
				className={`${checked ? 'bg-green-600' : 'bg-gray-200'} ${
					disabled ? ' opacity-50' : ''
				} relative inline-flex items-center h-5 rounded-full w-9 transition-colors focus:outline-none disabled:cursor-not-allowed`}
			>
				<span
					className={`${
						checked ? 'translate-x-5' : 'translate-x-1'
					} inline-block w-3 h-3 transform bg-white rounded-full transition-transform`}
				/>
			</HeadlessSwitch>
		</div>
	</HeadlessSwitch.Group>
)
