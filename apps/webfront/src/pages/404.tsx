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

import Link from 'next/link'
import { useEffect } from 'react'
import Container from 'src/components/core/Container'
import CoreLayout from 'src/components/core/CoreLayout'
import usePush from 'src/utils/hooks/usePush'
import { useUser } from 'src/utils/providers/auth'
import NotFound from 'svg/404.svg'

const FourOhFour = () => {
	const push = usePush()
	const { user } = useUser()

	useEffect(() => {
		if (user) {
			if (user.onboarded) push('/dashboard')
			else push('/onboarding')
		}
	}, [user, push])

	return (
		<Container title='404 - Incredible'>
			<CoreLayout>
				<div className='flex flex-row items-center justify-center h-screen px-2 md:px-0 relative'>
					<div className='flex flex-col space-y-16'>
						<NotFound />
						<div className='text-center'>
							<p className='mb-2 text-3xl font-bold text-white font-main'>
								Uh-oh, page not found
							</p>
							<p className='mb-6 text-base font-normal text-dark-title-200 font-body'>
								Sorry, this page doesn’t exist or it was removed
							</p>

							<Link href='/' passHref>
								<div className='px-5 py-3 text-base font-semibold text-white rounded cursor-pointer font-main bg-green-600 transition-all transform active:scale-95'>
									Go home
								</div>
							</Link>
						</div>
					</div>
				</div>
			</CoreLayout>
		</Container>
	)
}

export default FourOhFour
