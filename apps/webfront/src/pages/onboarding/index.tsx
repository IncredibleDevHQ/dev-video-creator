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
