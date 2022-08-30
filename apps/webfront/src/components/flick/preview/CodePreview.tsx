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
import { Listbox } from '@headlessui/react'
import { BiCheck } from 'react-icons/bi'
import {
	IoChevronUpOutline,
	IoChevronDownOutline,
	IoCloseOutline,
	IoAddOutline,
} from 'react-icons/io5'
import { Heading, Text } from 'ui/src'
import { CodeAnimation, CodeBlockView } from 'utils/src'

const CodeTextSizeTab = ({
	view,
	updateView,
}: {
	view: CodeBlockView
	updateView: (view: CodeBlockView) => void
}) => (
	<div className='flex flex-col p-5'>
		<Heading textStyle='extraSmallTitle'>Text size</Heading>
		<div className='grid grid-cols-3 mt-2 gap-x-2'>
			{[12, 16, 20].map(size => (
				<div className='aspect-w-1 aspect-h-1'>
					<button
						type='button'
						onClick={() => {
							updateView({
								...view,
								code: {
									...view?.code,
									fontSize: size,
								},
							})
						}}
						className={cx('border border-gray-200 rounded-sm p-px', {
							'border-gray-800': view?.code?.fontSize === size,
						})}
					>
						<Text
							textStyle='bodySmall'
							className={cx(
								'w-full h-full flex items-center justify-center text-gray-400 bg-gray-100',
								{
									'text-gray-800 bg-gray-200': view?.code?.fontSize === size,
								}
							)}
						>
							{size}px
						</Text>
					</button>
				</div>
			))}
		</div>
	</div>
)

const CodeAnimateTab = ({
	view,
	updateView,
}: {
	view: CodeBlockView
	updateView: (view: CodeBlockView) => void
}) => {
	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement>,
		index: number
	) => {
		const { value } = e.target
		const [f, t] = value.split('-')

		const { from, to } = t
			? { from: parseInt(f, 10), to: parseInt(t, 10) }
			: { from: parseInt(f, 10), to: parseInt(f, 10) }

		updateView({
			...view,
			code: {
				...view.code,
				highlightSteps: [
					...(view.code.highlightSteps?.slice(0, index) || []),
					{
						step: value,
						valid:
							value.match(/^\d+-\d+$/) !== null ||
							value.match(/^\d+$/) !== null,
						from: from - 1,
						to: to - 1,
						fileIndex: 0,
					},
					...(view.code.highlightSteps?.slice(index + 1) || []),
				],
			},
		})
	}

	return (
		<div className='flex flex-col p-5'>
			<Heading textStyle='extraSmallTitle' className='font-bold'>
				Animation
			</Heading>
			<Listbox
				value={view.code.animation}
				onChange={value =>
					updateView({
						...view,
						code: {
							...view.code,
							animation: value,
						},
					})
				}
			>
				{({ open }) => (
					<div className='relative mt-2'>
						<Listbox.Button className='w-full flex gap-x-4 text-left items-center justify-between rounded-sm bg-gray-100 shadow-sm py-2 px-3 pr-8 relative text-gray-800'>
							<div className='flex items-center gap-x-2 w-full'>
								<Text className='!text-size-xs block truncate '>
									{view.code.animation}
								</Text>
							</div>
							<span className='absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none '>
								{open ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
							</span>
						</Listbox.Button>
						<Listbox.Options className='bg-dark-300 mt-2 rounded-md absolute w-full p-1.5'>
							{Object.values(CodeAnimation).map(animation => (
								<Listbox.Option
									className={({ active }) =>
										cx(
											'flex items-center gap-x-4 py-2 px-3 pr-8 relative text-left  text-gray-100 cursor-pointer rounded-sm',
											{
												'bg-dark-100': active,
											}
										)
									}
									key={animation}
									value={animation}
								>
									{({ selected }) => (
										<>
											<Text className='!text-size-xs block truncate '>
												{animation}
											</Text>
											{selected && (
												<span className='absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none'>
													<BiCheck size={20} />
												</span>
											)}
										</>
									)}
								</Listbox.Option>
							))}
						</Listbox.Options>
					</div>
				)}
			</Listbox>
			{view.code.animation === CodeAnimation.HighlightLines && (
				<>
					<Heading textStyle='extraSmallTitle' className='font-bold mt-8'>
						Code Highlights
					</Heading>
					{view.code.highlightSteps?.map((_, index) => (
						<div className='mt-2'>
							<div className='flex items-center bg-gray-100 w-full py-2 px-2 rounded-sm border border-transparent justify-between'>
								<input
									value={view.code.highlightSteps?.[index].step}
									onChange={e => handleChange(e, index)}
									placeholder='1-4'
									className='bg-gray-100 rounded-sm focus:outline-none font-body text-size-xs placeholder-gray-400'
								/>
								<IoCloseOutline
									className='cursor-pointer'
									onClick={() => {
										updateView({
											...view,
											code: {
												...view.code,
												highlightSteps: view.code.highlightSteps?.filter(
													(__, i) => i !== index
												),
											},
										})
									}}
								/>
							</div>
							{!view.code.highlightSteps?.[index].valid &&
								view.code.highlightSteps?.[index].step && (
									<span className='text-xs font-body text-red-600 italic'>
										Enter a number or a range of numbers
									</span>
								)}
						</div>
					))}
					<button
						type='button'
						className='flex items-center gap-x-2 text-gray-800 mt-4 w-max'
						onClick={() => {
							updateView({
								...view,
								code: {
									...view.code,
									highlightSteps: [...(view.code.highlightSteps || []), {}],
								},
							})
						}}
					>
						<IoAddOutline />
						<Text className='text-left font-main !text-size-xs'>Add step</Text>
					</button>
				</>
			)}
		</div>
	)
}

export { CodeTextSizeTab, CodeAnimateTab }
