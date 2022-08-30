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



/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable @next/next/no-img-element */
import { cx } from '@emotion/css'
import { Listbox } from '@headlessui/react'
import { sentenceCase } from 'change-case'
import { useState, useEffect } from 'react'
import { BiCheck } from 'react-icons/bi'
import { IoChevronUpOutline, IoChevronDownOutline } from 'react-icons/io5'
import { Heading, Text } from 'ui/src'
import {
	ListBlockView,
	ListViewStyle,
	ListAppearance,
	ListOrientation,
} from 'utils/src'
import ListReplaceGif from 'svg/ListReplace.svg'
import ListAllAtOnceGif from 'svg/ListAllAtOnce.svg'
import ListStackGif from 'svg/ListStack.svg'
import BulletListStyleIcon from 'svg/BulletListStyle.svg'
import NumberListStyleIcon from 'svg/NumberListStyle.svg'

const ListBlockMode = ({
	view,
	updateView,
}: {
	view: ListBlockView
	updateView: (view: ListBlockView) => void
}) => {
	const [appearanceSrc, setAppearanceSrc] = useState<string>()

	useEffect(() => {
		let src = ''
		switch (view.list.appearance) {
			case 'stack':
				src = `${ListStackGif.src}?${Date.now()}`
				break
			case 'replace':
				src = `${ListReplaceGif.src}?${Date.now()}`
				updateView({
					...view,
					list: {
						...view.list,
						orientation: 'vertical',
						displayTitle: true,
					},
				})
				break
			case 'allAtOnce':
				src = `${ListAllAtOnceGif.src}?${Date.now()}`
				break
			default:
				src = `${ListStackGif.src}?${Date.now()}`
				break
		}
		setAppearanceSrc(src)
	}, [updateView, view, view.list.appearance])

	return (
		<div className='flex flex-col p-5'>
			<Heading textStyle='extraSmallTitle' className='font-bold'>
				List Style
			</Heading>
			<div className='grid grid-cols-3 mt-2 gap-x-2'>
				{(['none', 'bullet', 'number'] as ListViewStyle[]).map(style => (
					<div className='aspect-w-1 aspect-h-1'>
						<button
							type='button'
							onClick={() =>
								updateView({
									...view,
									list: {
										...view.list,
										viewStyle: style,
									},
								})
							}
							className={cx(
								'border border-gray-200 h-full w-full rounded-sm p-px',
								{
									'border-gray-800': view.list.viewStyle === style,
								}
							)}
						>
							{style === 'none' && (
								<div
									className={cx('bg-gray-100 w-full h-full', {
										'bg-gray-200': view.list.viewStyle === style,
									})}
								>
									<span
										className={cx(
											'flex items-center justify-center w-full h-full text-gray-300 rounded-sm text-xl',
											{
												'text-gray-800': view.list.viewStyle === style,
											}
										)}
									>
										-
									</span>
								</div>
							)}
							{(style === 'bullet' || style === 'number') && (
								<div
									style={{
										paddingLeft: '13px',
										paddingRight: '13px',
									}}
									className={cx(
										'flex flex-col items-center justify-center gap-y-1 bg-gray-100 w-full h-full p-2',
										{
											'bg-gray-200': view.list.viewStyle === style,
										}
									)}
								>
									<div
										className={cx(
											'filter h-full w-full p-1.5 flex items-center justify-center',
											{
												'brightness-0': view.list.viewStyle === style,
											}
										)}
									>
										{style === 'bullet' ? (
											<BulletListStyleIcon className='' />
										) : (
											<NumberListStyleIcon className='' />
										)}
									</div>
								</div>
							)}
						</button>
					</div>
				))}
			</div>
			<Heading textStyle='extraSmallTitle' className='font-bold mt-8'>
				Appearance
			</Heading>
			<Listbox
				value={view.list.appearance}
				onChange={value =>
					updateView({
						...view,
						list: {
							...view.list,
							appearance: value,
						},
					})
				}
			>
				{({ open }) => (
					<div className='relative mt-2'>
						<Listbox.Button className='w-full flex gap-x-4 text-left items-center justify-between rounded-sm bg-gray-100 shadow-sm py-2 px-3 pr-8 relative text-gray-800'>
							<div className='flex items-center gap-x-2 w-full'>
								<Text textStyle='caption' className='block truncate'>
									{sentenceCase(view.list.appearance as string)}
								</Text>
							</div>
							<span className='absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none '>
								{open ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
							</span>
						</Listbox.Button>
						<Listbox.Options className='bg-dark-300 mt-2 rounded-md absolute w-full z-10 shadow-md p-1.5'>
							{(['stack', 'replace', 'allAtOnce'] as ListAppearance[]).map(
								appearance => (
									<Listbox.Option
										className={({ active }) =>
											cx(
												'flex items-center gap-x-4 py-2 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer rounded-sm',
												{
													'bg-dark-100': active,
												}
											)
										}
										key={appearance}
										value={appearance}
									>
										{({ selected }) => (
											<>
												<Text textStyle='caption' className='block truncate '>
													{sentenceCase(appearance)}
												</Text>
												{selected && (
													<span className='absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none'>
														<BiCheck size={20} />
													</span>
												)}
											</>
										)}
									</Listbox.Option>
								)
							)}
						</Listbox.Options>
					</div>
				)}
			</Listbox>
			{appearanceSrc && (
				<img
					src={appearanceSrc}
					alt='Stack Preview'
					className='w-full h-full mt-2'
					onClick={e => {
						// invalidate image cache to force reload
						const src = e.currentTarget.src.split('?')[0]
						e.currentTarget.src = `${src}?${Date.now()}`
					}}
				/>
			)}
			{view.list.appearance !== 'replace' && (
				<>
					<Heading textStyle='extraSmallTitle' className='font-bold mt-8'>
						Title appearance
					</Heading>
					<div className='grid grid-cols-3 mt-2 gap-x-2'>
						<div className='aspect-w-1 aspect-h-1'>
							<button
								type='button'
								onClick={() =>
									updateView({
										...view,
										list: {
											...view.list,
											displayTitle: false,
										},
									})
								}
								className={cx(
									'border border-gray-200 h-full w-full rounded-sm p-px ',
									{
										'border-gray-800': !view?.list?.displayTitle,
									}
								)}
							>
								<div
									className={cx('bg-gray-100 w-full h-full p-2', {
										'bg-gray-200': !view?.list?.displayTitle,
									})}
								>
									<div
										className={cx('w-full h-full bg-gray-300 rounded-sm', {
											'!bg-gray-800': !view?.list?.displayTitle,
										})}
									/>
								</div>
							</button>
						</div>
						<div className='aspect-w-1 aspect-h-1'>
							<button
								type='button'
								onClick={() =>
									updateView({
										...view,
										list: {
											...view.list,
											displayTitle: true,
										},
									})
								}
								className={cx(
									'border border-gray-200 h-full w-full rounded-sm p-px ',
									{
										'border-gray-800': view?.list?.displayTitle,
									}
								)}
							>
								<div
									style={{
										paddingLeft: '13px',
										paddingRight: '13px',
									}}
									className={cx(
										'flex flex-col items-center justify-center gap-y-1 bg-gray-100 w-full h-full p-2',
										{
											'bg-gray-200': view?.list?.displayTitle,
										}
									)}
								>
									<div
										style={{
											borderRadius: '2px',
										}}
										className={cx('w-full h-full bg-gray-300', {
											'!bg-gray-800': view?.list?.displayTitle,
										})}
									/>
									<div className='aspect-w-1 aspect-h-1 w-full'>
										<div
											style={{
												borderRadius: '3px',
											}}
											className={cx('w-full h-full bg-gray-300', {
												'!bg-gray-800': view?.list?.displayTitle,
											})}
										/>
									</div>
								</div>
							</button>
						</div>
					</div>
					<Heading textStyle='extraSmallTitle' className='font-bold mt-8'>
						Orientation
					</Heading>
					<div className='grid grid-cols-3 mt-2 gap-x-2'>
						{(['vertical', 'horizontal'] as ListOrientation[]).map(
							orientation => (
								<div className='aspect-w-1 aspect-h-1'>
									<button
										type='button'
										onClick={() =>
											updateView({
												...view,
												list: {
													...view.list,
													orientation,
												},
											})
										}
										className={cx(
											'border border-gray-200 h-full w-full rounded-sm p-px',
											{
												'border-gray-800':
													view.list.orientation === orientation,
											}
										)}
									>
										<div
											className={cx(
												'flex items-center justify-center gap-1 bg-gray-100 w-full h-full',
												{
													'bg-gray-200': view.list.orientation === orientation,
													'flex-row': orientation === 'horizontal',
													'flex-col': orientation === 'vertical',
												}
											)}
										>
											{[1, 2, 3].map(() => (
												<div
													style={{
														borderRadius: '2px',
													}}
													className='h-1.5 w-1.5 !bg-gray-800'
												/>
											))}
										</div>
									</button>
								</div>
							)
						)}
					</div>
				</>
			)}
		</div>
	)
}

export default ListBlockMode
