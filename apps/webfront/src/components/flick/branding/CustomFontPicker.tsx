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



/* eslint-disable react-hooks/exhaustive-deps */
import { css, cx } from '@emotion/css'
import { Menu } from '@headlessui/react'
import { Font, FontManager, OPTIONS_DEFAULTS } from '@samuelmeuli/font-manager'
import React, { useEffect, useState } from 'react'
import { BiCheck } from 'react-icons/bi'
import { IoChevronDownOutline, IoChevronUpOutline } from 'react-icons/io5'
import { Button, Text } from 'ui/src'
import { loadFonts } from 'src/utils/hooks/useLoadFont'
import { useEnv } from 'utils/src'

export interface IFont {
	family: string
	type: 'google' | 'custom'
	url?: string
}

const initialFonts: IFont[] = [
	{
		family: 'Gilroy',
		type: 'custom',
	},
	{
		family: 'Inter',
		type: 'custom',
	},
]

const CustomFontPicker = ({
	activeFont,
	onChange,
	customFonts,
	showUploadFont,
}: {
	activeFont: IFont
	onChange: (font: IFont) => void
	customFonts: IFont[]
	showUploadFont: () => void
}) => {
	const [fonts, setFonts] = useState<IFont[]>(initialFonts)

	const { googleFontsApiKey } = useEnv()

	useEffect(() => {
		loadFonts(
			customFonts.map(font => ({
				family: font.family,
				type: font.type,
				url: font.url,
				weights: ['400'],
			}))
		)
		const newFonts = [...fonts, ...customFonts].sort((a, b) =>
			a.family.localeCompare(b.family)
		)
		setFonts(
			newFonts.filter(
				(font, index, self) =>
					self.findIndex(t => t.family === font.family) === index
			)
		)
	}, [customFonts])

	const getFonts = () => {
		const fontManager = new FontManager(
			googleFontsApiKey,
			'',
			{
				...OPTIONS_DEFAULTS,
				limit: 50,
			},
			() => {}
		)
		fontManager
			.init()
			.then(() => {
				const list = fontManager.getFonts()
				const fList: IFont[] = []
				list.forEach((font: Font) => {
					fList.push({
						family: font.family,
						type: 'google',
						url: `https://fonts.googleapis.com/css?family=${font.family}`,
					} as IFont)
				})
				setFonts(
					[...fList, initialFonts[0]]
						.filter(f => f.family !== '')
						.sort((a, b) => a.family.localeCompare(b.family))
				)
			})
			.catch(() => {
				// eslint-disable-next-line no-console
				console.error('Failed to load google fonts')
			})
	}

	useEffect(() => {
		getFonts()
	}, [])

	return (
		<Menu>
			{({ open }) => (
				<div className='relative mt-1'>
					<Menu.Button
						className={cx(
							'w-full flex gap-x-4 text-left items-center justify-between border border-transparent rounded-sm bg-gray-100 shadow-sm py-1.5 px-3 pr-8 relative',
							{
								'border-brand': open,
							}
						)}
					>
						<Text
							textStyle='caption'
							className={cx(
								'block truncate text-gray-800',
								css`
									font-family: ${activeFont.family};
								`
							)}
						>
							{activeFont.family}
						</Text>
						<span className='absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-600 '>
							{open ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
						</span>
					</Menu.Button>
					<div className='absolute w-full rounded-md z-50 bg-dark-300 mt-2 '>
						<Menu.Items>
							<Menu.Items
								className={cx(
									'h-52 overflow-y-scroll bg-dark-300 rounded-t-md w-full p-1',
									css`
										::-webkit-scrollbar {
											display: none;
										}
									`
								)}
							>
								{fonts.map(font => (
									<Menu.Item
										as='button'
										className='w-full'
										key={font.family}
										onClick={() => onChange(font)}
									>
										{({ active }) => (
											<div
												className={cx(
													'flex items-center gap-x-4 py-2 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer w-full rounded-sm',
													{
														'bg-dark-100': active,
													}
												)}
											>
												<Text
													textStyle='caption'
													className={cx(
														'block truncate',
														css`
															font-family: ${font.family};
														`
													)}
												>
													{font.family}
												</Text>
												{activeFont.family === font.family && (
													<span className='absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none'>
														<BiCheck size={20} />
													</span>
												)}
											</div>
										)}
									</Menu.Item>
								))}
							</Menu.Items>
							{open && (
								<Menu.Item
									className='w-full'
									as='button'
									onClick={() => {
										showUploadFont()
									}}
								>
									<div className='border-t border-gray-600 mx-3 pb-1  rounded-b-md bg-dark-300'>
										<Button
											colorScheme='dark'
											type='button'
											className='flex my-2 max-w-none w-full'
										>
											Add new
										</Button>
									</div>
								</Menu.Item>
							)}
						</Menu.Items>
					</div>
				</div>
			)}
		</Menu>
	)
}

export default CustomFontPicker
