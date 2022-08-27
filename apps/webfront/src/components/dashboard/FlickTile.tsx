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
import { Menu, Transition } from '@headlessui/react'
import { sentenceCase } from 'change-case'
import { differenceInMonths, format, formatDistance } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Fragment, useEffect, useState } from 'react'
import { FiMoreHorizontal } from 'react-icons/fi'
import { GoLinkExternal } from 'react-icons/go'
import {
	IoCopyOutline,
	IoDocumentTextOutline,
	IoTrashOutline,
} from 'react-icons/io5'
import { useUser } from 'src/utils/providers/auth'
import { emitToast, Heading, Text, ThumbnailPreview } from 'ui/src'
import { ContentTypeEnum, OrientationEnum } from 'utils/src/enums'
import trpc, { inferQueryOutput } from '../../server/trpc'

const FlickTile = ({
	id,
	name,
	Content,
	updatedAt,
	ownerSub,
	handleDelete,
	handleCopy,
	joinLink,
}: inferQueryOutput<'story.infiniteStories'>['stories'][number] & {
	handleDelete: (id: string) => void
	handleCopy: (id: string, newId: string) => void
}) => {
	const { user } = useUser()

	const router = useRouter()

	const deleteFlick = trpc.useMutation(['story.delete'], {
		onSuccess(data) {
			emitToast('Successfully deleted the flick', { type: 'success' })
			handleDelete(data.flickId)
		},
		onError() {
			emitToast('Error deleting story', { type: 'error' })
		},
	})

	const deleteFlickFunction = async () => {
		await deleteFlick.mutateAsync({
			flickId: id,
		})
	}

	const duplicateFlick = trpc.useMutation(['story.duplicate'], {
		onSuccess(data) {
			emitToast('Successfully duplicated the flick', { type: 'success' })
			handleCopy(id, data.id)
		},
		onError() {
			emitToast('Error making copy', {
				type: 'error',
			})
		},
	})

	const [overflowButtonVisible, setOverflowButtonVisible] = useState(false)
	const [overflowMenuVisible, setOverflowMenuVisible] = useState(false)
	const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)

	useEffect(() => {
		if (!overflowMenuVisible) {
			setShowDeleteConfirmation(false)
			setOverflowButtonVisible(false)
		}
	}, [overflowMenuVisible])

	useEffect(() => {
		if (showDeleteConfirmation) {
			setTimeout(() => {
				setShowDeleteConfirmation(false)
			}, 2000)
		}
	}, [showDeleteConfirmation])

	return (
		<Link href={`/story/${id}`}>
			<div
				className='relative border border-dark-300 rounded-md cursor-pointer hover:border-green-600'
				onMouseEnter={() => setOverflowButtonVisible(true)}
				onMouseLeave={() => {
					if (!overflowMenuVisible) {
						setOverflowButtonVisible(false)
						setOverflowMenuVisible(false)
					}
				}}
			>
				{Content.length > 0 && (
					<div className='absolute z-10 text-size-xs bg-green-600 rounded-br-sm rounded-tl-sm px-1 py-px'>
						Published
					</div>
				)}
				<div className='aspect-w-16 aspect-h-9'>
					<div className='flex items-center justify-center bg-dark-300 w-full h-full rounded-md'>
						{(() => {
							if (Content.length > 0) {
								if (Content[0]?.thumbnail && Content[0]?.preview) {
									return (
										<ThumbnailPreview
											backgroundImageSource={Content[0]?.preview || ''}
											posterImageSource={Content[0]?.thumbnail || ''}
											className='rounded-t-md w-full h-full'
											orientation={
												Content[0]?.type === ContentTypeEnum.Video
													? OrientationEnum.Landscape
													: OrientationEnum.Portrait
											}
											totalImages={50}
											useInternalScaling
										/>
									)
								}
								if (Content[1]?.thumbnail && Content[1]?.preview) {
									return (
										<ThumbnailPreview
											backgroundImageSource={Content[1]?.preview || ''}
											posterImageSource={Content[1]?.thumbnail || ''}
											className='rounded-t-md w-full h-full'
											orientation={
												Content[1]?.type === ContentTypeEnum.Video
													? OrientationEnum.Landscape
													: OrientationEnum.Portrait
											}
											totalImages={50}
											useInternalScaling
										/>
									)
								}
								return (
									<IoDocumentTextOutline size={36} className='text-dark-700' />
								)
							}
							return (
								<IoDocumentTextOutline size={36} className='text-dark-700' />
							)
						})()}
					</div>
				</div>
				<div className='flex flex-col p-4 gap-y-2'>
					<Heading textStyle='smallTitle'>{sentenceCase(name)}</Heading>
					<Text textStyle='bodySmall' className='text-dark-title-200 my-1'>
						{`Edited ${
							differenceInMonths(new Date(), new Date(updatedAt)) < 1
								? formatDistance(new Date(updatedAt), new Date(), {
										addSuffix: true,
								  })
								: format(new Date(updatedAt), 'do MMM yyyy')
						}`}
					</Text>
				</div>
				{overflowButtonVisible && (
					<Menu>
						<Menu.Button
							as='button'
							className='absolute top-0 right-0 m-2 bg-dark-100 w-min p-1.5 shadow-md rounded-md cursor-pointer'
							onClick={(e: any) => {
								e.stopPropagation()
							}}
						>
							<FiMoreHorizontal className='text-gray-100' />
						</Menu.Button>
						<Transition
							as={Fragment}
							enter='transition ease-out duration-100'
							enterFrom='transform opacity-0 scale-95'
							enterTo='transform opacity-100 scale-100'
							leave='transition ease-in duration-75'
							leaveFrom='transform opacity-100 scale-100'
							leaveTo='transform opacity-0 scale-95'
						>
							<Menu.Items
								as='ul'
								className='absolute top-10 right-2 bg-dark-400 flex flex-col p-1.5 rounded-md'
							>
								{Content.length > 0 && (
									<Menu.Item
										as='li'
										className={cx(
											'flex items-center hover:bg-dark-100 px-3 py-1.5 rounded-sm text-size-xs gap-x-3'
										)}
										onClick={() => {
											router.push(`/watch/${joinLink}`)
										}}
									>
										<GoLinkExternal size={14} className='text-gray-100' />
										<span className='font-medium text-gray-100 text-sm font-main'>
											Public page
										</span>
									</Menu.Item>
								)}
								<Menu.Item
									as='li'
									className={cx(
										' items-center hover:bg-dark-100 px-3 py-1.5 rounded-sm text-size-xs gap-x-3 hidden',
										{
											'cursor-not-allowed ': ownerSub !== user?.uid,
										}
									)}
									onClick={(e: any) => {
										e.stopPropagation()
										duplicateFlick.mutateAsync({
											flickId: id,
										})
									}}
								>
									<IoCopyOutline size={14} className='text-gray-100' />
									<span className='font-medium text-gray-100 text-sm'>
										Make a copy
									</span>
								</Menu.Item>
								<Menu.Item
									as='li'
									className={cx(
										'flex items-center hover:bg-dark-100 px-3 py-1.5 rounded-sm text-size-xs gap-x-3',
										{
											'cursor-not-allowed ': ownerSub !== user?.uid,
										}
									)}
									onClick={(e: any) => {
										e.stopPropagation()
										if (ownerSub !== user?.uid) return
										if (showDeleteConfirmation) {
											deleteFlickFunction()
										} else {
											setShowDeleteConfirmation(true)
										}
									}}
								>
									<IoTrashOutline
										size={14}
										className={cx('text-gray-100', {
											'text-red-400': showDeleteConfirmation,
										})}
									/>
									<span
										className={cx('font-medium text-gray-100 text-sm', {
											'text-red-400': showDeleteConfirmation,
										})}
									>
										{showDeleteConfirmation ? 'Yes, delete it' : 'Delete'}
									</span>
								</Menu.Item>
							</Menu.Items>
						</Transition>
					</Menu>
				)}
			</div>
		</Link>
	)
}

export default FlickTile
