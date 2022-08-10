import { cx } from '@emotion/css'
import { Menu, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { BiCheck } from 'react-icons/bi'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import { flickAtom } from 'src/stores/flick.store'
import { activeBrandIdAtom, brandingAtom } from 'src/stores/studio.store'
import {
	RoomEventTypes,
	useBroadcastEvent,
	useEventListener,
} from 'src/utils/liveblocks.config'
import BrandIcon from 'svg/BrandIcon.svg'
import { Button, Text } from 'ui/src'
import trpc from '../../../server/trpc'
import Branding from '../branding/Branding'

const Brand = () => {
	const flickId = useRecoilValue(flickAtom)?.id
	const { data } = trpc.useQuery(['user.brands'])

	const [activeBrandId, setActiveBrandId] = useRecoilState(activeBrandIdAtom)
	const setBrandingJSON = useSetRecoilState(brandingAtom)

	const { mutateAsync: updateBrand } = trpc.useMutation(['story.updateBrand'])
	const broadcast = useBroadcastEvent()

	const [brandingModal, setBrandingModal] = useState(false)

	useEventListener(({ event }) => {
		if (event.type === RoomEventTypes.BrandingChanged) {
			if (event.payload) {
				setActiveBrandId(event.payload.id)
				setBrandingJSON(event.payload.branding)
			} else {
				setActiveBrandId(null)
				setBrandingJSON({})
			}
		}
	})

	return (
		<>
			<Menu>
				{({ open }) => (
					<div>
						<Menu.Button
							className={cx(
								'text-gray-100 flex items-center gap-x-2 text-size-xs hover:bg-white/10 px-2 py-2 rounded-sm transform active:scale-95 transition-all font-main font-semibold',
								{
									'bg-white/10': open,
								}
							)}
						>
							<BrandIcon />
							Brand
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
								className='absolute flex flex-col text-left bg-dark-300 bg-opacity-100 z-50 rounded-sm p-1.5 mt-2.5 min-w-[190px]'
							>
								{data?.map(branding => (
									<Menu.Item
										as='li'
										key={branding.id}
										className={cx(
											'hover:bg-dark-100 cursor-pointer text-white flex items-center px-2 py-2 rounded-sm w-full'
										)}
										onClick={() => {
											broadcast({
												type: RoomEventTypes.BrandingChanged,
												payload: branding,
											})
											updateBrand({
												id: flickId ?? '',
												useBranding: true,
												brandingId: branding.id,
											})
											setActiveBrandId(branding.id)
											setBrandingJSON(
												JSON.parse(JSON.stringify(branding.branding))
											)
										}}
									>
										<BrandIcon className='mr-2' />
										<Text textStyle='caption' className='mr-4'>
											{branding.name}
										</Text>
										{branding.id === activeBrandId && (
											<BiCheck className='ml-auto' size={16} />
										)}
									</Menu.Item>
								))}
								<Menu.Item
									as='li'
									className={cx(
										'hover:bg-dark-100 cursor-pointer text-white flex items-center px-2 py-2 rounded-sm w-full'
									)}
									onClick={() => {
										broadcast({
											type: RoomEventTypes.BrandingChanged,
											payload: null,
										})
										updateBrand({
											id: flickId ?? '',
											useBranding: false,
											brandingId: null,
										})
										setActiveBrandId(null)
										setBrandingJSON({})
									}}
								>
									<BrandIcon className='mr-2' />
									<Text textStyle='caption' className='mr-4'>
										None
									</Text>
									{activeBrandId === null && (
										<BiCheck className='ml-auto' size={16} />
									)}
								</Menu.Item>
								{data && data.length > 0 && (
									<div className='border-t border-gray-600 mx-2 mt-1.5' />
								)}
								<Menu.Item as={Fragment}>
									<Button
										className='m-2 max-w-none'
										colorScheme='dark'
										onClick={() => {
											setBrandingModal(true)
										}}
									>
										Add new
									</Button>
								</Menu.Item>
							</Menu.Items>
						</Transition>
					</div>
				)}
			</Menu>
			{brandingModal && (
				<Branding
					open={brandingModal}
					handleClose={() => setBrandingModal(false)}
				/>
			)}
		</>
	)
}

export default Brand
