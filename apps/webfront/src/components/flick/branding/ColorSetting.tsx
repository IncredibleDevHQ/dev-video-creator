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

import { css, cx } from '@emotion/css'
import { Popover } from '@headlessui/react'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import { IoAddOutline, IoCloseCircle, IoCloseOutline } from 'react-icons/io5'
import { BrandingInterface } from 'src/utils/configs'
import { Heading } from 'ui/src'

const colorPickerStyle = css`
	.react-colorful__saturation {
		border-radius: 4px;
		width: 268px;
	}

	.react-colorful__hue {
		margin-top: 10px;
		height: 16px;
		border-radius: 4px;
		width: 268px;
	}

	.react-colorful__saturation-pointer {
		width: 16px;
		height: 16px;
	}

	.react-colorful__hue-pointer {
		width: 16px;
		height: 16px;
	}
`

interface Setting {
	category: string
	types: ('primary' | 'secondary' | 'text' | 'transition')[]
}

const settings: Setting[] = [
	{
		category: 'Surface Color',
		types: ['primary'],
	},
	{
		category: 'Text Color',
		types: ['text'],
	},
	{
		category: 'Transition Color',
		types: ['transition'],
	},
]

const ColorPicker = ({
	color,
	onChange,
	close,
}: {
	color: string
	onChange: (newColor: string) => void
	close: () => void
}) => (
	<div
		style={{
			width: '300px',
		}}
		className='absolute -top-4 right-56 p-4 pt-2 mt-1 mr-6 bg-white border border-gray-200 rounded-sm shadow-sm'
	>
		<IoCloseOutline
			className='ml-auto cursor-pointer'
			size={16}
			onClick={() => close()}
		/>
		<Heading textStyle='extraSmallTitle'>Custom color</Heading>
		<HexColorPicker
			className={cx('mt-2', colorPickerStyle)}
			color={color}
			onChange={onChange}
		/>
		<HexColorInput
			color={color}
			className='w-full p-2 mt-3 text-size-xs text-center transition-colors bg-gray-100 rounded font-body focus:border-brand focus:outline-none'
			onChange={onChange}
		/>
	</div>
)

const ColorSetting = ({
	branding,
	setBranding,
}: {
	branding: BrandingInterface
	setBranding: (branding: BrandingInterface) => void
}) => (
	<div className='flex flex-col'>
		{settings.map((setting, index) => (
			<div
				key={setting.category}
				className={cx('flex flex-col', {
					'mt-10': index !== 0,
				})}
			>
				<Heading textStyle='extraSmallTitle'>{setting.category}</Heading>
				<div className=''>
					{setting.types.map(type => (
						<Popover as='div' className='relative'>
							{({ close }) => (
								<>
									<Popover.Button
										style={{
											backgroundColor: branding.branding?.colors?.[type] || '',
										}}
										className='relative flex items-center justify-center w-1/2 h-16 mt-2 rounded-sm cursor-pointer ring-1 ring-offset-1 ring-gray-100'
									>
										{branding.branding?.colors?.[type] && (
											<IoCloseCircle
												className='absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full'
												size={16}
												onClick={e => {
													e.stopPropagation()
													setBranding({
														...branding,
														branding: {
															...branding.branding,
															colors: {
																...branding.branding?.colors,
																[type]: undefined,
															},
														},
													})
												}}
											/>
										)}
										{!branding.branding?.colors?.[type] && (
											<IoAddOutline size={21} className='text-gray-500' />
										)}
									</Popover.Button>
									<Popover.Panel>
										<ColorPicker
											color={branding.branding?.colors?.[type] || '#000'}
											onChange={(newColor: string) => {
												setBranding({
													...branding,
													branding: {
														...branding.branding,
														colors: {
															...branding.branding?.colors,
															[type]: newColor,
														},
													},
												})
											}}
											close={close}
										/>
									</Popover.Panel>
								</>
							)}
						</Popover>
					))}
				</div>
			</div>
		))}
	</div>
)

export default ColorSetting
