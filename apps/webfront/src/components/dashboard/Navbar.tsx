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

import { cx } from '@emotion/css'
import { Menu, Transition } from '@headlessui/react'
import axios from 'axios'
import { getAuth } from 'firebase/auth'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Fragment, HTMLAttributes } from 'react'
import { useUser } from 'src/utils/providers/auth'
import { Button, emitToast } from 'ui/src'
import Notifications from '../notifications/Notifications'

const Navbar = ({ className }: HTMLAttributes<HTMLDivElement>) => {
	const { user, loadingUser } = useUser()
	const { push, replace } = useRouter()

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
				'sticky top-0 flex justify-between items-center px-5 py-3 w-full bg-dark-500 z-[100] h-[60px]',
				className
			)}
		>
			<Link href='/'>
				<span className='flex items-center'>
					<Image
						src='/logo.svg'
						alt='incredible.dev'
						height={30}
						width={145}
						className='cursor-pointer'
					/>
				</span>
			</Link>
			{!user && !loadingUser && (
				<Button
					onClick={() => {
						push(`/login/?redirect=${encodeURIComponent(window.location.href)}`)
					}}
				>
					Sign in
				</Button>
			)}
			{user && (
				<div className='flex items-center gap-x-6'>
					<Notifications />
					<Menu>
						<Menu.Button as='button' className='flex items-center'>
							<Image
								src={user?.picture || '/dp_fallback.png'}
								className='rounded-full cursor-pointer'
								width={35}
								height={35}
							/>
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
								className='bg-dark-200 rounded-md absolute mt-14 mr-5 top-0 right-0 min-w-[150px] p-1.5 text-dark-title'
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
						</Transition>
					</Menu>
				</div>
			)}
		</nav>
	)
}

export default Navbar
