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



import { css, cx } from '@emotion/css'
import { Dialog, Transition } from '@headlessui/react'
import { useRouter } from 'next/router'
import { Fragment, useEffect, useState } from 'react'
import trpc, { inferMutationInput } from 'src/server/trpc'
import { Button, emitToast, Heading, TextField } from 'ui/src'
import { FlickScopeEnum } from 'utils/src/enums'

const defaults = {
	name: '',
	description: '',
	scope: FlickScopeEnum.Public,
}

const CreateFlickModal = ({
	open,
	handleClose,
	seriesId,
	handleRefresh,
}: {
	open: boolean
	handleClose: (refetch?: boolean) => void
	seriesId?: string
	handleRefresh?: () => void
}) => {
	const [details, setDetails] =
		useState<inferMutationInput<'story.create'>>(defaults)

	const {
		mutateAsync: createFlick,
		data,
		isLoading: loading,
	} = trpc.useMutation(['story.create'])

	const { push } = useRouter()

	const handleCreate = async () => {
		try {
			if (seriesId) {
				await createFlick({
					...details,
					seriesId,
				})
			} else {
				await createFlick(details)
			}
		} catch (e) {
			emitToast('Could not create your story.Please try again', {
				type: 'error',
			})
		}
	}

	useEffect(() => {
		if (!data) return
		push(`/story/${data?.id}`)
		handleRefresh?.()
		emitToast('Story created successfully', {
			type: 'success',
		})
	}, [data])

	return (
		<Transition appear show={open} as={Fragment}>
			<Dialog
				className='relative z-50'
				onClose={() => {
					setDetails(defaults)
					handleClose(!!data)
				}}
			>
				<Transition.Child
					as={Fragment}
					enter='ease-out duration-300'
					enterFrom='opacity-0'
					enterTo='opacity-100'
					leave='ease-in duration-200'
					leaveFrom='opacity-100'
					leaveTo='opacity-0'
				>
					<div className='fixed inset-0 bg-black/60' aria-hidden='true' />
				</Transition.Child>
				<div className='fixed inset-0 flex items-center justify-center p-4'>
					<Transition.Child
						as={Fragment}
						enter='ease-out duration-300'
						enterFrom='opacity-0 scale-95'
						enterTo='opacity-100 scale-100'
						leave='ease-in duration-200'
						leaveFrom='opacity-100 scale-100'
						leaveTo='opacity-0 scale-95'
					>
						<Dialog.Panel className='flex rounded-md flex-col max-w-[600px] w-full overflow-hidden bg-dark-100 p-4'>
							<div
								className={cx(
									'flex flex-col w-full',
									css`
										height: 50vh;
									`
								)}
							>
								<Heading className='py-2 text-gray-100' textStyle='mediumTitle'>
									Let&apos;s create a story
								</Heading>

								<TextField
									label='Name your story'
									value={details.name}
									onChange={e => {
										setDetails({ ...details, name: e.currentTarget.value })
									}}
									placeholder='Flick name'
									className='w-full border-none py-3 mt-1.5 focus:outline-none text-gray-100 text-sm'
								/>
								<span className='mt-4 text-size-xs font-bold tracking-wide text-gray-100 font-main'>
									Describe your story
								</span>
								<textarea
									value={details.description ?? ''}
									onChange={e =>
										setDetails({
											...details,
											description: e.currentTarget.value,
										})
									}
									placeholder='Description (optional)'
									className='w-full bg-dark-400 border focus:bg-dark-300 border-transparent rounded-md py-3 px-3 mt-1.5 focus:ring-0 focus:border-green-600 text-gray-100 text-size-sm flex-1 resize-none'
								/>
								<Button
									className='mt-6 w-full max-w-none'
									size='large'
									loading={loading}
									disabled={!details.name || !!data}
									onClick={() => {
										if (!details.name) return
										handleCreate()
									}}
								>
									{data ? 'Redirecting you to studio...' : 'Create'}
								</Button>
							</div>
						</Dialog.Panel>
					</Transition.Child>
				</div>
			</Dialog>
		</Transition>
	)
}

export default CreateFlickModal
