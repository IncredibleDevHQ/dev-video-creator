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
