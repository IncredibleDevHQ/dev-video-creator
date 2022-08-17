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
import OnBoarding from 'src/components/onboarding/OnBoarding'
import requireAuth from 'src/utils/helpers/requireAuth'
import { useUser } from 'src/utils/providers/auth'
import { ScreenState } from 'ui/src'

const OnboardingPage = () => {
	const { user, loadingUser } = useUser()
	const router = useRouter()

	useEffect(() => {
		if (user && user.onboarded) {
			router.push('/dashboard')
		}
	}, [user])

	if (!user || loadingUser) {
		return <ScreenState title='Loading' />
	}

	return user && user.onboarded ? (
		<ScreenState title='Redirecting you to dashboard' />
	) : (
		<OnBoarding />
	)
}

export const getServerSideProps = requireAuth()(async () => ({
	props: {},
}))

export default OnboardingPage
