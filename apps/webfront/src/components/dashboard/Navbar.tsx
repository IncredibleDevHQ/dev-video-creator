import { cx } from '@emotion/css'
import { Menu } from '@headlessui/react'
import axios from 'axios'
import { getAuth } from 'firebase/auth'
import Image from 'next/image'
import Link from 'next/link'
import { HTMLAttributes } from 'react'
import usePush from 'src/utils/hooks/usePush'
import useReplace from 'src/utils/hooks/useReplace'
import { useUser } from 'src/utils/providers/auth'
import { emitToast } from 'ui/src'

const Navbar = ({ className }: HTMLAttributes<HTMLDivElement>) => {
	const { user } = useUser()
	const replace = useReplace()
	const push = usePush()

	const handleSignOut = async () => {
		try {
			await axios.post(
				'/api/logout',
				{},
				{
					withCredentials: true,
				}
			)
			await getAuth().signOut()
			replace('/login')
		} catch (e) {
			emitToast('Could not sign you out', {
				type: 'error',
			})
		}
	}

	return (
		<nav
			className={cx(
				'sticky top-0 flex justify-between items-center px-5 py-3.5 w-full bg-dark-500 z-50',
				className
			)}
		>
			<Link href='/'>
				<Image
					src='/logo.svg'
					alt='incredible.dev'
					height={30}
					width={140}
					className='cursor-pointer'
				/>
			</Link>
			<div className='flex items-center justify-center gap-x-6'>
				<Menu>
					<Menu.Button>
						<Image
							src={user?.picture || '/dp_fallback.png'}
							className='rounded-full cursor-pointer'
							width={30}
							height={30}
						/>
					</Menu.Button>
					<Menu.Items
						as='ul'
						className='bg-dark-200 rounded-sm absolute mt-14 mr-5 top-0 right-0 min-w-[150px] p-1.5 text-dark-title'
					>
						<Menu.Item
							as='li'
							className='py-2 px-3 cursor-pointer rounded-sm hover:bg-dark-100 font-main text-size-sm'
							onClick={() => {
								push(`/${user?.username}`)
							}}
						>
							Profile
						</Menu.Item>
						<Menu.Item
							as='li'
							className='py-2 px-3 cursor-pointer rounded-sm hover:bg-dark-100 font-main text-size-sm'
							onClick={() => {
								push(`/settings`)
							}}
						>
							Settings
						</Menu.Item>
						<div className='border-t my-1 border-gray-500' />
						<Menu.Item
							as='li'
							className='py-2 px-3 cursor-pointer rounded-sm hover:bg-dark-100 font-main text-size-sm text-red-700'
							onClick={() => {
								handleSignOut()
							}}
						>
							Sign out
						</Menu.Item>
					</Menu.Items>
				</Menu>
				{/* <Notifications /> */}
			</div>
		</nav>
	)
}

export default Navbar
