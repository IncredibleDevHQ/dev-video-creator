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
