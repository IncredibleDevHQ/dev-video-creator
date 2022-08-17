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
import { capitalCase } from 'change-case'
import { ChangeEvent, useCallback, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5'
import { Heading, Switch, Text } from 'ui/src'
import { HandleDetails, OutroBlockView } from 'utils/src'

const SocialHandle = ({
	title,
	value,
	enabledCount,
	update,
}: {
	title: string
	value?: HandleDetails
	enabledCount: number
	update?: (title: string, value: HandleDetails) => void
}) => (
	<div>
		<div className='flex justify-between items-center'>
			<Heading textStyle='extraSmallTitle'>{title}</Heading>
			<Switch
				disabled={enabledCount === 3 && !value?.enabled}
				checked={value?.enabled || false}
				onChange={checked => {
					update?.(title, {
						handle: value?.handle || '',
						enabled: checked,
					})
				}}
			/>
		</div>
		<input
			className='bg-gray-100 mt-1.5 py-2 px-2 rounded-sm w-full h-full focus:outline-none font-body text-size-xs placeholder-gray-400'
			value={value?.handle}
			onChange={(e: ChangeEvent<HTMLInputElement>) => {
				update?.(title, {
					enabled: value?.enabled || false,
					handle: e.target.value,
				})
			}}
		/>
	</div>
)

const OutroContentTab = ({
	view,
	updateView,
}: {
	view: OutroBlockView | undefined
	updateView: (view: OutroBlockView) => void
}) => {
	const updateHandle = useCallback(
		(title: string, handle: HandleDetails) => {
			let alreadyEnabled = false
			let count = Object.entries(view?.outro || {}).reduce((total, [, b]) => {
				if ((b as HandleDetails).enabled) {
					if ((b as HandleDetails).handle === handle.handle) {
						alreadyEnabled = true
					}
					return total + 1
				}
				return total
			}, 0)

			/* FIXME: count doesn't work correctly */
			if (handle.enabled && !alreadyEnabled) {
				count += 1
			} else if (!handle.enabled && alreadyEnabled) {
				count -= 1
			}

			let socialDetails: OutroBlockView = {
				...view,
				type: 'outroBlock',
				outro: view?.outro || {},
			}

			if (title === 'Twitter') {
				socialDetails = {
					type: 'outroBlock',
					outro: {
						...view?.outro,
						twitter: handle,
						noOfSocialHandles: count,
					},
				}
			}
			if (title === 'Discord') {
				socialDetails = {
					type: 'outroBlock',
					outro: {
						...view?.outro,
						discord: handle,
						noOfSocialHandles: count,
					},
				}
			}

			if (title === 'Youtube') {
				socialDetails = {
					type: 'outroBlock',
					outro: {
						...view?.outro,
						youtube: handle,
						noOfSocialHandles: count,
					},
				}
			}

			if (title === 'LinkedIn') {
				socialDetails = {
					type: 'outroBlock',
					outro: {
						...view?.outro,
						linkedin: handle,
						noOfSocialHandles: count,
					},
				}
			}

			if (title === 'Website') {
				socialDetails = {
					type: 'outroBlock',
					outro: {
						...view?.outro,
						website: handle,
						noOfSocialHandles: count,
					},
				}
			}

			updateView(socialDetails)
		},
		[updateView, view]
	)

	return (
		<div className='flex flex-col justify-start p-5'>
			<Heading textStyle='extraSmallTitle'>Outro Text</Heading>
			<input
				className='bg-gray-100 rounded-sm focus:outline-none font-body text-size-xs placeholder-gray-400 px-2 py-2 mt-1.5'
				value={view?.outro?.title}
				placeholder='Thanks for watching'
				onChange={e => {
					updateView({
						type: 'outroBlock',
						outro: {
							...view?.outro,
							title: e.target.value,
						},
					})
				}}
			/>
			<div className='flex flex-col mt-6 gap-y-6'>
				<SocialHandle
					title='Twitter'
					enabledCount={view?.outro?.noOfSocialHandles || 0}
					value={view?.outro?.twitter}
					update={updateHandle}
				/>
				<SocialHandle
					title='Discord'
					enabledCount={view?.outro?.noOfSocialHandles || 0}
					value={view?.outro?.discord}
					update={updateHandle}
				/>
				<SocialHandle
					title='Youtube'
					enabledCount={view?.outro?.noOfSocialHandles || 0}
					value={view?.outro?.youtube}
					update={updateHandle}
				/>
				<SocialHandle
					title='LinkedIn'
					enabledCount={view?.outro?.noOfSocialHandles || 0}
					value={view?.outro?.linkedin}
					update={updateHandle}
				/>
				<SocialHandle
					title='Website'
					enabledCount={view?.outro?.noOfSocialHandles || 0}
					value={view?.outro?.website}
					update={updateHandle}
				/>
			</div>
		</div>
	)
}

const OutroSequenceTab = ({
	view,
	updateView,
}: {
	view: OutroBlockView | undefined
	updateView: (view: OutroBlockView) => void
}) => {
	useEffect(() => {
		if (!view?.outro.order) {
			updateView({
				...view,
				type: 'outroBlock',
				outro: {
					...view?.outro,
					order: [
						{
							state: 'outroVideo',
							enabled: true,
						},
						{
							state: 'titleSplash',
							enabled: true,
						},
					],
				},
			})
		}
	}, [updateView, view])

	return (
		<div className='flex flex-col pt-6 px-4'>
			<Heading textStyle='extraSmallTitle' className='font-bold'>
				Sequence
			</Heading>
			<Text textStyle='bodySmall' className='text-gray-400'>
				Drag and drop to change sequence
			</Text>
			<DragDropContext
				onDragEnd={result => {
					const { destination, source } = result

					if (!destination || !view?.outro?.order) return

					if (
						destination.droppableId === source.droppableId &&
						destination.index === source.index
					)
						return

					const newOrder = Array.from(view.outro.order)
					newOrder.splice(source.index, 1)
					newOrder.splice(destination.index, 0, view.outro.order[source.index])
					updateView({
						...view,
						type: 'outroBlock',
						outro: {
							...view?.outro,
							order: newOrder,
						},
					})
				}}
			>
				<Droppable droppableId='droppable'>
					{provided => (
						<div
							className='flex flex-col justify-center gap-y-2 w-full border border-dashed mt-4 rounded-md p-2'
							style={{
								height: view?.outro?.order?.length === 2 ? '105px' : '60px',
							}}
							{...provided.droppableProps}
							ref={provided.innerRef}
						>
							{view?.outro?.order?.map((o, i) => (
								<Draggable key={o.state} draggableId={o.state} index={i}>
									{draggableProvided => (
										<div
											className='flex justify-between border rounded-sm p-2 text-size-xs font-body bg-white'
											ref={draggableProvided.innerRef}
											{...draggableProvided.draggableProps}
											{...draggableProvided.dragHandleProps}
										>
											{capitalCase(o.state)}
											<button
												type='button'
												className='disabled:cursor-not-allowed'
												disabled={
													view?.outro?.order?.filter(order => order.enabled)
														.length === 1 && o.enabled
												}
												onClick={() => {
													updateView({
														...view,
														type: 'outroBlock',
														outro: {
															...view?.outro,
															order: view?.outro?.order?.map(item => {
																if (item.state === o.state) {
																	return {
																		...o,
																		enabled: !o.enabled,
																	}
																}
																return item
															}),
														},
													})
												}}
											>
												{o.enabled ? (
													<IoEyeOutline size={16} />
												) : (
													<IoEyeOffOutline size={16} />
												)}
											</button>
										</div>
									)}
								</Draggable>
							))}
						</div>
					)}
				</Droppable>
			</DragDropContext>
		</div>
	)
}

export { OutroContentTab, OutroSequenceTab }
