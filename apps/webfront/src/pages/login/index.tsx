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

import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import NextLink from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { IoLogoGoogle } from 'react-icons/io5'
import Container from 'src/components/core/Container'
import useReplace from 'src/utils/hooks/useReplace'
import { useUser } from 'src/utils/providers/auth'
import Logo from 'svg/Logo.svg'
import { Button, Heading, ScreenState, Text } from 'ui/src'

const LoginPage = () => {
	const { query } = useRouter()
	const replace = useReplace()
	const { user, loadingUser } = useUser()

	useEffect(() => {
		if (user) {
			if (user.onboarded) {
				if (query.continue && typeof query.continue === 'string') {
					replace(query.continue)
					return
				}
				replace('/dashboard')
			} else {
				replace('/onboarding')
			}
		}
	}, [user, replace, query])

	if (loadingUser || user) return <ScreenState title='Checking session' />

	return (
		<Container title='Incredible | Login'>
			<div className='relative flex flex-col items-center h-screen'>
				<div className='m-4 absolute top-0 left-0'>
					<NextLink href='/'>
						<Logo />
					</NextLink>
				</div>
				<div className='flex justify-center items-center w-full px-6 md:px-0 md:w-[520px]  h-screen'>
					<div className='flex flex-col'>
						<Heading
							textStyle='heading'
							className='text-dark-title font-bold sm:text-[40px] sm:leading-[50px]'
						>
							Create developer content in record time
						</Heading>
						<Text textStyle='body' className='mt-4 text-dark-title-200'>
							Create developer content in record time for multiple distribution
							channels and grow your community!
						</Text>

						<Button
							className='max-w-none mt-8 text-size-md py-2.5'
							size='large'
							leftIcon={<IoLogoGoogle />}
							onClick={async () => {
								const provider = new GoogleAuthProvider()
								await signInWithPopup(getAuth(), provider)
							}}
						>
							Sign In
						</Button>
					</div>
				</div>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src='pattern.svg'
					alt='Incredible'
					className='absolute bottom-0 right-0 h-36 sm:h-auto'
				/>
			</div>
		</Container>
	)
}

export default LoginPage
