import { Dialog, Menu, Transition } from '@headlessui/react'
import { LiveMap, LiveObject } from '@liveblocks/client'
import { Fragment, useEffect, useState } from 'react'
import { HiOutlineBan, HiOutlineSparkles } from 'react-icons/hi'
import {
	IoAddOutline,
	IoChevronDownOutline,
	IoChevronUpOutline,
	IoMenuOutline,
	IoPlayOutline,
	IoTrashOutline,
} from 'react-icons/io5'
import { MdOutlinePresentToAll } from 'react-icons/md'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import {
	Fragment_Type_Enum_Enum,
	useAddFragmentMutation,
	useDeleteFragmentMutation,
	useGetFlickFragmentLazyQuery,
	useUpdateFragmentNameMutation,
} from 'src/graphql/generated'
import {
	activeFragmentIdAtom,
	activeFragmentSelector,
	flickAtom,
	fragmentLoadingAtom,
	fragmentsAtom,
	participantsAtom,
} from 'src/stores/flick.store'
import { useMap } from 'src/utils/liveblocks.config'
import { useUser } from 'src/utils/providers/auth'
import { Button, emitToast, Heading, Loader } from 'ui/src'
import { useDebouncedCallback } from 'use-debounce'
import { BlockProperties, LiveViewConfig } from 'utils/src'

const CreateFormat = ({
	open,
	availableFormats,
	handleClose,
}: {
	open: boolean
	availableFormats: Fragment_Type_Enum_Enum[] | undefined
	handleClose: () => void
}) => {
	const id = useRecoilValue(flickAtom)?.id

	const [creatingFragment, setCreatingFragment] = useState(false)
	const setFragments = useSetRecoilState(fragmentsAtom)
	const setActiveFragmentId = useSetRecoilState(activeFragmentIdAtom)
	const setFragmentLoading = useSetRecoilState(fragmentLoadingAtom)

	const participants = useRecoilValue(participantsAtom)
	const { user } = useUser()

	const config = useMap('viewConfig')

	const [getNewFragment] = useGetFlickFragmentLazyQuery({
		fetchPolicy: 'no-cache',
		onCompleted(data) {
			const newFragment = data?.Fragment_by_pk

			if (!newFragment) return

			/* NOTE: Updating view config; Server side doesn't work */
			const { editorState } = newFragment
			const introBlockId = editorState?.blocks?.find(
				(b: any) => b.type === 'introBlock'
			)?.id
			const outroBlockId = editorState?.blocks?.find(
				(b: any) => b.type === 'outroBlock'
			)?.id

			const blocks: {
				[key: string]: BlockProperties
			} = {
				[introBlockId]: {
					layout: 'classic',
					view: {
						type: 'introBlock',
						intro: {
							order: [
								{ enabled: true, state: 'userMedia' },
								{ enabled: true, state: 'titleSplash' },
							],
						},
					},
				},
				[outroBlockId]: {
					layout: 'classic',
					view: {
						type: 'outroBlock',
						outro: {
							order: [{ enabled: true, state: 'titleSplash' }],
						},
					},
				},
			}

			const liveBlocks = new LiveMap<string, BlockProperties>()
			Object.entries(blocks).forEach(([blockId, value]) => {
				liveBlocks.set(blockId, value)
			})

			const fragmentViewConfig: LiveViewConfig = {
				selectedBlocks: [],
				continuousRecording: false,
				mode: newFragment.type as any,
				speakers: participants.filter(p => p.userSub === user?.uid),
				blocks: liveBlocks,
			}

			config?.set(newFragment.id, new LiveObject(fragmentViewConfig))

			setFragments(curr => [...curr, newFragment])

			emitToast('New format created', {
				type: 'success',
			})

			setCreatingFragment(false)
			setFragmentLoading(true)
			handleClose()

			setActiveFragmentId(newFragment.id)
		},
	})

	const [createFragment] = useAddFragmentMutation({
		onError(error) {
			emitToast(`Could not create new format ${error.message}`, {
				type: 'error',
			})
			setCreatingFragment(false)
		},
		onCompleted(data) {
			const createFragmentResult = data?.CreateFragment

			if (!createFragmentResult) return

			getNewFragment({
				variables: {
					id: createFragmentResult.fragmentId,
				},
			})
		},
	})

	if (!availableFormats) return null

	return (
		<Transition appear show={open} as={Fragment}>
			<Dialog onClose={handleClose} className='relative z-50'>
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
						<Dialog.Panel className='flex rounded-md flex-col h-[250px] min-w-[400px] bg-dark-400 text-gray-50 text-xs font-body p-3 px-8 overflow-hidden items-center'>
							{creatingFragment ? (
								<div className='flex flex-col gap-y-8 w-full h-full items-center justify-center'>
									<Loader className='w-12 h-12' />
									Creating format
								</div>
							) : (
								<>
									<Heading textStyle='mediumTitle' className='my-6'>
										Choose a format
									</Heading>
									<div className='flex items-center gap-x-6'>
										{[
											Fragment_Type_Enum_Enum.Landscape,
											Fragment_Type_Enum_Enum.Portrait,
											// Fragment_Type_Enum_Enum.Presentation,
											// Fragment_Type_Enum_Enum.Blog,
										].map(format => (
											<button
												key={format}
												disabled={!availableFormats.includes(format)}
												onClick={() => {
													setCreatingFragment(true)
													createFragment({
														variables: {
															flickId: id,
															name: 'Untitled',
															type: format as any,
														},
													})
												}}
												type='button'
												className='flex flex-col relative items-center justify-center gap-y-4 w-32 h-32 bg-dark-200 disabled:bg-dark-300 disabled:cursor-not-allowed rounded-md hover:bg-dark-100 active:scale-95 disabled:scale-100 transition-all'
											>
												{(() => {
													switch (format) {
														case Fragment_Type_Enum_Enum.Landscape:
															return <IoPlayOutline size={24} />
														case Fragment_Type_Enum_Enum.Portrait:
															return <HiOutlineSparkles size={24} />
														case Fragment_Type_Enum_Enum.Blog:
															return <IoMenuOutline size={24} />
														case Fragment_Type_Enum_Enum.Presentation:
															return <MdOutlinePresentToAll size={24} />
														default:
															return null
													}
												})()}
												<span className='text-size-xs'>
													{format}{' '}
													{format === Fragment_Type_Enum_Enum.Blog ||
													format === Fragment_Type_Enum_Enum.Presentation
														? ''
														: 'video'}
												</span>
												{!availableFormats.includes(format) && (
													<HiOutlineBan className='absolute text-gray-100/10 w-full h-full p-4 z-10' />
												)}
											</button>
										))}
									</div>
								</>
							)}
						</Dialog.Panel>
					</Transition.Child>
				</div>
			</Dialog>
		</Transition>
	)
}

const FormatSelector = () => {
	const [isCreateOpen, setIsCreateOpen] = useState(false)

	const [fragments, setFragments] = useRecoilState(fragmentsAtom)

	const [activeFragmentId, setActiveFragmentId] =
		useRecoilState(activeFragmentIdAtom)

	const [activeFragment, setActiveFragment] = useRecoilState(
		activeFragmentSelector
	)

	const setFragmentLoading = useSetRecoilState(fragmentLoadingAtom)

	const [availableFormats, setAvailableFormats] =
		useState<Fragment_Type_Enum_Enum[]>()

	useEffect(() => {
		const formats = [
			Fragment_Type_Enum_Enum.Landscape,
			Fragment_Type_Enum_Enum.Portrait,
			// Fragment_Type_Enum_Enum.Presentation,
			// Fragment_Type_Enum_Enum.Blog,
		].filter(type => {
			if (
				type === Fragment_Type_Enum_Enum.Landscape &&
				fragments.some(fragment => fragment.type === type || !fragment.type)
			) {
				return false
			}
			if (
				type === Fragment_Type_Enum_Enum.Blog &&
				fragments.some(fragment => fragment.type === type)
			) {
				return false
			}
			if (
				type === Fragment_Type_Enum_Enum.Presentation &&
				fragments.some(fragment => fragment.type === type)
			) {
				return false
			}

			return true
		})
		setAvailableFormats(formats)
	}, [fragments])

	const [updateFragmentName] = useUpdateFragmentNameMutation()

	const debounceUpdateFlickName = useDebouncedCallback(value => {
		updateFragmentName({
			variables: {
				name: value,
				id: activeFragmentId,
			},
		})
	}, 1000)

	const changeFormatTitle = (title: string) => {
		if (!activeFragment) return
		debounceUpdateFlickName(title)
		setActiveFragment({
			...activeFragment,
			name: title,
		})
	}

	const viewConfigLiveMap = useMap('viewConfig')
	const [deleteFragment] = useDeleteFragmentMutation({
		update(_, { data: updateDeleteFragmentData, errors }) {
			const deletedFragmentId =
				updateDeleteFragmentData?.delete_Fragment_by_pk?.id

			if (errors) {
				emitToast('Could not delete format', {
					type: 'error',
				})
			}

			if (!deletedFragmentId) return
			emitToast('Format deleted', {
				type: 'success',
			})

			const newFragments = fragments.filter(
				fragment => fragment.id !== deletedFragmentId
			)

			setFragments(newFragments)
			if (newFragments.length > 0 && deletedFragmentId === activeFragmentId)
				setActiveFragmentId(newFragments[0].id)

			if (newFragments.length === 0) setActiveFragmentId(null)
			viewConfigLiveMap?.delete(deletedFragmentId)
		},
	})

	return (
		<>
			{isCreateOpen && (
				<CreateFormat
					availableFormats={availableFormats}
					open={isCreateOpen}
					handleClose={() => setIsCreateOpen(false)}
				/>
			)}
			{fragments && fragments.length === 0 && (
				<Button
					type='button'
					leftIcon={<IoAddOutline />}
					onClick={() => {
						setIsCreateOpen(true)
					}}
				>
					Create format
				</Button>
			)}
			{fragments && fragments.length > 0 && (
				<Menu as='div' className='relative'>
					{({ open }) => (
						<>
							<Menu.Button className='flex gap-x-4 text-left items-center rounded-sm bg-dark-100 shadow-sm py-1.5 px-3 pr-8 relative text-size-xs text-dark-title'>
								Format:
								<div className='flex items-center gap-x-1'>
									{(() => {
										switch (activeFragment?.type) {
											case Fragment_Type_Enum_Enum.Landscape:
												return <IoPlayOutline />
											case Fragment_Type_Enum_Enum.Portrait:
												return <HiOutlineSparkles />
											case Fragment_Type_Enum_Enum.Blog:
												return <IoMenuOutline />
											case Fragment_Type_Enum_Enum.Presentation:
												return <MdOutlinePresentToAll />
											default:
												return <IoPlayOutline />
										}
									})()}

									<input
										onChange={e => {
											changeFormatTitle(e.target.value)
										}}
										onClick={e => e.stopPropagation()}
										onKeyDown={e => e.stopPropagation()}
										value={activeFragment?.name || ''}
										className='w-16 focus:w-32 truncate bg-transparent border border-transparent hover:border-gray-600 focus:outline-none focus:border-gray-600 transition-all'
									/>
								</div>
								<span className='absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none'>
									{open ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
								</span>
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
									className='absolute flex flex-col text-left bg-dark-300 bg-opacity-100 z-50 rounded-sm p-1.5 mt-2.5 w-full'
								>
									{fragments.map(fragment => (
										<Menu.Item
											key={fragment.id}
											as='li'
											onClick={() => {
												if (activeFragmentId === fragment.id) return
												setFragmentLoading(true)
												setActiveFragmentId(fragment.id)
											}}
											className='hover:bg-dark-100 text-size-xs cursor-pointer text-dark-title flex items-center pl-2.5 pr-1 py-1 rounded-sm w-full justify-between'
										>
											<div className='flex items-center gap-x-1'>
												{(() => {
													switch (fragment?.type) {
														case Fragment_Type_Enum_Enum.Landscape:
															return <IoPlayOutline />
														case Fragment_Type_Enum_Enum.Portrait:
															return <HiOutlineSparkles />
														case Fragment_Type_Enum_Enum.Blog:
															return <IoMenuOutline />
														case Fragment_Type_Enum_Enum.Presentation:
															return <MdOutlinePresentToAll />
														default:
															return <IoPlayOutline />
													}
												})()}
												{fragment.name}
											</div>
											<button
												type='button'
												className='p-1 hover:bg-white/10 rounded-sm active:scale-95 transition-all'
												onClick={e => {
													e.stopPropagation()
													deleteFragment({
														variables: {
															id: fragment.id,
														},
													})
												}}
											>
												<IoTrashOutline
													className='flex-shrink-0 text-red-500'
													size={14}
												/>
											</button>
										</Menu.Item>
									))}
									<div className='border-t border-gray-600 mx-2 mt-1.5' />

									<Button
										colorScheme='dark'
										className='max-w-none m-2'
										type='button'
										leftIcon={<IoAddOutline />}
										onClick={() => {
											setIsCreateOpen(true)
										}}
									>
										Create new
									</Button>
								</Menu.Items>
							</Transition>
						</>
					)}
				</Menu>
			)}
		</>
	)
}

export default FormatSelector
