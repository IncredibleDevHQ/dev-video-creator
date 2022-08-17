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

import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Container from 'src/components/core/Container'
import CookieBanner from 'src/components/core/CookieBanner'
import CoreLayout from 'src/components/core/CoreLayout'
import Hero from 'src/components/core/Hero'
import { useUser } from 'src/utils/providers/auth'

const Web = () => {
	const { user, loadingUser } = useUser()
	const { replace } = useRouter()

	useEffect(() => {
		if (!loadingUser && user) {
			if (user.onboarded) {
				replace('/dashboard')
			} else {
				replace('/onboarding')
			}
		}
	}, [user, loadingUser, replace])

	return (
		<Container>
			<CoreLayout>
				<div className='lines'>
					<div className='line' />
					<div className='line' />
					<div className='line' />
					<div className='line' />
					<div className='line' />
				</div>
				<Hero />
			</CoreLayout>
			<CookieBanner />
		</Container>
	)
}

export default Web
