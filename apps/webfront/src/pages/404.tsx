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
