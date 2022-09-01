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
import axios from 'axios'
import { getAuth } from 'firebase/auth'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Fragment, HTMLAttributes } from 'react'
import { useUser } from 'src/utils/providers/auth'
import { Avatar, Button, emitToast } from 'ui/src'
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
							<Avatar
								src={user?.picture || '/dp_fallback.png'}
								className='rounded-full cursor-pointer w-8 h-8'
								name={user?.displayName ?? ''}
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
